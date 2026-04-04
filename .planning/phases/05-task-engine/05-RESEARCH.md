# Phase 5: Task Engine - Research

**Researched:** 2026-04-04
**Domain:** Full-stack task management -- NestJS backend (CRUD, status machine, sub-resources) + SvelteKit frontend (table/Kanban views, detail page)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Backend Module Structure:**
- Top-level directory `apps/api/src/task/` with `task.module.ts`, `task.controller.ts`, `task.service.ts`, `dto/` subfolder
- TaskService extends `FirmScopedService`
- Sub-resources are nested endpoints on the task controller (not separate modules): `/api/tasks/:taskId/checklist`, `/api/tasks/:taskId/dependencies`, `/api/tasks/:taskId/comments`, `/api/tasks/:id/activity`
- Split into helper services: `TaskChecklistService`, `TaskDependencyService`, `TaskCommentService`, `TaskActivityService` -- all extend `FirmScopedService`
- Register `TaskModule` in `app.module.ts`

**Task Status Machine (TASK-02):**
- `TASK_STATUS_TRANSITIONS` map from `packages/shared/src/constants/task-status-transitions.ts`
- Status change endpoint: `PATCH /api/tasks/:id/status` with body `{ status: TaskStatus }`
- Validation pattern matches `EngagementService.changeEngagementStatus()`
- Additional gates on DONE (incomplete required checklist items -> ConflictException) and CANCELLED (set cancelledAt)
- Notification emission on status transitions via `TaskNotificationHelper` that writes directly to `notifications` table

**Kanban + Table View UX:**
- Kanban columns map to task statuses, drag-and-drop triggers status transition API call
- Invalid transitions revert drag and show toast error
- Table view uses existing `StatusTransitionDropdown` component with `TASK_STATUS_TRANSITIONS` + `entityType: 'task'`
- DONE 409 response shows toast: "Cannot mark as done: N required checklist items are incomplete"
- Kanban columns rendered in status enum order: TO_DO | IN_PROGRESS | AWAITING_CLIENT | UNDER_REVIEW | PARTNER_APPROVAL | DONE (CANCELLED omitted)

**Checklist UX (TASK-08):**
- Inline management on task detail page (no modal)
- Each item: checkbox toggle, click-to-edit label, required badge, drag handle, delete button
- "Add item" input at bottom, Enter to add, defaults to `isRequired: true`
- Max 30 enforcement: backend validates on create, frontend disables input at 30
- Checklist progress as mini progress bar on list/Kanban cards

**Dependency Management (TASK-09, TASK-10):**
- Cycle detection: BFS/DFS from prospective dependent task, walking `dependsOnTaskId` edges
- Validation: both tasks same firm, no self-dependency, no duplicates, cycle check before insert
- DEPENDENCY_UNBLOCKED: when task -> DONE, check all dependent tasks, if ALL deps now DONE, emit notification
- UI: "Blocked by" (removable) + "Blocking" (read-only) lists, task search/picker to add

**Comments with @Mentions (TASK-11):**
- V1: plain textarea, "Mention" button/@shortcut opens UserPicker popover, chips below textarea
- `mentions[]` array built from selected users, comment `body` is plain text
- Notifications written on comment create for each mentioned userId
- Threading: `parentCommentId` for one level of replies, newest-first top-level, oldest-first replies

**Activity Timeline (TASK-12):**
- Logged via `TaskActivityService.log(taskId, action, oldValue, newValue)` -- fire-and-forget
- Vertical timeline on task detail, actor name + human-readable sentence + relative timestamp
- Paginated: `GET /api/tasks/:id/activity?page=1&limit=50`

**Task Detail Page Layout (PAGE-05):**
- Single page with sections (not tabs)
- Two-column desktop: Left (2/3): Title, Description, Checklist, Comments. Right (1/3): Status, Priority, Assignee, Reviewer, Due Date, Client, Engagement, Tags, Dependencies, Activity
- Header: editable title, status dropdown, priority badge, delete action
- Activity section collapsed by default, expandable

**Internal Due Date (TASK-05):**
- V1: `internalDueDate = dueDate - firm.settings.default_internal_deadline_buffer_days` (fallback 3 days)
- User can override with explicit `internalDueDate`
- Validation: `internalDueDate <= dueDate`
- Clearing `dueDate` clears `internalDueDate`

**Subtask Depth (TASK-06):**
- Max 1 level, enforced on create/update
- Subtasks do NOT appear as top-level in list, nested under parent in table view
- Not shown as separate Kanban cards
- Parent shows "Subtasks" section on detail page

**Task List Filters (TASK-07, PAGE-04):**
- Filter set: Assignee, Client, Engagement, Status (multi-select), Priority (multi-select), Due date range, Overdue toggle, Search
- Server-side filtering, URL-synced filters with `goto()` + `replaceState: true`
- View toggle: "Table" / "Board" stored in URL `?view=board`

**Task Creation:**
- Route: `/tasks/new` full-page form
- Engagement auto-sets client, initial checklist items section
- Also accessible from engagement/client detail pages with pre-filled context

