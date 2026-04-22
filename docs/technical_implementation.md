# CA Practice OS — Technical Implementation Document

**Version:** 1.0 | **Date:** 2026-03-27
**Stack:** SvelteKit · NestJS · PostgreSQL (Prisma) · Redis · S3
**MVP Target:** ~50 firms, 5–50 users/firm

---

## Part 1: Technical Implementation Document

### 1. System Architecture & Strategy

#### 1.1 Backend — NestJS Service Map

| Module | Responsibility | Sync/Async |
|---|---|---|
| `AuthModule` | Login, JWT issue/refresh, session management, logout | Sync |
| `UserModule` | User CRUD, role management, deactivation events | Sync |
| `FirmModule` | Firm CRUD, settings management | Sync |
| `ClientModule` | Client CRUD, GST numbers, custom field definitions | Sync |
| `EngagementModule` | Engagement CRUD, lifecycle (complete/cancel cascade) | Sync |
| `TaskModule` | Task CRUD, status machine, checklists, dependencies, comments, activity log | Sync (status transitions emit async events) |
| `ComplianceModule` | Statutory deadlines, overrides, client assignments, calendar entries | Sync |
| `DocumentModule` | Upload (pre-signed URL), download, versioning, document requests, checklists | Sync (S3 operations); Async (retention cleanup) |
| `CredentialModule` | Credential CRUD with AES-256-GCM encryption, access logging | Sync |
| `DscModule` | DSC record CRUD, expiry tracking | Sync |
| `TeamModule` | Leave records, workload computation, approval queue | Sync |
| `NotificationModule` | In-app CRUD, email dispatch via BullMQ | Async (email delivery, retry) |
| `CronModule` | 8 daily jobs via BullMQ scheduled repeatable jobs | Async |
| `ActionLogModule` | NestJS interceptor — logs every mutating request to `user_action_log` | Async (fire-and-forget insert) |
| `ClientUploadModule` | Public token-based upload endpoint for client document requests | Sync |

**Async reasoning:**
- Email delivery is async because SMTP calls are 200-2000ms and must not block API responses
- Notification fanout (one event → multiple recipients × channels) is async via BullMQ
- Cron jobs are async by nature — long-running scans must not block the API process
- Action logging is fire-and-forget: a failed log insert must never fail the user's request

**Caching strategy (V1 — minimal):**
- No application-level cache. Redis is used only for sessions and BullMQ.
- Statutory deadlines (global seed data, rarely changes) are candidates for in-memory cache with TTL, but not required at MVP scale.
- Workload view computed on request — no cache.

#### 1.2 Database — Entity Relationship Overview

```
firms (root tenant)
├── users ← sessions
│   └── leave_records
├── clients
│   ├── client_gst_numbers
│   ├── credential_locker_entries → credential_access_log
│   └── dsc_records
├── client_custom_field_definitions
├── engagement_types
│   ├── engagement_custom_field_definitions
│   └── task_templates → task_template_items
├── engagements
│   ├── tasks
│   │   ├── task_checklists
│   │   ├── task_dependencies
│   │   ├── task_comments
│   │   └── task_activity_log
│   └── document_checklist_instances → document_checklist_instance_items
├── documents
├── document_requests
├── statutory_deadlines (global, no firm_id)
│   └── statutory_deadline_overrides
├── client_compliance_assignments
├── compliance_calendar_entries
├── notifications
└── user_action_log
```

**Key composite indexes:**

| Table | Index | Purpose |
|---|---|---|
| `tasks` | `(firm_id, assignee_id, status)` | Workload view, my-tasks query |
| `tasks` | `(firm_id, status, due_date)` | Overdue detection cron |
| `tasks` | `(firm_id, engagement_id, status)` | Engagement detail: task list |
| `tasks` | `(firm_id, client_id, status)` | Client detail: task list |
| `tasks` | `(firm_id, client_id, statutory_deadline_id, deleted_at)` | Dedup check in auto task generation |
| `notifications` | `(firm_id, recipient_id, status, created_at DESC)` | Notification bell query |
| `user_action_log` | `(firm_id, occurred_at DESC)` | Audit log page |
| `user_action_log` | `(firm_id, entity_type, entity_id)` | Entity history lookup |
| `compliance_calendar_entries` | `(firm_id, due_date, status)` | Calendar view |
| `documents` | `(firm_id, client_id, deleted_at)` | Client document listing |
| `credential_access_log` | `(firm_id, credential_id, accessed_at DESC)` | Access history |

**Data lifecycle:**
- All user-facing entities: soft delete (`deleted_at`). Hard-deleted after 30 days by cron 13.8.
- Documents in S3: hard-deleted at `retention_expires_at` (1 year) by cron 13.7, or when soft-delete ages past 30 days.
- `user_action_log`, `task_activity_log`, `credential_access_log`: immutable, no deletes. Archival strategy deferred to scalability roadmap.

#### 1.3 Frontend — SvelteKit Architecture

**Route structure:**
```
(auth)/
  login
  register
(app)/                          ← authenticated layout, sidebar + topbar
  dashboard
  clients/
    [clientId]/
      engagements/
        [engagementId]/
  engagements/
    [engagementId]/
  tasks/
    [taskId]/
  compliance/
  documents/
  credentials/                  ← client-scoped, accessed from client detail
  dsc/
  team/
    workload
    leave
    approval-queue
  settings/
    firm
    users
    audit-log
  recently-deleted
(public)/
  upload/[token]                ← client document upload portal
```

**State management:**
- Server state: SvelteKit `load` functions for all data fetching. No client-side SWR/tanstack-query — the server load + form actions pattern is sufficient at MVP.
- Client state: Svelte stores for UI-only state (sidebar collapsed, modal open, active filters, notification count).
- Auth state: JWT stored in memory (access token), refresh token in HTTP-only cookie. SvelteKit hooks handle refresh on server-side loads.

**Optimistic UI updates:**
| Action | Optimistic behavior | Rollback on failure |
|---|---|---|
| Toggle checklist item | Immediately show checked/unchecked | Revert checkbox, show toast error |
| Post comment | Append to list immediately with "sending" indicator | Remove comment, show toast |
| Task status transition | Update status pill immediately | Revert to previous status, show toast with reason |
| Mark notification as read | Remove from unread list immediately | Restore to unread, silent |

#### 1.4 Security

**Auth flow:**
1. Login: `POST /api/auth/login` → returns `{ accessToken, user }` + sets `refreshToken` as HTTP-only, Secure, SameSite=Strict cookie
2. Access token: 15-min expiry, sent as `Authorization: Bearer <token>`
3. Refresh: `POST /api/auth/refresh` (cookie-based) → new access token + rotated refresh token
4. Logout: `POST /api/auth/logout` → deletes session row, clears cookie
5. Session limit: 5 concurrent. On 6th login, oldest session evicted.

**Rate limiting (per user unless noted):**

| Endpoint | Limit | Scope |
|---|---|---|
| `POST /api/auth/login` | 5 req/min | Per IP |
| `POST /api/auth/register` | 3 req/min | Per IP |
| `POST /api/documents/upload-url` | 10 req/min | Per user |
| `POST /api/upload/:token` (public) | 5 req/min | Per IP |
| All other authenticated endpoints | 120 req/min | Per user |

**PII handling:**
- `password_hash`: bcrypt cost 12, never returned in any response
- `password_encrypted` (credentials): AES-256-GCM, key via env var (KMS in prod). Never in list endpoints. Single-fetch only with access check + audit log.
- `user_action_log.ip_address`, `sessions.ip_address`: PII, excluded from any client-facing endpoint. Admin-only via audit log.

**Multi-tenancy enforcement:**
- Prisma `$extends` client extension: injects `WHERE firm_id = ?` on every query automatically
- `FirmScopedService` base class: all service methods receive `firmId` from the authenticated JWT context via `AsyncLocalStorage`
- No raw SQL permitted — all queries go through Prisma client

---

### 2. API Contracts

#### 2.1 Auth

