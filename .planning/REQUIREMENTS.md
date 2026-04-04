# Requirements: CA Practice OS

**Defined:** 2026-03-27
**Core Value:** Every person in the firm knows exactly what to work on, every deadline is visible, and no client falls through the cracks.

## v1 Requirements

Requirements for initial release. Task tracking + client/engagement management is the core.

### Foundation

- [x] **FOUND-01**: Developer can start the full stack with `pnpm dev` (NestJS API + SvelteKit web)
- [x] **FOUND-02**: Shared package exports enums, DTOs, and constants importable by both apps
- [x] **FOUND-03**: Docker Compose runs PostgreSQL 16, Redis 7, and MinIO locally
- [x] **FOUND-04**: Environment variables validated on startup with clear error messages
- [x] **FOUND-05**: All tables use UUID v4 primary keys
- [x] **FOUND-06**: Every table has audit fields (created_at, updated_at, created_by, updated_by)
- [x] **FOUND-07**: Soft deletes on all user-facing entities (deleted_at, deleted_by)
- [x] **FOUND-08**: Health check endpoint returns DB + Redis connectivity status

### Multi-Tenancy

- [x] **TENANT-01**: Every data table scoped by firm_id
- [x] **TENANT-02**: Prisma $extends client extension auto-injects firm_id WHERE clause on all queries
- [x] **TENANT-03**: FirmScopedService base class provides getFirmId() from AsyncLocalStorage
- [x] **TENANT-04**: Cross-tenant data access returns empty/404 (never leaks data)

### Authentication

- [x] **AUTH-01**: User can register a new firm with email, password, firm name, and full name
- [x] **AUTH-02**: User can log in with email/password and receive JWT access token
- [x] **AUTH-03**: Access token expires in 15 minutes, refresh token in HTTP-only cookie (7 days)
- [x] **AUTH-04**: User can refresh access token via cookie-based refresh endpoint
- [x] **AUTH-05**: User can log out (session deleted, cookie cleared)
- [x] **AUTH-06**: Max 5 concurrent sessions per user; 6th login evicts oldest
- [x] **AUTH-07**: Deactivated users receive 403 on login attempt
- [x] **AUTH-08**: Login rate limited to 5 req/min per IP; register to 3 req/min per IP
- [x] **AUTH-09**: GET /api/auth/me returns current user profile and firm details

### Users

- [ ] **USER-01**: Admin/Partner can list users with role, active status, and search filters
- [ ] **USER-02**: Admin/Partner can create a new user with email, name, role, and temporary password
- [ ] **USER-03**: Admin/Partner can update user details (name, phone, role, notification preferences)
- [ ] **USER-04**: Admin/Partner can deactivate a user (shows count of open tasks needing reassignment)
- [ ] **USER-05**: Cannot deactivate the last active PARTNER or ADMIN in a firm

### Clients

- [x] **CLIENT-01**: User can create a client with display name, entity type, PAN/TAN/CIN, contact info, and team assignment
- [x] **CLIENT-02**: PAN, TAN, CIN validated by regex format on create/update
- [x] **CLIENT-03**: Client display_name is unique per firm (case-insensitive)
- [x] **CLIENT-04**: User can list clients with pagination, search, and filters (status, entity_type, tag, assigned_partner)
- [x] **CLIENT-05**: User can view client detail with GST numbers, assigned team, engagement count, open task count
- [x] **CLIENT-06**: User can update client fields
- [x] **CLIENT-07**: User can soft-delete a client (blocked if active engagements exist)
- [x] **CLIENT-08**: User can add/edit/delete GST numbers for a client (GSTIN regex validated, one primary per client)
- [x] **CLIENT-09**: Assignment fields verify user role (partner_id must be PARTNER, etc.)

### Engagements

- [ ] **ENG-01**: User can create an engagement linked to a client and engagement type
- [ ] **ENG-02**: Engagement name auto-generated as "[Type] - [Client] - [Period]" when not provided
- [ ] **ENG-03**: Partner/Manager inherited from client when null on creation
- [ ] **ENG-04**: Engagement creation optionally instantiates task chain from template (auto_create_tasks)
- [ ] **ENG-05**: User can list engagements with client, type, status, period, and task summary
- [ ] **ENG-06**: User can transition engagement status (ACTIVE, ON_HOLD, COMPLETED, CANCELLED)
- [ ] **ENG-07**: COMPLETED blocked if open tasks exist (returns blocking task IDs)
- [ ] **ENG-08**: CANCELLED auto-cancels TO_DO and IN_PROGRESS child tasks

### Tasks