**Notification Stubs (TASK-13):**
- Write to `notifications` table on events: TASK_ASSIGNED, TASK_REVIEW_REQUESTED, TASK_APPROVAL_REQUESTED, TASK_SENT_BACK, TASK_DEPENDENCY_UNBLOCKED, COMMENT_MENTION
- Fire-and-forget, never fail main operation

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

### Deferred Ideas (OUT OF SCOPE)
- Recurring task instance creation (fields writable but no automation)
- Compliance-linked tasks (`statutoryDeadlineId` ignored)
- Task custom fields (JSONB column exists, no UI)
- Bulk task operations
- Task time tracking (`estimatedHours` writable, no time log)
- Real-time updates on Kanban (no WebSocket/SSE)
- Advanced search (simple title `contains` only)
- Task export (CSV/PDF)
- Saved filters / views
- Attachment/document linking
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TASK-01 | Create task (standalone or engagement-bound) with title, description, priority, assignee, reviewer, due date, tags | Task Prisma model fully defined (24+ fields). CreateTaskDto pattern from client/engagement DTOs. FirmScopedService provides firm context. |
| TASK-02 | Status transitions enforce allowed-transitions matrix; invalid returns 400 with allowed_transitions[] | `TASK_STATUS_TRANSITIONS` constant already in shared package. `EngagementService.changeEngagementStatus()` is the exact pattern to replicate. |
| TASK-03 | DONE blocked by incomplete required checklist items | TaskChecklist model has `isRequired` + `isCompleted` fields. ConflictException pattern from engagement COMPLETED gate. |
| TASK-04 | completed_at and cancelled_at auto-set on terminal transitions | Task model has `completedAt` and `cancelledAt` fields. Same timestamp pattern as engagement `completedAt`. |
| TASK-05 | internal_due_date auto-computed from buffer chain | Firm model has `settings` JSONB field. `FirmSettings` type defines `default_internal_deadline_buffer_days`. Computation: `dueDate - bufferDays`. |
| TASK-06 | Subtask depth limited to 1 level | Task model has `parentTaskId` + self-referential `SubTasks` relation. Enforcement on create/update via parent lookup. |
| TASK-07 | List tasks with filters (assignee, client, engagement, status, priority, due date range, overdue, search) | `ListClientsQueryDto` / `ListEngagementsQueryDto` patterns for pagination DTOs. Prisma `where` builder pattern from `ClientService.listClients()`. |
| TASK-08 | Checklist CRUD with toggle, max 30, DONE-blocking | `TaskChecklist` model with 11 fields. `LIMITS.MAX_CHECKLIST_ITEMS_PER_TASK` (30) in shared. Sub-resource CRUD pattern from `ClientService.addGstNumber()`. |
| TASK-09 | Task dependencies with cycle detection | `TaskDependency` model with unique constraint `[taskId, dependsOnTaskId]`. BFS/DFS cycle detection before insert. |
| TASK-10 | Predecessor DONE emits DEPENDENCY_UNBLOCKED | Notification model exists with `NotificationType.TASK_DEPENDENCY_UNBLOCKED`. Fire-and-forget write to `notifications` table. |
| TASK-11 | Comments with @mentions (max 10) and threaded replies (depth 1) | `TaskComment` model with `mentions` UUID array, `parentCommentId` self-referential. `LIMITS.MAX_MENTIONS_PER_COMMENT` (10). |
| TASK-12 | Activity log records all mutations with actor, old/new, timestamp | `TaskActivityLog` model (8 fields, immutable). `TaskAction` enum (14 actions). Fire-and-forget logging pattern from ActionLogInterceptor. |
| TASK-13 | Notifications emitted on status change | Notification model + `NotificationType` enum covers all task events. `TaskNotificationHelper` writes records directly. |
| PAGE-04 | Task list with table (sortable/filterable) and Kanban (drag-to-change-status) | DataTable component (server-side pagination), FilterBar, StatusTransitionDropdown all available. `svelte-dnd-action` for Kanban DnD. |
| PAGE-05 | Task detail page (status controls, checklist, dependencies, comments, activity) | Two-column layout. All UI primitives available: InlineEdit, StatusBadge, StatusTransitionDropdown, UserPicker, ClientPicker, DatePicker, TagInput, Button, ConfirmDialog. |
</phase_requirements>

## Summary

Phase 5 is the core value proposition of CA Practice OS -- the task engine. This is a large but well-defined phase: the backend follows established patterns from client/engagement modules, and the frontend leverages a mature component library built in Phases 3-4.

**Backend:** The Task module structure mirrors `client/` and `engagement/`: controller + service + DTOs in `apps/api/src/task/`. The key complexity is in sub-resources (checklists, dependencies, comments, activity) and the status machine with its gates (checklist completion blocking DONE, dependency unblocking on DONE). All Prisma models, shared enums, status transition maps, and limits constants already exist -- this phase is about wiring them together. The `FirmScopedService` base class, `ParseUUIDPipe`, `class-validator` DTOs, and pagination response shape are all battle-tested from prior phases. Notification emission is fire-and-forget writes to the `notifications` table using existing `NotificationType` enum values.