```
POST /api/auth/register
Auth: public
Rate: 3/min per IP

Request:
{
  "firm_name": string,           // 1-200 chars, required
  "email": string,               // valid email, required
  "password": string,            // min 8 chars, required
  "full_name": string,           // 2-100 chars, required
  "phone": string | null         // E.164 format
}

Response 201:
{
  "access_token": string,
  "user": { id, email, full_name, role, firm_id },
  "firm": { id, name, display_name }
}
// Sets HttpOnly refresh_token cookie

Error codes:
  400 – Validation failed (details in body)
  409 – Email already registered
  429 – Rate limit exceeded
```

```
POST /api/auth/login
Auth: public
Rate: 5/min per IP

Request:
{
  "email": string,
  "password": string
}

Response 200:
{
  "access_token": string,
  "user": { id, email, full_name, role, firm_id, avatar_url, notification_preferences }
}
// Sets HttpOnly refresh_token cookie

Error codes:
  401 – Invalid credentials
  403 – Account deactivated
  429 – Rate limit exceeded
```

```
POST /api/auth/refresh
Auth: refresh_token cookie
Rate: 30/min per user

Response 200:
{
  "access_token": string
}
// Rotates refresh_token cookie

Error codes:
  401 – Invalid or expired refresh token
```

```
POST /api/auth/logout
Auth: Bearer token

Response 204 (no content)
// Clears refresh_token cookie, deletes session row
```

```
GET /api/auth/me
Auth: Bearer token

Response 200:
{
  "user": { id, email, full_name, role, firm_id, avatar_url, phone, notification_preferences, is_active, last_login_at },
  "firm": { id, name, display_name, timezone, settings }
}
```

#### 2.2 Users

```
GET /api/users
Auth: Bearer token
Query: ?role=PARTNER&is_active=true&search=john&page=1&limit=20

Response 200:
{
  "data": [{ id, email, full_name, role, phone, is_active, avatar_url, last_login_at, created_at }],
  "meta": { total, page, limit, total_pages }
}
```

```
POST /api/users
Auth: Bearer token

Request:
{
  "email": string,
  "full_name": string,
  "role": "PARTNER" | "MANAGER" | "JUNIOR_CA" | "ARTICLE" | "ADMIN",
  "phone": string | null,
  "password": string            // temporary, user changes on first login
}

Response 201:
{ id, email, full_name, role, phone, is_active, created_at }

Error codes:
  400 – Validation failed
  409 – Email already exists in this firm
```

```
PATCH /api/users/:id
Auth: Bearer token

Request (partial):
{
  "full_name": string,
  "phone": string | null,
  "role": string,
  "notification_preferences": object,
  "avatar_url": string | null
}

Response 200:
{ ...updated user }

Error codes:
  400 – Validation failed
  404 – User not found
```

```
PATCH /api/users/:id/deactivate
Auth: Bearer token

Response 200:
{
  "user": { id, is_active: false },
  "open_tasks_count": number     // tasks that need reassignment
}

Error codes:
  404 – User not found
  409 – Cannot deactivate last active PARTNER/ADMIN
```

#### 2.3 Clients

```
GET /api/clients
Auth: Bearer token
Query: ?status=ACTIVE&entity_type=PRIVATE_LIMITED&tag=gst&assigned_partner_id=uuid
       &search=acme&page=1&limit=20&sort=display_name&order=asc

Response 200:
{
  "data": [{
    id, display_name, legal_name, entity_type, constitution, pan, status,
    primary_contact_name, primary_contact_email, primary_contact_phone,
    assigned_partner: { id, full_name } | null,
    assigned_manager: { id, full_name } | null,
    tags, onboarded_at, created_at
  }],
  "meta": { total, page, limit, total_pages }
}
```

```
POST /api/clients
Auth: Bearer token

Request:
{
  "display_name": string,
  "legal_name": string | null,
  "entity_type": EntityType,
  "constitution": Constitution | null,
  "pan": string | null,
  "tan": string | null,
  "cin": string | null,
  "status": "ACTIVE" | "INACTIVE" | "PROSPECT",
  "primary_contact_name": string | null,
  "primary_contact_phone": string | null,
  "primary_contact_email": string | null,
  "address": Address | null,
  "notes": string | null,
  "tags": string[],
  "assigned_partner_id": uuid | null,
  "assigned_manager_id": uuid | null,
  "assigned_junior_id": uuid | null,
  "assigned_article_id": uuid | null,
  "financial_year_end": number,
  "custom_fields": object
}

Response 201:
{ ...full client object }

Error codes:
  400 – Validation failed (PAN/TAN/CIN format, display_name length, etc.)
  409 – Client display_name already exists in this firm
```

```
GET /api/clients/:id
Auth: Bearer token

Response 200:
{
  ...full client object,
  gst_numbers: [{ id, gstin, state_code, trade_name, registration_type, is_primary }],
  assigned_partner: { id, full_name } | null,
  assigned_manager: { id, full_name } | null,
  assigned_junior: { id, full_name } | null,
  assigned_article: { id, full_name } | null,
  engagement_count: number,
  open_task_count: number
}

Error codes:
  404 – Client not found
```

```
PATCH /api/clients/:id
Auth: Bearer token
Request: (partial — same fields as POST)

Response 200: { ...updated client }
Error codes: 400, 404, 409
```

```
DELETE /api/clients/:id
Auth: Bearer token

Response 200:
{ "message": "Client moved to recently deleted", "deleted_at": timestamp }

Error codes:
  404 – Client not found
  409 – Client has active engagements (must cancel/complete first)
```

```
POST /api/clients/:clientId/gst-numbers
Auth: Bearer token

Request:
{
  "gstin": string,
  "trade_name": string | null,
  "registration_type": "REGULAR" | "COMPOSITION" | "CASUAL" | "SEZ" | "ISD",
  "is_primary": boolean,
  "registered_at": date | null,
  "cancelled_at": date | null
}

Response 201: { ...gst number object }
Error codes: 400 (invalid GSTIN format), 409 (GSTIN already exists)
```

#### 2.4 Engagements

```
GET /api/engagements
Auth: Bearer token
Query: ?client_id=uuid&status=ACTIVE&category=GST&page=1&limit=20

Response 200:
{
  "data": [{
    id, name, status, period_label, period_start, period_end,
    client: { id, display_name },
    engagement_type: { id, name, code, category },
    assigned_partner: { id, full_name } | null,
    assigned_manager: { id, full_name } | null,
    task_summary: { total, done, overdue },
    fee_amount, fee_currency, created_at
  }],
  "meta": { total, page, limit, total_pages }
}
```

```
POST /api/engagements
Auth: Bearer token

Request:
{
  "client_id": uuid,
  "engagement_type_id": uuid,
  "name": string | null,             // auto-generated if null
  "period_label": string | null,
  "period_start": date | null,
  "period_end": date | null,
  "assigned_partner_id": uuid | null, // inherits from client if null
  "assigned_manager_id": uuid | null,
  "assigned_team": uuid[],
  "fee_amount": number | null,
  "notes": string | null,
  "auto_create_tasks": boolean        // instantiate task template on creation
}

Response 201: { ...full engagement, tasks_created: number }
Error codes: 400, 404 (client/engagement_type not found)
```

```
PATCH /api/engagements/:id/status
Auth: Bearer token

Request:
{
  "status": "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED"
}

Response 200:
{
  ...updated engagement,
  "tasks_cancelled": number | null   // populated if status → CANCELLED
}

Error codes:
  400 – Invalid transition
  409 – Cannot complete: N tasks still open (returns blocking_task_ids[])
```

#### 2.5 Tasks

