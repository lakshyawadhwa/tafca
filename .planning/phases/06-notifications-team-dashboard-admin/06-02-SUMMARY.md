---
phase: 06-notifications-team-dashboard-admin
plan: 02
subsystem: api
tags: [nestjs, prisma, dashboard, recently-deleted, firm-settings, promise-all, soft-delete]

# Dependency graph
requires:
  - phase: 05-task-engine
    provides: Task model with status, assignee, reviewer, dueDate fields
  - phase: 01-foundation
    provides: FirmScopedService, PrismaModule, multi-tenancy enforcement
  - phase: 02-auth
    provides: JwtAuthGuard, RolesGuard, CurrentUser decorator, JWT payload
provides:
  - GET /api/dashboard aggregated endpoint with parallel queries
  - GET /api/recently-deleted cross-entity soft-deleted record query
  - POST /api/recently-deleted/:entityType/:entityId/restore
  - GET /api/firms/settings with defaults
  - PATCH /api/firms/settings with JSONB merge
affects: [06-03-frontend-pages, dashboard-page, recently-deleted-page, settings-page]

# Tech tracking
tech-stack:
  added: []
  patterns: [parallel-query-aggregation, cross-entity-soft-delete-query, jsonb-merge-settings, unscoped-prisma-for-deleted-records]

key-files:
  created:
    - apps/api/src/dashboard/dashboard.module.ts
    - apps/api/src/dashboard/dashboard.controller.ts
    - apps/api/src/dashboard/dashboard.service.ts
    - apps/api/src/dashboard/dto/dashboard-response.dto.ts
    - apps/api/src/recently-deleted/recently-deleted.module.ts
    - apps/api/src/recently-deleted/recently-deleted.controller.ts
    - apps/api/src/recently-deleted/recently-deleted.service.ts
    - apps/api/src/recently-deleted/dto/recently-deleted-response.dto.ts
    - apps/api/src/recently-deleted/dto/restore-params.dto.ts
    - apps/api/src/recently-deleted/dto/list-recently-deleted-query.dto.ts
    - apps/api/src/firm-settings/firm-settings.module.ts
    - apps/api/src/firm-settings/firm-settings.controller.ts
    - apps/api/src/firm-settings/firm-settings.service.ts
    - apps/api/src/firm-settings/dto/update-firm-settings.dto.ts
    - apps/api/src/firm-settings/dto/firm-settings-response.dto.ts
  modified:
    - apps/api/src/app.module.ts

key-decisions:
  - "Dashboard uses Promise.all for 7 parallel queries in a single endpoint"
  - "Recently deleted uses unscopedPrisma because scoped client auto-filters deletedAt IS NULL"
  - "Firm settings merges partial DTO into existing JSONB with spread, preserving unset fields"
  - "Response DTOs use interfaces instead of classes to avoid strictPropertyInitialization issues"

patterns-established:
  - "Parallel query aggregation: Promise.all for multi-query dashboard endpoints"
  - "Cross-entity soft-delete query: parallel unscopedPrisma queries with explicit firmId, merged in-memory"
  - "JSONB merge pattern: read existing settings, spread with DTO overrides, write back"
  - "Batch user fetch: collect unique IDs across results, single findMany for display name resolution"

requirements-completed: [DEL-01, DEL-02, DEL-03, PAGE-06, PAGE-09]

# Metrics
duration: 5min
completed: 2026-04-05
---

# Phase 6 Plan 2: Dashboard, Recently Deleted & Firm Settings Summary

**Dashboard aggregation endpoint with 7 parallel queries, cross-entity soft-delete query/restore, and firm settings JSONB CRUD**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-05T07:01:47Z
- **Completed:** 2026-04-05T07:07:00Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments
- Dashboard GET /api/dashboard returns task summary (overdue/today/week/review), my tasks (10), approval queue (10, Partner/Manager only), and recent notifications (5) -- all via Promise.all parallel queries
- Recently Deleted GET /api/recently-deleted queries across clients, engagements, and tasks tables with 30-day window, computes daysRemaining, batch-resolves deletedBy user names
- Restore endpoint validates 30-day expiry, checks client unique constraints before restoring, PARTNER-only access
- Firm Settings returns defaults for missing fields (buffer_days=3, auto_task_gen=true, approval_for=[]), PATCH merges partial updates into JSONB