- [ ] **TASK-01**: User can create a task (standalone or engagement-bound) with title, description, priority, assignee, reviewer, due date, tags
- [ ] **TASK-02**: Task status transitions enforce allowed-transitions matrix; invalid transitions return 400 with allowed_transitions[]
- [ ] **TASK-03**: DONE transition blocked by incomplete required checklist items
- [ ] **TASK-04**: completed_at and cancelled_at auto-set on terminal transitions
- [ ] **TASK-05**: internal_due_date auto-computed from buffer chain (PRD section 13.3)
- [ ] **TASK-06**: Subtask depth limited to 1 level
- [ ] **TASK-07**: User can list tasks with filters (assignee, client, engagement, status, priority, due date range, overdue, search)
- [ ] **TASK-08**: User can add/edit/toggle/delete checklist items (max 30 per task)
- [ ] **TASK-09**: User can add task dependencies with cycle detection (circular dependency returns 400)
- [ ] **TASK-10**: Predecessor completing to DONE emits DEPENDENCY_UNBLOCKED event
- [ ] **TASK-11**: User can post comments with @mentions (max 10) and threaded replies (depth 1)
- [ ] **TASK-12**: Task activity log records all mutations with actor, old/new values, timestamp
- [ ] **TASK-13**: Notifications emitted on status change (TASK_ASSIGNED, REVIEW_REQUESTED, etc.)

### Notifications

- [ ] **NOTIF-01**: In-app notifications created for all event types (task assigned, status change, comment mention, dependency unblocked)
- [ ] **NOTIF-02**: User can view notification list with unread count
- [ ] **NOTIF-03**: User can mark individual notification as read
- [ ] **NOTIF-04**: User can mark all notifications as read

### Audit & Logging

- [ ] **AUDIT-01**: Every POST/PATCH/PUT/DELETE creates an immutable user_action_log entry
- [ ] **AUDIT-02**: Log includes firm_id, user_id, action, entity_type, entity_id, metadata, ip_address
- [ ] **AUDIT-03**: Failed log insert never fails the API response (fire-and-forget)
- [ ] **AUDIT-04**: Partner/Admin can view audit log with filters (user, entity, action, date range)
- [ ] **AUDIT-05**: Every request logged with structured fields (request_id, firm_id, user_id, method, path, status, duration_ms)

### Recently Deleted

- [ ] **DEL-01**: Partner/Admin can view recently deleted records across all entity types
- [ ] **DEL-02**: Partner can restore any soft-deleted record within 30 days
- [ ] **DEL-03**: Records show days until permanent deletion

### Team & Workload

- [ ] **TEAM-01**: User can view team workload (open tasks, overdue count, load status per user)
- [ ] **TEAM-02**: User can create leave requests with type, date range, half-day option
- [ ] **TEAM-03**: Manager/Partner can approve/reject leave requests
- [ ] **TEAM-04**: Partner/Manager can view approval queue (tasks in PARTNER_APPROVAL status)

### Frontend Shell

- [x] **SHELL-01**: Login page with email/password, error states for all auth failures
- [x] **SHELL-02**: Register page with firm name + user details
- [x] **SHELL-03**: Authenticated layout with collapsible sidebar (Dashboard, Clients, Engagements, Tasks, Team, Settings)
- [x] **SHELL-04**: Topbar with user menu (profile, settings, logout) and notification bell
- [x] **SHELL-05**: Breadcrumb trail derived from route
- [x] **SHELL-06**: Responsive: sidebar collapses to icons on mobile
- [x] **SHELL-07**: Auth guard redirects unauthenticated users to login
- [x] **SHELL-08**: JWT stored in memory, refresh token handled via SvelteKit hooks

### Frontend Components

- [x] **COMP-01**: DataTable component (sortable, paginated, column config)
- [x] **COMP-02**: Modal component with form support
- [x] **COMP-03**: FormField component (input wrapper with label, error, help text)
- [x] **COMP-04**: StatusBadge component (colored pills for task/engagement status)
- [x] **COMP-05**: UserPicker and ClientPicker (searchable selectors)
- [x] **COMP-06**: DatePicker with calendar popup
- [x] **COMP-07**: Toast notifications (success, error, info)
- [x] **COMP-08**: EmptyState and LoadingSkeleton components
- [x] **COMP-09**: ConfirmDialog for destructive actions

### Frontend Pages