```
GET /api/tasks
Auth: Bearer token
Query: ?assignee_id=uuid&client_id=uuid&engagement_id=uuid&status=IN_PROGRESS
       &priority=HIGH,URGENT&due_before=2026-04-15&due_after=2026-03-01
       &is_overdue=true&search=gstr&tags=gst&page=1&limit=50
       &sort=due_date&order=asc

Response 200:
{
  "data": [{
    id, title, status, priority, due_date, internal_due_date,
    assignee: { id, full_name } | null,
    reviewer: { id, full_name } | null,
    client: { id, display_name },
    engagement: { id, name } | null,
    tags, estimated_hours, is_recurring,
    checklist_progress: { completed, total },
    dependency_count: number,
    is_blocked: boolean,            // has unresolved dependencies
    parent_task_id: uuid | null,
    created_at, completed_at
  }],
  "meta": { total, page, limit, total_pages }
}
```

```
POST /api/tasks
Auth: Bearer token

Request:
{
  "title": string,
  "description": string | null,
  "engagement_id": uuid | null,
  "client_id": uuid | null,          // required if no engagement_id
  "parent_task_id": uuid | null,
  "priority": "LOW" | "MEDIUM" | "HIGH" | "URGENT",
  "assignee_id": uuid | null,
  "reviewer_id": uuid | null,
  "due_date": date | null,
  "estimated_hours": number | null,
  "tags": string[],
  "checklist_items": [{ label: string, is_required: boolean }] | null
}

Response 201: { ...full task object with checklists }
Error codes: 400, 404
```

```
PATCH /api/tasks/:id/status
Auth: Bearer token

Request:
{
  "status": TaskStatus
}

Response 200:
{
  ...updated task,
  "notifications_sent": string[]    // e.g. ["TASK_REVIEW_REQUESTED"]
}

Error codes:
  400 – Invalid status transition (returns allowed_transitions[])
  409 – Cannot complete: N required checklist items incomplete
  409 – Cannot complete: has uncompleted required checklist items (returns items[])
```

```
POST /api/tasks/:taskId/comments
Auth: Bearer token

Request:
{
  "body": string,                   // 1-5000 chars
  "mentions": uuid[],              // max 10
  "parent_comment_id": uuid | null
}

Response 201: { id, body, author: { id, full_name, avatar_url }, mentions, parent_comment_id, created_at }
Error codes: 400, 404
```

```
POST /api/tasks/:taskId/checklist
Auth: Bearer token

Request:
{
  "label": string,
  "is_required": boolean,
  "display_order": number
}

Response 201: { ...checklist item }
```

```
PATCH /api/tasks/:taskId/checklist/:id
Auth: Bearer token

Request:
{
  "is_completed": boolean           // or label, is_required, display_order
}

Response 200: { ...updated checklist item }
```

```
POST /api/tasks/:taskId/dependencies
Auth: Bearer token

Request:
{
  "depends_on_task_id": uuid
}

Response 201: { id, task_id, depends_on_task_id }
Error codes:
  400 – Self-dependency / circular dependency detected / different firm
  409 – Dependency already exists
```

```
GET /api/tasks/:id/activity
Auth: Bearer token
Query: ?page=1&limit=50

Response 200:
{
  "data": [{ id, action, actor: { id, full_name }, old_value, new_value, occurred_at }],
  "meta": { total, page, limit, total_pages }
}
```

#### 2.6 Documents

```
POST /api/documents/upload-url
Auth: Bearer token
Rate: 10/min per user

Request:
{
  "file_name": string,
  "mime_type": string,              // must be in allowed list
  "file_size_bytes": number,        // max 50MB
  "client_id": uuid | null,
  "engagement_id": uuid | null,
  "task_id": uuid | null
}

Response 200:
{
  "upload_url": string,             // pre-signed S3 PUT URL, 15-min TTL
  "storage_key": string,            // S3 object key to use in register call
  "storage_bucket": string
}

Error codes:
  400 – Invalid MIME type / file too large
  429 – Rate limit exceeded
```

```
POST /api/documents
Auth: Bearer token

Request:
{
  "name": string,
  "description": string | null,
  "document_type": DocumentType,
  "storage_key": string,
  "storage_bucket": string,
  "mime_type": string,
  "file_size_bytes": number,
  "checksum_sha256": string,
  "client_id": uuid | null,
  "engagement_id": uuid | null,
  "task_id": uuid | null,
  "tags": string[],
  "version_of_id": uuid | null     // if uploading new version
}

Response 201: { ...full document object }
Error codes: 400, 409 (duplicate checksum warning)
```

```
GET /api/documents/:id/download-url
Auth: Bearer token

Response 200:
{
  "download_url": string,           // pre-signed S3 GET URL, 15-min TTL
  "file_name": string,
  "mime_type": string
}
```

```
POST /api/document-requests
Auth: Bearer token

Request:
{
  "client_id": uuid,
  "engagement_id": uuid | null,
  "task_id": uuid | null,
  "title": string,
  "description": string | null,
  "due_date": date | null
}

Response 201:
{
  ...document request object,
  "upload_link": string             // public URL with token for client
}
```

```
POST /api/upload/:token
Auth: public (token-based)
Rate: 5/min per IP

// Multipart form upload — client-facing minimal portal
Request: multipart/form-data { file: File }

Response 200:
{
  "message": "Document uploaded successfully",
  "document_id": uuid
}

Error codes:
  400 – Invalid file type / too large
  401 – Token expired or invalid
  410 – Token already used
```

#### 2.7 Credentials

```
GET /api/clients/:clientId/credentials
Auth: Bearer token

Response 200:
{
  "data": [{
    id, portal, portal_label, username, registered_phone, registered_email,
    last_changed_at, last_accessed_at, last_accessed_by: { id, full_name } | null,
    created_at
    // NOTE: password_encrypted is NEVER included in list response
  }]
}

Error codes:
  403 – ARTICLE role cannot access credentials
```

```
GET /api/credentials/:id
Auth: Bearer token

Response 200:
{
  ...credential object,
  "password": string                // decrypted, returned only here
}
// Side effect: creates credential_access_log entry with action=VIEWED

Error codes:
  403 – Insufficient role / not assigned to this client
  404 – Credential not found
```

```
POST /api/clients/:clientId/credentials
Auth: Bearer token

Request:
{
  "portal": PortalEnum,
  "portal_label": string | null,
  "username": string,
  "password": string,               // plaintext — encrypted server-side
  "registered_phone": string | null,
  "registered_email": string | null,
  "notes": string | null
}

Response 201: { ...credential without password }
```

#### 2.8 DSC Tracker

```
GET /api/dsc
Auth: Bearer token
Query: ?client_id=uuid&status=ACTIVE&holder_type=CLIENT&expiring_within_days=30

Response 200:
{
  "data": [{
    id, holder_type, holder_name, class, type, issued_by, serial_number,
    valid_from, valid_until, status, storage_location,
    client: { id, display_name } | null,
    user: { id, full_name } | null,
    days_until_expiry: number
  }]
}
```

```
POST /api/dsc
Auth: Bearer token

Request:
{
  "holder_type": "CLIENT" | "PARTNER",
  "client_id": uuid | null,
  "user_id": uuid | null,
  "class": "CLASS_2" | "CLASS_3",
  "type": "INDIVIDUAL" | "ORGANISATION" | "DGFT",
  "issued_by": string | null,
  "serial_number": string | null,
  "valid_from": date,
  "valid_until": date,
  "storage_location": string | null,
  "notes": string | null
}

Response 201: { ...dsc record }
Error codes: 400 (valid_until <= valid_from, missing client_id for CLIENT type)
```

#### 2.9 Compliance Calendar

```
GET /api/compliance/calendar
Auth: Bearer token
Query: ?month=4&year=2026&client_id=uuid&category=GST&status=PENDING

Response 200:
{
  "data": [{
    id, client: { id, display_name },
    statutory_deadline: { id, code, name, category },
    period_label, due_date, internal_due_date, status,
    linked_task: { id, title, status, assignee: { id, full_name } } | null
  }]
}
```

```
GET /api/compliance/deadlines
Auth: Bearer token

Response 200:
{
  "data": [{
    id, code, name, description, category, applicable_to, recurrence,
    recurrence_day, recurrence_month, penalty_per_day, penalty_flat, penalty_notes
  }]
}
```

