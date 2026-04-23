# Technical Implementation Document
## CA Practice OS — Frontend V1 (Clients, Engagements, Tasks)

**Status:** v2 — rewrites the earlier spec after reconciling with actual codebase state (plain Vite+Svelte SPA, existing V1 pages shipped in `8be71d1`).

**Scope:** Harden the three modules that form the daily driver — **Client Management**, **Engagement Management**, **Task Tracking** — against acceptance criteria defined here. Existing pages in `apps/web/src/pages/` are scaffolds; this spec fills them out to shippable V1.

**Out of scope:** Visual polish (see `/frontend-design:frontend-design` plugin later). Deferred items tracked in `docs/v2_pending_items.md`.

---

## Confirmed Product Decisions

| Decision | Value |
|---|---|
| PAN | Mandatory if `entity_type != INDIVIDUAL` |
| GST | Always optional |
| Task list default view | `My Tasks` for ARTICLE/JUNIOR_CA, `All Tasks` for PARTNER/MANAGER/ADMIN |
| Engagement template instantiation | `instantiate_template` defaults `true` |
| ICAI verification | Skip V1, manual entry (pending doc §4) |
| Auth | localStorage, 1-day access token, no refresh flow |
| Analytics | `console.info()` only in V1 (pending doc §1) |
| Sentry | Skip V1 (pending doc §7) |
| Role permissions | Shared matrix const + DB seed; no admin UI in V1 (pending doc §2) |

---

## Part 1: Technical Implementation

### 1. System Architecture

#### Stack (real, as of 2026-04-23)

| Layer | Tech |
|---|---|
| Frontend | Svelte 5 + TailwindCSS v4, plain Vite dev server, custom client-side router (`apps/web/src/lib/router.svelte.ts`) |
| Backend | NestJS, controllers at `apps/api/src/<module>/<module>.controller.ts` |
| DB | PostgreSQL via Prisma ORM |
| Shared | `packages/shared` — enums, DTOs, constants, regex patterns, role matrix |

**No SvelteKit. No `+page.svelte`. No `load()`. No `hooks.server.ts`.** All page files are in `apps/web/src/pages/*.svelte`, registered with `router.addRoute(path, component)`.

#### Backend services (already built)

- `ClientService` — CRUD, GST sub-resource, custom field definitions
- `EngagementService` — CRUD, engagement types, task progress batch
- `TaskService` — CRUD, status machine, subtask handling
- Helpers: `TaskChecklistService`, `TaskDependencyService`, `TaskCommentService`, `TaskActivityService`
- `DashboardService` — parallel aggregate queries
- `FirmSettingsService` — firm-scoped JSONB settings
- `AuthService` — JWT access token (1-day), localStorage-backed on FE

Controllers expose plural routes: `/api/clients`, `/api/tasks`, `/api/engagements`, `/api/engagement-types`, `/api/firms/settings`, `/api/audit-log`.

#### Processing model

- Fully synchronous REST. No websocket in V1.
- Long operations (template instantiation) are transactional on the backend — either everything commits or user retries.

#### Caching strategy

| Resource | Strategy |
|---|---|
| Engagement types | Fetch once per session into module-level Svelte `$state`. Never invalidated. |
| Active user list (pickers) | Module-level cache. Invalidated on user invite / deactivate. UserPicker filters to active users only. |
| Client list | Server-paginated. URL-synced filters drive query. No client cache. |

#### Frontend architecture

**Routing.** `router.svelte.ts` exports `addRoute(path, component)`. Pages register themselves at app boot in `App.svelte`. Navigation via `navigate(path)` / `replace(path)`. Guards happen inside page mount (`$effect` checking `isAuthenticated()` → `navigate('/login')`).

**Data fetching.** Each page uses a Svelte `$effect` or TanStack Svelte Query hook to call the API via the shared `apiFetch` wrapper. No server-side render path — everything is client-fetched after auth check.

**State management.**

