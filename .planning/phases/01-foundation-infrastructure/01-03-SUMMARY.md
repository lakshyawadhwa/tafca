---
phase: 01-foundation-infrastructure
plan: 03
subsystem: api
tags: [error-handling, validation, logging, health-check, redis, ioredis, exception-filter, middleware, nestjs]

# Dependency graph
requires:
  - phase: 01-02
    provides: "Prisma schema, PrismaService with scoped/unscoped accessors, AsyncLocalStorage request context, RequestContextMiddleware"
provides:
  - GlobalExceptionFilter returning consistent JSON error responses with request_id
  - createValidationPipe factory with descriptive field-level error messages
  - RequestLoggingMiddleware with method, path, status, duration_ms, request_id
  - Global API prefix /api on all routes
  - Health check endpoint (GET /api/health) with DB and Redis connectivity checks
  - Global RedisModule with ioredis provider for injection anywhere
affects: [02-auth, 03-frontend-foundation, 04-client-management, 05-task-engine, all-api-modules]

# Tech tracking
tech-stack:
  added: []
  patterns: [global-exception-filter, custom-validation-pipe-factory, structured-request-logging, health-check-endpoint, redis-global-module, api-prefix]

key-files:
  created:
    - apps/api/src/common/filters/global-exception.filter.ts
    - apps/api/src/common/pipes/validation.pipe.ts
    - apps/api/src/common/middleware/request-logging.middleware.ts
    - apps/api/src/redis/redis.provider.ts
    - apps/api/src/redis/redis.module.ts
    - apps/api/src/health/health.controller.ts
    - apps/api/src/health/health.service.ts
    - apps/api/src/health/health.module.ts
  modified:
    - apps/api/src/main.ts
    - apps/api/src/app.module.ts

key-decisions:
  - "Global API prefix set to /api via app.setGlobalPrefix('api') - all routes under /api/*"
  - "Redis provider uses lazyConnect:true with maxRetriesPerRequest:3 for resilient connection handling"
  - "Health check uses unscoped Prisma client (system-level query, no firm context needed)"
  - "Middleware chain order: RequestContextMiddleware first (sets up AsyncLocalStorage), then RequestLoggingMiddleware (reads from context)"

patterns-established:
  - "Error responses always return { statusCode, message, error, request_id } JSON"
  - "5xx errors logged at ERROR level, 4xx at WARN level in exception filter"
  - "Request logging emits structured JSON with request_id, method, path, status, duration_ms"
  - "Health check pattern: service checks each dependency, returns ok/degraded/down aggregate"
  - "Redis injection via @Inject(REDIS_CLIENT) token from global RedisModule"

requirements-completed: [FOUND-08, ERR-01, ERR-02, ERR-03]

# Metrics
duration: 3min
completed: 2026-03-27
---

# Phase 01 Plan 03: Error Handling, Logging & Health Check Summary

**Global exception filter with request_id tracing, field-level validation errors, structured request logging, and GET /api/health with DB + Redis connectivity checks**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-27T06:32:22Z
- **Completed:** 2026-03-27T06:35:34Z
- **Tasks:** 2/2
- **Files modified:** 10 (5 in Task 1 + 6 in Task 2, with app.module.ts modified in both)

## Accomplishments
- GlobalExceptionFilter catches all exceptions and returns consistent JSON with statusCode, message, error, and request_id fields
- createValidationPipe factory with custom exceptionFactory producing descriptive per-field error messages
- RequestLoggingMiddleware logs every request with method, path, status, duration_ms, request_id, firm_id, user_id
- Health check endpoint (GET /api/health) verifies DB connectivity via SELECT 1 and Redis via ping(), returning ok/degraded/down status with latency_ms
- Global RedisModule with ioredis provider available for injection in any module (ready for auth sessions, BullMQ)
- Global API prefix /api set on all routes

## Task Commits

Each task was committed atomically:

1. **Task 1: Global exception filter, validation pipe, and request logging middleware** - `ef9448f` (feat)
2. **Task 2: Health check endpoint with DB and Redis connectivity, Redis module** - `05f4c51` (feat)

## Files Created/Modified
- `apps/api/src/common/filters/global-exception.filter.ts` - Catches all exceptions, returns consistent JSON with request_id
- `apps/api/src/common/pipes/validation.pipe.ts` - createValidationPipe factory with descriptive field-level errors
- `apps/api/src/common/middleware/request-logging.middleware.ts` - Structured JSON request logging with duration_ms
- `apps/api/src/redis/redis.provider.ts` - REDIS_CLIENT provider using ioredis with ConfigService
- `apps/api/src/redis/redis.module.ts` - Global RedisModule exporting REDIS_CLIENT
- `apps/api/src/health/health.controller.ts` - GET /health endpoint
- `apps/api/src/health/health.service.ts` - DB and Redis connectivity checks with latency_ms
- `apps/api/src/health/health.module.ts` - HealthModule with controller and service
- `apps/api/src/main.ts` - Added global prefix, exception filter, and validation pipe
- `apps/api/src/app.module.ts` - Added RedisModule, HealthModule imports and RequestLoggingMiddleware

## Decisions Made
- Set global API prefix to /api so all routes are under /api/* (consistent with plan and frontend expectations)
- Redis provider uses lazyConnect:true to avoid blocking app startup if Redis is temporarily unavailable
- Health check uses unscoped Prisma client for SELECT 1 (system-level query, no firm context needed)
- Middleware chain: RequestContextMiddleware runs first to populate AsyncLocalStorage, then RequestLoggingMiddleware reads from it

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - TypeScript compilation passed cleanly on both tasks.

## Known Stubs
None - all files are complete implementations with no placeholder data or TODO items.

## User Setup Required
None - no additional configuration required beyond what was set up in Plan 01 and 02. Redis connection uses REDIS_HOST/REDIS_PORT from .env (already validated by env.validation.ts).

## Next Phase Readiness
- Error handling layer ready for all future API endpoints (consistent error format guaranteed)
- Redis available globally for auth session storage (Phase 02) and BullMQ queues
- Health check endpoint ready for monitoring/deployment health probes
- Request logging captures full context for debugging in production
- All Phase 01 infrastructure complete - ready to begin Phase 02 (Authentication)

## Self-Check: PASSED

All 10 key files verified present. Both task commits (ef9448f, 05f4c51) verified in git history.

---
*Phase: 01-foundation-infrastructure*
*Completed: 2026-03-27*