```
GET /api/clients/:clientId/compliance-assignments
Auth: Bearer token

Response 200:
{
  "data": [{
    id, statutory_deadline: { id, code, name, category },
    is_enabled, auto_generate_tasks, task_template_id, internal_buffer_days
  }]
}
```

```
PATCH /api/clients/:clientId/compliance-assignments/:id
Auth: Bearer token

Request:
{
  "is_enabled": boolean,
  "auto_generate_tasks": boolean,
  "internal_buffer_days": number | null
}

Response 200: { ...updated assignment }
```

#### 2.10 Team & Workload

```
GET /api/team/workload
Auth: Bearer token

Response 200:
{
  "data": [{
    user: { id, full_name, role, avatar_url },
    open_task_count: number,
    overdue_task_count: number,
    due_this_week_count: number,
    load_status: "UNDERUTILISED" | "BALANCED" | "OVERLOADED",
    on_leave: boolean,
    leave_until: date | null
  }],
  "firm_average_tasks": number
}
```

```
GET /api/team/approval-queue
Auth: Bearer token

Response 200:
{
  "data": [{
    task: { id, title, status, priority, due_date },
    client: { id, display_name },
    engagement: { id, name } | null,
    submitted_by: { id, full_name },
    submitted_at: timestamp
  }]
}
```

```
POST /api/leave
Auth: Bearer token

Request:
{
  "leave_type": LeaveType,
  "start_date": date,
  "end_date": date,
  "is_half_day": boolean,
  "reason": string | null
}

Response 201: { ...leave record }
Error codes: 400 (end_date < start_date, is_half_day with multi-day range)
```

```
PATCH /api/leave/:id/approve
Auth: Bearer token

Response 200: { ...approved leave record, tasks_flagged: number }
```

#### 2.11 Notifications

```
GET /api/notifications
Auth: Bearer token
Query: ?status=PENDING,SENT&page=1&limit=20

Response 200:
{
  "data": [{
    id, type, title, body, entity_type, entity_id,
    channel, status, read_at, created_at
  }],
  "meta": { total, page, limit, total_pages },
  "unread_count": number
}
```

```
PATCH /api/notifications/:id/read
Auth: Bearer token

Response 200: { id, read_at: timestamp }
```

```
POST /api/notifications/mark-all-read
Auth: Bearer token

Response 200: { "marked_count": number }
```

#### 2.12 Recently Deleted

```
GET /api/recently-deleted
Auth: Bearer token
Query: ?entity_type=client,task,document&page=1&limit=20

Response 200:
{
  "data": [{
    entity_type: string,
    entity_id: uuid,
    name: string,                   // display name of the deleted entity
    deleted_at: timestamp,
    deleted_by: { id, full_name },
    days_until_permanent: number
  }],
  "meta": { total, page, limit, total_pages }
}
```

```
POST /api/recently-deleted/:entityType/:id/restore
Auth: Bearer token

Response 200:
{ "message": "Restored successfully", "entity_type": string, "entity_id": uuid }

Error codes:
  404 – Entity not found in recently deleted
  410 – Past 30-day restoration window
```

#### 2.13 Audit Log

```
GET /api/audit-log
Auth: Bearer token (PARTNER, ADMIN only)
Query: ?user_id=uuid&entity_type=client&entity_id=uuid
       &action=client.create&from=2026-03-01&to=2026-03-27
       &page=1&limit=50

Response 200:
{
  "data": [{
    id, user: { id, full_name }, action, entity_type, entity_id,
    metadata, ip_address, occurred_at
  }],
  "meta": { total, page, limit, total_pages }
}
```

---

### 3. Observability & Logging

#### 3.1 Error Tracking

| Scope | What to capture | Alert threshold |
|---|---|---|
| Global NestJS exception filter | All unhandled exceptions with request context (user_id, firm_id, path, method) | Any 5xx |
| Cron job failures | Job name, firm_id being processed, error stack, items processed before failure | Any failure |
| Email delivery failures | notification_id, recipient_email, SMTP error, retry_count | 3 consecutive failures for same notification |
| S3 operations | upload/download failures with storage_key, error code | Any failure |
| Credential decryption | credential_id, error (never log plaintext) | Any failure |
| JWT validation | token_hash prefix (first 8 chars), failure reason | >10 failures/min from same IP |

#### 3.2 Structured Log Fields (every request)

```json
{
  "request_id": "uuid",
  "firm_id": "uuid",
  "user_id": "uuid",
  "method": "POST",
  "path": "/api/tasks",
  "status_code": 201,
  "duration_ms": 42,
  "ip": "1.2.3.4",
  "user_agent": "..."
}
```

**Additional fields per domain:**

| Domain | Extra fields |
|---|---|
| Document upload | `file_size_bytes`, `mime_type`, `storage_key`, `upload_duration_ms` |
| Task status change | `task_id`, `old_status`, `new_status`, `notifications_emitted[]` |
| Credential access | `credential_id`, `client_id`, `action` (VIEWED/COPIED) |
| Cron job | `job_name`, `firms_processed`, `items_processed`, `duration_ms`, `errors_count` |
| Auth | `login_result` (success/invalid_password/deactivated/rate_limited), `session_count` |

#### 3.3 User Funnel Events (analytics — via `user_action_log`)

The `user_action_log` table doubles as the analytics source. Key events to track for product adoption:

| Event | Fields | Purpose |
|---|---|---|
| `auth.login` | user_id, ip | DAU tracking |
| `client.create` | client_id | Onboarding funnel |
| `engagement.create` | engagement_id, auto_create_tasks | Feature adoption |
| `task.status_change` | task_id, old→new | Workflow velocity |
| `task.comment_add` | task_id, has_mentions | Collaboration signal |
| `document.upload` | document_id, file_size, source | Storage usage |
| `credential.view` | credential_id, client_id | Security-sensitive feature adoption |
| `compliance.calendar_view` | month, year | Compliance feature usage |

---

## Part 2: Execution Plan (Ticket Breakdown)

### Epic 1: Foundation & Infrastructure
*Goal: Monorepo scaffolding, database schema, auth system, and multi-tenancy — the base everything else builds on.*

> **Story 1.1: [Backend] Scaffold Turborepo monorepo with NestJS and SvelteKit**
> *Description:* Set up the monorepo structure with `apps/api` (NestJS), `apps/web` (SvelteKit), and `packages/shared` (enums, DTOs, constants). Docker Compose for PostgreSQL, Redis, and MinIO.
> *Acceptance Criteria:*
> - [ ] `pnpm dev` starts both API and web app
> - [ ] `packages/shared` types importable from both apps
> - [ ] Docker Compose spins up PostgreSQL 16, Redis 7, MinIO
> - [ ] Environment variable handling via `.env` files with validation
> *Sub-tasks:*
> - [ ] Initialize Turborepo with pnpm workspaces
> - [ ] Scaffold NestJS app with base config (CORS, validation pipe, exception filter)
> - [ ] Scaffold SvelteKit app with TailwindCSS
> - [ ] Create `packages/shared` with initial enum exports
> - [ ] Write `docker-compose.yml` with postgres, redis, minio services
> - [ ] Add `.env.example` with all required env vars

> **Story 1.2: [Backend] Prisma schema — all 33+ tables with enums and relations**
> *Description:* Define the complete Prisma schema covering all entities from the PRD. Use multi-file schema (preview feature). Include all enums, relations, indexes, and default values.
> *Acceptance Criteria:*
> - [ ] `prisma migrate dev` runs cleanly and creates all tables
> - [ ] All FK relationships defined with proper cascade rules
> - [ ] All composite indexes from Section 1.2 created
> - [ ] Seed script creates: engagement types, statutory deadlines, task templates
> *Sub-tasks:*
> - [ ] Schema files: `auth.prisma`, `firm.prisma`, `client.prisma`, `engagement.prisma`, `task.prisma`, `compliance.prisma`, `document.prisma`, `credential.prisma`, `dsc.prisma`, `team.prisma`, `notification.prisma`, `audit.prisma`
> - [ ] Define all 29+ enums in shared package + Prisma
> - [ ] Add partial unique indexes (e.g., one primary GST per client where deleted_at IS NULL)
> - [ ] Write seed script for global engagement types, statutory deadlines, task templates
> - [ ] Add `updated_at` trigger via Prisma `@updatedAt`
> - [ ] Verify migration up/down works cleanly

