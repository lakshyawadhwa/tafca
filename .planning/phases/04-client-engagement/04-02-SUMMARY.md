---
phase: 04-client-engagement
plan: 02
subsystem: api
tags: [nestjs, prisma, engagement, engagement-type, status-transitions, template-instantiation, crud]

requires:
  - phase: 01-scaffolding
    provides: FirmScopedService, PrismaModule, shared enums and constants
  - phase: 02-auth
    provides: JWT auth guards, request context (firmId/userId via AsyncLocalStorage)
  - phase: 04-client-engagement
    plan: 01
    provides: ClientModule, ClientService, ENGAGEMENT_STATUS_TRANSITIONS, fixed shared enums
provides:
  - Engagement CRUD API at /api/engagements with auto-name generation and partner/manager inheritance
  - Engagement status transition API at /api/engagements/:id/status with validation and cascading
  - Template task instantiation via two-pass algorithm (create tasks, then link dependencies)
  - EngagementType read-only API at /api/engagement-types for dropdowns and template preview
  - EngagementService exported for cross-module dependency injection
affects: [04-03-frontend, 05-task-engine]

tech-stack:
  added: []
  patterns:
    - "EngagementType queries use unscopedPrisma because platform types have firmId: null"
    - "Two-pass template instantiation: Pass 1 creates tasks, Pass 2 links dependencies, wrapped in $transaction"
    - "Status transitions validated via ENGAGEMENT_STATUS_TRANSITIONS map from shared package"
    - "Task progress computed via groupBy query for batch efficiency on list views"
    - "Engagement name auto-generated as [Type] - [Client] - [Period] when not provided"

key-files:
  created:
    - apps/api/src/engagement-type/engagement-type.module.ts
    - apps/api/src/engagement-type/engagement-type.controller.ts
    - apps/api/src/engagement-type/engagement-type.service.ts
    - apps/api/src/engagement/engagement.module.ts
    - apps/api/src/engagement/engagement.controller.ts
    - apps/api/src/engagement/engagement.service.ts
    - apps/api/src/engagement/dto/create-engagement.dto.ts
    - apps/api/src/engagement/dto/update-engagement.dto.ts
    - apps/api/src/engagement/dto/list-engagements-query.dto.ts
    - apps/api/src/engagement/dto/engagement-response.dto.ts
    - apps/api/src/engagement/dto/change-engagement-status.dto.ts
  modified:
    - apps/api/src/app.module.ts

key-decisions:
  - "unscopedPrisma used for EngagementType and template queries -- platform types have firmId: null which scoped client filters out"
  - "Task progress uses groupBy for batch done-count queries instead of N+1 per-engagement queries"
  - "Template instantiation creates tasks via unscopedPrisma with explicit firmId -- scoped client cannot run $transaction"
  - "Engagement list defaults to createdAt desc sort (most recent first) unlike client list which defaults to displayName asc"

patterns-established:
  - "Cross-module service injection: EngagementModule imports EngagementTypeModule for service DI"
  - "Status transition pattern: validate against constant map, check preconditions, cascade side effects"
  - "Template instantiation two-pass pattern: create records first, link relationships second, all in $transaction"

requirements-completed: [ENG-01, ENG-02, ENG-03, ENG-04, ENG-05, ENG-06, ENG-07, ENG-08]

duration: 4min
completed: 2026-04-04
---

# Phase 4 Plan 2: Engagement Module Summary

**Engagement CRUD with lifecycle status transitions, auto-name generation, partner/manager inheritance from client, and two-pass template task instantiation from engagement types**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-04T19:06:10Z
- **Completed:** 2026-04-04T19:10:00Z
- **Tasks:** 1
- **Files modified:** 12

## Accomplishments
- Built complete Engagement module with 5 endpoints: create (with optional task chain), list (paginated/filtered/searchable), get, update, and status transition
- Built EngagementType read-only module with 2 endpoints: list all active types (platform + firm), and template preview for a specific type
- Implemented two-pass template instantiation algorithm: creates tasks from template items with role-to-user mapping and due date calculation, then links task dependencies -- all within a single Prisma transaction
- Status transition validation with COMPLETED-blocked-by-open-tasks (ENG-07) and CANCELLED-cascades-to-child-tasks (ENG-08)

