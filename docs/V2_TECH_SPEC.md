# V2 Tech Spec — Hardening, Compliance Engine, Documents

**Status:** Draft for review | **Date:** 2026-07-16
**Scope:** 3 epics, ship order = 1 → 2 → 3. Each epic independently shippable.
**Audience:** written so an SDE 1 can execute any story without follow-up questions.

Decisions locked with product:
- Object storage: **Cloudflare R2** (S3-compatible SDK, zero egress fees)
- Email: **Resend**
- "Doc minification" = **server-side compression of uploaded files** (images → WebP; PDFs pass-through in V1)

---

# Part 0: Current-State Facts (verified in code)

Read this first. Everything below builds on these.

| Fact | Where |
|---|---|
| Prisma models for compliance, documents, DSC **already exist** (Phase 1 created all 33 tables) | `apps/api/prisma/schema/compliance.prisma`, `document.prisma`, `dsc.prisma` |
| 24 statutory deadlines already seeded (GSTR-1/3B/9/9C, TDS, ITR, ROC…) | `apps/api/prisma/seed/statutory-deadlines.ts` |
| `NotificationType` enum already has `TASK_OVERDUE`, `DSC_EXPIRY_ALERT_30/15/7`, `DOCUMENT_REQUEST_*`; `NotificationChannel` has `EMAIL` | `apps/api/prisma/schema/base.prisma:238-264` |
| All domain services extend `FirmScopedService` → `this.prisma` (firm-scoped + soft-delete filtered), `this.unscopedPrisma` (raw) | `apps/api/src/common/base/firm-scoped.service.ts` |
| Firm/user context lives in AsyncLocalStorage; `requestContextStorage` is exported — background jobs can `.run()` a synthetic context | `apps/api/src/common/context/request-context.ts:9` |
| Redis client exists (ioredis), custom Redis `ThrottleGuard` factory exists | `apps/api/src/common/services/redis.service.ts`, `common/guards/throttle.guard.ts` |
| Error shape everywhere: `{ statusCode, message, error, request_id }` via `GlobalExceptionFilter` | `apps/api/src/common/filters/global-exception.filter.ts` |
| FE is a **Svelte 5 SPA** (not SvelteKit): `api()` wrapper with `ApiError` + 429 lockout, hash-less custom router, toast store, analytics stub | `apps/web/src/lib/api.ts`, `router.svelte.ts`, `analytics.ts` |
| Fire-and-forget side effects pattern: `.catch(() => {})`, never block main op | `apps/api/src/task/task-notification.helper.ts` |
| Notification creation pattern to copy | `task-notification.helper.ts:176-198` |
| Shared validation regexes (GSTIN etc.) | `packages/shared/src/constants/regex-patterns.ts` |
| **Not installed yet:** BullMQ, multer usage, S3 SDK, sharp, Sentry, Resend | `apps/api/package.json` |

**Deploy targets:** API on Railway, web on Vercel, Postgres+Redis on Railway. MinIO in local docker-compose.

---

# Part 1: Technical Implementation Document

## 1. System Architecture & Strategy

### Backend

**New modules** (all under `apps/api/src/`):

| Module | Responsibility |
|---|---|
| `queue/` | BullMQ wiring: queue registration, worker host, repeatable (cron) job registration, failure→Sentry hook |
| `email/` | Resend client, HTML templates (pure functions), `EmailService.enqueue()` — nothing sends synchronously |
| `compliance/` | Assignment CRUD, calendar query/status endpoints, period computation (pure util), generation + overdue processors |
| `dsc/` | DSC record CRUD, expiring query, expiry-alert processor |
| `storage/` | S3 client (R2 prod / MinIO dev), put, presigned GET, delete |
| `document/` | Upload (multipart → compress → R2 → row), list, download, soft delete, versions |
| `document-request/` | Request CRUD + **public token endpoints** (unauthenticated client upload) + reminder processor |

**Sync vs async decisions:**

- **Email sending is async** (BullMQ `email` queue). Reason: Resend latency/outage must never add latency to or fail an API mutation. Retry 3× with exponential backoff.
- **Compliance generation is async + fanned out per firm** (`compliance` queue: one scheduler job enqueues one job per firm). Reason: per-firm isolation — one firm's bad data can't kill the whole run; matches the scaling path in `docs/scalability_roadmap.md §2`.
- **File compression is synchronous inside the upload request.** Reason: sharp WebP re-encode of a ≤25MB image takes <1s; a staging-bucket + confirm + status-polling flow would add 3 endpoints, a `processing_status` migration, and FE polling for zero pilot-scale benefit. Scaling path (documented, not built): presigned PUT + async processing when p95 upload latency > 5s or files > 25MB are needed.
- **Workers run inside the API process** in V1 (Railway single service). Scaling path: `WORKER_MODE=true` env flag to run a second Railway service that only processes queues — the code split (processors in their own providers) makes this a config change, not a refactor.

**Caching:** none added in V1. Compliance calendar reads are firm-scoped, indexed (`@@index([firmId, dueDate, status])` already exists) and low-QPS. Do not add Redis caching until a measured problem exists.

### Background job schedule (all IST; cron strings are UTC)

| Job | IST | Cron (UTC) | Queue job name |
|---|---|---|---|
| Compliance generation (fan-out) | 06:00 | `30 0 * * *` | `compliance.generate` |
| Overdue detection + digest | 07:00 | `30 1 * * *` | `compliance.overdue` |
| DSC expiry alerts | 08:00 | `30 2 * * *` | `dsc.expiry` |
| Document request reminders | 09:00 | `30 3 * * *` | `docs.reminders` |

Registered as BullMQ **repeatable jobs** (not `@nestjs/schedule`) — dedupe across multiple instances comes free, and Railway restarts don't double-register (BullMQ upserts repeatables by key).

### Job execution context — the one trap

`FirmScopedService.getFirmId()` throws outside a request. Processors MUST wrap per-firm work in a synthetic context:

```ts
// queue/run-in-firm-context.ts
import { requestContextStorage } from '../common/context/request-context';

export function runInFirmContext<T>(
  firmId: string,
  systemUserId: string,   // see "system actor" below
  jobId: string,
  fn: () => Promise<T>,
): Promise<T> {
  return requestContextStorage.run(
    { firmId, userId: systemUserId, requestId: `job:${jobId}` },
    fn,
  );
}
```

