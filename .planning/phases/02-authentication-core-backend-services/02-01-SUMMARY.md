---
phase: 02-authentication-core-backend-services
plan: 01
subsystem: auth
tags: [jwt, passport, bcrypt, nestjs, redis, session, cookie, rate-limiting, rbac]

# Dependency graph
requires:
  - phase: 01-scaffolding-database-core-infra
    provides: Prisma schema (User, Session, Firm models), PrismaService, RedisModule, RequestContext, FirmScopedService, GlobalExceptionFilter, validation pipe
provides:
  - AuthModule with register, login, refresh, logout, me, change-password endpoints
  - SessionService with create/validate/delete and max-5 enforcement
  - RedisService typed wrapper over ioredis
  - Global JwtAuthGuard with @Public() bypass
  - RolesGuard with @Roles() decorator
  - FirmScopeGuard ensuring firm context on all requests
  - Rate limiting guards for auth endpoints
  - JWT dual-token flow (15m access + 7d refresh via HTTP-only cookie)
  - Auth decorators (@CurrentUser, @CurrentFirm, @Public, @Roles)
affects: [03-frontend-foundation, 04-client-engagement-management, 05-task-engine, 06-notifications-team]

# Tech tracking
tech-stack:
  added: [@nestjs/jwt, @nestjs/passport, passport, passport-jwt, bcrypt, cookie-parser]
  patterns: [dual-token JWT flow, session-as-kill-switch, Redis session cache with PostgreSQL fallback, IP-based rate limiting via Redis, account lockout]

key-files:
  created:
    - apps/api/src/auth/auth.module.ts
    - apps/api/src/auth/auth.service.ts
    - apps/api/src/auth/auth.controller.ts
    - apps/api/src/auth/strategies/jwt.strategy.ts
    - apps/api/src/auth/guards/jwt-auth.guard.ts
    - apps/api/src/auth/guards/roles.guard.ts
    - apps/api/src/auth/guards/firm-scope.guard.ts
    - apps/api/src/auth/constants/auth.constants.ts
    - apps/api/src/auth/interfaces/jwt-payload.interface.ts
    - apps/api/src/auth/interfaces/auth-context.interface.ts
    - apps/api/src/auth/interfaces/session-cache.interface.ts
    - apps/api/src/auth/dto/login.dto.ts
    - apps/api/src/auth/dto/register.dto.ts
    - apps/api/src/auth/dto/login-response.dto.ts
    - apps/api/src/auth/dto/register-response.dto.ts
    - apps/api/src/auth/dto/change-password.dto.ts
    - apps/api/src/auth/dto/me-response.dto.ts
    - apps/api/src/auth/decorators/public.decorator.ts
    - apps/api/src/auth/decorators/current-user.decorator.ts
    - apps/api/src/auth/decorators/current-firm.decorator.ts
    - apps/api/src/auth/decorators/roles.decorator.ts
    - apps/api/src/common/services/redis.service.ts
    - apps/api/src/common/guards/throttle.guard.ts
    - apps/api/src/session/session.service.ts
    - apps/api/src/session/session.module.ts
  modified:
    - apps/api/src/app.module.ts
    - apps/api/src/app.controller.ts
    - apps/api/src/main.ts
    - apps/api/src/redis/redis.module.ts
    - apps/api/src/common/context/request-context.middleware.ts
    - apps/api/src/health/health.controller.ts
    - apps/api/package.json

key-decisions:
  - "Dual-token flow: 15m access token + 7d refresh token via HTTP-only cookie instead of single 365d token"
  - "Auth service uses prisma.unscoped for all operations since auth happens outside firm context"
  - "Rate limiting via custom Redis-based ThrottleGuard factory instead of @nestjs/throttler"
  - "RequestContextMiddleware decodes JWT pre-guard to populate AsyncLocalStorage for Prisma extension"
  - "Deactivated user detection does two-step query: first find user, then check isActive for 403 vs 401"