- [ ] **PAGE-01**: Client list page with filters, search, pagination, empty state, loading skeleton
- [ ] **PAGE-02**: Client detail page with tabs (Overview, Engagements, Tasks) and editable fields
- [ ] **PAGE-03**: Engagement list page with filters + create modal (type selector, template preview)
- [ ] **PAGE-04**: Task list with table view (sortable/filterable) and Kanban view (drag-to-change-status)
- [ ] **PAGE-05**: Task detail page (status controls, checklist, dependencies, comments, activity timeline)
- [ ] **PAGE-06**: Dashboard (my tasks: overdue/today/this week, approval queue, recent notifications)
- [ ] **PAGE-07**: Team workload table with load status indicators
- [ ] **PAGE-08**: Leave request form + approval interface
- [ ] **PAGE-09**: Firm settings page (buffer days, toggles)
- [ ] **PAGE-10**: User management page (list, invite, edit role, deactivate)
- [ ] **PAGE-11**: Audit log page with filters
- [ ] **PAGE-12**: Recently deleted page with restore buttons

### Error Handling

- [x] **ERR-01**: Global exception filter returns consistent JSON format (statusCode, message, error, request_id)
- [x] **ERR-02**: Validation pipe with descriptive error messages
- [x] **ERR-03**: Request correlation ID (request_id) propagated across all log entries

## v2 Requirements

Deferred to V1.1+. Tracked but not in current roadmap.

### Document Management

- **DOC-01**: User can upload documents via pre-signed S3 URLs (50MB max)
- **DOC-02**: User can download documents via pre-signed GET URLs (15-min TTL)
- **DOC-03**: Document versioning (new version links to original)
- **DOC-04**: Document request with token-based client upload portal
- **DOC-05**: Public upload page (mobile-responsive, no auth)
- **DOC-06**: Document list with filters, version history, type icons

### Compliance Calendar

- **COMP-01**: Statutory deadline seed data (global, read-only per firm)
- **COMP-02**: Client compliance assignments (enable/disable per deadline)
- **COMP-03**: Calendar view by month/year with deadline cards
- **COMP-04**: Auto-task generation from compliance assignments

### Credentials & DSC

- **CRED-01**: Credential CRUD with AES-256-GCM encrypted passwords
- **CRED-02**: Role-based access (ARTICLE blocked, JUNIOR_CA scoped)
- **CRED-03**: Every credential view creates access log entry
- **DSC-01**: DSC record CRUD with expiry tracking
- **DSC-02**: Expiry countdown and status badges

### Automation & Cron

- **CRON-01**: Auto-task generation from compliance assignments (06:00 IST daily)
- **CRON-02**: Overdue + stuck task detection (07:00 IST daily)
- **CRON-03**: DSC expiry check (30/15/7 day alerts)
- **CRON-04**: Document request auto-reminders
- **CRON-05**: Document retention expiry cleanup
- **CRON-06**: Recently deleted hard-delete after 30 days
- **CRON-07**: Email notification delivery via BullMQ

## Out of Scope