## Task Commits

Each task was committed atomically:

1. **Task 1: Build EngagementType module and Engagement module with CRUD, status transitions, and template instantiation** - `96221c0` (feat)

## Files Created/Modified
- `apps/api/src/engagement-type/engagement-type.module.ts` - NestJS module exporting EngagementTypeService
- `apps/api/src/engagement-type/engagement-type.controller.ts` - GET /engagement-types and GET /engagement-types/:id/template
- `apps/api/src/engagement-type/engagement-type.service.ts` - Listing types with unscopedPrisma, template preview with items
- `apps/api/src/engagement/engagement.module.ts` - NestJS module importing EngagementTypeModule for service DI
- `apps/api/src/engagement/engagement.controller.ts` - 5 REST endpoints for engagement CRUD + status transitions
- `apps/api/src/engagement/engagement.service.ts` - Business logic: create with auto-name/inheritance/template, status transitions with validation/cascade
- `apps/api/src/engagement/dto/create-engagement.dto.ts` - clientId, engagementTypeId, optional name/period/assignments/autoCreateTasks
- `apps/api/src/engagement/dto/update-engagement.dto.ts` - All fields optional, no clientId/typeId changes allowed
- `apps/api/src/engagement/dto/list-engagements-query.dto.ts` - Pagination, search, filters by client/type/status
- `apps/api/src/engagement/dto/engagement-response.dto.ts` - Response with client name, type info, and task progress
- `apps/api/src/engagement/dto/change-engagement-status.dto.ts` - Single required status field with enum validation
- `apps/api/src/app.module.ts` - Added EngagementTypeModule and EngagementModule to imports

## Decisions Made
- EngagementType and template queries use unscopedPrisma: platform seed data has firmId: null, which the scoped Prisma client automatically filters out
- Task progress computed via groupBy batch query: avoids N+1 queries when listing engagements with done/total counts
- Template instantiation wraps both passes in unscopedPrisma.$transaction: scoped client cannot run transactions, so we explicitly pass firmId
- Engagement list defaults to createdAt desc: most recent engagements are more relevant than alphabetical sorting

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed checklistItems from task create data**
- **Found during:** Task 1 (Template instantiation)
- **Issue:** Plan referenced `checklistItems` field on Task model, but the Prisma Task model uses a `TaskChecklist` relation instead of a JSON field. `checklistItems` exists on `TaskTemplateItem` only.
- **Fix:** Removed `checklistItems` from task create data and from template item select query
- **Files modified:** apps/api/src/engagement/engagement.service.ts
- **Verification:** `npx tsc --noEmit` passes with zero errors
- **Committed in:** 96221c0 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed nullable engagementId in groupBy results**
- **Found during:** Task 1 (Task progress batch query)
- **Issue:** Task.engagementId is `String?` (nullable) in Prisma schema, so groupBy results have `engagementId: string | null`. Passing null to Map.set caused TypeScript error.
- **Fix:** Added null guard before `map.set(r.engagementId, ...)` in `getTaskDoneCounts`
- **Files modified:** apps/api/src/engagement/engagement.service.ts
- **Verification:** `npx tsc --noEmit` passes with zero errors
- **Committed in:** 96221c0 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes required for TypeScript compilation. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Engagement API is complete and ready for frontend integration (04-03)
- EngagementService is exported for future cross-module use (e.g., task engine in Phase 5)
- EngagementType API provides dropdown data and template preview for the frontend engagement create modal
- All 8 ENG requirements (ENG-01 through ENG-08) are implemented as API endpoints
- Status transition logic reuses ENGAGEMENT_STATUS_TRANSITIONS from shared package (also available for frontend validation)

## Self-Check: PASSED

All 11 created files verified present. Task commit (96221c0) verified in git log.

---
*Phase: 04-client-engagement*
*Completed: 2026-04-04*