| State | Where |
|---|---|
| Server state | `@tanstack/svelte-query` (already a dep) — per-route query keys |
| Form state | Local `$state` within the page component |
| Filter state | URL query params, written via `replace()` so back-button respects history |
| Module caches | `lib/api.ts` or per-resource module file — lazy fetch, cache in `$state` |
| Auth | `lib/auth.svelte.ts` (localStorage + `$state`) |

**Optimistic updates.**

| Action | Optimistic behavior | Rollback |
|---|---|---|
| Toggle checklist item | Flip `is_completed` immediately, update progress bar | Revert + toast "Failed to update" |
| Task status transition (kanban drag) | Move card, pre-validated client-side against `TASK_STATUS_TRANSITIONS` | Revert + toast with allowed transitions |
| Comment submit | Append with `pending` indicator | Remove + toast + restore textarea |

No optimistic updates on: client create/edit, engagement create, task create, sidebar field edits.

**Unsaved-changes guard.** Task detail metadata sidebar, client form, engagement form: track `isDirty` in `$state`. If the user attempts to `navigate()` away OR triggers `beforeunload`, show confirm dialog.

#### Security

- Every page except `/login`, `/register`, `/onboarding`, `/welcome` guards on mount: no auth → redirect to `/login`.
- `apiFetch` attaches `Authorization: Bearer <token>` from `auth.getAccessToken()`. On 401 → `clearAuth()` + redirect `/login`.
- Backend enforces firm scoping via Prisma `$extends`. FE never sends `firm_id`.
- Credential locker route: role gate — ARTICLE hidden entirely, JUNIOR_CA sees only assigned clients. (Covered when that page is revisited — deferred from current scope unless cheap.)
- 429 response: global toast "Too many requests", caller disables submit for 5s via return value from `apiFetch`.

---

### 2. Role Permission Matrix

Lives in `packages/shared/src/constants/role-permissions.ts`. Seeded to DB per firm at firm creation. Read path in V1 goes through shared const; DB copy is write-ahead for the future admin UI (pending doc §2).

**Shape.**
```ts
type Resource = 'client' | 'engagement' | 'task' | 'checklist' | 'dependency' | 'comment' | 'credentials';
type Action = 'view' | 'create' | 'edit' | 'delete' | 'assign' | 'status_change';
type RolePermissions = Record<UserRole, Partial<Record<Resource, Partial<Record<Action, boolean>>>>>;
```

**V1 defaults (draft — confirm before ship).** `true` = allowed, absent/false = denied.

| Resource / Action | PARTNER | MANAGER | JUNIOR_CA | ARTICLE | ADMIN |
|---|---|---|---|---|---|
| client:view | ✓ | ✓ | ✓ (assigned) | ✓ (assigned) | ✓ |
| client:create | ✓ | ✓ | ✗ | ✗ | ✓ |
| client:edit | ✓ | ✓ | ✗ | ✗ | ✓ |
| client:delete | ✓ | ✗ | ✗ | ✗ | ✓ |
| engagement:view | ✓ | ✓ | ✓ (assigned) | ✓ (assigned) | ✓ |
| engagement:create | ✓ | ✓ | ✗ | ✗ | ✓ |
| engagement:edit | ✓ | ✓ | ✗ | ✗ | ✓ |
| engagement:status_change | ✓ | ✓ | ✗ | ✗ | ✓ |
| task:view | ✓ | ✓ | ✓ (assigned) | ✓ (assigned) | ✓ |
| task:create | ✓ | ✓ | ✓ | ✓ | ✓ |
| task:edit | ✓ | ✓ | ✓ (own) | ✓ (own) | ✓ |
| task:assign | ✓ | ✓ | ✗ | ✗ | ✓ |
| task:status_change | ✓ | ✓ | ✓ (own) | ✓ (own) | ✓ |
| task:delete | ✓ | ✓ | ✗ | ✗ | ✓ |
| checklist:* | ✓ | ✓ | ✓ (own task) | ✓ (own task) | ✓ |
| dependency:* | ✓ | ✓ | ✗ | ✗ | ✓ |
| comment:create | ✓ | ✓ | ✓ | ✓ | ✓ |
| comment:edit | ✓ (own) | ✓ (own) | ✓ (own) | ✓ (own) | ✓ (own) |
| comment:delete | ✓ (own) | ✓ (own) | ✓ (own) | ✓ (own) | ✓ |
| credentials:* | ✓ | ✓ | ✓ (assigned) | ✗ | ✓ |