**Frontend:** The task list page (PAGE-04) has two views sharing the same filter state: table (using DataTable + FilterBar + StatusTransitionDropdown) and Kanban (using `svelte-dnd-action` for drag-and-drop between status columns). The task detail page (PAGE-05) is a two-column scrollable layout with inline editing, checklist management, dependency lists, threaded comments with @mention chips, and a collapsible activity timeline. All UI primitives (InlineEdit, StatusBadge, UserPicker, ClientPicker, DatePicker, TagInput, Modal, ConfirmDialog, Select, GroupedSelect) are already built and exported from `$lib/components/ui`.

**Primary recommendation:** Build backend-first (task CRUD + status machine in plan 1, sub-resources in plan 2), then frontend (list + detail pages in plan 3). Use `svelte-dnd-action` (v0.9.69) for Kanban drag-and-drop -- it supports Svelte 5 runes mode and multi-container drag.

## Project Constraints (from CLAUDE.md)

- **Stack:** SvelteKit + TailwindCSS (frontend), NestJS (backend), PostgreSQL + Prisma (DB), Redis
- **Multi-tenancy:** `firm_id` on every table, enforced via Prisma `$extends` + FirmScopedService + AsyncLocalStorage
- **Auth:** JWT (15-min access) + HTTP-only cookie refresh, max 5 concurrent sessions
- **Monorepo:** Turborepo + pnpm workspaces (`apps/api`, `apps/web`, `packages/shared`)
- **GSD Workflow:** Use GSD entry points for all work
- **Soft deletes:** Everywhere (`deleted_at IS NULL` filter via Prisma extension)
- **UUIDs:** For all PKs
- **Error format:** `{ statusCode, message, error, request_id }`

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| NestJS | ^10.0.0 | Backend framework | Already used, all modules follow this pattern |
| Prisma | ^5.0.0 | ORM with multi-file schema | Already used, Task models already defined |
| SvelteKit | ^2.0.0 | Frontend framework with SSR | Already used, route-based data loading |
| Svelte | ^5.0.0 | UI framework with runes | Already used, $state/$derived/$props throughout |
| TailwindCSS | ^4.0.0 | Utility-first CSS | Already used, CSS @import approach |
| class-validator | (installed) | DTO validation | Already used in all DTOs |
| class-transformer | (installed) | Query param transformation | Already used in list query DTOs |
| lucide-svelte | ^1.0.1 | Icon library | Already used throughout UI |
| @ca-practice-os/shared | workspace:* | Shared enums, constants, types | Already used, has all task enums/transitions |

### New Dependency
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| svelte-dnd-action | 0.9.69 | Drag-and-drop for Kanban board | Kanban view column-to-column drag (PAGE-04) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| svelte-dnd-action | Native HTML5 DnD | Native is simpler but lacks: touch support, auto-scroll, animated transitions, multi-container management. svelte-dnd-action handles all these. |
| svelte-dnd-action | @neodrag/svelte (v2.3.3) | @neodrag is for making elements draggable (drag position), not for sortable lists / between-container drag. Wrong tool for Kanban. |
| svelte-dnd-action | sveltednd (Svelte 5 native) | Very new library, minimal adoption, not battle-tested. svelte-dnd-action is mature with Svelte 5 runes support since v0.9.59. |

**Installation:**
```bash
cd apps/web && pnpm add svelte-dnd-action
```

**Version verification:**
```
svelte-dnd-action: 0.9.69 (verified via npm view, current as of 2026-04-04)
```

## Architecture Patterns

### Backend: Task Module Structure
```
apps/api/src/task/
  task.module.ts         # NestJS module, registers services + controller
  task.controller.ts     # All endpoints including sub-resource routes
  task.service.ts        # Core CRUD + status machine + internal due date
  task-checklist.service.ts    # Checklist CRUD, toggle, max-30 enforcement
  task-dependency.service.ts   # Dependency CRUD, cycle detection
  task-comment.service.ts      # Comment CRUD, threading, mention extraction
  task-activity.service.ts     # Activity log writes (fire-and-forget)
  task-notification.helper.ts  # Notification record creation helper
  dto/
    create-task.dto.ts
    update-task.dto.ts
    list-tasks-query.dto.ts
    change-task-status.dto.ts
    create-checklist-item.dto.ts
    update-checklist-item.dto.ts
    create-dependency.dto.ts
    create-comment.dto.ts
    update-comment.dto.ts
    task-response.dto.ts        # Response shapes for task, checklist, dependency, comment, activity
```

### Frontend: Task Routes Structure
```
apps/web/src/routes/(app)/tasks/
  +page.svelte           # Task list with table/Kanban toggle
  +page.server.ts        # SSR data loading with filters
  new/
    +page.svelte         # Task creation form
    +page.server.ts      # Load users, clients, engagements for pickers
  [id]/
    +page.svelte         # Task detail (two-column layout)
    +page.server.ts      # Load task + checklists + deps + comments + activity
```

