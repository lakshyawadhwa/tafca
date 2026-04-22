# Technical Implementation Document
## CA Practice OS — Frontend Pages Rebuild (V1)

**Context:** All 6 backend phases complete. Frontend pages deleted — rebuilding from scratch based on user interview feedback (Apr 10, Arjun Tandan, CA firm owner) and Engineering PRD. This spec covers the three modules that form the core daily driver: **Client Management**, **Engagement Management**, and **Task Tracking**.

---

## Confirmed Product Decisions

- **PAN** — mandatory for all entity types except `INDIVIDUAL`
- **GST** — always optional
- **Task list default view** — `My Tasks` for ARTICLE/JUNIOR_CA; `All Tasks` for PARTNER/MANAGER/ADMIN
- **Engagement template instantiation** — `instantiate_template` defaults to `true`
- **ICAI verification** — skip V1, manual entry only (deferred V1.5)

---

## Part 1: Technical Implementation Document

---

### 1. System Architecture & Strategy

#### Backend

All backend services already implemented. Relevant services:

- `ClientsService` — CRUD, GST sub-resource, custom field definitions
- `EngagementsService` — CRUD, engagement types (seeded), task progress batch
- `TasksService` — CRUD, status machine, subtask handling
- `ChecklistService` — task checklist CRUD
- `DependencyService` — DAG validation, dependency graph
- `CommentService` — comments + @mentions
- `DashboardService` — 7 parallel aggregate queries
- `FirmSettingsService` — firm JSONB settings
- `AuthService` — JWT access token + refresh cookie

**Processing model:** Fully synchronous REST. No websocket in V1.

**Caching strategy:**
- Engagement types: cache in Svelte module-level `$state` on first load. Never invalidated within session.
- User list (assignee pickers): cache per session. Invalidated on user invite/deactivate.
- Client list: server-paginated, no client-side cache. URL-synced filters drive query.

#### Database

Already migrated. No schema changes in this story. Key access patterns:
- Client list: paginated, filterable by status/partner/tags
- Engagement list per client: sorted by `period_end DESC`
- Task list: filterable by status/assignee/due_date, URL-synced
- Task detail: joins engagement + client + assignee + reviewer + checklist + dependencies + comments

#### Frontend

**Stack:** Svelte 5 + TailwindCSS v4. SvelteKit routing. Svelte 5 `$state` runes + `$derived` for state management.

**Route structure:**
```
/(app)/
  dashboard/
  clients/
    +page.svelte              → client list
    new/+page.svelte          → client create form
    [id]/
      +page.svelte            → client detail (overview + engagements)
      edit/+page.svelte       → client edit form
  engagements/
    +page.svelte              → engagement list (all clients)
    [id]/
      +page.svelte            → engagement detail (tasks + doc checklist)
  tasks/
    +page.svelte              → task list (kanban + list view)
    new/+page.svelte          → task create
    [id]/
      +page.svelte            → task detail
  compliance/
    +page.svelte              → compliance calendar
```

**Component hierarchy:**
```
Layout (Sidebar + Topbar)
├── ClientListPage
│   ├── DataTable
│   ├── ClientFilterBar
│   └── StatusBadge
├── ClientFormPage (create + edit)
│   ├── PanField (regex validation)
│   ├── GstNumberList (add/remove multi-GST)
│   ├── EntityTypePicker
│   ├── UserPicker (partner/manager/junior/article slots)
│   └── TagInput
├── ClientDetailPage
│   ├── ClientHeader
│   ├── EngagementCard[]
│   └── GstNumberTable
├── EngagementFormPage
│   ├── EngagementTypePicker
│   ├── PeriodFields
│   └── TeamPicker
├── TaskListPage
│   ├── TaskFilterBar
│   ├── KanbanBoard (mode toggle)
│   └── TaskCard
├── TaskFormPage
│   ├── ClientEngagementPicker (2-level)
│   ├── AssigneePicker
│   ├── DueDateFields
│   └── PriorityPicker
└── TaskDetailPage
    ├── TaskMetadataSidebar
    ├── TaskStatusControl
    ├── ChecklistSection
    ├── SubtaskList
    ├── DependencySection
    ├── CommentSection
    └── ActivityTimeline
```

**State management:**
- Server state: SvelteKit `load()` functions. Re-run on navigation.
- Form state: local `$state` within form pages.
- Filter state: URL query params via `goto()` with `replaceState: true`.
- Picker caches: module-level lazy-fetch for users + engagement types.

