---
phase: 05-task-engine
plan: 02
subsystem: api
tags: [nestjs, prisma, task-engine, checklist, dependencies, comments, bfs-cycle-detection, threading, mentions]

# Dependency graph
requires:
  - phase: 05-task-engine/05-01
    provides: TaskService, TaskActivityService, TaskNotificationHelper, TaskModule scaffold, TaskController with 7 endpoints
provides:
  - TaskChecklistService with CRUD, max-30 enforcement, toggle tracking with activity log
  - TaskDependencyService with BFS cycle detection, duplicate/self-dep checks, activity logging
  - TaskCommentService with depth-1 threading, @mention notifications, ownership enforcement
  - 11 sub-resource REST endpoints nested under /api/tasks/:taskId/
  - DTOs for checklist, dependency, and comment operations
affects: [05-task-engine/05-03, 06-frontend-tasks]

# Tech tracking
tech-stack:
  added: []
  patterns: [sub-resource-services-with-parent-validation, bfs-cycle-detection, depth-1-threading, batch-author-resolution]

key-files:
  created:
    - apps/api/src/task/task-checklist.service.ts
    - apps/api/src/task/task-dependency.service.ts
    - apps/api/src/task/task-comment.service.ts
    - apps/api/src/task/dto/create-checklist-item.dto.ts
    - apps/api/src/task/dto/update-checklist-item.dto.ts
    - apps/api/src/task/dto/create-dependency.dto.ts
    - apps/api/src/task/dto/create-comment.dto.ts
    - apps/api/src/task/dto/update-comment.dto.ts
  modified:
    - apps/api/src/task/task.controller.ts
    - apps/api/src/task/task.module.ts

key-decisions:
  - "Sub-resource services extend FirmScopedService independently, injecting TaskActivityService and TaskNotificationHelper for side effects"
  - "BFS cycle detection walks dependsOn edges from predecessor — firm-scoped queries ensure cross-firm isolation"
  - "Comment author resolution uses batch unscopedPrisma.user.findMany to avoid N+1 on list queries"
  - "Threading enforcement checks parentComment.parentCommentId === null — simple guard prevents deep nesting"

patterns-established:
  - "Sub-resource CRUD pattern: verify parent task exists, then operate on child resource with parent ID scoping"
  - "BFS cycle detection: queue-based traversal of dependency graph before insert, returns boolean"
  - "Ownership enforcement: compare authorId === getUserId() before update/delete, throw ForbiddenException"
  - "Batch author resolution: collect unique authorIds from paginated results, single findMany, map back to responses"

requirements-completed: [TASK-08, TASK-09, TASK-10, TASK-11, TASK-12]

# Metrics
duration: 5min
completed: 2026-04-04
---

# Phase 5 Plan 2: Task Sub-Resources Summary

**Checklist CRUD with max-30 enforcement, dependency management with BFS cycle detection, and threaded comments with @mention notifications — 11 new sub-resource endpoints on /api/tasks/:taskId/**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-04T21:28:57Z
- **Completed:** 2026-04-04T21:33:59Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- TaskChecklistService: add (max 30 enforced), update/toggle (CHECKLIST_ITEM_COMPLETED/UNCOMPLETED activity log), soft-delete, list (ordered), reorder (transaction)
- TaskDependencyService: add with self-dep check, duplicate check, BFS cycle detection, remove with activity log, getDependencies (blockedBy + blocking lists)
- TaskCommentService: add with depth-1 threading enforcement, @mention notifications (max 10), update/delete with ownership check, paginated list with threaded replies and batch author resolution
- 11 sub-resource endpoints wired into TaskController with ParseUUIDPipe on all params
- TaskModule registers 6 providers total (3 new + 3 from 05-01)

## Task Commits

Each task was committed atomically:

1. **Task 1: Checklist and Dependency services with DTOs** - `b28afd7` (feat)
2. **Task 2: Comment service, controller sub-resource routes, and module wiring** - `8959814` (feat)

## Files Created/Modified
- `apps/api/src/task/dto/create-checklist-item.dto.ts` - DTO: label (MaxLength 300), isRequired (default true)
- `apps/api/src/task/dto/update-checklist-item.dto.ts` - DTO: label, isCompleted, isRequired, displayOrder (all optional)
- `apps/api/src/task/dto/create-dependency.dto.ts` - DTO: dependsOnTaskId (UUID, required)
- `apps/api/src/task/dto/create-comment.dto.ts` - DTO: body (MaxLength 5000), mentions (UUID[], max 10), parentCommentId (optional)
- `apps/api/src/task/dto/update-comment.dto.ts` - DTO: body, mentions (both optional)
- `apps/api/src/task/task-checklist.service.ts` - Checklist CRUD with max-30, toggle tracking, reorder
- `apps/api/src/task/task-dependency.service.ts` - Dependency add/remove with BFS cycle detection
- `apps/api/src/task/task-comment.service.ts` - Comment CRUD with threading, mentions, ownership, paginated list
- `apps/api/src/task/task.controller.ts` - Updated: 11 new sub-resource endpoints (4 checklist, 3 dependency, 4 comment)
- `apps/api/src/task/task.module.ts` - Updated: 6 providers registered

## Decisions Made
- Sub-resource services extend FirmScopedService independently rather than being injected into TaskService — cleaner separation, controller routes to each service directly
- BFS cycle detection uses firm-scoped queries ensuring cross-firm isolation in multi-tenant context
- Comment author resolution batches unique authorIds from paginated results into a single unscopedPrisma.user.findMany to avoid N+1
- Threading depth-1 enforcement is a simple guard: if parentComment itself has a parentCommentId, reject with 400

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - TypeScript compiled and NestJS built clean on first attempt for both tasks.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All task sub-resource endpoints ready for frontend integration in 05-03 and Phase 6
- TaskChecklistService toggle tracking integrates with DONE gate in TaskService.changeTaskStatus()
- Dependency BFS cycle detection prevents circular dependencies at the API level
- Comment mention notifications write to notifications table, ready for Phase 6 notification UI

## Self-Check: PASSED

All 10 files verified present. Both task commits (b28afd7, 8959814) confirmed in git log. TypeScript compiles with zero errors. NestJS builds successfully.