> **Story 1.3: [Backend] Prisma multi-tenancy extension and FirmScopedService**
> *Description:* Build the Prisma `$extends` client that automatically injects `firm_id` filtering on all queries. Implement `AsyncLocalStorage` context for firm_id propagation. Create `FirmScopedService` base class.
> *Acceptance Criteria:*
> - [ ] Any query through extended Prisma client automatically filters by firm_id
> - [ ] `findMany`, `findFirst`, `create`, `update`, `delete` all scoped
> - [ ] Attempting to access data from another firm returns empty/404
> - [ ] Raw queries blocked or logged as warnings
> *Sub-tasks:*
> - [ ] Implement Prisma `$extends` with `query` extension for all models
> - [ ] Set up `AsyncLocalStorage` to hold `{ firmId, userId }` per request
> - [ ] Create NestJS middleware to populate AsyncLocalStorage from JWT
> - [ ] Create `FirmScopedService` base class with `getFirmId()` helper
> - [ ] Write integration tests: cross-tenant isolation verification
> - [ ] Add structured log warning for any query missing firm_id scope

> **Story 1.4: [Backend] Auth module — register, login, JWT, sessions, refresh**
> *Description:* Full auth flow: firm registration (creates firm + first PARTNER user), login, JWT access/refresh tokens, session management with 5-session limit, logout.
> *Acceptance Criteria:*
> - [ ] Register creates firm + user, returns JWT + sets refresh cookie
> - [ ] Login validates credentials, returns JWT + sets refresh cookie
> - [ ] Refresh rotates refresh token and returns new access token
> - [ ] Logout deletes session, clears cookie
> - [ ] 6th login evicts oldest session
> - [ ] Deactivated users get 403 on login
> *Sub-tasks:*
> - [ ] `AuthService`: register, login, refresh, logout, validateSession
> - [ ] `AuthController`: 5 endpoints per API contract 2.1
> - [ ] JWT strategy (passport-jwt) with 15-min access token
> - [ ] Refresh token: HTTP-only, Secure, SameSite=Strict cookie
> - [ ] Session management: create/delete/evict-oldest
> - [ ] `AuthGuard`: global guard extracting user + firm from JWT
> - [ ] Rate limiting: 5/min login, 3/min register (per IP)
> - [ ] Unit tests: happy path + edge cases (wrong password, deactivated, session limit)
> - [ ] Add auth structured logging (login_result, session_count)

> **Story 1.5: [Backend] User action logging interceptor**
> *Description:* NestJS global interceptor that logs every mutating request (POST, PATCH, PUT, DELETE) to `user_action_log`. Fire-and-forget — must never fail the request.
> *Acceptance Criteria:*
> - [ ] Every POST/PATCH/PUT/DELETE creates a `user_action_log` entry
> - [ ] Log includes: firm_id, user_id, action (derived from route), entity_type, entity_id, metadata (request body summary), ip_address
> - [ ] Failed log insert does not fail the API response
> - [ ] GET requests are not logged (except credential view — handled separately)
> *Sub-tasks:*
> - [ ] Create `ActionLogInterceptor` as global NestJS interceptor
> - [ ] Action name derivation: `entity.operation` from route (e.g., `POST /api/clients` → `client.create`)
> - [ ] Entity ID extraction from route params or response body
> - [ ] Async insert with try/catch swallowing errors (log to stderr)
> - [ ] Unit tests: verify log creation, verify no request failure on log error

> **Story 1.6: [Backend] Global error handling and request logging**
> *Description:* NestJS global exception filter, request/response logging middleware, and health check endpoint.
> *Acceptance Criteria:*
> - [ ] All exceptions return consistent JSON format: `{ statusCode, message, error, request_id }`
> - [ ] Every request logged with fields from Section 3.2
> - [ ] `GET /api/health` returns 200 with DB + Redis connectivity status
> *Sub-tasks:*
> - [ ] Global exception filter with request_id propagation
> - [ ] Request logging middleware (method, path, status, duration_ms, user_id, firm_id)
> - [ ] Health check endpoint: DB ping + Redis ping
> - [ ] Correlation ID (`request_id`) via `cls-hooked` or `AsyncLocalStorage`
> - [ ] Validation pipe with descriptive error messages

---

### Epic 2: Client & Engagement Management
*Goal: Full CRUD for clients (with GST numbers and custom fields) and engagements (with lifecycle management and task template instantiation).*

> **Story 2.1: [Backend] Client CRUD with validation**
> *Description:* Client service and controller implementing all endpoints from API contract 2.3. Include PAN/TAN/CIN regex validation, case-insensitive display_name uniqueness, and role-verified assignment fields.
> *Acceptance Criteria:*
> - [ ] Create, list, get, update, soft-delete clients
> - [ ] PAN/TAN/CIN format validation with clear error messages
> - [ ] `display_name` unique per firm (case-insensitive)
> - [ ] Assignment fields verify user role (partner must be PARTNER, etc.)
> - [ ] Delete blocked if client has active engagements
> - [ ] Pagination, search, and filter all working
> *Sub-tasks:*
> - [ ] `ClientService` with all CRUD methods
> - [ ] `ClientController` with 5 endpoints
> - [ ] Validation DTOs with class-validator decorators (PAN/TAN/CIN regex)
> - [ ] Case-insensitive uniqueness check on `display_name`
> - [ ] Soft delete with cascade check (active engagements)
> - [ ] Integration tests: CRUD + validation + cross-tenant isolation
> - [ ] Action log entries for all mutations

> **Story 2.2: [Backend] Client GST numbers sub-resource**
> *Description:* GST number CRUD nested under client. Enforce GSTIN format, state_code derivation, and single primary constraint.
> *Acceptance Criteria:*
> - [ ] Add/edit/delete GST numbers for a client
> - [ ] GSTIN regex validated, state_code auto-derived from first 2 chars
> - [ ] Only one `is_primary = true` per client (setting new primary unsets old)
> - [ ] `cancelled_at` must be null or after `registered_at`
> *Sub-tasks:*
> - [ ] `ClientGstService` and controller endpoints
> - [ ] Partial unique index for `is_primary = true` per client (in Prisma)
> - [ ] Auto-derivation of `state_code` from GSTIN
> - [ ] Integration tests

> **Story 2.3: [Backend] Engagement CRUD with lifecycle**
> *Description:* Engagement service with full lifecycle management. On creation, optionally instantiate task chain from template. On COMPLETED, validate all tasks done. On CANCELLED, auto-cancel open tasks.
> *Acceptance Criteria:*
> - [ ] Create engagement with optional task template instantiation
> - [ ] Auto-generate engagement name: "[Type] - [Client] - [Period]"
> - [ ] Partner/Manager inheritance from client when null
> - [ ] COMPLETED blocked if open tasks exist (returns blocking list)
> - [ ] CANCELLED auto-cancels TO_DO and IN_PROGRESS child tasks
> *Sub-tasks:*
> - [ ] `EngagementService` with CRUD + status transitions
> - [ ] `EngagementController` with endpoints per contract 2.4
> - [ ] Task template instantiation logic (create tasks + dependencies from template items)
> - [ ] Status transition validation with error details
> - [ ] Cascade logic: CANCELLED → auto-cancel child tasks
> - [ ] Integration tests: create with template, complete with blocking tasks, cancel cascade
> - [ ] Action log entries