**Scope qualifiers** (`assigned`, `own`) encoded as separate const map alongside the booleans. Scope check happens in the service layer (`if (perm.scope === 'assigned') verify user is assigned_partner/manager/junior/article`).

**FE use.** `lib/permissions.ts` exports `can(user, resource, action, subject?) → boolean`. UI hides / disables + backend re-checks.

---

### 3. API Contracts

All endpoints require `Authorization: Bearer <token>`. Error codes below are **deltas from current backend behavior** — items flagged 🛠️ need audit work (see §5 Ticket 0.0).

#### Client

```
GET /api/clients
Query: page, limit, status, partner_id, manager_id, tags (comma), search, sort_by, sort_dir
Response 200: { data: ClientListItem[], meta: { total, page, limit } }
```

```
POST /api/clients
Body: ClientCreateRequest (see DTO in shared)
Response 201: Client
Errors:
  400 — Validation failure (field errors array)
  409 — case-insensitive display_name collision within firm 🛠️
```

```
GET    /api/clients/:id           → Client + gst_numbers + assignees + engagement_count + open_task_count
PATCH  /api/clients/:id           → Partial<ClientCreateRequest>
POST   /api/clients/:id/gst-numbers        → { gstin, state_code, trade_name, registration_type, is_primary, registered_at, cancelled_at }
PATCH  /api/clients/:clientId/gst-numbers/:id
DELETE /api/clients/:clientId/gst-numbers/:id
Errors (GST): 400 (regex / state mismatch 🛠️), 409 (duplicate GSTIN)
```

**PAN / GSTIN / phone regex** live in `packages/shared/src/constants/regex-patterns.ts`. FE blur-validates; BE DTO re-validates.

#### Engagement

```
GET /api/engagement-types
Response 200: { data: EngagementType[] }
// Session-cache on FE.
```

```
GET /api/engagements
Query: client_id, status, partner_id, manager_id, page, limit, sort_by, sort_dir
Response 200: { data: EngagementListItem[], meta }
```

```
POST /api/engagements
Body: EngagementCreateRequest (includes instantiate_template: boolean, default true)
Response 201: Engagement
Behavior: When instantiate_template is true, backend wraps engagement creation + child task creation in a SINGLE TRANSACTION. Failure → 400/500, user retries full create. 🛠️
Errors: 400, 404
```

```
PATCH /api/engagements/:id/status
Body: { status: EngagementStatus }
Response 200 | Errors:
  400 — Invalid transition. Body: { current, attempted, allowed }
  409 — COMPLETED blocked by open tasks. Body: { open_task_count, blocking_tasks: [{ id, title, status }] } 🛠️
```

#### Task

```
GET /api/tasks
Query: engagement_id, client_id, assignee_id, status (multi), priority, due_before, due_after,
       is_overdue, parent_task_id ('null' = root only), search 🛠️, page, limit, sort_by, sort_dir
Response 200: { data: TaskListItem[], meta }
```

```
POST /api/tasks
Body: TaskCreateRequest
Response 201: Task
Errors:
  400 — assignee === reviewer, depth > 1 for subtask, missing client_id when engagement_id null
  404 — engagement/client/assignee not found
```

```
GET    /api/tasks/:id         → Task + assignee + reviewer + client + engagement + parent + subtasks + checklist + dependencies + checklist_progress + is_blocked
PATCH  /api/tasks/:id         → Partial<TaskCreateRequest>
PATCH  /api/tasks/:id/status
  Body: { status: TaskStatus }
  Errors:
    400 — Invalid transition. Body: { current, attempted, allowed_transitions }
    409 — DONE blocked. Body: { incomplete_required_items }
```

```
POST   /api/tasks/:id/checklist             → { label, is_required }
PATCH  /api/tasks/:id/checklist/:itemId     → { is_completed?, label?, is_required?, display_order? }
DELETE /api/tasks/:id/checklist/:itemId
Behavior: BE DTO rejects create when task already has 30 items. 🛠️
```

