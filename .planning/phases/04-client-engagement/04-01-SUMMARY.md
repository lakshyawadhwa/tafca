---
phase: 04-client-engagement
plan: 01
subsystem: api
tags: [nestjs, prisma, client, gst, crud, validation, enums]

requires:
  - phase: 01-scaffolding
    provides: FirmScopedService, PrismaModule, shared REGEX/LIMITS constants
  - phase: 02-auth
    provides: JWT auth guards, request context (firmId/userId via AsyncLocalStorage)
provides:
  - Client CRUD API at /api/clients with PAN/TAN/CIN validation
  - Client GST number CRUD at /api/clients/:id/gst-numbers with GSTIN validation
  - Fixed shared enums synced to Prisma schema (EngagementCategory, ConstitutionType, RecurrenceType)
  - ENGAGEMENT_STATUS_TRANSITIONS constant from @ca-practice-os/shared
  - ClientService exported for engagement module dependency injection
affects: [04-02-engagement, 04-03-frontend, 05-task-engine]

tech-stack:
  added: []
  patterns:
    - "Client module follows user module pattern: controller -> service (extends FirmScopedService) -> DTOs"
    - "Nested resource pattern: GST numbers as sub-routes of client (/clients/:id/gst-numbers)"
    - "isPrimary toggle via unscoped transaction to atomically unset/set primary GST number"
    - "Role-validated assignments: partner must have PARTNER role, manager must have MANAGER or PARTNER"

key-files:
  created:
    - apps/api/src/client/client.module.ts
    - apps/api/src/client/client.controller.ts
    - apps/api/src/client/client.service.ts
    - apps/api/src/client/dto/create-client.dto.ts
    - apps/api/src/client/dto/update-client.dto.ts
    - apps/api/src/client/dto/list-clients-query.dto.ts
    - apps/api/src/client/dto/client-response.dto.ts
    - apps/api/src/client/dto/create-gst-number.dto.ts
    - apps/api/src/client/dto/update-gst-number.dto.ts
    - packages/shared/src/constants/engagement-status-transitions.ts
  modified:
    - packages/shared/src/enums/engagement-category.enum.ts
    - packages/shared/src/enums/constitution.enum.ts
    - packages/shared/src/enums/recurrence.enum.ts
    - packages/shared/src/enums/index.ts
    - packages/shared/src/index.ts
    - apps/api/src/app.module.ts

key-decisions:
  - "Manager assignment accepts PARTNER or MANAGER role (partners can manage)"
  - "Backward-compatible enum aliases (Constitution, Recurrence) prevent breaking Phase 1-3 code"
  - "Client list returns lighter response shape (no notes/address/customFields) for performance"
  - "GST isPrimary toggle uses unscopedPrisma.$transaction for atomic unset+set across rows"

patterns-established:
  - "Domain module pattern: module.ts, controller.ts, service.ts, dto/ subfolder"
  - "Nested resource routes: POST/PATCH/DELETE /:parentId/sub-resource/:childId"
  - "Soft-delete blocked by active children: count active engagements before allowing client delete"
  - "Assignment role validation via Promise.all parallel lookups"

requirements-completed: [CLIENT-01, CLIENT-02, CLIENT-03, CLIENT-04, CLIENT-05, CLIENT-06, CLIENT-07, CLIENT-08, CLIENT-09]

duration: 17min
completed: 2026-04-04
---

# Phase 4 Plan 1: Client Module Summary

**Client CRUD API with PAN/TAN/CIN/GSTIN validation, GST number management, case-insensitive name uniqueness, role-validated team assignments, and soft-delete blocked by active engagements**

## Performance

