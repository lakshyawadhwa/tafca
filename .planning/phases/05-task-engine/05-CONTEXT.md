# Phase 5: Task Engine - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

The task engine is the core value proposition of CA Practice OS. Users can create tasks (standalone or engagement-bound), transition them through an enforced status machine, manage checklists, set up dependencies, post threaded comments with @mentions, and view a full activity timeline. The frontend provides both a table view and a Kanban board for task management.

**Backend scope:** Task module (CRUD, status machine, internal due date computation, subtask depth enforcement), TaskChecklist sub-resource (CRUD, toggle, max 30 enforcement, DONE-blocking), TaskDependency sub-resource (add/remove, cycle detection, DEPENDENCY_UNBLOCKED event), TaskComment sub-resource (threaded with @mentions, COMMENT_MENTION notifications), TaskActivityLog (immutable log of all mutations), notification emission stubs for Phase 6.

**Frontend scope:** Task list page with table + Kanban views (PAGE-04), Task detail page with status controls, checklist, dependencies, comments, and activity timeline (PAGE-05).

</domain>

<decisions>
## Implementation Decisions

### Backend Module Structure

- Follow the established pattern from `client/` and `engagement/`: top-level directory `apps/api/src/task/` with `task.module.ts`, `task.controller.ts`, `task.service.ts`, `dto/` subfolder
- TaskService extends `FirmScopedService` — `this.prisma` auto-injects firm_id, `this.getFirmId()` / `this.getUserId()` available
- Sub-resources (checklists, dependencies, comments, activity) are nested endpoints on the task controller, not separate modules — same pattern as GST numbers on the client controller
  - `POST/GET /api/tasks/:taskId/checklist`
  - `PATCH/DELETE /api/tasks/:taskId/checklist/:id`
  - `POST/DELETE /api/tasks/:taskId/dependencies`
  - `GET /api/tasks/:taskId/dependencies`
  - `POST/GET /api/tasks/:taskId/comments`
  - `PATCH/DELETE /api/tasks/:taskId/comments/:id`
  - `GET /api/tasks/:id/activity`
- However, to keep the service file manageable, split into helper services: `TaskChecklistService`, `TaskDependencyService`, `TaskCommentService`, `TaskActivityService` — all injected into `TaskService` or used directly by the controller. All extend `FirmScopedService`.
- Register `TaskModule` in `app.module.ts`

### Task Status Machine Implementation (TASK-02)

- The `TASK_STATUS_TRANSITIONS` map already exists in `packages/shared/src/constants/task-status-transitions.ts` — both backend and frontend consume it
- Status change endpoint: `PATCH /api/tasks/:id/status` with body `{ status: TaskStatus }`
- Validation pattern matches `EngagementService.changeEngagementStatus()`: look up current status, check `TASK_STATUS_TRANSITIONS[currentStatus].includes(targetStatus)`, throw `BadRequestException` with `allowed_transitions[]` on invalid
- Additional gates on DONE transition:
  1. Check for incomplete required checklist items — if any, throw `ConflictException` with item labels
  2. Set `completedAt` timestamp
- On CANCELLED transition: set `cancelledAt` timestamp
- Notification emission on status change:
  - `IN_PROGRESS` -> `UNDER_REVIEW`: emit `TASK_REVIEW_REQUESTED` to `reviewerId`
  - `UNDER_REVIEW` -> `PARTNER_APPROVAL`: emit `TASK_APPROVAL_REQUESTED` to partner
  - `UNDER_REVIEW`/`PARTNER_APPROVAL` -> `IN_PROGRESS`: emit `TASK_SENT_BACK` to `assigneeId`
  - Assignee change: emit `TASK_ASSIGNED` to new assignee
- **V1 notification approach:** Create `TaskNotificationHelper` that builds notification payloads and writes to the `notifications` table directly. Phase 6 will add the in-app UI for viewing them. For V1, we just write the records — no real-time delivery, no email.

### Task Status Change UX (Kanban Drag + Dropdown)