```
POST   /api/tasks/:id/dependencies          → { depends_on_task_id }
DELETE /api/tasks/:id/dependencies/:depId
Errors: 400 (circular), 409 (exists)

GET    /api/tasks/:id/comments
POST   /api/tasks/:id/comments              → { body, mentions: uuid[], parent_comment_id? }
PATCH  /api/tasks/:id/comments/:cid
DELETE /api/tasks/:id/comments/:cid         → soft delete
GET    /api/tasks/:id/activity              → paginated (default limit 20)
```

**Checklist concept.** Each task carries a flat list of micro-todos: `{ id, label, is_completed, is_required, display_order }`. Max 30 per task, enforced FE + BE. Required items gate DONE. Distinct from subtasks (which are real child tasks with their own assignee/status).

---

### 4. Observability & Logging

**Error handling.**
- `apiFetch` wraps all API calls. On 4xx → caller handles. On 5xx → surface user-facing toast + `console.error({ route, endpoint, status, duration_ms, request_id })`.
- Every API call sends `X-Request-ID: <uuid v4>`. BE already echoes / generates if absent.
- No Sentry in V1 (pending doc §7). `console.error` is the hook to replace later.

**Analytics.**
- `lib/analytics.ts` exports `track(event, props)` that calls `console.info('[track]', event, { firm_id, user_id, ...props })`.
- Gated by `if (import.meta.env.VITE_ANALYTICS_ENABLED === 'true')`. Default off.
- Events:
  ```
  client_create_started         { entity_type }
  client_create_completed       { client_id, entity_type, has_pan, has_gst, tags_count }
  client_create_failed          { error_code }
  engagement_create_completed   { engagement_id, engagement_type_code, instantiate_template }
  task_create_completed         { task_id, has_engagement, has_assignee, has_due_date }
  task_status_changed           { task_id, from_status, to_status }
  checklist_item_toggled        { task_id, is_completed }
  comment_submitted             { task_id, has_mentions, is_reply }
  kanban_drag_completed         { task_id, from_status, to_status, success }
  ```
- PII audit: no names, emails, phone numbers, PAN, GSTIN in event props. Reviewer enforces this at merge.

**Performance budgets (aspirational, no alerting in V1).**
- `GET /api/tasks` list: target P95 <300ms
- `GET /api/tasks/:id`: target P95 <200ms
- `GET /api/dashboard`: target P95 <800ms
- Route transition → first interactive on task detail: target <1.5s

Used for self-audit during build. Formal alerting deferred with Sentry.

---

## Part 2: Execution Plan

### Build Order

```
0.0  Backend audit (BLOCKS everything)
1.1  [BE] Client contract hardening         ─┐
1.2  [FE] Client list                        │
1.3  [FE] Client create/edit form            │
1.4  [FE] Client detail                     ─┤
2.1  [FE] Engagement create form             │  (FE work runs in parallel
2.2  [FE] Engagement detail                  │   with BE audits, gated by
3.1  [FE] Task list (list + kanban)          │   the specific audit item
3.2  [FE] Task create                        │   each story depends on)
3.3  [FE] Task detail — metadata + status    │
3.4  [FE] Checklist section                  │
3.5  [FE] Dependency section                 │
3.6  [FE] Comment section                    │
3.7  [FE] Activity timeline                 ─┘
4.1  [Full] Error boundaries + empty states
4.2  [FE]   Analytics console.info wiring
```

### Story 0.0 — [BE] Backend audit & contract hardening (BLOCKS FE work)

*Description:* Sweep the backend for contract gaps the FE will hit. Single ticket, multiple small patches. TDD — each change gets an integration test that failed first.