> **Story 2.4: [Frontend] Client list page with filters and search**
> *Description:* Paginated client list with status/entity_type/tag/partner filters, search bar, and create button. Table view with key columns.
> *Acceptance Criteria:*
> - [ ] Paginated table showing clients with key fields
> - [ ] Filter by status, entity_type, assigned_partner, tags
> - [ ] Search by display_name/legal_name/PAN
> - [ ] Empty state for zero clients
> - [ ] Loading skeleton while fetching
> *Sub-tasks:*
> - [ ] SvelteKit route `(app)/clients/+page.svelte` with server load function
> - [ ] Reusable `DataTable` component with pagination
> - [ ] Filter sidebar / dropdown components
> - [ ] Search input with debounce (300ms)
> - [ ] Empty state and loading skeleton components
> - [ ] Link rows to client detail page

> **Story 2.5: [Frontend] Client detail page**
> *Description:* Client detail view with tabs: Overview, Engagements, Tasks, Documents, Credentials, Compliance. Overview tab shows client info + GST numbers + assignment fields.
> *Acceptance Criteria:*
> - [ ] Tabbed layout with all 6 tabs
> - [ ] Overview: editable client fields, GST number list, assigned team
> - [ ] Engagement tab: list of engagements for this client
> - [ ] Quick stats: engagement count, open tasks, overdue tasks
> *Sub-tasks:*
> - [ ] Route `(app)/clients/[clientId]/+page.svelte` with nested layout
> - [ ] Tab navigation component
> - [ ] Client info edit form with validation
> - [ ] GST number list with add/edit/delete inline
> - [ ] Engagement list sub-component (reused from engagement list page)
> - [ ] Quick stats bar

> **Story 2.6: [Frontend] Engagement list and create flow**
> *Description:* Engagement list page with filters + create modal. Create flow: select client, select engagement type, set period, optionally instantiate task template.
> *Acceptance Criteria:*
> - [ ] List with client, type, status, period, task summary columns
> - [ ] Create modal with client selector, type dropdown, period fields
> - [ ] Checkbox: "Create tasks from template" (shows template preview)
> - [ ] Success: redirect to engagement detail
> *Sub-tasks:*
> - [ ] Route `(app)/engagements/+page.svelte`
> - [ ] Create engagement modal component
> - [ ] Engagement type selector with category grouping
> - [ ] Task template preview component
> - [ ] Form validation and error handling

---

### Epic 3: Task Engine
*Goal: Full task management — CRUD, status machine with transition enforcement, checklists, dependencies, comments, activity log, and template instantiation.*

> **Story 3.1: [Backend] Task CRUD with status machine**
> *Description:* Task service implementing the full status transition matrix from PRD section 6.1. Enforce all validation rules: checklist completion for DONE, assignee/reviewer same-firm, depth-1 subtasks.
> *Acceptance Criteria:*
> - [ ] Create tasks (standalone or engagement-bound)
> - [ ] Status transitions enforce the allowed-transitions matrix
> - [ ] Invalid transitions return 400 with `allowed_transitions[]`
> - [ ] DONE blocked by incomplete required checklist items
> - [ ] `completed_at` / `cancelled_at` auto-set on terminal transitions
> - [ ] `internal_due_date` auto-computed from buffer chain
> - [ ] Subtask depth limited to 1
> *Sub-tasks:*
> - [ ] `TaskService` with create, update, status transition methods
> - [ ] Status transition map as const config (not if/else chains)
> - [ ] Internal due date computation (PRD section 13.3)
> - [ ] Checklist completion gate for DONE transition
> - [ ] `client_id` auto-population from engagement
> - [ ] Notification emission on status change (TASK_ASSIGNED, REVIEW_REQUESTED, etc.)
> - [ ] `TaskActivityLogService` — record all mutations
> - [ ] Integration tests: every valid + invalid transition, checklist gate, subtask depth
> - [ ] Structured logging: task_id, old_status, new_status

> **Story 3.2: [Backend] Task checklists, dependencies, and comments**
> *Description:* Sub-resource CRUD for checklists (with completion toggle), dependencies (with DAG cycle detection), and comments (with @mentions and threading).
> *Acceptance Criteria:*
> - [ ] Checklist: add/edit/toggle/delete items, max 30 per task
> - [ ] Dependencies: add/remove, cycle detection at insert, `DEPENDENCY_UNBLOCKED` event on predecessor DONE
> - [ ] Comments: add with @mentions, threaded replies (depth 1), soft delete with "[deleted]" placeholder
> - [ ] Notifications: COMMENT_MENTION for each @mentioned user, DEPENDENCY_UNBLOCKED
> *Sub-tasks:*
> - [ ] `TaskChecklistService` with CRUD + toggle
> - [ ] `TaskDependencyService` with add/remove + cycle detection (BFS/DFS on task graph within firm)
> - [ ] `TaskCommentService` with add/delete + mention extraction
> - [ ] Event emission: DEPENDENCY_UNBLOCKED, COMMENT_MENTION
> - [ ] Integration tests: cycle detection (A→B→C→A), mention notification, checklist max

> **Story 3.3: [Frontend] Task list page with Kanban and table views**
> *Description:* Task list with two view modes: table (sortable/filterable) and Kanban (columns = statuses). Filters: assignee, client, engagement, status, priority, due date range, overdue flag.
> *Acceptance Criteria:*
> - [ ] Table view with all filter/sort options
> - [ ] Kanban view with drag-to-change-status (calls PATCH status)
> - [ ] View toggle persisted in localStorage
> - [ ] Overdue tasks visually highlighted (red badge)
> - [ ] Blocked tasks show lock icon with dependency tooltip
> *Sub-tasks:*
> - [ ] Route `(app)/tasks/+page.svelte`
> - [ ] Table view component with sorting + pagination
> - [ ] Kanban board component with drag-and-drop (status columns)
> - [ ] Filter bar (assignee picker, client picker, date range, priority multi-select)
> - [ ] Optimistic status update on Kanban drag with rollback
> - [ ] Overdue + blocked visual indicators

> **Story 3.4: [Frontend] Task detail page**
> *Description:* Full task detail: status controls, info panel (assignee, reviewer, due date, priority), checklist, dependency graph, comments thread, activity timeline.
> *Acceptance Criteria:*
> - [ ] Status transition buttons (only show valid transitions)
> - [ ] Editable fields: title, description, assignee, reviewer, due_date, priority, tags
> - [ ] Checklist with add/toggle/delete
> - [ ] Comments with @mention autocomplete and threading
> - [ ] Activity timeline showing all changes
> - [ ] Dependency list with "blocked by" / "blocking" sections
> *Sub-tasks:*
> - [ ] Route `(app)/tasks/[taskId]/+page.svelte`
> - [ ] Status transition button bar with allowed-transition logic
> - [ ] Editable info panel with inline editing
> - [ ] Checklist component with optimistic toggle
> - [ ] Comment thread component with @mention autocomplete (query users endpoint)
> - [ ] Activity timeline component
> - [ ] Dependency list with add/remove

---

### Epic 4: Document Management
*Goal: S3-backed document upload/download, versioning, document requests with client upload portal, and document checklists.*

> **Story 4.1: [Backend] Document upload and download via pre-signed URLs**
> *Description:* Two-step upload: client gets pre-signed PUT URL, uploads to S3, then registers the document. Downloads via pre-signed GET URL (15-min TTL). Version management: new version replaces latest in linear chain.
> *Acceptance Criteria:*
> - [ ] `upload-url` returns pre-signed PUT URL with correct content-type constraint
> - [ ] Document registration validates MIME type, file size (50MB max), checksum
> - [ ] Download URL is pre-signed GET with 15-min TTL
> - [ ] Version upload: increments version, sets version_of_id to original
> - [ ] Duplicate checksum detection (warning, not block)
> - [ ] `retention_expires_at` auto-set to `created_at + 1 year`
> *Sub-tasks:*
> - [ ] S3 service: generateUploadUrl, generateDownloadUrl, deleteObject
> - [ ] `DocumentService` with register, list, get, delete, createVersion
> - [ ] `DocumentController` with endpoints per contract 2.6
> - [ ] MIME type allowlist validation
> - [ ] Checksum duplicate detection (query same firm + checksum)
> - [ ] Integration tests with MinIO (local S3)
> - [ ] Logging: file_size_bytes, mime_type, storage_key on every upload