- **Kanban view:** Columns map to task statuses. Drag-and-drop triggers a status transition API call. If the transition is invalid (e.g., dragging from TO_DO to DONE), revert the drag and show a toast error with the allowed transitions.
- **Table view:** Use the existing `StatusTransitionDropdown` component (already built in Phase 4) — it accepts `currentStatus`, `transitions` map, and `onTransition` callback. Pass `TASK_STATUS_TRANSITIONS` as the transitions prop with `entityType: 'task'`.
- **DONE transition with checklist gate:** When the status change API returns a 409 (incomplete required checklist items), show a toast error: "Cannot mark as done: N required checklist items are incomplete". The user can then open the task detail to complete them.
- **Kanban implementation:** Use a lightweight drag-and-drop library (`@neodrag/svelte` or `svelte-dnd-action`). Whichever is simpler and better maintained. Columns are rendered from the status enum order. Each card shows: title, priority badge, assignee avatar, due date, checklist progress. Drag handles on the card.

### Checklist UX (TASK-08)

- **Inline management on task detail page** — no modal. Checklist items appear as a list below the task description.
- Each item: checkbox (toggle), label text (click-to-edit inline), required badge (small "Required" tag), drag handle for reorder, delete button (x icon)
- "Add item" input at the bottom of the list — type label, press Enter to add. New items default to `isRequired: true`.
- Toggle checkbox calls `PATCH /api/tasks/:taskId/checklist/:id` with `{ isCompleted: true/false }`
- Max 30 enforcement: backend validates on create; frontend disables the "Add item" input when count reaches 30, shows "(30/30 max)" hint
- Checklist progress shown as a mini progress bar on the task list/Kanban card: "3/5" with a thin bar
- Required items are visually distinguished — a small red asterisk or "Required" tag next to the label

### Dependency Management (TASK-09, TASK-10)

- **Cycle detection algorithm:** BFS/DFS from the prospective dependent task, walking `dependsOnTaskId` edges. If we reach the predecessor task, it's a cycle. Done in the service layer before insert. Since task graphs within a firm are small (typically <50 tasks per engagement), a simple recursive query is fine — no need for graph DB or complex algorithms.
- **Implementation:** When adding a dependency `(taskA depends on taskB)`:
  1. Validate both tasks exist in same firm
  2. Validate `taskA !== taskB`
  3. Check for existing duplicate
  4. Run cycle check: from taskB, walk all its `dependsOn` edges recursively. If taskA is found, reject with 400.
  5. Create the `TaskDependency` record
- **DEPENDENCY_UNBLOCKED event (TASK-10):** When a task transitions to DONE, query all tasks that `dependsOn` this task. For each, check if ALL their dependencies are now DONE. If so, emit `TASK_DEPENDENCY_UNBLOCKED` notification to the dependent task's assignee. If some dependencies remain, do nothing.
- **UI for dependencies on task detail page:** A "Dependencies" section showing two lists:
  - "Blocked by" — tasks this task depends on, with their status badges. Each row has a remove (x) button.
  - "Blocking" — tasks that depend on this task, read-only list with status badges.
  - "Add dependency" — a task search/picker to select a predecessor task. Shows error toast if cycle detected.
- **Blocked indicator:** Tasks with unresolved dependencies (at least one predecessor not DONE) show a "Blocked" badge on the list/Kanban views. This is computed in the list query: `is_blocked = dependsOn.some(dep => dep.dependsOnTask.status !== DONE)`

### Comments with @Mentions (TASK-11)

- **Mention parsing approach:** The frontend uses a rich-text-like input where typing `@` triggers a user picker dropdown (search firm users). When a user is selected, their name is inserted as `@[Full Name](userId)` in the comment body. The `mentions` array is built from these insertions before submitting.
- **Simpler V1 approach:** Skip rich text. Use a plain textarea. Below it, a "Mention" button or `@` shortcut opens a UserPicker popover. Selected users appear as chips below the textarea, and their IDs are added to the `mentions[]` array. The comment `body` is plain text — mentions are displayed by post-processing the `mentions` array to highlight names in the rendered comment.
- **Who can be mentioned:** Any active user in the firm. The UserPicker already supports firm-scoped user search.
- **Notification integration:** On comment create, for each userId in `mentions[]`, write a `COMMENT_MENTION` notification record. Phase 6 surfaces these in the notification bell.
- **Threading:** `parentCommentId` enables one level of replies. Top-level comments render with a "Reply" button. Replies are indented under the parent. No deeper nesting.
- **Display:** Comments shown newest-first for top-level, oldest-first for replies within a thread. Each comment shows: author name, avatar, relative timestamp ("2h ago"), body text, mention highlights, reply button, edit/delete (own comments only).