*Acceptance Criteria:*
- [ ] `POST /api/clients` with invalid PAN → 400 with field-level error
- [ ] `POST /api/clients` with PAN missing when `entity_type != INDIVIDUAL` → 400
- [ ] `POST /api/clients` duplicate `display_name` within firm (case-insensitive) → 409
- [ ] `POST /api/clients/:id/gst-numbers` mismatched `state_code` → 400
- [ ] `POST /api/clients/:id/gst-numbers` invalid GSTIN regex → 400
- [ ] Phone fields reject non-E.164 format
- [ ] `GET /api/tasks?search=<str>` returns matches on title (debounce-friendly, case-insensitive, limit respected)
- [ ] `PATCH /api/engagements/:id/status` to `COMPLETED` with open tasks → 409 with `{ open_task_count, blocking_tasks[] }`
- [ ] `POST /api/tasks/:id/checklist` when task has 30 items → 400 "max 30 items"
- [ ] `POST /api/engagements` with `instantiate_template: true` where one template item is malformed → 500, DB shows NO engagement row (transactional)
- [ ] `packages/shared/src/constants/role-permissions.ts` committed with matrix from §2
- [ ] Backend service layer reads from this matrix for every `@UseGuards` permission check
- [ ] DB seed writes firm's role permission copy on firm creation (write-ahead, not read)

*Sub-tasks:*
- [ ] Add / fix `class-validator` decorators on `CreateClientDto` — PAN regex, conditional required on entity_type, E.164 phone
- [ ] Case-insensitive uniqueness: Prisma migration adds `UNIQUE (firm_id, LOWER(display_name))` functional index + service-level check with prisma `mode: 'insensitive'`
- [ ] `ClientGstNumbersService` — regex validator + state-code prefix cross-check
- [ ] `TaskService.list` — add `search` query param, ILIKE on title, respects firm scope
- [ ] `EngagementService.transitionStatus` — check open task count when target is COMPLETED, 409 with payload if blocked
- [ ] `TaskChecklistService.create` — check `count(items) >= 30` before insert, 400
- [ ] `EngagementService.create` — wrap template instantiation in `prisma.$transaction`; fail returns 500 and rolls back engagement row
- [ ] Commit `role-permissions.ts` shared const + migration for `firm_role_permissions` table + seed hook
- [ ] Refactor existing permission checks to use `PermissionService.can(user, resource, action, subject)`
- [ ] Integration tests (TDD) for every AC item above

*Done when:* All integration tests pass; FE team can consume `/api/tasks?search=`, engagement COMPLETED 409 body, checklist 400, and role-permissions const.

---

### Epic 1: Client Management

> **Story 1.2 — [FE] Client list page**
> *Route:* `/clients`
> *AC:*
> - [ ] Table columns: display_name, entity_type, status badge, assigned_partner, assigned_manager, tag chips, GST count
> - [ ] Filters: status (multi-select), partner, tags, search (display_name / legal_name / PAN)
> - [ ] Filters persist in URL — bookmarkable; back button restores prior filter state
> - [ ] Empty state with CTA to create first client
> - [ ] Loading skeleton while fetching
> *Sub-tasks:*
> - [ ] `apiFetch('/api/clients', { query })` wrapper returning `{ data, meta }`
> - [ ] `ClientFilterBar.svelte` — all filter inputs, URL sync via `router.replace()`
> - [ ] DataTable wired with data + sort handlers
> - [ ] `EmptyState.svelte` (reusable, props: icon, heading, subtext, cta)
> - [ ] Skeleton (3 rows)
> - [ ] Tests: URL sync round-trip, filter → query param → fetch, empty state render

> **Story 1.3 — [FE] Client create/edit form**
> *Routes:* `/clients/new` and `/clients/:id/edit`
> *AC:*
> - [ ] `entity_type` first — drives field visibility (CIN for companies, TAN for TDS-registered)
> - [ ] PAN: uppercase transform on input, required if `entity_type != INDIVIDUAL`, regex validate on blur
> - [ ] Phone: E.164 hint, blur validate
> - [ ] GST section: add/remove entries, first auto-marked primary, per-entry GSTIN + state_code validation
> - [ ] Partner/Manager/Junior/Article pickers filtered to correct role
> - [ ] Submit 201 → `navigate('/clients/:id')`
> - [ ] 409 maps inline to `display_name` field
> - [ ] 400 field errors map to correct inputs
> - [ ] Unsaved-changes guard on nav away
> *Sub-tasks:*
> - [ ] `PanField.svelte` — uppercase, conditional required, regex
> - [ ] `GstNumberList.svelte` — add/remove, primary toggle, per-entry validation
> - [ ] `EntityTypePicker.svelte` — emits `entity_type`, parent hides/shows CIN/TAN
> - [ ] `UserPicker.svelte` — prop `role: UserRole`, filters to active users in role
> - [ ] `TagInput.svelte` — max 10
> - [ ] Error mapping: 400 body → field state, 409 → `display_name`
> - [ ] `isDirty` tracking + beforeunload hook
> - [ ] Tests per component + form submit happy / 400 / 409 paths