| Feature | Reason |
|---------|--------|
| WhatsApp notifications | Removed from V1 entirely — API complexity, deferred |
| Email notifications | Deferred to V1.1, in-app only for V1 |
| RBAC hard enforcement | V1.5 — V1 uses action logging, review with CA managers first |
| OAuth / Magic link login | Email/password sufficient for V1 |
| Mobile app | Web-first, responsive design covers mobile |
| User-created engagement types | Platform-only templates in V1 |
| Configurable financial year | Fixed to April-March (Indian FY) |
| Billing / subscription enforcement | V1 is free for all firms |
| Real-time updates (WebSocket/SSE) | Polling sufficient at MVP scale |
| Custom field definitions UI | Backend supports it, UI deferred |
| Engagement custom fields | Deferred — standard fields sufficient |
| Client upload portal | Deferred with document management |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Complete |
| FOUND-02 | Phase 1 | Complete |
| FOUND-03 | Phase 1 | Complete |
| FOUND-04 | Phase 1 | Complete |
| FOUND-05 | Phase 1 | Complete |
| FOUND-06 | Phase 1 | Complete |
| FOUND-07 | Phase 1 | Complete |
| FOUND-08 | Phase 1 | Complete |
| TENANT-01 | Phase 1 | Complete |
| TENANT-02 | Phase 1 | Complete |
| TENANT-03 | Phase 1 | Complete |
| TENANT-04 | Phase 1 | Complete |
| ERR-01 | Phase 1 | Complete |
| ERR-02 | Phase 1 | Complete |
| ERR-03 | Phase 1 | Complete |
| AUTH-01 | Phase 2 | Complete |
| AUTH-02 | Phase 2 | Complete |
| AUTH-03 | Phase 2 | Complete |
| AUTH-04 | Phase 2 | Complete |
| AUTH-05 | Phase 2 | Complete |
| AUTH-06 | Phase 2 | Complete |
| AUTH-07 | Phase 2 | Complete |
| AUTH-08 | Phase 2 | Complete |
| AUTH-09 | Phase 2 | Complete |
| USER-01 | Phase 2 | Pending |
| USER-02 | Phase 2 | Pending |
| USER-03 | Phase 2 | Pending |
| USER-04 | Phase 2 | Pending |
| USER-05 | Phase 2 | Pending |
| AUDIT-01 | Phase 2 | Pending |
| AUDIT-02 | Phase 2 | Pending |
| AUDIT-03 | Phase 2 | Pending |
| AUDIT-04 | Phase 2 | Pending |
| AUDIT-05 | Phase 2 | Pending |
| SHELL-01 | Phase 3 | Complete |
| SHELL-02 | Phase 3 | Complete |
| SHELL-03 | Phase 3 | Complete |
| SHELL-04 | Phase 3 | Complete |
| SHELL-05 | Phase 3 | Complete |
| SHELL-06 | Phase 3 | Complete |
| SHELL-07 | Phase 3 | Complete |
| SHELL-08 | Phase 3 | Complete |
| COMP-01 | Phase 3 | Complete |
| COMP-02 | Phase 3 | Complete |
| COMP-03 | Phase 3 | Complete |
| COMP-04 | Phase 3 | Complete |
| COMP-05 | Phase 3 | Complete |
| COMP-06 | Phase 3 | Complete |
| COMP-07 | Phase 3 | Complete |
| COMP-08 | Phase 3 | Complete |
| COMP-09 | Phase 3 | Complete |
| CLIENT-01 | Phase 4 | Complete |
| CLIENT-02 | Phase 4 | Complete |
| CLIENT-03 | Phase 4 | Complete |
| CLIENT-04 | Phase 4 | Complete |
| CLIENT-05 | Phase 4 | Complete |
| CLIENT-06 | Phase 4 | Complete |
| CLIENT-07 | Phase 4 | Complete |
| CLIENT-08 | Phase 4 | Complete |
| CLIENT-09 | Phase 4 | Complete |
| ENG-01 | Phase 4 | Pending |
| ENG-02 | Phase 4 | Pending |
| ENG-03 | Phase 4 | Pending |
| ENG-04 | Phase 4 | Pending |
| ENG-05 | Phase 4 | Pending |
| ENG-06 | Phase 4 | Pending |
| ENG-07 | Phase 4 | Pending |
| ENG-08 | Phase 4 | Pending |
| PAGE-01 | Phase 4 | Pending |
| PAGE-02 | Phase 4 | Pending |
| PAGE-03 | Phase 4 | Pending |
| TASK-01 | Phase 5 | Pending |
| TASK-02 | Phase 5 | Pending |
| TASK-03 | Phase 5 | Pending |
| TASK-04 | Phase 5 | Pending |
| TASK-05 | Phase 5 | Pending |
| TASK-06 | Phase 5 | Pending |
| TASK-07 | Phase 5 | Pending |
| TASK-08 | Phase 5 | Pending |
| TASK-09 | Phase 5 | Pending |
| TASK-10 | Phase 5 | Pending |
| TASK-11 | Phase 5 | Pending |
| TASK-12 | Phase 5 | Pending |
| TASK-13 | Phase 5 | Pending |
| PAGE-04 | Phase 5 | Pending |
| PAGE-05 | Phase 5 | Pending |
| NOTIF-01 | Phase 6 | Pending |
| NOTIF-02 | Phase 6 | Pending |
| NOTIF-03 | Phase 6 | Pending |
| NOTIF-04 | Phase 6 | Pending |
| TEAM-01 | Phase 6 | Pending |
| TEAM-02 | Phase 6 | Pending |
| TEAM-03 | Phase 6 | Pending |
| TEAM-04 | Phase 6 | Pending |
| DEL-01 | Phase 6 | Pending |
| DEL-02 | Phase 6 | Pending |
| DEL-03 | Phase 6 | Pending |
| PAGE-06 | Phase 6 | Pending |
| PAGE-07 | Phase 6 | Pending |
| PAGE-08 | Phase 6 | Pending |
| PAGE-09 | Phase 6 | Pending |
| PAGE-10 | Phase 6 | Pending |
| PAGE-11 | Phase 6 | Pending |
| PAGE-12 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 104 total
- Mapped to phases: 104
- Unmapped: 0

---
*Requirements defined: 2026-03-27*
*Last updated: 2026-03-27 after roadmap creation*