### Activity Timeline (TASK-12)

- **What gets logged:** Every task mutation creates a `TaskActivityLog` entry via the `TaskActivityService`. Logged actions (from the `TaskAction` enum):
  - `CREATED` — task creation with initial values
  - `STATUS_CHANGED` — old/new status
  - `ASSIGNEE_CHANGED` — old/new assignee IDs
  - `REVIEWER_CHANGED` — old/new reviewer IDs
  - `DUE_DATE_CHANGED` — old/new dates
  - `PRIORITY_CHANGED` — old/new priority
  - `CHECKLIST_ITEM_COMPLETED` / `CHECKLIST_ITEM_UNCOMPLETED` — item label
  - `COMMENT_ADDED` — comment preview
  - `DEPENDENCY_ADDED` / `DEPENDENCY_REMOVED` — predecessor task title
- **Display format:** A vertical timeline on the task detail page. Each entry: actor name, action description (human-readable sentence, e.g., "changed status from In Progress to Under Review"), relative timestamp. No avatars in the timeline — keep it compact.
- **Data fetching:** `GET /api/tasks/:id/activity?page=1&limit=50` — paginated, newest-first. Load more on scroll or "Load more" button.
- **Activity log write pattern:** `TaskActivityService.log(taskId, action, oldValue, newValue)` — called from within service methods. Fire-and-forget (don't await, catch and log errors silently). Same philosophy as the ActionLogInterceptor.

### Task Detail Page Layout (PAGE-05)

- **Single page with sections, not tabs.** Task detail has a natural flow: status + metadata at top, then description, then checklist, dependencies, comments, and activity. Tabs would hide important information and add unnecessary clicks. Scrollable single page is better for task context.
- **Layout structure:**
  - **Header:** Title (editable inline), status transition dropdown, priority badge (editable), action menu (delete)
  - **Metadata bar:** Assignee picker, Reviewer picker, Due date picker, Client link, Engagement link, Tags. All inline-editable.
  - **Description:** Rich text area (or plain textarea for V1), editable
  - **Checklist section:** Inline checklist with progress bar
  - **Dependencies section:** Blocked-by and Blocking lists
  - **Comments section:** Threaded comment list with compose box
  - **Activity section:** Timeline at the bottom (collapsed by default, expandable)
- **Responsive:** On mobile, metadata bar stacks vertically. On desktop, two-column: main content (left, wider) and metadata sidebar (right, narrower) — like JIRA/Linear issue view.
- **Two-column desktop layout:**
  - Left (2/3): Title, Description, Checklist, Comments
  - Right (1/3): Status, Priority, Assignee, Reviewer, Due Date, Client, Engagement, Tags, Dependencies, Activity

### Internal Due Date Computation (TASK-05)

- **Buffer chain from PRD section 13.3:**
  ```
  buffer = firm.settings.default_internal_deadline_buffer_days ?? 3
  internal_due_date = due_date - buffer days
  ```
- **V1 simplification:** The full chain includes `task.internal_buffer_days` (not on the schema) and `client_compliance_assignment.internal_buffer_days` (compliance is deferred to V1.1). So for V1, the chain simplifies to just the firm-level setting with a fallback of 3 days.
- **Implementation:** On task create or update where `dueDate` is set (and `internalDueDate` is NOT explicitly provided):
  1. Fetch `firm.settings` (from the Firm model's `settings` JSONB)
  2. Extract `default_internal_deadline_buffer_days` (default: 3)
  3. Compute `internalDueDate = dueDate - bufferDays`
  4. If user explicitly provides `internalDueDate`, use that instead (override)
- **Validation:** `internalDueDate` must be `<= dueDate` if both are set
- **When dueDate is cleared:** Also clear `internalDueDate`

### Subtask Depth (TASK-06)

- Max 1 level: a task can have a `parentTaskId`, but a subtask cannot itself have subtasks
- **Enforcement:** On create/update, if `parentTaskId` is provided, check that the parent task does NOT have a `parentTaskId` itself. If it does, throw `BadRequestException('Subtask depth limited to 1 level — cannot create a subtask of a subtask')`
- **List view:** Subtasks do NOT appear as top-level items in the task list — they appear nested under their parent. In table view, parent tasks have an expand chevron that reveals subtasks inline. In Kanban view, subtasks are not shown as separate cards — they appear only on the parent task's detail page.
- **Detail view:** Parent task shows a "Subtasks" section (between description and checklist) listing child tasks with their status, assignee, and due date. Each subtask links to its own detail page. A "Add subtask" button creates a new task pre-filled with `parentTaskId`.

### Task List Filters (TASK-07, PAGE-04)

- **Filter set:** Horizontal filter bar (same component pattern as client/engagement lists):
  - Assignee (UserPicker)
  - Client (ClientPicker)
  - Engagement (dropdown, filtered by selected client if present)
  - Status (multi-select — allow selecting multiple statuses)
  - Priority (multi-select)
  - Due date range (start/end DatePickers)
  - Overdue toggle (checkbox: "Show overdue only")
  - Search (text input — searches title)
- **Server-side filtering:** All filters are query params sent to `GET /api/tasks`. The backend builds Prisma `where` clauses accordingly.
- **URL-synced filters:** Filters update the URL search params so that filter state is bookmarkable and shareable. Use SvelteKit's `goto()` with `replaceState: true` to update the URL without full navigation.
- **View toggle:** A toggle button between "Table" and "Board" (Kanban) views. The active view is also stored in the URL (e.g., `?view=board`). Both views share the same filter state.
- **Kanban filtering:** Filters apply to the board too — filtered-out cards simply don't appear. Column headers show count of visible cards.

### Task Creation

- **Route:** `/tasks/new` for standalone task creation. Also accessible via "Add Task" button on engagement detail and client detail pages (pre-fills `clientId` / `engagementId`).
- **Form approach:** Full-page form (same pattern as client creation), not a modal. Task creation has enough fields (title, description, client, engagement, assignee, reviewer, priority, due date, tags, initial checklist items) that a modal would feel cramped.
- **Engagement auto-sets client:** When `engagementId` is selected, auto-populate `clientId` from the engagement's client. If `clientId` is selected first, filter the engagement dropdown to that client's engagements.
- **Initial checklist items:** An optional section on the create form to add checklist items inline. Same UX as the detail page checklist but starting empty.

### Notification Emission Stubs (TASK-13)

- **V1 approach:** Write notification records to the `notifications` table on task events. These records sit ready for Phase 6 to surface in the UI.
- **Events that emit notifications:**
  - Task assigned (`TASK_ASSIGNED`) -> assignee
  - Status to UNDER_REVIEW (`TASK_REVIEW_REQUESTED`) -> reviewer
  - Status to PARTNER_APPROVAL (`TASK_APPROVAL_REQUESTED`) -> assigned partner
  - Status sent back to IN_PROGRESS (`TASK_SENT_BACK`) -> assignee
  - Dependency unblocked (`TASK_DEPENDENCY_UNBLOCKED`) -> blocked task's assignee
  - Comment mention (`COMMENT_MENTION`) -> each mentioned user
- **Implementation:** A `NotificationService` (or `TaskNotificationHelper`) that takes event type + recipient + metadata and writes to the notifications table. Called from TaskService methods. If the write fails, log the error and continue (fire-and-forget) — never fail the main operation because of a notification write error.

### Claude's Discretion

- Exact DTO field names and response shapes (follow existing camelCase patterns from client/engagement)
- Prisma query optimization (select vs include, batch strategies for list queries)
- Drag-and-drop library choice for Kanban (`svelte-dnd-action` vs `@neodrag/svelte` vs native HTML5 DnD)
- Exact Kanban card layout and styling
- Comment textarea vs contenteditable implementation details
- Activity timeline entry formatting (exact sentence templates)
- Whether cycle detection uses BFS or DFS (either works at this scale)
- Exact mobile breakpoint for two-column -> single-column layout on task detail
- Whether "Add subtask" inline or navigates to `/tasks/new?parentTaskId=...`
- Filter bar responsive collapse behavior on mobile

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- **FirmScopedService** (`common/base/firm-scoped.service.ts`): Abstract base providing `this.prisma` (firm-scoped), `this.unscopedPrisma`, `this.getFirmId()`, `this.getUserId()`
- **TASK_STATUS_TRANSITIONS** (`packages/shared/src/constants/task-status-transitions.ts`): Already defined transition map — TO_DO, IN_PROGRESS, AWAITING_CLIENT, UNDER_REVIEW, PARTNER_APPROVAL, DONE, CANCELLED
- **Shared enums**: `TaskStatus` (7 values), `TaskPriority` (4 values), `TaskAction` (14 action types), `NotificationType` (21 types including all task events)
- **Shared LIMITS**: `MAX_CHECKLIST_ITEMS_PER_TASK` (30), `MAX_MENTIONS_PER_COMMENT` (10), `COMMENT_MAX_LENGTH` (5000), `TASK_TITLE_MAX_LENGTH` (300), `TASK_DESCRIPTION_MAX_LENGTH` (10000)
- **UI Components**: DataTable (server-side pagination), Modal, FormField, StatusBadge, StatusTransitionDropdown, UserPicker, ClientPicker, DatePicker, FilterBar, EmptyState, LoadingSkeleton, ConfirmDialog, Button, Input, Tabs, TagInput, Select, GroupedSelect, InlineEdit, ToastContainer
- **API utility**: `api<T>(path, options)` in `$lib/utils/api.ts`
- **Auth store**: `getAccessToken()`, `getUser()` in `$lib/stores/auth.svelte.ts`
- **Toast store**: `$lib/stores/toast.svelte.ts`

### Established Backend Patterns
- **Status transition pattern**: `EngagementService.changeEngagementStatus()` — lookup current, validate against transition map, additional gates (COMPLETED blocked by open tasks), cascade effects (CANCELLED cascades), timestamp auto-set. Task status changes follow this exact pattern.
- **Sub-resource CRUD pattern**: `ClientService.addGstNumber()` etc. — nested under parent entity, parent existence verified first, transaction for cross-record updates
- **Pagination response**: `{ data: T[], meta: { total, page, limit, totalPages } }`
- **Guards**: JwtAuthGuard, RolesGuard, FirmScopeGuard — all applied globally
- **ActionLogInterceptor**: Automatically logs all mutations
- **Error responses**: ConflictException, BadRequestException, NotFoundException

### Established Frontend Patterns
- **Route groups**: `(app)/tasks/` already has a placeholder `+page.svelte`
- **Data fetching**: SvelteKit `+page.server.ts` for SSR, `api()` for client-side mutations, `invalidateAll()` after mutations
- **Svelte 5 runes**: `$state`, `$derived`, `$props` throughout
- **TailwindCSS v4**: CSS @import approach, complete class strings

### Prisma Models Available
- `Task` (24+ fields + audit + relations to engagement, client, parentTask, subTasks, checklists, comments, activityLog, dependsOn, dependedOnBy)
- `TaskChecklist` (11 fields + audit, indexed on taskId and firmId)
- `TaskDependency` (5 fields, unique constraint on taskId+dependsOnTaskId, indexed on both)
- `TaskComment` (10+ fields + audit, self-referential for threading via parentCommentId)
- `TaskActivityLog` (8 fields, immutable, indexed on taskId)
- `TaskTemplate` + `TaskTemplateItem` (already used by engagement template instantiation)

### Integration Points (API Endpoints)
- `POST /api/tasks` — create task (standalone or engagement-bound, optional initial checklist items)
- `GET /api/tasks` — list with full filter set, pagination, includes computed fields
- `GET /api/tasks/:id` — detail with checklists, dependency counts, related data
- `PATCH /api/tasks/:id` — update task fields
- `PATCH /api/tasks/:id/status` — status transition with validation + gates + notifications
- `DELETE /api/tasks/:id` — soft-delete
- `POST/GET /api/tasks/:taskId/checklist` — add/list checklist items
- `PATCH/DELETE /api/tasks/:taskId/checklist/:id` — update/delete checklist item
- `POST/GET/DELETE /api/tasks/:taskId/dependencies` — manage dependencies
- `POST/GET /api/tasks/:taskId/comments` — add/list comments
- `PATCH/DELETE /api/tasks/:taskId/comments/:id` — edit/delete comment
- `GET /api/tasks/:id/activity` — paginated activity timeline

</code_context>

<specifics>
## Specific Ideas

### Kanban Column Ordering
Render Kanban columns in the logical workflow order: TO_DO | IN_PROGRESS | AWAITING_CLIENT | UNDER_REVIEW | PARTNER_APPROVAL | DONE. Omit CANCELLED from the board — cancelled tasks only appear when filtered explicitly in table view.

### Computed `is_blocked` Field
On the task list endpoint, compute `is_blocked` as a derived field: `dependsOn.some(dep => dep.dependsOnTask.status NOT IN (DONE, CANCELLED))`. Include it in the list response so the frontend can show a "Blocked" badge without extra queries.

### Checklist Progress in List Response
Include `checklist_progress: { completed, total }` in the task list response — computed via count aggregation. This powers the mini progress bar on Kanban cards and table rows.

### Internal Due Date Display
Show `internalDueDate` as a secondary date below the main `dueDate` on the task detail metadata bar, labeled "Internal deadline". On the task list, only show `dueDate` — `internalDueDate` is visible on the detail page.

### Comment Mention Chips
Instead of rich-text @mention inline parsing, use a simpler approach: mention chips rendered below the textarea. When the user clicks a chip or presses a remove icon, the mention is removed from the array. This is faster to build and avoids contenteditable headaches.

### Activity Log Sentence Templates
Build a mapping of `TaskAction` -> human-readable template:
- `STATUS_CHANGED`: "{actor} changed status from {old} to {new}"
- `ASSIGNEE_CHANGED`: "{actor} assigned to {new}" / "{actor} unassigned {old}"
- `CHECKLIST_ITEM_COMPLETED`: "{actor} completed '{label}'"
- `COMMENT_ADDED`: "{actor} commented"
- `DEPENDENCY_ADDED`: "{actor} added dependency on '{predecessor title}'"

### Task Create from Engagement Context
When creating a task from an engagement's task tab, pre-fill: `engagementId`, `clientId`, `assigneeId` (from engagement team), `dueDate` (from engagement period end). This saves repetitive data entry.

</specifics>

<deferred>
## Deferred Ideas

- **Recurring task instance creation** — The `isRecurring` and `recurrenceConfig` fields exist on the Task model, but automatic recurrence (PRD 13.2: creating next instance when current completes) is deferred to V1.1 with the cron system. The fields are writable but no automation triggers.
- **Compliance-linked tasks** — `statutoryDeadlineId` exists but compliance calendar is V1.1. Field is nullable and ignored in V1.
- **Task custom fields** — `customFields` JSONB column exists but no UI to define or render custom fields in V1.
- **Bulk task operations** — Multi-select + bulk status change, bulk assign, bulk delete. Useful but not V1.
- **Task time tracking** — `estimatedHours` is writable, but no time log / actual hours tracking in V1.
- **Real-time updates on Kanban** — WebSocket/SSE for live board updates when another user moves a task. V1 uses polling or manual refresh.
- **Advanced search** — Full-text search across task titles and descriptions. V1 uses simple `contains` search on title.
- **Task export** — CSV/PDF export of task lists. V1.1 territory.
- **Saved filters / views** — Named filter presets that users can save and share. Useful but not V1.
- **Attachment/document linking** — Document management is deferred to V1.1. The `documents` relation on Task exists but won't be populated.

</deferred>