patterns-established:
  - "@Public() decorator skips JWT guard on public routes (login, register, refresh, health)"
  - "ThrottleGuard factory pattern for per-endpoint rate limiting via Redis"
  - "Session-as-kill-switch: every request validates session in Redis (PostgreSQL fallback)"
  - "Auth decorators extract JWT payload fields from request.user"
  - "Account lockout after 10 failed attempts with 30-minute cooldown via Redis"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08, AUTH-09]

# Metrics
duration: 50min
completed: 2026-03-29
---

# Phase 02 Plan 01: Authentication System Summary

**Complete JWT auth with dual-token flow (15m access + 7d HTTP-only refresh cookie), session-based revocation via Redis/PostgreSQL, max-5 session enforcement, account lockout, and IP-based rate limiting**

## Performance

- **Duration:** 50 min
- **Started:** 2026-03-28T17:54:00Z
- **Completed:** 2026-03-28T18:44:00Z
- **Tasks:** 2
- **Files modified:** 33

## Accomplishments

- Complete auth system with 6 endpoints: register, login, refresh, logout, me, change-password
- Dual-token JWT flow with 15-minute access tokens and 7-day refresh tokens stored as HTTP-only cookies
- Session management with Redis cache + PostgreSQL persistence, automatic oldest-session eviction at 5 concurrent sessions
- Global guards (JwtAuthGuard, RolesGuard, FirmScopeGuard) applied to all routes with @Public() bypass
- Redis-based IP rate limiting (5 login/min, 3 register/min) and account lockout after 10 failed attempts
- Firm registration flow creating firm + partner user in a single transaction

## Task Commits

Each task was committed atomically:

1. **Task 1: Auth interfaces, DTOs, constants, decorators, RedisService wrapper, and session service** - `6d04902` (feat)
2. **Task 2: Auth service, controller, guards, JWT strategy, rate limiting, and AppModule wiring** - `f5c34f4` (feat)

## Files Created/Modified

- `apps/api/src/auth/auth.module.ts` - Auth module wiring PassportModule, JwtModule, SessionModule
- `apps/api/src/auth/auth.service.ts` - Core auth logic: register, login, refresh, logout, getMe, changePassword
- `apps/api/src/auth/auth.controller.ts` - 6 auth API endpoints with cookie management
- `apps/api/src/auth/strategies/jwt.strategy.ts` - Passport JWT strategy with session validation
- `apps/api/src/auth/guards/jwt-auth.guard.ts` - Global JWT guard with @Public() bypass
- `apps/api/src/auth/guards/roles.guard.ts` - Role-based access control guard
- `apps/api/src/auth/guards/firm-scope.guard.ts` - Firm context sanity check guard
- `apps/api/src/auth/constants/auth.constants.ts` - Auth configuration constants
- `apps/api/src/auth/interfaces/*.ts` - JwtPayload, AuthContext, SessionCache interfaces
- `apps/api/src/auth/dto/*.ts` - Login, Register, ChangePassword, MeResponse, LoginResponse, RegisterResponse DTOs
- `apps/api/src/auth/decorators/*.ts` - @Public, @CurrentUser, @CurrentFirm, @Roles decorators
- `apps/api/src/common/services/redis.service.ts` - Typed wrapper over raw ioredis client
- `apps/api/src/common/guards/throttle.guard.ts` - Redis-based rate limiting guard factory
- `apps/api/src/session/session.service.ts` - Session CRUD with Redis cache and max-session enforcement
- `apps/api/src/session/session.module.ts` - Session module
- `apps/api/src/app.module.ts` - Added AuthModule, SessionModule, global guards
- `apps/api/src/main.ts` - Added cookie-parser middleware
- `apps/api/src/common/context/request-context.middleware.ts` - JWT decode for AsyncLocalStorage
- `apps/api/src/health/health.controller.ts` - Added @Public() decorator
- `apps/api/src/app.controller.ts` - Added @Public() decorator
- `apps/api/src/redis/redis.module.ts` - Added RedisService as provider/export
- `apps/api/package.json` - Added auth dependencies

## Decisions Made