### Frontend: Task-Specific Components
```
apps/web/src/lib/components/task/
  TaskForm.svelte              # Create/edit form (similar to ClientForm)
  KanbanBoard.svelte           # Kanban view with svelte-dnd-action
  KanbanCard.svelte            # Individual task card in Kanban column
  ChecklistSection.svelte      # Inline checklist with add/toggle/delete/reorder
  DependencySection.svelte     # Blocked-by + Blocking lists with add picker
  CommentSection.svelte        # Threaded comments with mention chips
  ActivityTimeline.svelte      # Collapsible timeline with sentence formatting
  TaskMetadataSidebar.svelte   # Right column: status, priority, assignee, etc.
  SubtaskSection.svelte        # List of child tasks under parent
```

### Pattern 1: Status Machine (Backend)
**What:** Validate status transitions against allowed-transitions map, apply gates, emit side effects
**When to use:** Any status change on a task
**Example:**
```typescript
// Source: engagement.service.ts (existing pattern, adapted for tasks)
async changeTaskStatus(id: string, dto: ChangeTaskStatusDto): Promise<TaskResponseDto> {
  const task = await this.prisma.task.findUnique({
    where: { id },
    select: { id: true, status: true, assigneeId: true, reviewerId: true },
  });
  if (!task) throw new NotFoundException('Task not found');

  const currentStatus = task.status as TaskStatus;
  const targetStatus = dto.status;

  const allowedTransitions = TASK_STATUS_TRANSITIONS[currentStatus];
  if (!allowedTransitions?.includes(targetStatus)) {
    throw new BadRequestException({
      message: `Cannot transition from ${currentStatus} to ${targetStatus}`,
      allowed_transitions: allowedTransitions || [],
    });
  }

  // Gate: DONE blocked by incomplete required checklist items
  if (targetStatus === TaskStatus.DONE) {
    const incomplete = await this.prisma.taskChecklist.count({
      where: { taskId: id, isRequired: true, isCompleted: false },
    });
    if (incomplete > 0) {
      throw new ConflictException({
        message: `Cannot mark as done: ${incomplete} required checklist item${incomplete > 1 ? 's are' : ' is'} incomplete`,
        incomplete_required_items: incomplete,
      });
    }
  }

  const updateData: Record<string, any> = {
    status: targetStatus,
    updatedBy: this.getUserId(),
  };

  if (targetStatus === TaskStatus.DONE) updateData.completedAt = new Date();
  if (targetStatus === TaskStatus.CANCELLED) updateData.cancelledAt = new Date();

  const updated = await this.prisma.task.update({ where: { id }, data: updateData, select: TASK_SELECT });

  // Fire-and-forget: activity log + notifications
  this.activityService.log(id, TaskAction.STATUS_CHANGED, currentStatus, targetStatus).catch(() => {});
  this.notificationHelper.onStatusChange(task, currentStatus, targetStatus).catch(() => {});

  // TASK-10: Check dependency unblocking on DONE
  if (targetStatus === TaskStatus.DONE) {
    this.checkDependencyUnblocking(id).catch(() => {});
  }

  return this.toTaskResponse(updated);
}
```

### Pattern 2: Cycle Detection (Backend)
**What:** BFS traversal of dependency graph to detect cycles before inserting a new edge
**When to use:** Adding a task dependency
**Example:**
```typescript
// When adding: taskA depends on taskB
// Walk from taskB through all its dependencies. If we reach taskA, it's a cycle.
private async hasCycle(taskId: string, dependsOnTaskId: string): Promise<boolean> {
  const visited = new Set<string>();
  const queue = [dependsOnTaskId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === taskId) return true; // Cycle detected
    if (visited.has(current)) continue;
    visited.add(current);

    const deps = await this.prisma.taskDependency.findMany({
      where: { taskId: current },
      select: { dependsOnTaskId: true },
    });
    for (const dep of deps) {
      queue.push(dep.dependsOnTaskId);
    }
  }
  return false;
}
```

### Pattern 3: Kanban Drag-and-Drop (Frontend)
**What:** Multi-container sortable with svelte-dnd-action, status transition on finalize
**When to use:** Kanban board view
**Example:**
```svelte
<!-- Source: svelte-dnd-action docs + Svelte 5 runes -->
<script lang="ts">
  import { dndzone } from 'svelte-dnd-action';
  import { TASK_STATUS_TRANSITIONS } from '@ca-practice-os/shared';

  let columns = $state(/* Map<status, Task[]> */);

  function handleConsider(status: string, e: CustomEvent) {
    columns[status] = e.detail.items;
  }

  function handleFinalize(status: string, e: CustomEvent) {
    const items = e.detail.items;
    const movedItem = items.find((item: any) => item.id === e.detail.info?.id);
    if (movedItem && movedItem._originalStatus !== status) {
      // Validate transition
      const allowed = TASK_STATUS_TRANSITIONS[movedItem._originalStatus];
      if (!allowed?.includes(status)) {
        // Revert: re-fetch or restore from snapshot
        addToast(`Cannot move from ${movedItem._originalStatus} to ${status}`, 'error');
        return;
      }
      // Call API to change status
      changeTaskStatus(movedItem.id, status);
    }
    columns[status] = items;
  }
</script>

{#each statusColumns as status}
  <div
    use:dndzone={{ items: columns[status], type: 'task' }}
    onconsider={(e) => handleConsider(status, e)}
    onfinalize={(e) => handleFinalize(status, e)}
  >
    {#each columns[status] as task (task.id)}
      <KanbanCard {task} />
    {/each}
  </div>
{/each}
```