**Optimistic updates:**

| Action | Optimistic behavior | Rollback |
|---|---|---|
| Toggle checklist item | Flip `is_completed` immediately, update progress bar | Revert + toast "Failed to update" |
| Task status transition | Move card to new kanban column | Revert card + toast with allowed transitions |
| Comment submit | Append with `pending` indicator | Remove + toast + restore textarea |

No optimistic updates on: client create/edit, engagement create, task create.

#### Security

- All `/(app)` routes guarded in `hooks.server.ts` — redirect to `/login` if no valid token.
- `access_token` cookie (httpOnly, 14min) read in hooks, set in `locals.user`.
- API calls from `load()` forward Bearer token from `locals.user.token`.
- Client-side API calls use `fetch('/api/...')` — Vite proxy in dev, same origin in prod.
- Credential locker: ARTICLE role — section hidden entirely. JUNIOR_CA — assigned clients only.
- 429 response: show "Too many requests" toast, disable submit 5 seconds.

---

### 2. API Contracts

#### Client Endpoints

```
GET /api/clients
Auth: Bearer token required

Query params:
  page         : number, default 1
  limit        : number, default 20, max 100
  status       : 'ACTIVE' | 'INACTIVE' | 'PROSPECT'
  partner_id   : uuid
  manager_id   : uuid
  tags         : string (comma-separated)
  search       : string (display_name, legal_name, pan)
  sort_by      : 'display_name' | 'created_at' | 'onboarded_at'
  sort_dir     : 'asc' | 'desc'

Response 200:
{
  "data": [{
    "id": uuid,
    "display_name": string,
    "legal_name": string | null,
    "entity_type": EntityType,
    "status": "ACTIVE" | "INACTIVE" | "PROSPECT",
    "pan": string | null,
    "assigned_partner": { "id": uuid, "full_name": string } | null,
    "assigned_manager": { "id": uuid, "full_name": string } | null,
    "tags": string[],
    "onboarded_at": date | null,
    "gst_count": number
  }],
  "meta": { "total": number, "page": number, "limit": number }
}

Error codes:
  401 – Token expired or missing
  403 – Firm context not established
```

```
POST /api/clients
Auth: Bearer token required

Request:
{
  "display_name": string,         // required, 1-200 chars
  "legal_name": string | null,
  "entity_type": EntityType,      // required
  "constitution": Constitution | null,
  "pan": string | null,           // required if entity_type != INDIVIDUAL; regex ^[A-Z]{5}[0-9]{4}[A-Z]{1}$
  "tan": string | null,
  "cin": string | null,
  "status": "ACTIVE" | "INACTIVE" | "PROSPECT",
  "primary_contact_name": string | null,
  "primary_contact_phone": string | null,  // E.164
  "primary_contact_email": string | null,
  "address": AddressObject | null,
  "notes": string | null,
  "tags": string[],
  "assigned_partner_id": uuid | null,
  "assigned_manager_id": uuid | null,
  "assigned_junior_id": uuid | null,
  "assigned_article_id": uuid | null,
  "onboarded_at": date | null,
  "financial_year_end": number    // 1-12, default 3
}

Response 201: full client object
Error codes:
  400 – Validation failure (field errors array)
  409 – display_name already exists in firm (case-insensitive)
```

```
GET /api/clients/:id
Response 200:
{
  ...full client fields,
  "gst_numbers": [GstNumber],
  "assigned_partner": UserRef | null,
  "assigned_manager": UserRef | null,
  "assigned_junior": UserRef | null,
  "assigned_article": UserRef | null,
  "engagement_count": number,
  "open_task_count": number
}
Error codes: 404
```

```
PATCH /api/clients/:id
Request: Partial<ClientCreateRequest>
Response 200: full client object
Error codes: 400, 404, 409
```

```
POST /api/clients/:id/gst-numbers
Request:
{
  "gstin": string,
  "state_code": string,
  "trade_name": string | null,
  "registration_type": "REGULAR" | "COMPOSITION" | "CASUAL" | "SEZ" | "ISD",
  "is_primary": boolean,
  "registered_at": date | null,
  "cancelled_at": date | null
}
Response 201: GstNumber object
Error codes:
  400 – Invalid GSTIN format or state_code mismatch
  409 – GSTIN already exists for client
```