## Task Commits

Each task was committed atomically:

1. **Task 1: Dashboard and firm settings modules** - `c26e305` (feat)
2. **Task 2: Recently deleted module** - `02bcb2e` (feat)

## Files Created/Modified
- `apps/api/src/dashboard/dashboard.service.ts` - Aggregated dashboard data via 7 parallel Promise.all queries
- `apps/api/src/dashboard/dashboard.controller.ts` - GET /api/dashboard endpoint extracting user from JWT
- `apps/api/src/dashboard/dashboard.module.ts` - NestJS module registration
- `apps/api/src/dashboard/dto/dashboard-response.dto.ts` - Response interfaces (TaskSummary, DashboardTask, DashboardNotification)
- `apps/api/src/recently-deleted/recently-deleted.service.ts` - Cross-entity soft-deleted record query and restore with unscopedPrisma
- `apps/api/src/recently-deleted/recently-deleted.controller.ts` - GET list (PARTNER/ADMIN) and POST restore (PARTNER only)
- `apps/api/src/recently-deleted/recently-deleted.module.ts` - NestJS module registration
- `apps/api/src/recently-deleted/dto/recently-deleted-response.dto.ts` - RecentlyDeletedItemDto with daysRemaining
- `apps/api/src/recently-deleted/dto/list-recently-deleted-query.dto.ts` - Optional entityType filter
- `apps/api/src/recently-deleted/dto/restore-params.dto.ts` - Validated path params (entityType, entityId)
- `apps/api/src/firm-settings/firm-settings.service.ts` - Read with defaults, update with JSONB merge
- `apps/api/src/firm-settings/firm-settings.controller.ts` - GET (all users) and PATCH (PARTNER/ADMIN)
- `apps/api/src/firm-settings/firm-settings.module.ts` - NestJS module registration
- `apps/api/src/firm-settings/dto/update-firm-settings.dto.ts` - Validated DTO with buffer days, auto_task_gen, approval_for
- `apps/api/src/firm-settings/dto/firm-settings-response.dto.ts` - Response interface for V1 settings fields
- `apps/api/src/app.module.ts` - Registered DashboardModule, FirmSettingsModule, RecentlyDeletedModule

## Decisions Made
- Dashboard uses Promise.all for 7 parallel queries in a single endpoint -- bounded by slowest query, not sum
- Recently deleted uses unscopedPrisma with explicit firmId because the scoped client auto-filters `deletedAt IS NULL`, which would exclude all deleted records
- Firm settings update merges partial DTO into existing JSONB using spread, so unset fields in DTO don't overwrite existing values
- Response DTOs use TypeScript interfaces instead of classes to avoid strictPropertyInitialization errors -- these are pure response shapes, not validated input

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed readonly array incompatibility with Prisma notIn filter**
- **Found during:** Task 1 (Dashboard service)
- **Issue:** `as const` made the status array readonly, but Prisma's `notIn` filter requires a mutable array type
- **Fix:** Removed `as const` from the activeStatuses notIn array
- **Files modified:** apps/api/src/dashboard/dashboard.service.ts
- **Verification:** TypeScript compiles clean
- **Committed in:** c26e305 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor type fix, no scope change.

## Issues Encountered
- Pre-existing TypeScript error in `apps/api/src/team/team.service.ts:204` from Plan 06-01 execution (Prisma `$Enums.TaskPriority` vs shared `TaskPriority` mismatch). Not caused by this plan. Documented in deferred-items.md.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All backend endpoints for dashboard, recently deleted, and firm settings are ready for frontend consumption in Plan 06-03
- Dashboard endpoint: `GET /api/dashboard`
- Recently deleted: `GET /api/recently-deleted`, `POST /api/recently-deleted/:entityType/:entityId/restore`
- Firm settings: `GET /api/firms/settings`, `PATCH /api/firms/settings`

## Self-Check: PASSED

- All 15 created files verified present on disk
- Both task commits (c26e305, 02bcb2e) verified in git log

---
*Phase: 06-notifications-team-dashboard-admin*
*Completed: 2026-04-05*