> **Story 1.4 — [FE] Client detail page**
> *Route:* `/clients/:id`
> *AC:*
> - [ ] Header: display_name, legal_name, status, entity_type, team, open_task_count
> - [ ] PAN / TAN / CIN with copy-to-clipboard
> - [ ] GST table: GSTIN, state, type, primary indicator, dates
> - [ ] Engagements section: status, type, period, task_progress bar
> - [ ] "Add Engagement" button → `/engagements/new?client_id=:id`
> - [ ] 404 → friendly error page
> *Sub-tasks:*
> - [ ] Two parallel queries: client detail + engagements scoped to client
> - [ ] `ClientHeader.svelte` + copy-to-clipboard helper
> - [ ] `GstNumberTable.svelte` + inline add-GST form
> - [ ] `EngagementCard.svelte` with progress bar
> - [ ] 404 state within page (not global)
> - [ ] Tests: 404 path, copy-clipboard integration, engagement card render

---

### Epic 2: Engagement Management

> **Story 2.1 — [FE] Engagement create form**
> *Route:* `/engagements/new` (optionally `?client_id=` prefill)
> *AC:*
> - [ ] Type picker grouped by category (GST, Income Tax, TDS, etc.)
> - [ ] Selecting type auto-fills name `{type.name} - {client.display_name} - {period}`, editable
> - [ ] Period fields required for recurring types, optional for ONE_OFF (keyed off `engagement_type.recurrence`)
> - [ ] Team: partner/manager prefilled from client when arriving from client detail
> - [ ] "Generate task checklist" toggle default ON, preview lists template items
> - [ ] Submit 201 → `navigate('/engagements/:id')`
> - [ ] Failure on transactional instantiation → toast "Engagement creation failed, please retry", form stays dirty
> *Sub-tasks:*
> - [ ] `EngagementTypePicker.svelte` grouped, session-cached fetch
> - [ ] Name auto-fill logic (debounced on type / period change)
> - [ ] Period fields conditional render
> - [ ] `TaskTemplatePreview.svelte` — fetch template items, show ordered
> - [ ] Submit wiring with `instantiate_template` from toggle
> - [ ] Unsaved-changes guard
> - [ ] Tests: auto-fill, recurring/non-recurring field toggle, 500 retry path

> **Story 2.2 — [FE] Engagement detail page**
> *Route:* `/engagements/:id`
> *AC:*
> - [ ] Header: name, type badge, status, period, client link, fee
> - [ ] Team section: partner, manager, assigned_team
> - [ ] Task list: status, assignee, due date, is_blocked
> - [ ] Status control: role-gated via role matrix; COMPLETED blocked → modal with blocking task titles from 409 body
> - [ ] "Add Task" → `/tasks/new?engagement_id=:id&client_id=:cid`
> - [ ] Overdue tasks: red due_date chip
> *Sub-tasks:*
> - [ ] Page load: engagement detail + tasks scoped to engagement
> - [ ] `EngagementStatusControl.svelte` — allowed transitions via `ENGAGEMENT_STATUS_TRANSITIONS` const + `can(user, 'engagement', 'status_change')`
> - [ ] 409 blocking tasks modal
> - [ ] `TaskListByEngagement.svelte` sorted by due_date ASC
> - [ ] Tests: status gate, 409 modal, overdue highlight

---

### Epic 3: Task Tracking