```
PATCH /api/clients/:clientId/gst-numbers/:id
DELETE /api/clients/:clientId/gst-numbers/:id
```

---

#### Engagement Endpoints

```
GET /api/engagement-types
Response 200: { "data": [{ "id": uuid, "name": string, "code": string, "category": Category, "recurrence": Recurrence }] }
// Cache client-side for session duration
```

```
GET /api/engagements
Query params: client_id, status, partner_id, manager_id, page, limit, sort_by, sort_dir

Response 200:
{
  "data": [{
    "id": uuid,
    "name": string,
    "status": EngagementStatus,
    "client": { "id": uuid, "display_name": string },
    "engagement_type": { "id": uuid, "name": string, "category": string },
    "period_label": string | null,
    "period_start": date | null,
    "period_end": date | null,
    "assigned_partner": UserRef | null,
    "assigned_manager": UserRef | null,
    "fee_amount": string | null,
    "task_progress": { "total": number, "done": number, "cancelled": number }
  }],
  "meta": { "total", "page", "limit" }
}
```

```
POST /api/engagements
Request:
{
  "client_id": uuid,
  "engagement_type_id": uuid,
  "name": string | null,
  "status": EngagementStatus,
  "period_label": string | null,
  "period_start": date | null,
  "period_end": date | null,
  "assigned_partner_id": uuid | null,
  "assigned_manager_id": uuid | null,
  "assigned_team": uuid[],
  "fee_amount": string | null,
  "fee_currency": string,          // default "INR"
  "notes": string | null,
  "instantiate_template": boolean  // default true
}
Response 201: full engagement object
Error codes: 400, 404
```

---

#### Task Endpoints

```
GET /api/tasks
Query params:
  engagement_id, client_id, assignee_id,
  status (multi: ?status=TO_DO&status=IN_PROGRESS),
  priority, due_before, due_after, is_overdue,
  parent_task_id (uuid | 'null' for root tasks only),
  page, limit, sort_by (due_date|priority|created_at), sort_dir

Response 200:
{
  "data": [{
    "id": uuid,
    "title": string,
    "status": TaskStatus,
    "priority": Priority,
    "assignee": UserRef | null,
    "reviewer": UserRef | null,
    "due_date": date | null,
    "internal_due_date": date | null,
    "is_overdue": boolean,
    "is_blocked": boolean,
    "checklist_progress": { "completed": number, "total": number },
    "subtask_count": number,
    "client": { "id": uuid, "display_name": string } | null,
    "engagement": { "id": uuid, "name": string } | null,
    "tags": string[]
  }],
  "meta": { "total", "page", "limit" }
}
```

```
POST /api/tasks
Request:
{
  "title": string,                 // required, 1-300 chars
  "description": string | null,
  "engagement_id": uuid | null,
  "client_id": uuid | null,        // required if engagement_id null
  "parent_task_id": uuid | null,
  "status": TaskStatus,            // default TO_DO
  "priority": Priority,            // default MEDIUM
  "assignee_id": uuid | null,
  "reviewer_id": uuid | null,
  "due_date": date | null,
  "internal_due_date": date | null,
  "estimated_hours": number | null,
  "is_recurring": boolean,
  "recurrence_config": RecurrenceConfig | null,
  "tags": string[]
}
Response 201: full task object
Error codes:
  400 – assignee === reviewer, depth > 1 for subtask, missing client_id
  404 – engagement/client/assignee not found
```

```
GET /api/tasks/:id
Response 200:
{
  ...task fields,
  "assignee": UserRef | null,
  "reviewer": UserRef | null,
  "client": ClientRef | null,
  "engagement": EngagementRef | null,
  "parent_task": { "id": uuid, "title": string } | null,
  "subtasks": [TaskSummary],
  "checklist": [ChecklistItem],
  "dependencies": {
    "blocks": [TaskRef],
    "blocked_by": [TaskRef]
  },
  "is_blocked": boolean,
  "checklist_progress": { "completed": number, "total": number, "required_total": number }
}
```

```
PATCH /api/tasks/:id
Response 200: full task object
Error codes: 400, 404, 409
```

```
PATCH /api/tasks/:id/status
Request: { "status": TaskStatus }
Response 200: { "id": uuid, "status": TaskStatus, "completed_at": timestamptz | null }
Error codes:
  400 – Invalid transition. Body: { "current": TaskStatus, "attempted": TaskStatus, "allowed_transitions": TaskStatus[] }
  409 – DONE blocked. Body: { "incomplete_required_items": number }
```