### Pattern 4: Sub-Resource CRUD (Backend)
**What:** Nested endpoints on parent controller with parent existence verification
**When to use:** Checklists, dependencies, comments under a task
**Example:**
```typescript
// Source: client.controller.ts GST number pattern
@Post(':taskId/checklist')
@HttpCode(HttpStatus.CREATED)
async addChecklistItem(
  @Param('taskId', ParseUUIDPipe) taskId: string,
  @Body() dto: CreateChecklistItemDto,
): Promise<ChecklistItemResponseDto> {
  return this.checklistService.addItem(taskId, dto);
}

@Patch(':taskId/checklist/:id')
async updateChecklistItem(
  @Param('taskId', ParseUUIDPipe) taskId: string,
  @Param('id', ParseUUIDPipe) id: string,
  @Body() dto: UpdateChecklistItemDto,
): Promise<ChecklistItemResponseDto> {
  return this.checklistService.updateItem(taskId, id, dto);
}
```

### Pattern 5: URL-Synced Filters (Frontend)
**What:** Filter state stored in URL search params for bookmarkability
**When to use:** Task list page filters
**Example:**
```typescript
// Source: clients/+page.svelte (existing pattern)
function updateFilters(key: string, value: string) {
  const url = new URL($page.url);
  if (value) {
    url.searchParams.set(key, value);
  } else {
    url.searchParams.delete(key);
  }
  url.searchParams.set('page', '1');
  goto(url.toString(), { replaceState: true, noScroll: true });
}
```

### Anti-Patterns to Avoid
- **Don't use `include` for list queries:** Use `select` with explicit fields + `_count` aggregations. Include fetches all fields and nested relations, bloating response size and slowing queries.
- **Don't await activity/notification writes:** These are fire-and-forget. Awaiting them slows the main request and a failure shouldn't block the user operation.
- **Don't build separate modules for sub-resources:** Checklists, deps, comments, activity are all part of the task domain. Separate NestJS modules would create unnecessary complexity and circular dependency issues. Use separate service classes within the same module.
- **Don't use `on:consider`/`on:finalize` syntax:** Svelte 5 uses `onconsider`/`onfinalize` (no colon). Using the old syntax causes a warning and may break in strict runes mode.
- **Don't dynamically construct Tailwind classes:** TailwindCSS v4 purges dynamically interpolated classes. Always use complete class strings in Record<string, string> lookup objects (existing pattern from StatusBadge).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop between Kanban columns | Custom HTML5 DnD with drag events | `svelte-dnd-action` | Touch support, auto-scroll, animation, multi-container management, accessibility built-in |
| Status transition validation | Custom if/else chains | `TASK_STATUS_TRANSITIONS` map + `.includes()` check | Single source of truth shared between frontend/backend, easily extensible |
| Checklist max enforcement | Manual count checks scattered around | `LIMITS.MAX_CHECKLIST_ITEMS_PER_TASK` from shared package | Consistent limit across frontend (disable input) and backend (validate on create) |
| Mention limit enforcement | Per-endpoint validation | `LIMITS.MAX_MENTIONS_PER_COMMENT` from shared package | Same as above |
| Pagination response shape | Custom per-endpoint | Standard `{ data, meta: { total, page, limit, totalPages } }` | Consistent with all existing list endpoints, DataTable component expects this shape |
| UUID validation on route params | Manual regex | `ParseUUIDPipe` from NestJS | Automatic 400 with clear error, zero boilerplate |

**Key insight:** This phase is almost entirely "wire together existing patterns." The Prisma models, shared enums, transition maps, limits constants, UI components, and architectural patterns all exist. The planner should structure tasks around assembling these pieces, not inventing new patterns.

## Common Pitfalls

### Pitfall 1: svelte-dnd-action Event Syntax in Svelte 5
**What goes wrong:** Using `on:consider` / `on:finalize` (Svelte 3/4 syntax) instead of `onconsider` / `onfinalize` (Svelte 5 syntax)
**Why it happens:** svelte-dnd-action README still shows Svelte 3 syntax. Most tutorials/examples use old syntax.
**How to avoid:** Always use `onconsider` and `onfinalize` (no colon). Declare items with `$state()`. Both handlers receive `CustomEvent` -- access items via `e.detail.items`.
**Warning signs:** Console warning about deprecated event handlers, or events not firing in runes mode.

### Pitfall 2: Optimistic Kanban Drag Reversal
**What goes wrong:** User drags a task to an invalid status column, the API returns 400, but the card is already visually in the new column.
**Why it happens:** svelte-dnd-action updates the DOM on drop (finalize), before the API call completes.
**How to avoid:** Save a snapshot of columns state before finalize. On API error, restore the snapshot and show toast. Alternatively, validate transitions client-side first using `TASK_STATUS_TRANSITIONS` before even allowing the drop (optimistic but with client-side pre-validation).
**Warning signs:** Cards appearing in wrong columns after failed API calls.