> **Story 4.2: [Backend] Document requests and client upload portal**
> *Description:* Document request CRUD with token-based public upload. Client receives email with upload link. Upload page is a minimal public form (no auth).
> *Acceptance Criteria:*
> - [ ] Create document request → generates upload_token, returns upload_link
> - [ ] Public `POST /api/upload/:token` accepts multipart file upload
> - [ ] Token validated: not expired, not already used
> - [ ] Upload creates document record with source=CLIENT_UPLOAD, fulfills request
> - [ ] Requesting user notified on fulfillment
> - [ ] Token expires after 30 days
> *Sub-tasks:*
> - [ ] `DocumentRequestService` with CRUD + token management
> - [ ] `ClientUploadController` (public, no auth guard)
> - [ ] Token validation middleware: expiry check, single-use check
> - [ ] Multipart upload handling (multer or busboy)
> - [ ] File → S3 upload + document record creation + request fulfillment
> - [ ] Notification: DOCUMENT_REQUEST_FULFILLED
> - [ ] Rate limiting: 5/min per IP on public endpoint
> - [ ] Integration tests: upload flow, expired token, reused token

> **Story 4.3: [Frontend] Client document upload portal**
> *Description:* Minimal public page at `/upload/:token`. No login required. Shows: firm logo (if available), request title/description, file upload dropzone, allowed types, max size, submit button, success confirmation.
> *Acceptance Criteria:*
> - [ ] Page loads with token validation (shows error if expired/invalid)
> - [ ] Drag-and-drop file upload with progress indicator
> - [ ] File type and size validation client-side before upload
> - [ ] Success page with confirmation message
> - [ ] Mobile-responsive
> *Sub-tasks:*
> - [ ] Route `(public)/upload/[token]/+page.svelte`
> - [ ] Token validation via server load (GET request metadata)
> - [ ] File dropzone component with drag-and-drop + click-to-browse
> - [ ] Client-side validation (MIME type, 50MB limit)
> - [ ] Upload progress bar
> - [ ] Success/error states
> - [ ] Responsive layout (mobile-first — clients will use phones)

> **Story 4.4: [Frontend] Document list and management UI**
> *Description:* Document list with filters (client, engagement, type, tags), upload button, version history, download, and delete. Document request management: create, view status, copy upload link.
> *Acceptance Criteria:*
> - [ ] Document list with thumbnail/icon, name, type, size, uploaded_by, date
> - [ ] Upload flow: select file → get pre-signed URL → upload to S3 → register
> - [ ] Version history: expand to see all versions of a document
> - [ ] Document request creation modal
> - [ ] Request list showing status, copy-link button, reminder count
> *Sub-tasks:*
> - [ ] Route `(app)/documents/+page.svelte`
> - [ ] Upload component: two-step (pre-sign → S3 → register)
> - [ ] Document list with type icons and size formatting
> - [ ] Version history expandable row
> - [ ] Document request create modal
> - [ ] Document request list with status badges and copy-link

---

### Epic 5: Compliance, Credentials & DSC
*Goal: Compliance calendar with deadline tracking, credential locker with encryption, DSC tracker with expiry alerts.*

> **Story 5.1: [Backend] Compliance calendar module**
> *Description:* Statutory deadlines (global seeds), deadline overrides, client compliance assignments, and calendar entries. Serves the calendar view and powers auto task generation.
> *Acceptance Criteria:*
> - [ ] List all statutory deadlines (global read-only for firms)
> - [ ] Client compliance assignment CRUD (enable/disable per client per deadline)
> - [ ] Calendar entries query by month/year/client/category/status
> - [ ] Effective due date computation (base date + override check)
> *Sub-tasks:*
> - [ ] `ComplianceService` with deadline queries, assignment CRUD, calendar view
> - [ ] `ComplianceController` per contract 2.9
> - [ ] Effective due date resolver (checks overrides table first)
> - [ ] Calendar entry generation/refresh logic
> - [ ] Integration tests

> **Story 5.2: [Backend] Credential locker with encryption**
> *Description:* Credential CRUD with AES-256-GCM encryption for passwords. Role-based access control (ARTICLE blocked, JUNIOR_CA scoped to assigned clients). Every access logged.
> *Acceptance Criteria:*
> - [ ] Passwords encrypted at rest with AES-256-GCM
> - [ ] Decrypted password returned only on single-fetch endpoint
> - [ ] ARTICLE role gets 403 on all credential endpoints
> - [ ] JUNIOR_CA can only access assigned-client credentials
> - [ ] Every view/copy creates credential_access_log entry
> *Sub-tasks:*
> - [ ] `EncryptionService`: encrypt/decrypt using AES-256-GCM with env-var key
> - [ ] `CredentialService` with CRUD + access control
> - [ ] `CredentialAccessLogService` — fire-and-forget log on every access
> - [ ] Role-based guards: ARTICLE blocked, JUNIOR_CA scoped
> - [ ] Integration tests: encryption roundtrip, role access, audit log

> **Story 5.3: [Backend] DSC tracker**
> *Description:* DSC record CRUD, expiry status management, renewal linking.
> *Sub-tasks:*
> - [ ] `DscService` with CRUD + expiry check
> - [ ] `DscController` per contract 2.8
> - [ ] Computed `days_until_expiry` in response
> - [ ] Integration tests

> **Story 5.4: [Frontend] Compliance calendar view**
> *Description:* Month-view calendar showing all deadlines with status indicators. Filter by client, category. Click to navigate to linked task.
> *Sub-tasks:*
> - [ ] Route `(app)/compliance/+page.svelte`
> - [ ] Month calendar grid component
> - [ ] Deadline cards with status badge (PENDING/IN_PROGRESS/FILED/MISSED)
> - [ ] Client and category filter
> - [ ] Click-through to linked task

> **Story 5.5: [Frontend] Credential locker and DSC tracker UI**
> *Description:* Client-scoped credential list with show/hide password, copy button. DSC list with expiry countdown and status badges.
> *Sub-tasks:*
> - [ ] Credential list within client detail (tab)
> - [ ] Password reveal with confirmation dialog
> - [ ] Copy-to-clipboard with toast
> - [ ] DSC list page with expiry indicators
> - [ ] Add/edit forms for both

---

### Epic 6: Notifications & Automation
*Goal: In-app + email notification system, all 8 daily cron jobs, recurring task instance creation.*

> **Story 6.1: [Backend] Notification service and email delivery**
> *Description:* Notification creation, in-app listing with unread count, email delivery via BullMQ worker. Retry logic with exponential backoff (3 attempts).
> *Acceptance Criteria:*
> - [ ] Notifications created for all event types in PRD section 12
> - [ ] In-app: list, mark-read, mark-all-read, unread count
> - [ ] Email: dispatched via BullMQ worker, retried 3x on failure
> - [ ] User preference respected (can disable email, cannot disable in-app)
> *Sub-tasks:*
> - [ ] `NotificationService` with create, list, markRead, markAllRead
> - [ ] `EmailWorker` BullMQ processor with retry + exponential backoff
> - [ ] Email templates (Handlebars or similar) for each notification type
> - [ ] `NotificationController` per contract 2.11
> - [ ] User notification preference check before email dispatch
> - [ ] Integration tests: create, deliver, retry on failure
> - [ ] Logging: notification_id, recipient, channel, delivery_result