```
POST   /api/tasks/:id/checklist
PATCH  /api/tasks/:id/checklist/:itemId
DELETE /api/tasks/:id/checklist/:itemId

POST   /api/tasks/:id/dependencies       // { "depends_on_task_id": uuid }
DELETE /api/tasks/:id/dependencies/:dependsOnTaskId
Error codes (dependencies):
  400 – Circular dependency detected
  409 – Dependency already exists

GET    /api/tasks/:id/comments
POST   /api/tasks/:id/comments           // { "body": string, "mentions": uuid[], "parent_comment_id": uuid | null }
PATCH  /api/tasks/:id/comments/:cid
DELETE /api/tasks/:id/comments/:cid     // soft delete

GET    /api/tasks/:id/activity           // paginated, default limit 20
```

---

### 3. Observability & Logging

**Error tracking (Sentry):**
- Wrap all `load()` functions in try/catch. Capture to Sentry with `user_id`, `firm_id`, `route`.
- Alert on: any 5xx from `PATCH /api/tasks/:id/status`
- Alert on: 429 from client or engagement create
- Alert threshold: >1% error rate on `POST /api/tasks` over 5-minute window

**Performance targets:**
- `GET /api/tasks` (list): P95 <300ms, alert if >500ms
- `GET /api/tasks/:id`: P95 <200ms, alert if >400ms
- `GET /api/dashboard`: P95 <800ms, alert if >1500ms
- Frontend: route transition → first interactive on task detail <1.5s

**User funnel events:**
```
client_create_started       { entity_type }
client_create_completed     { client_id, entity_type, has_pan, has_gst, tags_count }
client_create_failed        { error_code }
engagement_create_started   { engagement_type_code }
engagement_create_completed { engagement_id, engagement_type_code, instantiate_template }
task_status_changed         { task_id, from_status, to_status }
task_create_completed       { task_id, has_engagement, has_assignee, has_due_date }
checklist_item_toggled      { task_id, is_completed }
comment_submitted           { task_id, has_mentions, is_reply }
kanban_drag_completed       { task_id, from_status, to_status, success }
```

**Structured logs:** Include `X-Request-ID` header per page load. On 5xx: log `{ route, request_id, endpoint, status_code, duration_ms }` to Sentry.

---

## Part 2: Execution Plan (Ticket Breakdown)

**Build order:** 1.2 → 1.3 → 1.4 → 2.1 → 2.2 → 3.1 → 3.2 → 3.3 → 3.4 → 3.5 → 3.6 → 1.1 → 3.7 → 4.1 → 4.2

---

### Epic 1: Client Management
*Goal: CA team can create, view, filter, and edit clients with Indian regulatory field validation and multi-GST support.*

> **Story 1.1: [Backend] Verify client API contracts match PRD**
> *Description:* Audit client endpoints — confirm PAN regex, GSTIN regex, phone E.164, max 10 tags enforced.
> *Acceptance Criteria:*
> - [ ] `POST /api/clients` with invalid PAN → 400 with field-level error
> - [ ] `POST /api/clients` duplicate display_name (case-insensitive) → 409
> - [ ] `POST /api/clients/:id/gst-numbers` with mismatched state_code → 400
> - [ ] Phone fields reject non-E.164 format
> - [ ] PAN mandatory for non-INDIVIDUAL entity types (400 if missing)
> *Sub-tasks:*
> - [ ] Add/fix class-validator decorators on `CreateClientDto`
> - [ ] Add case-insensitive uniqueness check on `display_name` within firm
> - [ ] Add GSTIN regex + state_code cross-validation in `ClientGstNumbersService`
> - [ ] Add PAN conditional required logic: required if `entity_type != INDIVIDUAL`
> - [ ] Integration tests: valid create, duplicate name, invalid PAN, invalid GSTIN, PAN missing for company

---

> **Story 1.2: [Frontend] Client list page**
> *Description:* `/clients` — paginated table, filter bar, URL-synced state.
> *Acceptance Criteria:*
> - [ ] Table: display_name, entity_type, status badge, assigned_partner, assigned_manager, tag chips, GST count
> - [ ] Filters: status (multi-select), partner (UserPicker), tags, search (display_name/legal_name/pan)
> - [ ] Filters persist in URL — bookmarkable
> - [ ] Empty state with CTA to create first client
> - [ ] Loading skeleton while fetching
> *Sub-tasks:*
> - [ ] `+page.server.ts` — read URL params, call `GET /api/clients`
> - [ ] `ClientFilterBar.svelte` — all filter inputs, URL sync via `goto(replaceState: true)`
> - [ ] DataTable wired with client data + sort handlers
> - [ ] `EmptyState.svelte` reusable component
> - [ ] Loading skeleton (3 rows)