> **Story 3.1 — [FE] Task list page (list + kanban toggle)**
> *Route:* `/tasks`
> *AC:*
> - [ ] Default view: ARTICLE/JUNIOR_CA → assignee_id = current user; PARTNER/MANAGER/ADMIN → no assignee filter
> - [ ] View toggle: List / Kanban, persisted in `localStorage['tasks_view_mode']`
> - [ ] Filters URL-synced: assignee, status (multi), priority, due_before, client, overdue toggle
> - [ ] List view: sortable columns title, client, status, priority, assignee, due_date, is_blocked
> - [ ] Kanban: 5 columns TO_DO → IN_PROGRESS → AWAITING_CLIENT → UNDER_REVIEW → PARTNER_APPROVAL + collapsed DONE
> - [ ] Drag in kanban: validate against `TASK_STATUS_TRANSITIONS` before PATCH; revert on 400/409
> - [ ] Overdue: red due_date chip (list), red card border (kanban) — concrete style deferred to design pass
> *Sub-tasks:*
> - [ ] `TaskFilterBar.svelte` — role-aware default, URL sync
> - [ ] `TaskListView.svelte`
> - [ ] `KanbanBoard.svelte` — 5 columns + collapsed DONE (or horizontal scroll if narrow; OK to defer polish)
> - [ ] Drag handler: pre-validate, optimistic update, PATCH, rollback
> - [ ] View mode in localStorage
> - [ ] Tests: role-based default, URL round-trip, drag happy path, drag-rollback on 400

> **Story 3.2 — [FE] Task create form**
> *Route:* `/tasks/new` (query param prefills `engagement_id`, `client_id`)
> *AC:*
> - [ ] Title (required, 1-300), description textarea
> - [ ] Client → Engagement 2-level picker (engagement filters to selected client)
> - [ ] Assignee + reviewer pickers — inline error if assignee === reviewer
> - [ ] Due date + internal_due_date (internal shown as computed hint, override allowed)
> - [ ] Priority picker, tags (max 10)
> - [ ] Prefill from URL params
> - [ ] Submit 201 → `navigate('/tasks/:id')`
> - [ ] Unsaved-changes guard
> *Sub-tasks:*
> - [ ] `ClientEngagementPicker.svelte` — 2-level dependent select
> - [ ] `AssigneePicker.svelte` — conflict validation
> - [ ] `InternalDueDateField.svelte` — compute hint, override
> - [ ] URL prefill on mount
> - [ ] Tests: engagement-linked, standalone, assignee=reviewer error, prefill

> **Story 3.3 — [FE] Task detail — metadata + status**
> *Route:* `/tasks/:id` (two-panel layout — body left, metadata sidebar right)
> *AC:*
> - [ ] Status dropdown shows only allowed transitions from current
> - [ ] DONE gate: 409 with `incomplete_required_items` → modal with count
> - [ ] Inline edit title + description: click to edit, Escape cancels, blur-or-save commits
> - [ ] Sidebar fields (assignee, reviewer, due_date, priority, tags): edit locally → explicit "Save" button on the sidebar. Unsaved-changes guard on nav away.
> - [ ] Subtask list: child tasks with status, "Add subtask" quick-create (title only)
> - [ ] 404 → friendly error
> *Sub-tasks:*
> - [ ] Full task load via `GET /api/tasks/:id`
> - [ ] `TaskStatusControl.svelte` — allowed transitions + PATCH `/status`
> - [ ] `TaskMetadataSidebar.svelte` — dirty-state tracking, single PATCH on save, per-field error mapping
> - [ ] Inline title/description edit
> - [ ] `SubtaskList.svelte` + quick-add
> - [ ] DONE 409 modal
> - [ ] Tests: status gate, sidebar save roundtrip, unsaved guard, inline edit Escape