> **Story 6.2: [Backend] Cron jobs — auto task generation, overdue detection, DSC expiry, document reminders, retention, cleanup**
> *Description:* All 8 cron jobs from PRD section 13. Implemented as BullMQ repeatable jobs.
> *Acceptance Criteria:*
> - [ ] 06:00 IST: Auto task generation from compliance assignments
> - [ ] 07:00 IST: Overdue task detection + stuck task detection
> - [ ] 08:00 IST: DSC expiry check (30/15/7 day alerts, auto-expire)
> - [ ] 09:00 IST: Document request auto-reminders (day 3, 7, 14)
> - [ ] 10:00 IST: Document retention expiry check
> - [ ] 11:00 IST: Recently deleted cleanup (hard delete after 30 days)
> - [ ] Each job logs: firms_processed, items_processed, duration_ms, errors
> *Sub-tasks:*
> - [ ] BullMQ scheduler setup with cron expressions
> - [ ] `AutoTaskGenerationJob` — compliance assignment → task chain
> - [ ] `OverdueDetectionJob` — overdue + stuck task detection
> - [ ] `DscExpiryJob` — expiry alerts + status update
> - [ ] `DocumentReminderJob` — auto-reminders for pending requests
> - [ ] `DocumentRetentionJob` — retention expiry notifications + S3 deletion
> - [ ] `RecentlyDeletedCleanupJob` — hard delete aged records
> - [ ] `RecurringTaskJob` — triggered on task DONE (event-driven, not cron)
> - [ ] Integration tests per job with seed data
> - [ ] Structured logging per job run

> **Story 6.3: [Frontend] Notification bell and notification center**
> *Description:* Topbar notification bell with unread count badge. Dropdown showing recent notifications. Click navigates to relevant entity. Full notification page with filters.
> *Sub-tasks:*
> - [ ] Notification bell icon with badge count (polled every 30s or SSE)
> - [ ] Dropdown: last 10 notifications with mark-as-read on click
> - [ ] Full notification page with type filter and pagination
> - [ ] Click-through navigation (task → task detail, document → document, etc.)

---

### Epic 7: Team, Dashboard & Settings
*Goal: Workload view, leave management, partner approval queue, recently deleted, firm settings, audit log, and the main dashboard.*

> **Story 7.1: [Backend] Team module — workload, leave, approval queue**
> *Description:* Workload computation (from live task data), leave CRUD with approval, partner approval queue query.
> *Sub-tasks:*
> - [ ] `WorkloadService` — compute per-user stats + load_status
> - [ ] `LeaveService` — CRUD + approve/reject + task flagging on approval
> - [ ] `ApprovalQueueService` — query tasks in PARTNER_APPROVAL for current user
> - [ ] Controllers per contracts 2.10
> - [ ] Integration tests

> **Story 7.2: [Backend] Recently deleted and audit log**
> *Description:* Recently deleted: aggregate soft-deleted records across all entity tables. Restore endpoint. Audit log: paginated query of user_action_log with filters.
> *Sub-tasks:*
> - [ ] `RecentlyDeletedService` — aggregate query across entity tables
> - [ ] `RestoreService` — unset deleted_at/deleted_by per entity type
> - [ ] `AuditLogService` — paginated query with user/entity/action/date filters
> - [ ] Controllers per contracts 2.12, 2.13
> - [ ] Integration tests

> **Story 7.3: [Frontend] Dashboard**
> *Description:* Main landing page after login. Shows: my tasks (overdue, due today, due this week), approval queue (for PARTNER/MANAGER), upcoming deadlines, recent notifications.
> *Sub-tasks:*
> - [ ] Route `(app)/dashboard/+page.svelte`
> - [ ] "My Tasks" widget (3 sections: overdue, today, this week)
> - [ ] "Approval Queue" widget (PARTNER/MANAGER only)
> - [ ] "Upcoming Deadlines" widget (next 7 days)
> - [ ] "Recent Activity" widget (last 10 notifications)

> **Story 7.4: [Frontend] Team workload, leave, and settings pages**
> *Description:* Workload heatmap/table, leave calendar, firm settings page, user management page, audit log page.
> *Sub-tasks:*
> - [ ] Workload table with load_status color coding
> - [ ] Leave request form + calendar view of team leave
> - [ ] Firm settings form (buffer days, auto-generation toggle, etc.)
> - [ ] User management: list, invite, edit role, deactivate
> - [ ] Audit log table with filters
> - [ ] Recently deleted page with restore buttons

---

### Epic 8: Frontend Application Shell
*Goal: Authenticated layout (sidebar, topbar, breadcrumbs), auth pages (login, register), and shared components.*

> **Story 8.1: [Frontend] Auth pages — login and register**
> *Description:* Login page with email/password. Register page with firm name + user details. Redirect to dashboard on success. Error states for all auth failure modes.
> *Sub-tasks:*
> - [ ] Route `(auth)/login/+page.svelte`
> - [ ] Route `(auth)/register/+page.svelte`
> - [ ] Form validation (client-side + server-side error display)
> - [ ] JWT handling: store access token in memory, refresh cookie handled by SvelteKit hooks
> - [ ] Redirect logic: authenticated → dashboard, unauthenticated → login

> **Story 8.2: [Frontend] Authenticated layout — sidebar, topbar, breadcrumbs**
> *Description:* The app shell for all authenticated pages. Sidebar with navigation (collapsible), topbar with user menu + notification bell, breadcrumb trail.
> *Acceptance Criteria:*
> - [ ] Sidebar: Dashboard, Clients, Engagements, Tasks, Compliance, Documents, DSC, Team, Settings
> - [ ] Active page highlighted in sidebar
> - [ ] User menu: profile, settings, logout
> - [ ] Notification bell (from Story 6.3)
> - [ ] Responsive: sidebar collapses to icons on mobile
> - [ ] Breadcrumb trail derived from route
> *Sub-tasks:*
> - [ ] Layout `(app)/+layout.svelte`
> - [ ] Sidebar component with route-based active state
> - [ ] Topbar component with user dropdown
> - [ ] Breadcrumb component
> - [ ] Mobile responsive: sidebar toggle, off-canvas on small screens
> - [ ] SvelteKit hooks: auth guard (redirect to login if no valid session)

> **Story 8.3: [Frontend] Shared UI component library**
> *Description:* Reusable components used across all pages. Build these before feature pages.
> *Sub-tasks:*
> - [ ] `DataTable` — sortable, paginated table with column config
> - [ ] `Modal` — dialog overlay with form support
> - [ ] `FormField` — input wrapper with label, error, help text
> - [ ] `StatusBadge` — colored pill for task/engagement/compliance status
> - [ ] `UserPicker` — searchable user selector (single and multi)
> - [ ] `ClientPicker` — searchable client selector
> - [ ] `DatePicker` — date input with calendar popup
> - [ ] `FileDropzone` — drag-and-drop file upload
> - [ ] `Toast` — notification toasts (success, error, info)
> - [ ] `EmptyState` — zero-data placeholder with action button
> - [ ] `LoadingSkeleton` — shimmer placeholder for loading states
> - [ ] `ConfirmDialog` — "Are you sure?" modal for destructive actions

---

### Implementation Order (Recommended Sprint Sequence)

| Sprint | Stories | Dependency |
|---|---|---|
| **Sprint 1** (Week 1-2) | 1.1, 1.2, 1.6, 8.1, 8.2, 8.3 | Foundation + frontend shell. Parallel FE/BE. |
| **Sprint 2** (Week 3-4) | 1.3, 1.4, 1.5 | Auth + multi-tenancy. Blocks all feature work. |
| **Sprint 3** (Week 5-6) | 2.1, 2.2, 2.3, 2.4, 2.5, 2.6 | Clients + engagements (full stack). |
| **Sprint 4** (Week 7-8) | 3.1, 3.2, 3.3, 3.4 | Task engine (full stack). Core value prop. |
| **Sprint 5** (Week 9-10) | 4.1, 4.2, 4.3, 4.4 | Documents + client portal. |
| **Sprint 6** (Week 11-12) | 5.1, 5.2, 5.3, 5.4, 5.5 | Compliance + credentials + DSC. |
| **Sprint 7** (Week 13-14) | 6.1, 6.2, 6.3 | Notifications + all cron jobs. |
| **Sprint 8** (Week 15-16) | 7.1, 7.2, 7.3, 7.4 | Team, dashboard, settings, audit. |

⚠️ **Assumption:** Sprint 1 FE and BE work in parallel. FE mocks API responses using the contracts above. BE delivers real endpoints by end of Sprint 2. Integration begins Sprint 3.