---

> **Story 1.3: [Frontend] Client create/edit form**
> *Description:* `/clients/new` and `/clients/:id/edit` — all fields, field-level validation.
> *Acceptance Criteria:*
> - [ ] entity_type first — drives field visibility (CIN for companies, TAN for TDS-registered)
> - [ ] PAN: uppercase enforced on input, required if entity_type != INDIVIDUAL, regex on blur
> - [ ] Phone: E.164 hint, validate on blur
> - [ ] GST section: add/remove entries, first auto-marked primary, per-entry GSTIN validation
> - [ ] Partner/Manager/Junior/Article pickers show only correct role
> - [ ] Submit → 201 → navigate to `/clients/:id`
> - [ ] 409 maps to inline error on `display_name` field
> - [ ] 400 field errors mapped to correct form fields
> *Sub-tasks:*
> - [ ] `PanField.svelte` — uppercase transform, conditional required, regex validation
> - [ ] `GstNumberList.svelte` — add/remove, isPrimary toggle, per-entry validation
> - [ ] `EntityTypePicker.svelte` — conditional field visibility
> - [ ] `UserPicker.svelte` with `role` filter prop
> - [ ] `TagInput.svelte` — max 10 enforcement
> - [ ] Error mapping: 400 → field state, 409 → display_name field

---

> **Story 1.4: [Frontend] Client detail page**
> *Description:* `/clients/:id` — overview, GST table, engagement list.
> *Acceptance Criteria:*
> - [ ] Header: display_name, legal_name, status badge, entity_type, team, open task count
> - [ ] PAN/TAN/CIN with copy-to-clipboard
> - [ ] GST table: GSTIN, state, type, primary indicator, dates
> - [ ] Engagements section: status, type, period, task progress bar
> - [ ] "Add Engagement" button → prefills client on engagement form
> - [ ] 404 → friendly error page
> *Sub-tasks:*
> - [ ] `+page.server.ts`: `GET /api/clients/:id` + `GET /api/engagements?client_id=:id`
> - [ ] `ClientHeader.svelte` with copy-to-clipboard for identifiers
> - [ ] `GstNumberTable.svelte` + inline add form
> - [ ] `EngagementCard.svelte` with task progress bar
> - [ ] `+error.svelte` for client routes

---

### Epic 2: Engagement Management
*Goal: CA team can create engagements, auto-generate task chains, and track progress.*

> **Story 2.1: [Frontend] Engagement create form**
> *Description:* Accessible from client detail and global nav. Type selection auto-fills name. Template instantiation defaults on.
> *Acceptance Criteria:*
> - [ ] Type picker grouped by category (GST, Income Tax, TDS, etc.)
> - [ ] Selecting type auto-fills name (editable), shows recurrence chip
> - [ ] Period fields: required for recurring types, optional for ONE_OFF
> - [ ] Team: partner/manager pre-filled from client if accessed from client detail
> - [ ] "Generate task checklist" toggle — default ON — shows task preview
> - [ ] Submit → 201 → navigate to `/engagements/:id`
> *Sub-tasks:*
> - [ ] `EngagementTypePicker.svelte` — grouped, fetch + cache `GET /api/engagement-types`
> - [ ] Auto-fill: on type select, name = `{type.name} - {client.name} - {period}`
> - [ ] Period fields conditional on recurrence type
> - [ ] `TaskTemplatePreview.svelte` — fetch template items, show ordered list
> - [ ] Form submit with `instantiate_template` wired to toggle

---