> **Story 3.4 — [FE] Checklist section with optimistic toggle**
> *Location:* Task detail body, below description
> *AC:*
> - [ ] Per item: checkbox (optimistic), label, required lock icon, delete
> - [ ] Optimistic toggle: instant UI + async PATCH + revert + toast on failure
> - [ ] Add item: inline input at bottom, Enter adds, Escape cancels
> - [ ] Dual progress bar: `completed / total` + `required_completed / required_total`
> - [ ] Reorder via drag handles
> - [ ] Max 30: disable add + hint at limit (BE enforces; FE mirrors)
> *Sub-tasks:*
> - [ ] `ChecklistSection.svelte`
> - [ ] Optimistic mirror with rollback
> - [ ] Dual progress bar
> - [ ] Drag reorder → PATCH `display_order`
> - [ ] Tab between items, Enter in add-input submits
> - [ ] Tests: optimistic-then-rollback, max 30 boundary, required/total progress split

> **Story 3.5 — [FE] Dependency section**
> *AC:*
> - [ ] "Blocked by" + "Blocks" lists with status badges
> - [ ] Blocked banner when `is_blocked`
> - [ ] Add via typeahead `GET /api/tasks?search=…&limit=10` — excludes self + existing deps
> - [ ] Circular dependency 400 → toast
> - [ ] Remove via X button per row
> *Sub-tasks:*
> - [ ] `DependencySection.svelte`
> - [ ] Typeahead (debounced 250ms)
> - [ ] Add/remove with loading state
> - [ ] Tests: circular path, exclude self, typeahead debounce

> **Story 3.6 — [FE] Comment section with @mentions**
> *AC:*
> - [ ] Thread: avatar, name, time ago, body, reply
> - [ ] `@` trigger opens UserPicker filtered to active users, insert chip
> - [ ] Reply scoped to parent comment
> - [ ] Deleted shows "[comment deleted]" if replies exist
> - [ ] Optimistic append with pending indicator, confirm on 201
> - [ ] Edit → textarea with existing body
> *Sub-tasks:*
> - [ ] `CommentSection.svelte` + `CommentCompose.svelte`
> - [ ] `@` detection + picker popup
> - [ ] Optimistic state array
> - [ ] Edit/delete handlers
> - [ ] Tests: optimistic-then-rollback, mention of active-only user, soft-delete-with-replies render

> **Story 3.7 — [FE] Activity timeline (collapsed)**
> *AC:*
> - [ ] Shows last 3 events collapsed; "Show all" expands
> - [ ] Human-readable strings for all 14 action enum values (enum: `packages/shared/src/enums/task-action.enum.ts`)
> - [ ] Pagination 20/page
> - [ ] Time format: "2 hours ago" / "yesterday" / "Apr 10"
> *Sub-tasks:*
> - [ ] `ActivityTimeline.svelte`
> - [ ] Action → string map (exhaustive switch — FE-only asserting all enum values covered)
> - [ ] Paginated load-more
> - [ ] Tests: exhaustive enum render, pagination

---

### Epic 4: Foundation & Observability

> **Story 4.1 — [Full] Error boundaries and empty states**
> *AC:*
> - [ ] Top-level error boundary in `App.svelte` catches route-level throws, offers retry
> - [ ] 404 page for unknown routes
> - [ ] Empty states for: clients, tasks, engagements, comments, dependencies
> - [ ] 429 handled in `apiFetch` — toast "Too many requests", returned flag disables submit 5s
> *Sub-tasks:*
> - [ ] Error boundary component
> - [ ] `EmptyState.svelte` reusable
> - [ ] `apiError` util — map HTTP → user message
> - [ ] 429 handler with 5s lockout signal
> - [ ] Tests: 429 lockout, empty state render

> **Story 4.2 — [FE] Analytics event wiring (console-only)**
> *AC:*
> - [ ] `lib/analytics.ts` exports `track(event, props)`
> - [ ] Events fire at: client_create_completed, engagement_create_completed, task_create_completed, task_status_changed, checklist_item_toggled, comment_submitted, kanban_drag_completed
> - [ ] Each event includes `firm_id`, `user_id`. No PII in props.
> - [ ] Env gate: `VITE_ANALYTICS_ENABLED === 'true'` → `console.info`, else no-op
> *Sub-tasks:*
> - [ ] `analytics.ts`
> - [ ] Wire `track()` at each success point
> - [ ] Grep PII audit — reviewer checks all `track()` sites
> - [ ] Tests: env gate on/off, event payload shape