### Pitfall 3: N+1 Queries on Task List
**What goes wrong:** Loading checklist progress and dependency blocked status individually for each task in a list.
**Why it happens:** Naive implementation fetches each task's checklists and dependencies separately.
**How to avoid:** Use Prisma `_count` aggregation in the list query for checklist progress. For `is_blocked`, use a subquery or join: include `dependsOn` with `select: { dependsOnTask: { select: { status: true } } }` and compute client-side, OR use a raw query with EXISTS for the blocked check. The engagement module's `getTaskDoneCounts()` batch pattern is the model to follow.
**Warning signs:** Slow task list loading, increasing latency with more tasks.

### Pitfall 4: Cycle Detection Missing Firm Scope
**What goes wrong:** Cycle detection query walks dependencies across firms if using unscopedPrisma.
**Why it happens:** Developer uses raw prisma instead of firm-scoped prisma for the traversal.
**How to avoid:** Always use `this.prisma` (firm-scoped) for cycle detection queries. The firm scope is critical -- tasks from other firms cannot be dependencies anyway, but the query should naturally filter to the current firm.
**Warning signs:** Dependencies appearing to reference non-existent tasks.

### Pitfall 5: Activity Log Blocking Main Request
**What goes wrong:** Activity log write failure causes the main mutation (e.g., status change) to fail.
**Why it happens:** Awaiting the activity log write and not catching errors.
**How to avoid:** Call `this.activityService.log(...)` WITHOUT await, and chain `.catch((err) => this.logger.error('Activity log failed', err))`. Same pattern as ActionLogInterceptor's fire-and-forget approach.
**Warning signs:** Intermittent 500 errors on task mutations that correspond to DB write failures on the activity log table.

### Pitfall 6: Internal Due Date Not Cleared When Due Date Is Removed
**What goes wrong:** Task has `dueDate: null` but `internalDueDate` still has the old computed value.
**Why it happens:** Update logic only computes `internalDueDate` when `dueDate` is set, but doesn't clear it when `dueDate` is removed.
**How to avoid:** In the update method, if `dto.dueDate === null`, also set `internalDueDate = null`. The clearing logic must be explicit.
**Warning signs:** Tasks showing an internal deadline with no external deadline.

### Pitfall 7: Comment Threading Depth Enforcement
**What goes wrong:** User creates a reply to a reply, resulting in 2+ levels of nesting.
**Why it happens:** Backend doesn't validate that `parentCommentId` refers to a top-level comment (one without its own parent).
**How to avoid:** When `parentCommentId` is provided, look up the parent comment and verify `parentComment.parentCommentId === null`. If the parent itself has a parent, reject with BadRequestException.
**Warning signs:** Deeply nested comment threads in the UI that break the indentation layout.

## Code Examples

### Verified: Engagement Status Change (Template for Task Status)
```typescript
// Source: apps/api/src/engagement/engagement.service.ts (lines 455-536)
async changeEngagementStatus(id: string, dto: ChangeEngagementStatusDto): Promise<EngagementResponseDto> {
  const engagement = await this.prisma.engagement.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!engagement) throw new NotFoundException('Engagement not found');

  const currentStatus = engagement.status as EngagementStatus;
  const targetStatus = dto.status;
  const allowedTransitions = ENGAGEMENT_STATUS_TRANSITIONS[currentStatus];
  if (!allowedTransitions || !allowedTransitions.includes(targetStatus)) {
    throw new BadRequestException({
      message: `Cannot transition from ${currentStatus} to ${targetStatus}`,
      allowed_transitions: allowedTransitions || [],
    });
  }
  // ... gates and side effects
}
```

### Verified: Sub-Resource Pattern (GST Numbers on Client)
```typescript
// Source: apps/api/src/client/client.controller.ts (lines 68-95)
@Post(':id/gst-numbers')
@HttpCode(HttpStatus.CREATED)
async addGstNumber(
  @Param('id', ParseUUIDPipe) clientId: string,
  @Body() dto: CreateGstNumberDto,
): Promise<GstNumberResponseDto> {
  return this.clientService.addGstNumber(clientId, dto);
}
```

### Verified: Pagination Query Pattern
```typescript
// Source: apps/api/src/client/client.service.ts (lines 143-209)
const skip = (page - 1) * limit;
const orderBy = { [sortBy]: sortOrder };
const [data, total] = await Promise.all([
  this.prisma.client.findMany({ where, skip, take: limit, orderBy, select: {...} }),
  this.prisma.client.count({ where }),
]);
return { data: data.map(transform), meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
```

### Verified: Frontend SSR Data Loading with Filters
```typescript
// Source: apps/web/src/routes/(app)/clients/+page.server.ts
export const load: PageServerLoad = async ({ url, fetch }) => {
  const page = url.searchParams.get('page') ?? '1';
  const search = url.searchParams.get('search') ?? '';
  // ... build query params from URL
  const res = await fetch(`/api/clients?${params.toString()}`);
  // ... error handling
  return { clients: result.data ?? [], meta: result.meta, filters: {...} };
};
```

