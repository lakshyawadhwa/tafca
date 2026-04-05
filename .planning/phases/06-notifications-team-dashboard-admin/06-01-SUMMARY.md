---
phase: 06-notifications-team-dashboard-admin
plan: 01
subsystem: api
tags: [nestjs, notifications, team, workload, leave, approval-queue, prisma]

# Dependency graph
requires:
  - phase: 05-task-engine
    provides: TaskNotificationHelper, Task model with status machine, Notification/LeaveRecord Prisma models
provides:
  - NotificationModule with 4 endpoints (list, mark-read, mark-all-read, unread-count)
  - TeamModule with 7 endpoints (workload, approval-queue, 5 leave endpoints)
  - WorkloadStatus shared type (UNDERUTILISED | BALANCED | OVERLOADED)
  - TaskNotificationHelper status fix (SENT + sentAt at creation)
affects: [06-02, 06-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Workload computation via parallel groupBy queries with load thresholds relative to firm average"
    - "Leave overlap validation using date range intersection query"
    - "Fire-and-forget leave notifications for affected tasks on approval"
    - "Batch-fetch user names pattern for models without User relation"

key-files:
  created:
    - apps/api/src/notification/notification.module.ts
    - apps/api/src/notification/notification.controller.ts
    - apps/api/src/notification/notification.service.ts
    - apps/api/src/notification/dto/list-notifications-query.dto.ts
    - apps/api/src/notification/dto/notification-response.dto.ts
    - apps/api/src/team/team.module.ts
    - apps/api/src/team/team.controller.ts
    - apps/api/src/team/team.service.ts
    - apps/api/src/team/leave.service.ts
    - apps/api/src/team/dto/workload-response.dto.ts
    - apps/api/src/team/dto/create-leave.dto.ts
    - apps/api/src/team/dto/list-leave-query.dto.ts
    - apps/api/src/team/dto/leave-response.dto.ts
    - apps/api/src/team/dto/approval-queue-query.dto.ts
    - apps/api/src/team/dto/approval-queue-response.dto.ts
    - packages/shared/src/types/workload-status.type.ts
  modified:
    - apps/api/src/task/task-notification.helper.ts
    - apps/api/src/app.module.ts
    - packages/shared/src/index.ts

key-decisions:
  - "TaskNotificationHelper sets status=SENT and sentAt=now() at creation -- eliminates PENDING->SENT transition complexity"
  - "Workload uses unscopedPrisma for groupBy queries with explicit firmId to avoid scoped client issues with aggregation"
  - "Leave overlap checks both PENDING and APPROVED records to prevent double-booking"
  - "Approval queue filters by reviewerId OR engagement.assignedPartnerId for comprehensive coverage"

patterns-established:
  - "Notification read pattern: recipient-scoped queries with unreadCount always returned in meta"
  - "Workload thresholds: < 0.5x avg = UNDERUTILISED, 0.5x-1.5x = BALANCED, > 1.5x = OVERLOADED"
  - "Leave cancellation: PENDING always cancellable, APPROVED only if future start date"

requirements-completed: [NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-04, TEAM-01, TEAM-02, TEAM-03, TEAM-04]

# Metrics
duration: 14min
completed: 2026-04-05
---

# Phase 6 Plan 1: Notification & Team Module Summary

**Notification read/mark-read API (4 endpoints) + Team workload, leave CRUD, and approval queue (7 endpoints) with TaskNotificationHelper SENT status fix**

## Performance

- **Duration:** 14 min
- **Started:** 2026-04-05T07:01:32Z
- **Completed:** 2026-04-05T07:15:32Z
- **Tasks:** 2
- **Files modified:** 19

## Accomplishments
- Fixed TaskNotificationHelper to set status=SENT and sentAt=now() at creation, eliminating the PENDING->SENT transition gap
- Built NotificationModule with paginated list (unreadCount in meta), mark-read, mark-all-read, and unread-count endpoints -- all recipient-scoped for security
- Built TeamModule with workload computation using 3 parallel groupBy queries, leave CRUD with date/overlap validation, and approval queue for PARTNER_APPROVAL tasks

## Task Commits

Each task was committed atomically:

1. **Task 1: Notification module + TaskNotificationHelper status fix** - `7487b3a` (feat)
2. **Task 2: Team module -- workload, leave management, and approval queue** - `dc334ea` (feat)

## Files Created/Modified
- `apps/api/src/notification/notification.service.ts` - Notification list, mark-read, mark-all-read, unread-count with FirmScopedService
- `apps/api/src/notification/notification.controller.ts` - 4 notification endpoints with route ordering for unread-count
- `apps/api/src/notification/notification.module.ts` - NestJS module registration
- `apps/api/src/notification/dto/list-notifications-query.dto.ts` - Query DTO with page, limit, unreadOnly
- `apps/api/src/notification/dto/notification-response.dto.ts` - NotificationDto + PaginatedNotificationResponseDto with unreadCount in meta
- `apps/api/src/team/team.service.ts` - Workload computation with parallel groupBy + approval queue for PARTNER_APPROVAL tasks
- `apps/api/src/team/leave.service.ts` - Leave CRUD with overlap validation, approve/reject/cancel with fire-and-forget notifications
- `apps/api/src/team/team.controller.ts` - 7 team endpoints (workload, approval-queue, 5 leave endpoints)
- `apps/api/src/team/team.module.ts` - NestJS module with TeamService + LeaveService
- `apps/api/src/team/dto/workload-response.dto.ts` - WorkloadUserDto with load status
- `apps/api/src/team/dto/create-leave.dto.ts` - CreateLeaveDto with class-validator rules
- `apps/api/src/team/dto/list-leave-query.dto.ts` - ListLeaveQueryDto with status/userId filters
- `apps/api/src/team/dto/leave-response.dto.ts` - LeaveDto with resolved user names
- `apps/api/src/team/dto/approval-queue-query.dto.ts` - ApprovalQueueQueryDto
- `apps/api/src/team/dto/approval-queue-response.dto.ts` - ApprovalQueueItemDto with client/assignee names
- `packages/shared/src/types/workload-status.type.ts` - WorkloadStatus union type (display-only, not DB enum)
- `apps/api/src/task/task-notification.helper.ts` - Fixed status=SENT + sentAt=now() at creation
- `apps/api/src/app.module.ts` - Registered NotificationModule and TeamModule
- `packages/shared/src/index.ts` - Added workload-status.type barrel export

## Decisions Made
- TaskNotificationHelper sets status=SENT and sentAt=now() at creation time -- all in-app notifications are immediately "sent" and the only transition needed is SENT->READ
- Workload uses unscopedPrisma for groupBy queries with explicit firmId because scoped client can have issues with aggregation operations
- Leave overlap validation checks against both PENDING and APPROVED records to prevent any form of double-booking
- Approval queue filters by reviewerId OR engagement.assignedPartnerId to ensure partners see all tasks needing their attention
- Explicitly pass firmId in LeaveRecord.create() data for Prisma TypeScript compatibility (no firm relation on the model)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added explicit firmId to LeaveRecord.create()**
- **Found during:** Task 2 (Leave service implementation)
- **Issue:** Prisma TypeScript types require firmId in unchecked create input because LeaveRecord has no `firm` relation
- **Fix:** Added `firmId: this.getFirmId()` to the create data object (consistent with ClientService pattern)
- **Files modified:** `apps/api/src/team/leave.service.ts`
- **Verification:** TypeScript compiles cleanly
- **Committed in:** dc334ea (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix necessary for TypeScript compilation. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Notification and Team backend APIs are ready for 06-03 frontend pages
- Dashboard aggregation endpoint (06-02) can call TeamService.getApprovalQueue() and NotificationService methods
- All 11 new endpoints are registered and TypeScript compiles cleanly

## Self-Check: PASSED

All 17 created files verified present. Both task commits (7487b3a, dc334ea) verified in git log. TypeScript compiles cleanly for both shared and api packages.

---
*Phase: 06-notifications-team-dashboard-admin*
*Completed: 2026-04-05*