Inside `runInFirmContext`, existing scoped services (`TaskService`, `TaskNotificationHelper`) work unchanged. **System actor** for `createdBy`/audit fields: the firm's oldest active `PARTNER` (query once per firm per job run, fallback oldest active `ADMIN`). ⚠️ Assumption: no dedicated system user row; auto-created tasks show as created by the managing partner. Confirm with product — if unacceptable, add a `is_system` user per firm in a later migration.

### Database

**One migration** (`v2_compliance_documents`):

1. `compliance_calendar_entries`: add `@@unique([firmId, clientId, statutoryDeadlineId, periodLabel], map: "uq_calendar_entry_period")` — this is the idempotency backbone of the generation job (re-runs collide and skip instead of duplicating).
2. `client_compliance_assignments`: add `@@unique([firmId, clientId, statutoryDeadlineId], map: "uq_client_deadline")` (one assignment per client per deadline; soft-deleted rows excluded by partial index — see note) and `@@index([firmId, isEnabled])`.
3. `documents`: add `@@index([firmId, createdAt(sort: Desc)])` for the "all firm documents" listing.

⚠️ Note on 2: Prisma can't express partial unique indexes. Write raw SQL in the migration: `CREATE UNIQUE INDEX uq_client_deadline ON client_compliance_assignments (firm_id, client_id, statutory_deadline_id) WHERE deleted_at IS NULL;` and keep it out of the Prisma schema (comment in schema file pointing at the migration).

**Data lifecycle:** documents soft-delete like everything else; the R2 object is NOT deleted on soft delete (restore within 30 days must work via existing Recently Deleted page). Hard GC of orphaned R2 objects is out of scope V1 (documented in v2_pending_items).

### Frontend (Svelte 5 SPA)

New pages (register in `router.svelte.ts` + sidebar):

| Route | Page | Auth |
|---|---|---|
| `/compliance` | ComplianceCalendar.svelte | yes |
| `/dsc` | DscRegistry.svelte | yes |
| `/upload/:token` | PublicUpload.svelte | **no** — renders outside the app shell |

New shared components: `CsvImportModal.svelte`, `DocumentsSection.svelte` (mounted as tab in ClientDetail / TaskDetail / EngagementDetail), `RequestDocumentModal.svelte`, `ComplianceAssignmentsTab.svelte` (ClientDetail).

**State:** keep existing pattern — TanStack Query (`lib/query.ts`) for server state, no new stores. **Optimistic updates:** compliance entry status chips (PENDING → FILED) update optimistically, rollback + toast on `ApiError` — copy the Kanban drag pattern from TaskList. Uploads and CSV import are NOT optimistic (server is source of truth for validation results).

**Every list gets 4 states** (loading skeleton / empty / error / data) using existing `LoadingSkeleton` + `EmptyState` components.

### Security

- All new authed endpoints: existing JWT guard + firm scoping. RBAC via existing `permissions.ts` / role matrix — new resources: `COMPLIANCE`, `DSC`, `DOCUMENT` (add to `packages/shared` role matrix const: ARTICLE read-only on COMPLIANCE/DSC; all roles may upload documents; only MANAGER+ may delete documents or change compliance assignments).
- **Public upload endpoints** (`/api/public/document-requests/:token/*`): no auth, so defense in depth:
  - token = UUIDv4 (already `@unique @default(dbgenerated("gen_random_uuid()"))` on `document_requests.upload_token`) — unguessable
  - expiry enforced (`upload_token_expires_at`, default now+14d) → `410 Gone`
  - rate limit **5 req/min per IP** via existing ThrottleGuard factory
  - max 10 uploaded files per request lifetime (count check before accept)
  - same mime allowlist + 25MB cap as internal uploads
  - response leaks nothing beyond firm display name + request title
- Rate limits (per user unless noted): upload `20/min`, CSV import `3/min`, presigned download `60/min`, public upload `5/min/IP`.
- PII: CSV import files are parsed in memory and never written to disk; log row **counts**, never row contents. Sentry `beforeSend` scrubs `Authorization` headers and request bodies.

---

## 2. API Contracts

Error shape everywhere (existing): `{ statusCode, message, error, request_id }`. Only deltas noted below. All authed endpoints: `Auth: Bearer` + firm-scoped.

### 2.1 CSV Client Import

```
GET /api/clients/import/template
→ 200 text/csv — header row + 2 example rows

POST /api/clients/import?mode=validate | commit
Content-Type: multipart/form-data; field "file" (text/csv, ≤1MB, ≤500 data rows)

Response 200 (both modes):
{
  "mode": "validate",
  "totalRows": 137,
  "validRows": 134,
  "invalidRows": 3,
  "createdCount": 0,            // >0 only in commit mode
  "errors": [
    { "row": 12, "field": "pan", "message": "Invalid PAN format (expected AAAAA9999A)" },
    { "row": 40, "field": "pan", "message": "Duplicate of existing client 'Mehta Textiles'" },
    { "row": 41, "field": "entity_type", "message": "Unknown entity type 'PROPRIETOR' — allowed: INDIVIDUAL, HUF, ..." }
  ]
}

Errors:
  400 – commit mode with ≥1 invalid row (body includes full errors array; NOTHING is created — all-or-nothing)
  400 – not a parseable CSV / >500 rows / missing required headers
  413 – file >1MB
  429 – rate limit (3/min)
```

CSV columns (header names exact, snake_case): `display_name*, entity_type*, pan, tan, cin, gstin, email, phone, assigned_partner_email, tags`. `gstin` and `tags` support multiple values separated by `;`.

**Commit is all-or-nothing** (single transaction). Rationale: partial imports make "which rows made it?" a support nightmare; user fixes CSV and re-runs. Re-run duplicate detection then makes previously-created rows error — that's correct behavior, surface it plainly.

### 2.2 Compliance