### Verified: StatusTransitionDropdown Usage
```svelte
<!-- Source: apps/web/src/lib/components/ui/StatusTransitionDropdown.svelte -->
<StatusTransitionDropdown
  currentStatus={task.status}
  transitions={TASK_STATUS_TRANSITIONS}
  onTransition={(newStatus) => changeStatus(task.id, newStatus)}
  entityType="task"
/>
```

### Verified: svelte-dnd-action Svelte 5 Usage Pattern
```svelte
<!-- Source: svelte-dnd-action release notes v0.9.59+ (Svelte 5 runes) -->
<script lang="ts">
  import { dndzone } from 'svelte-dnd-action';

  let items = $state([/* items with id property */]);

  function handleConsider(e: CustomEvent) {
    items = e.detail.items;
  }

  function handleFinalize(e: CustomEvent) {
    items = e.detail.items;
  }
</script>

<div use:dndzone={{ items }} onconsider={handleConsider} onfinalize={handleFinalize}>
  {#each items as item (item.id)}
    <div>{item.name}</div>
  {/each}
</div>
```

### Activity Log Sentence Templates
```typescript
// Recommended mapping for TaskAction -> human-readable sentence
const ACTIVITY_TEMPLATES: Record<string, (actor: string, old: any, new_: any) => string> = {
  CREATED: (actor) => `${actor} created this task`,
  STATUS_CHANGED: (actor, old, new_) => `${actor} changed status from ${formatStatus(old)} to ${formatStatus(new_)}`,
  ASSIGNEE_CHANGED: (actor, old, new_) => new_ ? `${actor} assigned to ${new_}` : `${actor} unassigned ${old}`,
  REVIEWER_CHANGED: (actor, old, new_) => new_ ? `${actor} set reviewer to ${new_}` : `${actor} removed reviewer`,
  DUE_DATE_CHANGED: (actor, old, new_) => `${actor} changed due date${new_ ? ` to ${formatDate(new_)}` : ''}`,
  PRIORITY_CHANGED: (actor, old, new_) => `${actor} changed priority from ${old} to ${new_}`,
  CHECKLIST_ITEM_COMPLETED: (actor, _, new_) => `${actor} completed "${new_}"`,
  CHECKLIST_ITEM_UNCOMPLETED: (actor, _, new_) => `${actor} uncompleted "${new_}"`,
  COMMENT_ADDED: (actor) => `${actor} added a comment`,
  DEPENDENCY_ADDED: (actor, _, new_) => `${actor} added dependency on "${new_}"`,
  DEPENDENCY_REMOVED: (actor, old) => `${actor} removed dependency on "${old}"`,
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Svelte 3/4 `on:event` | Svelte 5 `onevent` | Svelte 5 (2024) | svelte-dnd-action uses `onconsider`/`onfinalize` in Svelte 5 |
| Svelte stores (`$store`) | Svelte 5 runes (`$state`, `$derived`) | Svelte 5 (2024) | All state management in components uses runes |
| `let props = export let x` | `let { x } = $props()` | Svelte 5 (2024) | All component props declared with `$props()` |
| TailwindCSS config file | TailwindCSS v4 CSS @import | TailwindCSS 4 (2025) | No config file, classes in CSS imports. Must use complete class strings. |

**Deprecated/outdated:**
- `on:consider`/`on:finalize` event syntax: Use `onconsider`/`onfinalize` in Svelte 5
- `export let` for props: Use `$props()` destructuring
- `$:` reactive declarations: Use `$derived()` or `$effect()`

## Open Questions

1. **Kanban card layout details**
   - What we know: Card shows title, priority badge, assignee avatar, due date, checklist progress
   - What's unclear: Exact card dimensions, spacing, whether to show client name on card, overdue highlight styling
   - Recommendation: Implement minimal card first (title + priority + assignee initials + due date + checklist bar), iterate based on visual feel

2. **Engagement picker on task list filters**
   - What we know: Filter includes engagement dropdown, filtered by selected client
   - What's unclear: Whether to lazy-load engagements on client selection or pre-load all
   - Recommendation: Lazy-load engagements when client is selected (avoid loading thousands of engagements upfront). Use a new `EngagementPicker` component or a filtered Select.

3. **Task list computed fields performance**
   - What we know: Need `is_blocked` and `checklist_progress` on each task in list
   - What's unclear: Whether Prisma can compute these efficiently in a single query
   - Recommendation: Use `_count` for checklist progress. For `is_blocked`, include minimal `dependsOn` relation with `dependsOnTask.status` and compute client-side. If too slow, add a denormalized `isBlocked` boolean field updated on dependency/status changes.

## Environment Availability

> Phase 5 is purely code/config changes using the existing development environment. No new external dependencies beyond `svelte-dnd-action` (npm package).

Step 2.6: SKIPPED (no new external system dependencies -- all infrastructure from Phase 1 is available).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (via NestJS) |
| Config file | `apps/api/package.json` (test script: `jest`) |
| Quick run command | `cd apps/api && pnpm test -- --testPathPattern=task` |
| Full suite command | `cd apps/api && pnpm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TASK-01 | Task CRUD (create, read, update, delete) | unit | `cd apps/api && pnpm test -- --testPathPattern=task.service` | No -- Wave 0 |
| TASK-02 | Status transition validation | unit | `cd apps/api && pnpm test -- --testPathPattern=task.service` | No -- Wave 0 |
| TASK-03 | DONE blocked by incomplete checklist | unit | `cd apps/api && pnpm test -- --testPathPattern=task.service` | No -- Wave 0 |
| TASK-04 | completed_at/cancelled_at auto-set | unit | `cd apps/api && pnpm test -- --testPathPattern=task.service` | No -- Wave 0 |
| TASK-05 | Internal due date computation | unit | `cd apps/api && pnpm test -- --testPathPattern=task.service` | No -- Wave 0 |
| TASK-06 | Subtask depth enforcement | unit | `cd apps/api && pnpm test -- --testPathPattern=task.service` | No -- Wave 0 |
| TASK-07 | List with filters | unit | `cd apps/api && pnpm test -- --testPathPattern=task.service` | No -- Wave 0 |
| TASK-08 | Checklist CRUD + max 30 | unit | `cd apps/api && pnpm test -- --testPathPattern=task-checklist` | No -- Wave 0 |
| TASK-09 | Dependency with cycle detection | unit | `cd apps/api && pnpm test -- --testPathPattern=task-dependency` | No -- Wave 0 |
| TASK-10 | Dependency unblocked emission | unit | `cd apps/api && pnpm test -- --testPathPattern=task-dependency` | No -- Wave 0 |
| TASK-11 | Comments with mentions + threading | unit | `cd apps/api && pnpm test -- --testPathPattern=task-comment` | No -- Wave 0 |
| TASK-12 | Activity log recording | unit | `cd apps/api && pnpm test -- --testPathPattern=task-activity` | No -- Wave 0 |
| TASK-13 | Notification stub emission | unit | `cd apps/api && pnpm test -- --testPathPattern=task-notification` | No -- Wave 0 |
| PAGE-04 | Task list table + Kanban views | manual-only | Visual verification (Svelte components, no backend test) | N/A |
| PAGE-05 | Task detail page sections | manual-only | Visual verification (Svelte components, no backend test) | N/A |