> **Story 2.2: [Frontend] Engagement detail page**
> *Description:* `/engagements/:id` — summary, task list, status transitions.
> *Acceptance Criteria:*
> - [ ] Header: name, type badge, status, period, client link, fee
> - [ ] Team section: partner, manager, assigned_team
> - [ ] Task list: status badges, assignees, due dates, progress
> - [ ] Status control: role-restricted, COMPLETED blocked if open tasks (show blocking list)
> - [ ] "Add Task" pre-fills engagement_id on task create
> - [ ] Overdue tasks: red due_date + icon
> *Sub-tasks:*
> - [ ] `+page.server.ts`: engagement + tasks load
> - [ ] `EngagementStatusControl.svelte` — role + state machine restricted
> - [ ] `TaskListByEngagement.svelte` — sorted by due_date ASC, overdue highlight
> - [ ] COMPLETED gate: catch 400, show modal with blocking task titles

---

### Epic 3: Task Tracking
*Goal: Team members can see tasks, update status, manage checklists and subtasks, communicate via comments.*

> **Story 3.1: [Frontend] Task list page (list + kanban toggle)**
> *Description:* `/tasks` — list and kanban views. Default view by role.
> *Acceptance Criteria:*
> - [ ] Default: ARTICLE/JUNIOR_CA → My Tasks; PARTNER/MANAGER/ADMIN → All Tasks
> - [ ] View toggle: List / Kanban (persisted in localStorage)
> - [ ] Filters: assignee, status (multi), priority, due_before, client, overdue toggle — URL-synced
> - [ ] List: sortable, columns: title, client, status, priority, assignee, due_date, is_blocked
> - [ ] Kanban: 5 columns (TO_DO → IN_PROGRESS → AWAITING_CLIENT → UNDER_REVIEW → PARTNER_APPROVAL) + collapsed DONE
> - [ ] Drag in kanban: pre-validate transition client-side, PATCH on drop, revert on 400/409
> - [ ] Overdue: red due_date chip (list) / red card border (kanban)
> *Sub-tasks:*
> - [ ] `TaskFilterBar.svelte` — all filters, URL sync, role-based default assignee filter
> - [ ] `TaskListView.svelte` — sortable DataTable
> - [ ] Wire `KanbanBoard.svelte` to URL-filtered data
> - [ ] Drag handler: check `TASK_STATUS_TRANSITIONS` before API call
> - [ ] Kanban optimistic update + rollback
> - [ ] View mode in `localStorage` key `tasks_view_mode`

---

> **Story 3.2: [Frontend] Task create form**
> *Description:* `/tasks/new` — standalone or engagement-linked. Pre-fill from URL params.
> *Acceptance Criteria:*
> - [ ] Title (required), description (plain textarea)
> - [ ] Client → engagement 2-level picker (engagement filters to selected client)
> - [ ] Assignee + reviewer pickers, inline error if equal
> - [ ] Due date + internal_due_date (auto-computed shown as hint, overridable)
> - [ ] Priority picker, tags input
> - [ ] Pre-fill from `?engagement_id=` and `?client_id=` URL params
> - [ ] Submit → navigate to `/tasks/:id`
> *Sub-tasks:*
> - [ ] `ClientEngagementPicker.svelte` — 2-level dependent select
> - [ ] `AssigneePicker.svelte` with conflict validation (assignee ≠ reviewer)
> - [ ] `InternalDueDateField.svelte` — computed hint, override input
> - [ ] URL param pre-fill on mount
> - [ ] Test: create with engagement, create standalone, assignee = reviewer error

---

> **Story 3.3: [Frontend] Task detail page — metadata + status**
> *Description:* `/tasks/:id` — two-panel layout: body left, metadata sidebar right.
> *Acceptance Criteria:*
> - [ ] Status: dropdown shows only allowed transitions from current state
> - [ ] DONE gate: if incomplete required checklist items → modal with count
> - [ ] Inline edit: title + description click-to-edit, Escape cancels, blur saves
> - [ ] Sidebar pickers: assignee, reviewer, due_date, priority, tags — immediate PATCH on change
> - [ ] Subtask list: child tasks with status; "Add subtask" quick-create (title only)
> - [ ] 404 task → friendly error
> *Sub-tasks:*
> - [ ] `+page.server.ts`: full task load
> - [ ] `TaskStatusControl.svelte` — allowed transitions dropdown, PATCH `/status`
> - [ ] `TaskMetadataSidebar.svelte` — all pickers, immediate PATCH, per-field loading state
> - [ ] Inline edit: input toggle on title/description
> - [ ] `SubtaskList.svelte` — list + quick-add input
> - [ ] DONE gate: 409 response → modal

---

