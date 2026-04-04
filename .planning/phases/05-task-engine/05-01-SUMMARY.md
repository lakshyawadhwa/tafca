---
phase: 05-task-engine
plan: 01
subsystem: api
tags: [nestjs, prisma, task-engine, status-machine, crud, pagination, notifications, activity-log]

# Dependency graph
requires:
  - phase: 01-scaffolding
    provides: FirmScopedService base class, Prisma schema with Task model, shared enums/constants
  - phase: 02-auth
    provides: JwtAuthGuard, RolesGuard, FirmScopeGuard (all global), AsyncLocalStorage context
  - phase: 04-client-engagement
    provides: Client and Engagement modules for relation validation, established CRUD/status-machine patterns
provides:
  - TaskModule with full CRUD (create, get, list, update, delete)
  - Status machine with transition validation and DONE/CANCELLED gates
  - Internal due date auto-computation from firm buffer settings
  - Subtask depth enforcement (1 level max)
  - Task list with 10 filters and pagination
  - TaskActivityService for fire-and-forget mutation logging
  - TaskNotificationHelper for status/assignment notification records
  - 7 REST endpoints registered in app.module.ts
affects: [05-task-engine/05-02, 05-task-engine/05-03, 06-frontend-tasks]

# Tech tracking
tech-stack:
  added: []
  patterns: [status-machine-with-gates, fire-and-forget-activity-logging, computed-response-fields, internal-due-date-auto-computation]

key-files:
  created:
    - apps/api/src/task/task.module.ts
    - apps/api/src/task/task.controller.ts
    - apps/api/src/task/task.service.ts
    - apps/api/src/task/task-activity.service.ts
    - apps/api/src/task/task-notification.helper.ts
    - apps/api/src/task/dto/create-task.dto.ts
    - apps/api/src/task/dto/update-task.dto.ts
    - apps/api/src/task/dto/list-tasks-query.dto.ts
    - apps/api/src/task/dto/change-task-status.dto.ts
    - apps/api/src/task/dto/task-response.dto.ts
  modified:
    - apps/api/src/app.module.ts

key-decisions:
  - "Status machine clones engagement pattern: TASK_STATUS_TRANSITIONS lookup + BadRequestException with allowed_transitions array"
  - "DONE gate uses ConflictException (409) with incomplete_required_items count for clear frontend error handling"
  - "Internal due date auto-computed from firm.settings.default_internal_deadline_buffer_days (default 3), overridable per task"
  - "Computed fields (isBlocked, checklistProgress, subtaskCount) included in both detail and list responses to avoid frontend N+1"
  - "Activity and notification writes are fire-and-forget with .catch(() => {}) to never block the main operation"

patterns-established:
  - "Status machine with gates pattern: validate transition -> check gates -> auto-set timestamps -> update -> emit side effects"
  - "Fire-and-forget side effect pattern: service.method().catch(() => {}) for activity logging and notifications"
  - "Computed response fields: isBlocked and checklistProgress derived from included relations in toTaskResponse()"
  - "Internal due date chain: firm buffer setting -> auto-compute unless user explicitly overrides"

requirements-completed: [TASK-01, TASK-02, TASK-03, TASK-04, TASK-05, TASK-06, TASK-07, TASK-12, TASK-13]

# Metrics
duration: 4min
completed: 2026-04-04
---

# Phase 5 Plan 1: Task Engine Core Summary

**Task CRUD with enforced status machine (7 transitions), DONE checklist gate, internal due date auto-computation, 10-filter list endpoint, and fire-and-forget activity/notification logging**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-04T21:14:22Z
- **Completed:** 2026-04-04T21:18:30Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Full task CRUD with 7 REST endpoints (create, get, list, update, status change, delete, activity log)
- Status machine enforces TASK_STATUS_TRANSITIONS map with DONE blocked by incomplete required checklist items (409) and auto timestamps on terminal states
- Internal due date auto-computed from firm-level buffer setting (default 3 days), with user override support
- Subtask depth enforcement (max 1 level) on task creation
- Task list supports all 10 filters (search, assignee, client, engagement, status, priority, date range, overdue, parentTask) with pagination
- Fire-and-forget activity logging on every mutation (create, update, status change, field changes)
- Notification records written on status changes (review requested, approval requested, sent back) and assignment changes

## Task Commits

Each task was committed atomically:

1. **Task 1: DTOs, TaskActivityService, TaskNotificationHelper, and TaskModule scaffold** - `8d88404` (feat)
2. **Task 2: TaskService (CRUD, status machine, internal due date, subtask depth) and TaskController** - `1711350` (feat)

## Files Created/Modified
- `apps/api/src/task/dto/create-task.dto.ts` - CreateTaskDto with class-validator (title, description, engagement, client, parent, assignee, reviewer, priority, dueDate, tags, initialChecklistItems)
- `apps/api/src/task/dto/update-task.dto.ts` - UpdateTaskDto (subset of create fields, all optional)
- `apps/api/src/task/dto/list-tasks-query.dto.ts` - ListTasksQueryDto with 10 filter params + pagination + sort
- `apps/api/src/task/dto/change-task-status.dto.ts` - ChangeTaskStatusDto with TaskStatus enum validation
- `apps/api/src/task/dto/task-response.dto.ts` - TypeScript interfaces for TaskResponseDto, TaskListItemDto, TaskListResponseDto, ActivityEntryDto
- `apps/api/src/task/task-activity.service.ts` - Fire-and-forget activity log writes + paginated getActivity() with actor name resolution
- `apps/api/src/task/task-notification.helper.ts` - Notification record creation for status changes, assignee changes, dependency unblocking, comment mentions
- `apps/api/src/task/task.service.ts` - Core task service with createTask, getTask, listTasks, updateTask, changeTaskStatus, deleteTask, checkDependencyUnblocking, computeInternalDueDate
- `apps/api/src/task/task.controller.ts` - 7 REST endpoints: POST /, GET /, GET /:id, PATCH /:id, PATCH /:id/status, DELETE /:id, GET /:id/activity
- `apps/api/src/task/task.module.ts` - NestJS module registering TaskService, TaskActivityService, TaskNotificationHelper, TaskController
- `apps/api/src/app.module.ts` - Added TaskModule to imports

## Decisions Made
- Status machine clones the proven engagement pattern: lookup TASK_STATUS_TRANSITIONS, throw BadRequestException with allowed_transitions array on invalid transitions
- DONE gate returns 409 ConflictException with incomplete_required_items count so frontend can display clear error messaging
- Internal due date uses firm.settings JSONB field (default_internal_deadline_buffer_days, fallback 3) — clearing dueDate also clears internalDueDate
- Computed fields (isBlocked, checklistProgress, subtaskCount) included in both detail and list responses using Prisma includes + client-side computation to avoid N+1
- Activity and notification writes use fire-and-forget pattern (.catch(() => {})) to never block the main CRUD response
- TaskNotificationHelper resolves partner for PARTNER_APPROVAL notifications by checking engagement then client assignedPartnerId

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - TypeScript compiled and NestJS built clean on first attempt for both tasks.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Task module ready for 05-02 (checklist, dependency, comment sub-resources) to add nested endpoints
- TaskActivityService and TaskNotificationHelper are injectable and ready for sub-resource services to use
- All 7 endpoints functional and ready for frontend integration

## Self-Check: PASSED

All 11 files verified present. Both task commits (8d88404, 1711350) confirmed in git log. TypeScript compiles with zero errors. NestJS builds successfully.

---
*Phase: 05-task-engine*
*Completed: 2026-04-04*