- **Dual-token flow over single token:** Used 15-minute access tokens with 7-day refresh tokens via HTTP-only cookie instead of the doc's single 365d token approach. This follows the technical_implementation.md API contracts and provides better security posture.
- **Unscoped Prisma for all auth operations:** Auth service uses `prisma.unscoped` throughout since authentication occurs before firm context is established (no firmId in AsyncLocalStorage during login/register).
- **Custom ThrottleGuard over @nestjs/throttler:** Built a simple Redis-based rate limiter factory instead of adding @nestjs/throttler dependency, reducing complexity while providing per-endpoint control.
- **Two-step deactivated user detection:** Login first finds user without isActive filter, then checks isActive separately to return 403 (deactivated) vs 401 (not found) per AUTH-07.
- **JWT decode in middleware:** RequestContextMiddleware decodes JWT payload (without validation) to populate AsyncLocalStorage before guards run, ensuring Prisma firm-scoping works throughout the request lifecycle.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed DTO strict property initialization errors**
- **Found during:** Task 1
- **Issue:** TypeScript `strict: true` mode requires definite assignment assertions on class properties. DTOs from the doc blueprint lacked `!` operator.
- **Fix:** Added `!` definite assignment operator to all DTO properties (standard NestJS DTO pattern with class-validator)
- **Files modified:** All 6 DTO files in apps/api/src/auth/dto/
- **Verification:** TypeScript compiles clean
- **Committed in:** 6d04902 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed cookie-parser import syntax**
- **Found during:** Task 2
- **Issue:** `import * as cookieParser from 'cookie-parser'` produced "not callable" error with `esModuleInterop: true`
- **Fix:** Changed to `import cookieParser from 'cookie-parser'` (default import)
- **Files modified:** apps/api/src/main.ts
- **Verification:** TypeScript compiles clean
- **Committed in:** f5c34f4 (Task 2 commit)

**3. [Rule 1 - Bug] Fixed ThrottleGuard anonymous class private property export error**
- **Found during:** Task 2
- **Issue:** TypeScript TS4094: exported anonymous class cannot have private/protected properties
- **Fix:** Changed `private readonly redis` to `readonly redis` and added explicit return type to factory function
- **Files modified:** apps/api/src/common/guards/throttle.guard.ts
- **Verification:** TypeScript compiles clean
- **Committed in:** f5c34f4 (Task 2 commit)

**4. [Rule 2 - Missing Critical] Marked AppController root endpoint as @Public()**
- **Found during:** Task 2
- **Issue:** With global JwtAuthGuard, the root `GET /api` endpoint would require auth, breaking health-check semantics
- **Fix:** Added `@Public()` decorator to AppController.getHealth()
- **Files modified:** apps/api/src/app.controller.ts
- **Verification:** TypeScript compiles clean
- **Committed in:** f5c34f4 (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (3 bugs, 1 missing critical)
**Impact on plan:** All auto-fixes necessary for TypeScript strict-mode compliance and correct public endpoint behavior. No scope creep.

## Issues Encountered

None beyond the auto-fixed deviations above.

## Known Stubs

None. All auth endpoints are fully implemented with real business logic, no placeholder data.

## User Setup Required

None - no external service configuration required beyond existing .env variables (JWT_SECRET, JWT_ISSUER, REDIS_HOST already validated by env.validation.ts from Phase 01).

## Next Phase Readiness

- Auth system is fully wired and compiles clean
- All 6 auth endpoints are registered under `/api/auth/*`
- Global guards protect all routes by default; public routes use `@Public()`
- Frontend can integrate auth immediately: POST login -> store access token -> attach as Bearer header -> refresh via cookie
- Phase 02 Plan 02 (user management CRUD) can build on AuthModule exports and @CurrentUser decorator
- Phase 03 (frontend foundation) can implement login/register pages targeting these endpoints

## Self-Check: PASSED

- All 25 created files verified present on disk
- Commit 6d04902 (Task 1) verified in git log
- Commit f5c34f4 (Task 2) verified in git log
- TypeScript compilation passes (`tsc --noEmit` returns 0)

---
*Phase: 02-authentication-core-backend-services*
*Completed: 2026-03-29*