> **Story 3.4: [Frontend] Checklist section with optimistic toggle**
> *Description:* Checklist below description. Add, complete, reorder, delete.
> *Acceptance Criteria:*
> - [ ] Each item: checkbox (optimistic), label, required lock icon, delete
> - [ ] Optimistic toggle: instant UI, async PATCH, revert + toast on failure
> - [ ] Add item: inline input at bottom, Enter to add, Escape to cancel
> - [ ] Progress bar: total + required separate counts
> - [ ] Reorder: drag handles
> - [ ] Max 30 items — disable add + show hint at limit
> *Sub-tasks:*
> - [ ] `ChecklistSection.svelte` — full checklist, optimistic toggle via `$state` mirror
> - [ ] Dual progress bar (total / required)
> - [ ] Drag reorder: native drag events, PATCH `display_order` on drop
> - [ ] Keyboard UX: Tab between items, Enter in add-input submits

---

> **Story 3.5: [Frontend] Dependency section**
> *Description:* Blocked-by and blocks lists. Add via task search.
> *Acceptance Criteria:*
> - [ ] "Blocked by" + "Blocks" lists with status badges
> - [ ] Blocked banner if `is_blocked: true`
> - [ ] Add: typeahead search across firm tasks, exclude self + existing deps
> - [ ] Circular dep: 400 → toast "Cannot add: creates circular dependency"
> - [ ] Remove: X button per row
> *Sub-tasks:*
> - [ ] `DependencySection.svelte`
> - [ ] Blocked banner (dismissible within session)
> - [ ] Task search typeahead: debounced `GET /api/tasks?search=&limit=10`
> - [ ] Add/remove with loading states

---

> **Story 3.6: [Frontend] Comment section with @mentions**
> *Description:* Comment thread below dependencies. Plain textarea + @mention chips.
> *Acceptance Criteria:*
> - [ ] Comment list: avatar, name, time ago, body, reply button
> - [ ] @mention: trigger on `@`, show user picker, insert chip
> - [ ] Reply scoped to parent comment
> - [ ] Deleted comment shows "[comment deleted]" if has replies
> - [ ] Optimistic: append immediately with pending indicator, confirm on 201
> - [ ] Edit: textarea with existing body
> *Sub-tasks:*
> - [ ] `CommentSection.svelte` + `CommentCompose.svelte`
> - [ ] @mention detection + UserPicker popup
> - [ ] Optimistic append: local `$state` array, async POST, remove on failure
> - [ ] Edit/delete handlers

---

> **Story 3.7: [Frontend] Activity timeline (collapsed)**
> *Description:* Activity log collapsed by default, load-more pagination.
> *Acceptance Criteria:*
> - [ ] Shows last 3 events collapsed. "Show all activity" expands.
> - [ ] Human-readable action strings for all 14 action enum values
> - [ ] Load more: paginated 20/page
> - [ ] Time: "2 hours ago" / "yesterday" / "Apr 10"
> *Sub-tasks:*
> - [ ] `ActivityTimeline.svelte` — collapsed + expand
> - [ ] Action → human-readable string map
> - [ ] Paginated load more

---

### Epic 4: Foundation & Observability
*Goal: App is resilient, debuggable, and instrumented.*

> **Story 4.1: [Full-Stack] Error boundaries and empty states**
> *Acceptance Criteria:*
> - [ ] `/(app)/+error.svelte` — catches load() failures, retry option
> - [ ] Per-route `+error.svelte` for client/engagement/task (404 friendly)
> - [ ] Empty states for: clients, tasks, engagements, comments
> - [ ] 429 → toast + disable submit 5 seconds
> *Sub-tasks:*
> - [ ] `+error.svelte` in each route group
> - [ ] `EmptyState.svelte` reusable (icon + heading + subtext + optional CTA)
> - [ ] `apiError` util: maps HTTP status → user message, Sentry for 5xx
> - [ ] 429 handler in shared `apiFetch` wrapper

---

> **Story 4.2: [Frontend] Structured event logging**
> *Acceptance Criteria:*
> - [ ] Events fire at: client created, engagement created, task created, task status changed, checklist toggled, comment submitted
> - [ ] Each event: `firm_id`, `user_id`, entity context. No PII.
> - [ ] Dev: `console.info`. Prod: `PUBLIC_ANALYTICS_ENABLED` gate.
> *Sub-tasks:*
> - [ ] `analytics.ts` — `track(event, props)` wrapper with env gate
> - [ ] Wire track calls at each success point
> - [ ] Audit all track() calls for PII before merge