- **Duration:** 17 min
- **Started:** 2026-04-04T18:42:37Z
- **Completed:** 2026-04-04T18:59:37Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments
- Fixed critical enum mismatches between Prisma schema and shared TS package (EngagementCategory, ConstitutionType, RecurrenceType) with backward-compatible aliases
- Added ENGAGEMENT_STATUS_TRANSITIONS constant to shared package for reuse by engagement module and frontend
- Built complete Client CRUD with 8 endpoints: create, list (paginated/filtered/searchable), get, update, soft-delete, plus GST number add/update/delete
- Full validation: PAN/TAN/CIN/GSTIN regex, case-insensitive displayName uniqueness, role-validated team assignments, soft-delete blocked by active engagements

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix shared enum mismatches and add engagement status transitions** - `9e09429` (fix)
2. **Task 2: Build Client module -- CRUD + GST numbers + validation + soft delete** - `9b44036` (feat)

## Files Created/Modified
- `packages/shared/src/enums/engagement-category.enum.ts` - Fixed ROC -> ROC_COMPLIANCE, REGISTRATION -> PAYROLL
- `packages/shared/src/enums/constitution.enum.ts` - Renamed to ConstitutionType, HUF -> OTHER
- `packages/shared/src/enums/recurrence.enum.ts` - Renamed to RecurrenceType
- `packages/shared/src/enums/index.ts` - Updated exports with backward-compatible aliases
- `packages/shared/src/constants/engagement-status-transitions.ts` - ACTIVE/ON_HOLD/COMPLETED/CANCELLED transition map
- `packages/shared/src/index.ts` - Added engagement-status-transitions export
- `apps/api/src/client/client.module.ts` - NestJS module exporting ClientService
- `apps/api/src/client/client.controller.ts` - 8 REST endpoints for client + GST CRUD
- `apps/api/src/client/client.service.ts` - Business logic with FirmScopedService, validation, transactions
- `apps/api/src/client/dto/create-client.dto.ts` - Create DTO with PAN/TAN/CIN regex, tags, assignments
- `apps/api/src/client/dto/update-client.dto.ts` - Update DTO with all fields optional
- `apps/api/src/client/dto/list-clients-query.dto.ts` - Pagination, search, filters, sort
- `apps/api/src/client/dto/client-response.dto.ts` - Response DTOs for client and GST number
- `apps/api/src/client/dto/create-gst-number.dto.ts` - GSTIN regex validation, registration type
- `apps/api/src/client/dto/update-gst-number.dto.ts` - All fields optional
- `apps/api/src/app.module.ts` - Registered ClientModule in imports

## Decisions Made
- Manager assignment accepts PARTNER or MANAGER role: Partners often manage clients directly in smaller CA firms
- Backward-compatible enum aliases (Constitution -> ConstitutionType, Recurrence -> RecurrenceType): Prevents breaking any existing Phase 1-3 code that might reference old names
- Client list response is lighter than detail response: Omits notes, address, customFields, constitution for list performance
- GST isPrimary toggle uses unscopedPrisma.$transaction: The scoped client can't do transactions, so we manually inject firmId within the transaction block

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added firmId to Prisma create data objects**
- **Found during:** Task 2 (Client module build)
- **Issue:** TypeScript compilation failed because Prisma's generated types require `firmId` in create data, even though the scoped extension auto-injects it at runtime
- **Fix:** Explicitly pass `firmId: this.getFirmId()` in create data (matching the pattern used by UserService)
- **Files modified:** apps/api/src/client/client.service.ts
- **Verification:** `npx tsc --noEmit` passes with zero errors
- **Committed in:** 9b44036 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required for TypeScript compilation. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Client API is complete and ready for frontend integration (04-03)
- ClientService is exported for the Engagement module (04-02) to inject and query clients
- ENGAGEMENT_STATUS_TRANSITIONS constant is available for the Engagement module's status transition logic
- All 9 CLIENT requirements (CLIENT-01 through CLIENT-09) are implemented

## Self-Check: PASSED

All 11 created files verified present. Both task commits (9e09429, 9b44036) verified in git log.

---
*Phase: 04-client-engagement*
*Completed: 2026-04-04*