```
GET /api/compliance/deadlines?category=GST&entityType=PRIVATE_LIMITED
→ 200 { items: [ { id, code, name, description, category, recurrence,
                   recurrenceDay, applicableTo[], penaltyNotes } ] }
  // platform masters, unscoped, isActive only

GET /api/compliance/suggestions?clientId=<uuid>
→ 200 { items: [ { deadlineId, code, name, reason: "Entity type PRIVATE_LIMITED" | "Has GSTIN" } ] }
  // deadlines applicable to client's entityType; GST ones only if client has ≥1 GST number;
  // excludes deadlines already assigned (non-deleted assignment exists)

POST /api/compliance/assignments
{ "clientId": uuid, "statutoryDeadlineId": uuid,
  "autoGenerateTasks": bool = true, "internalBufferDays": int|null,   // null → firm default
  "customDueDateDay": int|null }                                       // null → statutory day
→ 201 assignment
  409 – assignment already exists for (client, deadline)
  400 – deadline not applicable to client's entityType (still allowed with "force": true — CA knows edge cases)

POST /api/compliance/assignments/bulk
{ "clientIds": uuid[] (≤200), "statutoryDeadlineIds": uuid[] (≤20), "autoGenerateTasks": bool }
→ 201 { "created": 240, "skippedExisting": 15, "skippedNotApplicable": 5 }
  // never errors on per-pair conflicts — skips and counts

GET    /api/compliance/assignments?clientId=<uuid>     → 200 { items: [...] } with deadline hydrated
PATCH  /api/compliance/assignments/:id                 { isEnabled?, autoGenerateTasks?, internalBufferDays?, customDueDateDay? }
DELETE /api/compliance/assignments/:id                 → 204 (soft delete; existing calendar entries KEPT, future generation stops)

GET /api/compliance/calendar?from=2026-07-01&to=2026-08-31&clientId&category&status&page&pageSize
→ 200 { items: [ { id, clientId, clientName, deadlineCode, deadlineName, category,
                   periodLabel, dueDate, internalDueDate, status, linkedTaskId,
                   penaltyPerDay, isOverdue } ],
        totalItems }
  // default from=today−30d, to=today+60d; sorted dueDate asc; max range 12 months

PATCH /api/compliance/calendar/:id
{ "status": "FILED" | "IN_PROGRESS" | "NOT_APPLICABLE" | "PENDING" }
→ 200 entry
  400 – invalid transition, body includes allowed_transitions[]  // same pattern as tasks
```

Entry status machine (mirror `TASK_STATUS_TRANSITIONS` pattern — new const `COMPLIANCE_ENTRY_TRANSITIONS` in `packages/shared/src/constants/`):

```
PENDING      → IN_PROGRESS, FILED, NOT_APPLICABLE, MISSED
IN_PROGRESS  → FILED, PENDING, MISSED
MISSED       → FILED               // late filing happens all the time
NOT_APPLICABLE → PENDING           // undo
FILED        → (terminal; PARTNER/ADMIN may revert to IN_PROGRESS — mistakes happen)
```

Side effect: task transition to `DONE` auto-sets any entry with `linkedTaskId = task.id` to `FILED` (fire-and-forget in `task.service.ts`). Reverse is NOT true (marking entry FILED does not touch the task — the CA may have filed outside the tracked task).

### 2.3 DSC

```
GET    /api/dsc?holderType&status&expiringInDays&page   → 200 { items, totalItems }
        // expiringInDays=30 → validUntil ≤ today+30d AND status=ACTIVE, sorted validUntil asc
POST   /api/dsc      { holderType, clientId|userId, holderName, class, type, issuedBy?, serialNumber?, validFrom, validUntil, storageLocation?, notes? }
        400 – validUntil ≤ validFrom; clientId required iff holderType=CLIENT
PATCH  /api/dsc/:id  (same fields + status; RENEWED requires renewedById pointing at another record)
DELETE /api/dsc/:id  → 204 soft delete
```

### 2.4 Documents

```
POST /api/documents
Content-Type: multipart/form-data
  file: binary (≤25MB)
  + fields: name?, description?, documentType? (enum, default GENERAL),
            clientId?, engagementId?, taskId?, isClientVisible?, versionOfId?
→ 201 {
  "id": uuid, "name": "balance-sheet.webp", "documentType": "BALANCE_SHEET",
  "mimeType": "image/webp", "fileSizeBytes": 184223,
  "compressed": true, "originalSizeBytes": 2411008, "version": 1
}
Errors:
  400 – no link target: at least ONE of clientId/engagementId/taskId required
  400 – linked entity not found in firm
  413 – >25MB
  415 – mime not in allowlist OR magic-bytes sniff disagrees with extension
  429 – rate limit (20/min)

GET /api/documents?clientId|engagementId|taskId&documentType&search&page&pageSize
→ 200 { items: [ { id, name, documentType, mimeType, fileSizeBytes, version,
                   uploadedByName, source, createdAt, tags[] } ], totalItems }

GET /api/documents/:id/download
→ 200 { "url": "https://<r2-presigned>", "expiresAt": iso }   // 15-min presigned GET,
                                                              // Content-Disposition: attachment; filename=<name>
DELETE /api/documents/:id → 204   // soft delete; R2 object retained for restore
```

Mime allowlist: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/vnd.ms-excel`, `text/csv`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`. Verify with magic bytes (`file-type` package), not just the client-sent header — a renamed `.exe` must 415.

### 2.5 Document Requests (incl. public)

```
POST /api/document-requests
{ "clientId": uuid, "title": "FY25-26 bank statements", "description"?, "dueDate"?, "taskId"?, "engagementId"? }
→ 201 { id, uploadToken, uploadUrl: "<APP_URL>/upload/<token>", uploadTokenExpiresAt }
  // side effects: email to client's contact email (if present) with uploadUrl;
  // in-app notification DOCUMENT_REQUEST_SENT to requester is NOT created (they did it themselves)

GET    /api/document-requests?clientId&status&page → 200 list (requester name + fulfillment doc hydrated)
POST   /api/document-requests/:id/remind  → 200 { remindersSent }  // manual re-send; 429 if <1h since last
PATCH  /api/document-requests/:id         { status: "CANCELLED" }  → 200

--- PUBLIC (no auth, rate-limited 5/min/IP) ---

GET /api/public/document-requests/:token
→ 200 { "firmName": "Sharma & Associates", "title", "description", "dueDate", "status",
        "filesUploaded": 2, "maxFiles": 10 }
  404 – unknown token
  410 – expired / CANCELLED / already FULFILLED

POST /api/public/document-requests/:token/upload
multipart "file" (same 25MB cap + allowlist + compression pipeline)
→ 201 { "name", "fileSizeBytes" }
  410 – as above;  409 – 10-file limit reached
  // Document row: source=CLIENT_UPLOAD, uploadedBy=request.requestedBy (⚠️ no client user exists;
  //   source field disambiguates true actor), clientId/taskId/engagementId copied from request
  // First upload → request.status=FULFILLED, fulfilledAt, fulfilledByDocumentId;
  //   further uploads still accepted until token expiry (clients send files one by one)
  // Each upload → in-app notification DOCUMENT_REQUEST_FULFILLED to requestedBy (dedupe: only first)
```