### Sampling Rate
- **Per task commit:** `cd apps/api && pnpm test -- --testPathPattern=task`
- **Per wave merge:** `cd apps/api && pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/api/src/task/task.service.spec.ts` -- covers TASK-01 through TASK-07
- [ ] `apps/api/src/task/task-checklist.service.spec.ts` -- covers TASK-08
- [ ] `apps/api/src/task/task-dependency.service.spec.ts` -- covers TASK-09, TASK-10
- [ ] `apps/api/src/task/task-comment.service.spec.ts` -- covers TASK-11
- [ ] `apps/api/src/task/task-activity.service.spec.ts` -- covers TASK-12
- [ ] `apps/api/src/task/task-notification.helper.spec.ts` -- covers TASK-13
- [ ] Test infrastructure: Jest is already configured via NestJS, `@nestjs/testing` is installed

## Sources

### Primary (HIGH confidence)
- Codebase: `apps/api/src/engagement/engagement.service.ts` -- status transition pattern, template instantiation
- Codebase: `apps/api/src/client/client.service.ts` -- CRUD pattern, sub-resource pattern, pagination
- Codebase: `apps/api/src/client/client.controller.ts` -- controller + sub-resource routing
- Codebase: `apps/api/prisma/schema/task.prisma` -- Task, TaskChecklist, TaskDependency, TaskComment, TaskActivityLog models
- Codebase: `packages/shared/src/constants/task-status-transitions.ts` -- TASK_STATUS_TRANSITIONS map
- Codebase: `packages/shared/src/enums/` -- TaskStatus, TaskPriority, TaskAction, NotificationType
- Codebase: `packages/shared/src/constants/limits.ts` -- MAX_CHECKLIST_ITEMS_PER_TASK (30), MAX_MENTIONS_PER_COMMENT (10), etc.
- Codebase: `apps/web/src/lib/components/ui/` -- 21 components available for reuse
- Codebase: `apps/web/src/routes/(app)/clients/` -- route patterns for list, detail, new, edit

### Secondary (MEDIUM confidence)
- [svelte-dnd-action GitHub](https://github.com/isaacHagoel/svelte-dnd-action) -- Svelte 5 support confirmed via release notes (v0.9.44 peer dep, v0.9.59 $state fix, v0.9.66 runes mode fix)
- [svelte-dnd-action npm](https://www.npmjs.com/package/svelte-dnd-action) -- Version 0.9.69 verified via `npm view`

### Tertiary (LOW confidence)
- None -- all findings verified against codebase or npm registry

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- everything except svelte-dnd-action already in the project, svelte-dnd-action verified on npm
- Architecture: HIGH -- patterns directly cloned from existing client/engagement modules in same codebase
- Pitfalls: HIGH -- derived from real patterns observed in the codebase and verified library documentation

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (stable patterns, no fast-moving dependencies)