---

## 3. Compliance Generation — Full Algorithm (the hard part, read carefully)

### 3.1 Period computation (`apps/api/src/compliance/period.util.ts`)

Pure functions, zero I/O, exhaustively unit-tested. **All dates are calendar dates in IST** — represent them as `Date` objects at UTC midnight constructed via `new Date(Date.UTC(y, m, d))` and NEVER call `new Date(string)` on user input or `.getHours()`-family locally. "Today in IST" = `new Date(Date.now() + 5.5 * 3600_000)` → take UTC y/m/d.

```ts
export interface DuePeriod {
  periodLabel: string;   // canonical: "Apr 2026" | "Q1 FY26-27" | "H1 FY26-27" | "FY25-26"
  dueDate: Date;         // UTC-midnight calendar date
}

export function computeDuePeriods(
  deadline: {
    recurrence: RecurrenceType;
    recurrenceDay: number | null;
    recurrenceMonth: number | null;      // 1-12
    quarterMonthOffset: number | null;   // months after quarter end
  },
  windowStart: Date,  // inclusive
  windowEnd: Date,    // inclusive
  customDueDateDay?: number | null,      // assignment override for recurrenceDay
): DuePeriod[]
```

Rules per recurrence (Indian FY = Apr 1 – Mar 31; FY label `FY{yy}-{yy+1}`):

| Recurrence | Period covered | Due date | periodLabel |
|---|---|---|---|
| `MONTHLY` | calendar month M | day `recurrenceDay` of month M+1 | `"Apr 2026"` (month M) |
| `QUARTERLY` | FY quarter (Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar) | day `recurrenceDay` of (quarter-end month + `quarterMonthOffset ?? 1`) | `"Q1 FY26-27"` |
| `HALF_YEARLY` | H1=Apr-Sep, H2=Oct-Mar | day `recurrenceDay` of (half-end month + 1) | `"H1 FY26-27"` |
| `ANNUALLY` | the FY that **ended most recently before** the due date | `recurrenceDay` of `recurrenceMonth` each calendar year | `"FY25-26"` |
| `ONE_OFF` | — | **never auto-generated**; return `[]` | — |

Edge cases the implementation MUST handle (each one is a unit test):

1. **Day clamp:** `recurrenceDay=31` in a 30-day due month → clamp to last day (30). Feb → 28/29 (leap-aware). Use `new Date(Date.UTC(y, m + 1, 0)).getUTCDate()` for days-in-month.
2. **Year rollover:** December period, MONTHLY → due in January of next year.
3. **FY boundary:** ANNUALLY with `recurrenceMonth=12` (GSTR-9 due 31 Dec 2026) covers `FY25-26` (ended Mar 2026), not FY26-27.
4. **Window boundaries inclusive:** dueDate exactly = windowStart or windowEnd → included.
5. **customDueDateDay** replaces `recurrenceDay` in due-date math but does NOT change periodLabel.
6. **Null recurrenceDay** on MONTHLY/QUARTERLY seed row → treat as data error: log warning with deadline code, skip (do not throw — one bad master must not kill the firm's run).
7. **Extension overrides:** after computing, look up `StatutoryDeadlineOverride` rows for `(statutoryDeadlineId, periodLabel)`; if found, replace dueDate with `extendedDate`. (Batch-load all overrides for the involved deadline IDs once per firm run, build a `Map<'deadlineId|periodLabel', Date>`.)

### 3.2 Generation processor (`compliance.generate.firm`, payload `{ firmId }`)

```
1. systemUserId = oldest active PARTNER of firm (fallback ADMIN; none → log error, abort firm)
2. runInFirmContext(firmId, systemUserId, job.id, async () => {
3.   assignments = prisma.clientComplianceAssignment.findMany({
       where: { isEnabled: true },                     // scoped client adds firmId + deletedAt IS NULL
       include impossible for cross-file relations → fetch clients + deadlines separately:
     })
4.   batch-load: clients (skip deletedAt / status ARCHIVED), active deadlines, overrides
5.   window = [todayIST, todayIST + 60 days]
6.   for each assignment (client alive, deadline active):
7.     periods = computeDuePeriods(deadline, windowStart, windowEnd, assignment.customDueDateDay)
8.     for each period:
9.       bufferDays = assignment.internalBufferDays
                      ?? firm.settings.default_internal_deadline_buffer_days ?? 3
10.      internalDueDate = dueDate − bufferDays days
11.      try:
12.        entry = prisma.complianceCalendarEntry.create({ clientId, statutoryDeadlineId,
                    periodLabel, dueDate, internalDueDate, status: PENDING })
13.      catch P2002 (unique collision on uq_calendar_entry_period):
14.        continue        // already generated on a previous run — idempotency by constraint
15.      if assignment.autoGenerateTasks:
16.        task = TaskService.createTask(...)  // through the service → status machine, activity
             title: `${deadline.name} — ${periodLabel} — ${client.displayName}`
             clientId, dueDate: entry.dueDate, internalDueDate: entry.internalDueDate
             priority: deadline.penaltyPerDay != null ? HIGH : MEDIUM
             assigneeId: client.assignedManagerId ?? client.assignedPartnerId ?? null
17.        prisma.complianceCalendarEntry.update({ id: entry.id, linkedTaskId: task.id })
18.   })
19. log summary: { firmId, assignmentsEvaluated, entriesCreated, entriesSkipped, tasksCreated, durationMs }
```

More edge cases (tests):

- **Assignment disabled/deleted mid-stream:** existing entries + tasks stay untouched; generation just stops producing new ones. Never retro-delete.
- **Client archived after entries exist:** overdue job skips archived clients' entries; UI shows them under the client regardless.
- **Task creation fails** (e.g. validation): catch, log with entry id, continue — entry exists without linked task; next run does NOT retry task creation (linkedTaskId stays null; entry visible in calendar either way). Simpler than a retry state machine; acceptable because failure here means a code bug, not a transient.
- **Duplicate GSTIN-driven double filing:** not our problem — one assignment per (client, deadline) is DB-enforced.
- **First-ever run backfill:** window starts *today* — we never generate entries for already-past due dates (a pilot firm onboarding in July must not get 200 instant-overdue March entries). If a firm wants history, they mark it manually.

### 3.3 Overdue processor (`compliance.overdue`, daily 07:00 IST)

Per firm (same fan-out + context wrapper):

1. `entries`: status `PENDING|IN_PROGRESS`, `dueDate < todayIST`, client not archived.
2. `tasks`: status not in `(DONE, CANCELLED)`, `dueDate < todayIST`.
3. **In-app notifications, deduped:** for each overdue task with an assignee, create `TASK_OVERDUE` notification **only if** none exists yet for `(recipientId, type, entityId)` — one `findFirst` guard per candidate. First-overdue only; no daily re-spam.
4. **Email digest:** group everything by responsible user (task assignee; for taskless entries → client's assignedManager ?? assignedPartner). One email per user per day: "3 compliance items and 2 tasks overdue" + top-10 list + link. Send via `email` queue. Skip user if 0 items. No per-item emails, ever.
5. Entries stay `PENDING` when overdue (UI derives `isOverdue = dueDate < today && status not FILED/NOT_APPLICABLE`). Auto-`MISSED` after +30 days overdue.

### 3.4 DSC expiry processor (`dsc.expiry`, daily 08:00 IST)

- `validUntil == today+30 | today+15 | today+7` (exact match → naturally fires once) AND `status=ACTIVE` → notification `DSC_EXPIRY_ALERT_{30|15|7}` to: holder user (if `holderType=TEAM_MEMBER`) else client's assignedPartner; plus email via queue.
- `validUntil < today` AND `status=ACTIVE` → set `status=EXPIRED` (audit-logged with system actor).
- Edge: job down for a day → exact match misses a threshold. Accepted V1 (three thresholds = redundancy). Noted in pending items.

---

## 4. Upload Compression Pipeline (`storage/compression.util.ts`)

```ts
export interface CompressionResult {
  buffer: Buffer;
  mimeType: string;        // possibly changed to image/webp
  fileName: string;        // extension swapped if converted
  compressed: boolean;
  originalSizeBytes: number;
}

export async function maybeCompress(
  buffer: Buffer, mimeType: string, fileName: string,
): Promise<CompressionResult>
```

Rules:

1. Only `image/jpeg`, `image/png` are candidates. PDFs, office files, existing WebP: **pass through untouched** (V1; ghostscript-based PDF compression is a documented later item — needs an apt layer on Railway).
2. Skip if `buffer.length < 100 * 1024` (100KB) — not worth the CPU or the format change.
3. `sharp(buffer).rotate()` (bakes EXIF orientation — critical: phone photos of documents are the primary CA use case) `.webp({ quality: 80 }).toBuffer()`.
4. Keep the WebP **only if** `webp.length < 0.9 * original.length`; else pass through original. Never make files bigger or churn formats for a 2% win.
5. On conversion: `fileName` extension → `.webp`, `mimeType` → `image/webp`; record `{ original_filename, original_size_bytes, compression: "webp-q80" }` into `documents.custom_fields` (JSONB already exists — no migration).
6. sharp failure (corrupt image) → log warning, pass through original. Compression must never fail an upload of a file that passed validation.
7. `checksumSha256` (schema field) is computed over the **stored** (post-compression) bytes.

Order of operations in the upload handler: multer memory buffer → size check → magic-byte sniff vs allowlist → `maybeCompress` → sha256 → `storage.putObject('firms/{firmId}/documents/{docId}/{sanitizedName}', ...)` → create `Document` row. Sanitize filename: NFC normalize, strip `/ \ .. control chars`, collapse whitespace, max 100 chars, never trust as R2 key alone (docId prefix guarantees uniqueness).

Log per upload: `{ documentId, firmId, userId, mimeIn, mimeOut, bytesIn, bytesOut, compressRatio, durationMs }`.

---

## 5. Observability & Logging

**Sentry (both apps), first story of Epic 1 — everything after ships with it on:**

- API: `@sentry/nestjs`, init before `NestFactory.create` (own `instrument.ts` imported first in `main.ts`). Capture in `GlobalExceptionFilter` only when `statusCode >= 500` OR exception is not an `HttpException`. Tags: `request_id`, `firm_id`, `user_id`, `path`. `beforeSend`: drop `Authorization`, cookies, request bodies. `SENTRY_DSN` unset → init skipped entirely (local dev).
- Queue failures: BullMQ `worker.on('failed')` → `Sentry.captureException` with `{ queue, jobName, jobId, attemptsMade }`. A silently dying cron is the worst failure mode this platform can have — this hook is non-negotiable.
- Web: `@sentry/svelte` in `apps/web/src/main.ts`. `beforeSend`: drop `ApiError` with status 401/429 (expected noise). Release = `VITE_VERCEL_GIT_COMMIT_SHA`. Wire `ErrorFallback` boundary to `captureException`.
- Alert rules (Sentry UI, part of the story's AC): any API 5xx event; any `queue:*` event; FE error rate > 10/hour.

**Structured logs** (existing request-logging middleware already carries `request_id`): every job logs a single summary line (shape in §3.2 step 19); every email logs `{ notificationId, template, to_domain (not full address), status, durationMs }`.

**Funnel events** (existing `apps/web/src/lib/analytics.ts`, console-only per pending-items §1 — keep the discipline of naming them now):
`client_import_started`, `client_import_validated {validRows, invalidRows}`, `client_import_committed {createdCount}`, `compliance_assignment_created {bulk}`, `compliance_entry_status_changed {status}`, `dsc_created`, `doc_upload_started`, `doc_upload_completed {compressed, bytesIn, bytesOut}`, `doc_upload_failed {status}`, `doc_request_created`, `public_upload_completed`.

**Performance targets** (log now, alert when Sentry perf enabled): upload p95 < 4s at 10MB; compliance generation < 60s/firm at 500 clients × 10 assignments; calendar list p95 < 300ms.

---

# Part 2: Execution Plan (Ticket Breakdown)

Dependency chain: **1.1 → 1.2 → (1.3, 1.4, 2.x, 3.x in parallel where marked)**. Estimates assume one engineer.

---

**Epic 1: Ops Hardening & Onboarding** — *~1 week*
*Goal: the platform is observable, can send email, and a 300-client firm can onboard in an afternoon.*

> **Story 1.1: [Full-Stack] Sentry error tracking on API and web** *(0.5–1d, no dependencies — do first)*
> *Description:* Wire @sentry/nestjs + @sentry/svelte per §5. No-op without DSN.
> *Acceptance Criteria:*
> - [ ] Throwing a test 500 in any controller produces a Sentry event tagged with request_id/firm_id/user_id
> - [ ] A thrown error in a Svelte page produces an FE event with release SHA; 401/429 ApiErrors do NOT
> - [ ] `Authorization` header and request bodies never appear in event payloads
> - [ ] Local dev with no DSN: zero Sentry imports execute network calls
> *Sub-tasks:*
> - [ ] `apps/api/src/instrument.ts` + first-import in `main.ts`; capture hook in `global-exception.filter.ts` (5xx / non-HttpException only)
> - [ ] `beforeSend` scrubbers both sides
> - [ ] FE init in `apps/web/src/main.ts` + `ErrorFallback` captureException
> - [ ] Railway/Vercel env vars + Sentry alert rules (5xx, queue:*, FE >10/hr)
> - [ ] Unit test: filter calls captureException for 500, not for 400

> **Story 1.2: [Backend] BullMQ queue infrastructure** *(1d, blocks email + all Epic 2 jobs)*
> *Description:* `queue/` module: bullmq + @nestjs/bullmq, queues `email` + `compliance`, repeatable-job registration on boot (§ Part 1 schedule table), `runInFirmContext` helper, failed→Sentry hook, default job opts (attempts 3, exp backoff 5s, removeOnComplete 1000 / removeOnFail 5000).
> *Acceptance Criteria:*
> - [ ] `docker compose up` + `pnpm dev` → worker connects to Redis (`maxRetriesPerRequest: null` connection, separate from RedisService client)
> - [ ] Repeatable jobs visible exactly once after two API restarts (no duplicates)
> - [ ] A job throwing 3× lands in failed set AND produces a Sentry event
> - [ ] `runInFirmContext` makes `FirmScopedService.getFirmId()` work inside a processor (integration test)
> *Sub-tasks:*
> - [ ] Deps + `QueueModule` (global) with connection factory from existing REDIS_URL config
> - [ ] Repeatable registration idempotent by jobId key
> - [ ] `run-in-firm-context.ts` + system-actor resolver (oldest active PARTNER→ADMIN)
> - [ ] `worker.on('failed')` Sentry hook + job summary logging shape
> - [ ] Integration test with real Redis (testcontainers or compose service)

> **Story 1.3: [Backend] Email channel via Resend** *(1d, needs 1.2)*
> *Description:* `email/` module per §1; extend `TaskNotificationHelper.createNotification` with `emailTemplate?` param → second Notification row (channel EMAIL, status PENDING) + enqueue; processor sends via Resend, updates status SENT/FAILED + sentAt. V1 emailed types: TASK_ASSIGNED, TASK_REVIEW_REQUESTED, TASK_APPROVAL_REQUESTED, COMMENT_MENTION (+ Epic 2/3 senders later).
> *Acceptance Criteria:*
> - [ ] Assigning a task → recipient gets email within 30s; API response latency unchanged (enqueue only)
> - [ ] Resend 500 → 3 retries → Notification row status FAILED; in-app row unaffected
> - [ ] Deactivated user (`isActive=false`) → no email row, no send
> - [ ] Firm setting `email_notifications_enabled=false` (JSONB merge pattern, default true) → in-app only
> - [ ] From-domain verified (SPF/DKIM) — manual checklist item in PR description
> *Sub-tasks:*
> - [ ] `EmailService.enqueue()` + processor + Resend client (env RESEND_API_KEY, EMAIL_FROM)
> - [ ] Base layout + 4 template functions (pure, unit-snapshot-tested)
> - [ ] Helper wiring for the 4 types + firm-settings gate
> - [ ] Structured send logging (§5) — log `to` domain only, never full address
> - [ ] Unit tests: gate logic, FAILED path

> **Story 1.4: [Full-Stack] CSV client import** *(2d, independent of 1.2/1.3)*
> *Description:* Endpoints per §2.1 + `CsvImportModal` wizard on ClientList (template download → pick file → validate → error table → commit). Parse with `csv-parse/sync` in memory.
> *Acceptance Criteria:*
> - [ ] Template downloads; 137-row valid file: validate shows 137/0, commit creates 137, list refreshes
> - [ ] Row with bad PAN / unknown entity_type / duplicate PAN of existing client / duplicate PAN **within the file** → precise row+field+message; commit with any error creates NOTHING (400)
> - [ ] PAN required for non-INDIVIDUAL entity types (existing product rule), optional for INDIVIDUAL
> - [ ] `assigned_partner_email` must match an active PARTNER; blank → unassigned
> - [ ] 501-row file → 400 before parsing rows; 1.1MB file → 413; 3/min throttle → 429 surfaces via existing lockout toast
> - [ ] BOM, CRLF, quoted commas, `;`-separated gstin/tags all parse
> *Sub-tasks:*
> - [ ] `ImportService` in client module: parse → per-row validate (reuse `REGEX` from shared + entity enum) → duplicate checks (file-internal set + one indexed DB query on PANs/names)
> - [ ] Controller: FileInterceptor(memory, 1MB) + mode switch + all-or-nothing `$transaction` reusing `createClient` validation path
> - [ ] Template endpoint (static string)
> - [ ] `CsvImportModal.svelte` 3-step wizard + analytics events + 4 UI states
> - [ ] Unit tests: 10 fixture CSVs (happy, each error class, BOM/CRLF); e2e: import→verify list
> - [ ] Log summary `{userId, firmId, mode, totalRows, validRows, durationMs}`

> **Story 1.5: [Backend] Demo seed data** *(0.5d)*
> *Description:* `pnpm db:seed:demo` → firm "Sharma & Associates Demo", 5 users (one per role, `Demo@1234`), 25 clients (mixed entity types, valid PAN/GSTIN), 10 engagements, 60 tasks across statuses/dates, DSC records incl. one expiring in 10d.
> *Acceptance Criteria:*
> - [ ] Idempotent: second run aborts cleanly ("demo firm exists")
> - [ ] Refuses to run unless `DEMO_SEED_ALLOWED=true`
> - [ ] Post-seed dashboard/task list/team pages look genuinely populated (overdue items, mixed statuses)
> *Sub-tasks:*
> - [ ] `prisma/seed/demo.ts` + package script; guard env; fixed UUIDs for stability
> - [ ] Include compliance assignments once Epic 2 lands (follow-up ticket, noted in file)

---

**Epic 2: Compliance Engine** — *~1.5 weeks. The differentiator.*
*Goal: statutory deadlines turn into calendar entries and tasks automatically; nothing statutory is ever silently missed.*

> **Story 2.1: [Backend] Migration + period computation util** *(1d, pure logic — start while 1.x in review)*
> *Description:* §1 migration (unique constraints + indexes, raw-SQL partial index) + `period.util.ts` per §3.1.
> *Acceptance Criteria:*
> - [ ] All 7 edge cases in §3.1 have passing unit tests (day clamp, rollover, FY boundary, inclusive window, customDueDateDay, null-day skip, override substitution)
> - [ ] Property test: for every seeded deadline × any 60-day window in 2026-2028, all dueDates fall inside window and labels are unique per deadline
> - [ ] Migration applies clean on a DB with existing data
> *Sub-tasks:*
> - [ ] Migration (incl. raw partial unique index + schema comment)
> - [ ] `computeDuePeriods` + FY label helpers + IST "today" helper
> - [ ] `COMPLIANCE_ENTRY_TRANSITIONS` const in packages/shared (+ enum re-exports)
> - [ ] Exhaustive unit tests (this file justifies >95% branch coverage)

> **Story 2.2: [Backend] Assignment CRUD + calendar endpoints** *(1.5d, needs 2.1)*
> *Description:* Everything in §2.2 except processors. `ComplianceService extends FirmScopedService`; suggestions logic (entityType match + GSTIN presence for GST category, minus already-assigned).
> *Acceptance Criteria:*
> - [ ] Contracts in §2.2 honored incl. 409 on duplicate assignment, bulk skip-counting, transition validation with `allowed_transitions` in error body
> - [ ] Suggestions for a PRIVATE_LIMITED client with GSTIN include GSTR + ROC + TDS deadlines; INDIVIDUAL without GSTIN excludes GST + ROC
> - [ ] DELETE assignment keeps existing calendar entries
> - [ ] Task→DONE hook sets linked entry FILED (fire-and-forget, integration test)
> *Sub-tasks:*
> - [ ] Module + DTOs (class-validator) + controller + RBAC resource `COMPLIANCE` in shared matrix
> - [ ] Bulk endpoint with per-pair skip logic (no transaction across pairs — count and continue)
> - [ ] Calendar list query (existing `[firmId, dueDate, status]` index) + client/deadline name hydration via batch lookup pattern
> - [ ] Hook in `task.service.ts` DONE transition
> - [ ] Unit + integration tests per criterion; audit-log coverage via existing interceptor (verify, don't build)

> **Story 2.3: [Backend] Generation + overdue + DSC processors** *(2d, needs 1.2 + 2.2)*
> *Description:* Three processors per §3.2–3.4, fan-out per firm, `runInFirmContext`, idempotency by unique constraint.
> *Acceptance Criteria:*
> - [ ] Seeded demo firm with 25 clients × assignments: run generates expected entries+tasks; **second run creates zero** (idempotent)
> - [ ] Tasks created via `TaskService.createTask` (activity log entry exists, assignee resolution manager→partner→null, priority HIGH iff penaltyPerDay)
> - [ ] Entries never generated for past due dates (onboarding-backfill rule)
> - [ ] Disabled assignment stops future generation, keeps existing entries
> - [ ] Overdue run: first-time TASK_OVERDUE in-app notifs (deduped), one digest email per user per day, none for 0-item users
> - [ ] DSC at exactly 30/15/7 days fires matching alert; past-validity flips to EXPIRED
> - [ ] One firm's processor throwing does not affect other firms' jobs (separate BullMQ jobs)
> *Sub-tasks:*
> - [ ] Fan-out scheduler job + per-firm processors (3)
> - [ ] Digest email template + grouping logic
> - [ ] Notification dedupe guards
> - [ ] Integration test: full generate→overdue cycle against compose Postgres+Redis with clock injection (pass `today` into processors as param, default IST-now — makes every date test deterministic)
> - [ ] Job summary logs + Sentry failure path verified

> **Story 2.4: [Frontend] Compliance calendar page + client assignments tab** *(2d, needs 2.2; mock against §2.2 before 2.3 lands)*
> *Description:* `/compliance` list grouped by due date (filters: client, category, status, month nav; overdue rows flagged; status chip → optimistic PATCH with rollback; linked-task deep link). ClientDetail gains "Compliance" tab: suggestions (pre-checked) + assignment list with enable/auto-task toggles + buffer-days editor.
> *Acceptance Criteria:*
> - [ ] All filters URL-synced (existing TaskList pattern); 4 UI states each section
> - [ ] Marking FILED updates instantly, rolls back with toast on 400, respects transition matrix client-side (chips for invalid targets disabled)
> - [ ] Suggestion accept creates assignments (bulk endpoint) and they disappear from suggestions
> - [ ] Sidebar entry + breadcrumbs + RBAC hiding (ARTICLE sees read-only)
> *Sub-tasks:*
> - [ ] `ComplianceCalendar.svelte` + router/sidebar wiring
> - [ ] `ComplianceAssignmentsTab.svelte` in ClientDetail
> - [ ] Dashboard card "Compliance due this week" (extend dashboard endpoint with one count query — [Backend] half-day inside this story)
> - [ ] Analytics events; Playwright: assign→(trigger generation via test hook or seeded entry)→mark FILED

> **Story 2.5: [Full-Stack] DSC registry page** *(1d, needs 2.2 patterns; independent of 2.3/2.4)*
> *Description:* §2.3 endpoints + `/dsc` page: table (holder, class, validity, status, storage location), expiring-≤30d warning banner, CRUD modal, RENEWED flow linking new record.
> *Acceptance Criteria:*
> - [ ] Contract validations (validUntil>validFrom, holderType↔clientId/userId pairing) return field-level 400s surfaced inline
> - [ ] Expiring banner count matches `expiringInDays=30` query; row highlight for ≤7d
> - [ ] Renew flow: old record → RENEWED + renewedById, new record ACTIVE
> *Sub-tasks:*
> - [ ] `dsc/` module + DTOs + RBAC resource
> - [ ] `DscRegistry.svelte` + modal + router/sidebar
> - [ ] Unit tests service; Playwright happy path

---

**Epic 3: Documents & Client Uploads** — *~1.5 weeks*
*Goal: files live on the engagement, not in WhatsApp; clients can fulfil document requests with one link and zero accounts.*

> **Story 3.1: [Backend] Storage module + R2/MinIO wiring** *(1d)*
> *Description:* §1 `storage/` — S3Client with R2 endpoint (prod) / MinIO (dev, existing compose service), put/presign-get/delete, bucket bootstrap for dev.
> *Acceptance Criteria:*
> - [ ] Same code path works against MinIO locally and R2 in staging (endpoint/creds via env only)
> - [ ] Presigned GET expires at 15min (verified: fetch at 16min → 403) and sets `Content-Disposition: attachment; filename=`
> - [ ] Missing env in prod mode → boot fails fast with descriptive error (existing env-validation pattern)
> *Sub-tasks:*
> - [ ] Deps (@aws-sdk/client-s3, s3-request-presigner) + module + config schema
> - [ ] Key convention helper + filename sanitizer (§4) with unit tests (unicode, traversal attempts, 200-char names)
> - [ ] Dev bucket auto-create; DEPLOY.md update (R2 bucket + token setup steps)

> **Story 3.2: [Backend] Upload with compression, list, download, delete** *(2d, needs 3.1)*
> *Description:* §2.4 endpoints + §4 pipeline exactly. `DocumentService extends FirmScopedService`.
> *Acceptance Criteria:*
> - [ ] 2.4MB JPEG → stored as WebP, `compressed:true`, original name/size in customFields, sha256 matches stored bytes
> - [ ] 80KB PNG and any PDF pass through unchanged; corrupt JPEG uploads fine uncompressed
> - [ ] Renamed .exe → 415 (magic bytes); 26MB → 413; zero link targets → 400; cross-firm taskId → 400
> - [ ] Download URL works once fetched, expires, never exposes R2 keys in list responses
> - [ ] Soft-deleted doc appears in Recently Deleted and restores (existing cross-entity restore machinery — add Document to its entity map)
> - [ ] versionOfId chains increment version correctly
> *Sub-tasks:*
> - [ ] Deps (sharp, file-type) — pin sharp; verify Railway build (nixpacks) compiles it, else add build config (spike ½d flagged)
> - [ ] `compression.util.ts` + unit tests (fixtures: jpeg>100KB, png<100KB, corrupt, webp-bigger-than-original)
> - [ ] Upload controller (FileInterceptor memory 25MB) + service + list/download/delete + throttles
> - [ ] Recently-deleted integration
> - [ ] Upload log line + analytics-shaped response fields; integration tests vs MinIO

> **Story 3.3: [Frontend] DocumentsSection on client/task/engagement pages** *(1.5d, needs 3.2 contract only)*
> *Description:* Shared `DocumentsSection.svelte` (list: name, type badge, size, uploader, date; upload button + drag-drop; download; delete confirm) mounted as tab/section in three detail pages, pre-scoped to the parent entity.
> *Acceptance Criteria:*
> - [ ] Upload from each parent auto-links correct FK; list filters to parent; 4 UI states
> - [ ] Upload disabled + toast during 429 lockout (existing `getLockoutRemainingMs`)
> - [ ] 415/413 server errors render human messages inline, not toast-only
> - [ ] Download opens in new tab via presigned URL
> *Sub-tasks:*
> - [ ] Component (+ file-input & drag-drop, spinner during upload — no progress bar V1)
> - [ ] Mount in 3 pages + doc-type picker (enum from shared)
> - [ ] Analytics events; Playwright: upload jpeg fixture → appears in list → download URL 200

> **Story 3.4: [Full-Stack] Document requests + public upload page** *(2d, needs 3.2)*
> *Description:* §2.5 complete: internal CRUD + email-with-link, public GET/upload (no auth), reminder processor (09:00 IST: PENDING + dueDate ≤ 3d away or past, ≥48h since last, <3 total → email + REMINDED + counters), `/upload/:token` page outside app shell (firm name header, request title/description, file picker, per-file success list, expired/fulfilled states).
> *Acceptance Criteria:*
> - [ ] Request create → client contact email receives link (skip+log if client has no email); link works logged-out
> - [ ] Public page: unknown token → friendly 404 state; expired/cancelled → 410 state; 11th file → clear limit message
> - [ ] First public upload flips FULFILLED + notifies requester (once); files land linked to client/task/engagement with source=CLIENT_UPLOAD
> - [ ] Reminder job respects 48h/3-max rules (clock-injected test)
> - [ ] 5/min/IP throttle on public routes verified
> *Sub-tasks:*
> - [ ] `document-request/` module: internal endpoints + public controller (unscoped token lookup → explicit firmId ops)
> - [ ] Reminder processor + email templates (request + reminder)
> - [ ] `PublicUpload.svelte` + router bypass of auth shell
> - [ ] `RequestDocumentModal.svelte` on ClientDetail/TaskDetail + requests list w/ status + manual remind button
> - [ ] Playwright: create request → visit public URL logged-out → upload → verify fulfilment + doc linkage

---

## Rollout & Sequencing

1. **Week 1:** 1.1 → 1.2 → 1.3 ∥ 1.4 → 1.5. Ship. Sentry live before anything else merges.
2. **Week 2–2.5:** 2.1 → 2.2 → 2.3 ∥ 2.4 ∥ 2.5. Ship behind nothing — compliance page appears when done.
3. **Week 3–4:** 3.1 → 3.2 → 3.3 ∥ 3.4. Ship.
4. After each epic: `docs/v2_pending_items.md` updated (move shipped, add new deferrals: R2 object GC, PDF ghostscript compression, DSC missed-threshold catch-up, presigned-PUT upload path, per-user email preferences).

## Open Assumptions (confirm before the relevant story starts)

1. **System actor** = firm's oldest active PARTNER for auto-generated tasks' `createdBy` (Story 2.3). Alternative: per-firm system user row (+1 migration).
2. **CSV import is all-or-nothing** (Story 1.4). Alternative rejected: partial commit.
3. **Client contact email field** exists on Client (`email`) and is the document-request recipient (Story 3.4). If multiple contacts exist in schema, use primary.
4. **Emails per-notification** for 4 task types won't be spammy at pilot scale; digest-everything is the fallback switch (firm setting) if firms complain.
5. **sharp on Railway nixpacks** builds cleanly (prebuilt binaries usually fine). Spike budgeted in 3.2.
