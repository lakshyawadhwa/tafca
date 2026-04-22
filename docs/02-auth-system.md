# Phase 2: Auth System

## Goal
Implement the complete authentication and authorization system: JWT-based auth with session-as-kill-switch, RBAC guards, firm-scoping via AsyncLocalStorage, and all auth API endpoints.

---

## 2.1 Architecture Overview

### Key Design Decision: No Token Expiry Until Logout

The JWT access token does **not** expire in any meaningful way. A safety-net `expiresIn` of `365d` is set, but the **real** revocation mechanism is the `sessions` table in PostgreSQL, cached in Redis. When a user logs out (or an admin revokes a session), the session row is deleted, and the token becomes immediately invalid on the next request.

**Why this works:**
- Every single request validates the session exists (Redis first, PostgreSQL fallback)
- No refresh token complexity, no silent refresh, no token rotation
- Instant revocation: delete the session row, the token is dead
- Simpler frontend: store token in `localStorage`, attach to every request, done

### Token Flow

```
Login → Create session (PostgreSQL + Redis) → Sign JWT with sessionId → Return JWT
  │
  ▼
Every Request → Verify JWT signature → Check Redis session:{sessionId}
  │                                         │
  │                                    Found? → Extract user context → Continue
  │                                         │
  │                                    Not found → Check PostgreSQL sessions table
  │                                                     │
  │                                                Found? → Repopulate Redis → Continue
  │                                                     │
  │                                                Not found → 401 Unauthorized
  │
Logout → Delete session from PostgreSQL → Delete session from Redis → 204
```

---

## 2.2 JWT Payload

```typescript
// This is what gets signed into the JWT
interface JwtPayload {
  sub: string;       // userId (UUID)
  firmId: string;    // firm UUID — enables firm scoping without DB lookup
  role: UserRole;    // PARTNER | MANAGER | JUNIOR_CA | ARTICLE | ADMIN
  email: string;     // for logging/audit, not for auth decisions
  sessionId: string; // the session UUID — the kill switch
  iat: number;       // issued-at (auto-set by jsonwebtoken)
}
```

**No `exp` in the payload.** The `@nestjs/jwt` module sets `expiresIn: '365d'` as a safety net, but the real expiry mechanism is session deletion.

---

## 2.3 Project Structure

```
apps/api/src/
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── strategies/
│   │   └── jwt.strategy.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   ├── roles.guard.ts
│   │   └── firm-scope.guard.ts
│   ├── decorators/
│   │   ├── current-user.decorator.ts
│   │   ├── current-firm.decorator.ts
│   │   ├── roles.decorator.ts
│   │   └── public.decorator.ts
│   ├── dto/
│   │   ├── login.dto.ts
│   │   ├── login-response.dto.ts
│   │   ├── change-password.dto.ts
│   │   └── me-response.dto.ts
│   ├── interfaces/
│   │   ├── jwt-payload.interface.ts
│   │   ├── auth-context.interface.ts
│   │   └── session-cache.interface.ts
│   └── constants/
│       └── auth.constants.ts
├── session/
│   ├── session.module.ts
│   └── session.service.ts
├── context/
│   ├── context.module.ts
│   └── async-context.service.ts
└── redis/
    ├── redis.module.ts
    └── redis.service.ts
```

---

## 2.4 Interfaces

### `apps/api/src/auth/interfaces/jwt-payload.interface.ts`
```typescript
import { UserRole } from '@ca-practice-os/shared';

/**
 * The shape of data stored inside the JWT.
 * This is what JwtStrategy.validate() receives after signature verification.
 */
export interface JwtPayload {
  sub: string;       // userId
  firmId: string;
  role: UserRole;
  email: string;
  sessionId: string;
  iat: number;
}
```

### `apps/api/src/auth/interfaces/auth-context.interface.ts`
```typescript
import { UserRole } from '@ca-practice-os/shared';

/**
 * Stored in AsyncLocalStorage. Available everywhere via AsyncContextService.
 * Set by JwtAuthGuard after successful validation.
 */
export interface AuthContext {
  userId: string;
  firmId: string;
  role: UserRole;
  sessionId: string;
}
```

### `apps/api/src/auth/interfaces/session-cache.interface.ts`
```typescript
import { UserRole } from '@ca-practice-os/shared';

/**
 * Shape of session data stored in Redis.
 * Key: session:{sessionId}
 * TTL: 365 days (matches JWT safety-net expiry)
 */
export interface SessionCache {
  userId: string;
  firmId: string;
  role: UserRole;
  expiresAt: string; // ISO 8601
}
```

---

## 2.5 DTOs

### `apps/api/src/auth/dto/login.dto.ts`
```typescript
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
```

### `apps/api/src/auth/dto/login-response.dto.ts`
```typescript
import { UserRole } from '@ca-practice-os/shared';

export class LoginUserDto {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  firmId: string;
  avatarUrl: string | null;
}

export class LoginResponseDto {
  accessToken: string;
  user: LoginUserDto;
}
```

### `apps/api/src/auth/dto/change-password.dto.ts`
```typescript
import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  newPassword: string;
}
```

### `apps/api/src/auth/dto/me-response.dto.ts`
```typescript
import { UserRole } from '@ca-practice-os/shared';

export class MeResponseDto {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  firmId: string;
  firmName: string;
  avatarUrl: string | null;
  phone: string | null;
  whatsappNumber: string | null;
  notificationPreferences: Record<string, unknown>;
  lastLoginAt: string | null;
  createdAt: string;
}
```

---

## 2.6 Constants

### `apps/api/src/auth/constants/auth.constants.ts`
```typescript
export const AUTH_CONSTANTS = {
  /** Safety-net JWT expiry. Real revocation is session deletion. */
  JWT_EXPIRY: '365d',

  /** Redis key prefix for sessions */
  SESSION_PREFIX: 'session:',

  /** Redis TTL for session cache (in seconds). Matches JWT_EXPIRY. */
  SESSION_CACHE_TTL: 365 * 24 * 60 * 60, // 31,536,000 seconds

  /** Maximum concurrent sessions per user */
  MAX_SESSIONS_PER_USER: 5,

  /** bcrypt cost factor */
  BCRYPT_ROUNDS: 12,

  /** Rate limit: max login attempts per email per minute */
  LOGIN_RATE_LIMIT_MAX: 5,
  LOGIN_RATE_LIMIT_WINDOW_SECONDS: 60,

  /** Account lockout: failed attempts before lockout */
  LOCKOUT_THRESHOLD: 10,

  /** Account lockout duration in minutes */
  LOCKOUT_DURATION_MINUTES: 30,

  /** Redis key prefix for failed login attempts */
  LOGIN_ATTEMPTS_PREFIX: 'login_attempts:',

  /** Redis key prefix for account lockout */
  LOCKOUT_PREFIX: 'lockout:',
} as const;
```

---

## 2.7 Redis Service

### `apps/api/src/redis/redis.module.ts`
```typescript
import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
```

### `apps/api/src/redis/redis.service.ts`
```typescript
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.client = new Redis({
      host: this.config.getOrThrow<string>('REDIS_HOST'),
      port: this.config.getOrThrow<number>('REDIS_PORT'),
      password: this.config.get<string>('REDIS_PASSWORD') || undefined,
      // Reconnect with exponential backoff
      retryStrategy: (times: number) => Math.min(times * 50, 2000),
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.client.expire(key, ttlSeconds);
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  getClient(): Redis {
    return this.client;
  }
}
```

---

## 2.8 Session Service

### `apps/api/src/session/session.module.ts`
```typescript
import { Module } from '@nestjs/common';
import { SessionService } from './session.service';

@Module({
  providers: [SessionService],
  exports: [SessionService],
})
export class SessionModule {}
```

### `apps/api/src/session/session.service.ts`
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AUTH_CONSTANTS } from '../auth/constants/auth.constants';
import { SessionCache } from '../auth/interfaces/session-cache.interface';
import { UserRole } from '@ca-practice-os/shared';
import * as crypto from 'crypto';

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Create a new session for a user.
   * Enforces MAX_SESSIONS_PER_USER — if exceeded, the oldest session is revoked.
   *
   * Returns the session ID (UUID).
   */
  async createSession(params: {
    userId: string;
    firmId: string;
    role: UserRole;
    jwt: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<string> {
    const { userId, firmId, role, jwt, ipAddress, userAgent } = params;

    // Hash the JWT for storage (never store raw tokens in DB)
    const tokenHash = crypto.createHash('sha256').update(jwt).digest('hex');

    // Safety-net expiry: 1 year from now
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    // Enforce max concurrent sessions
    await this.enforceMaxSessions(userId);

    // Create session in PostgreSQL
    const session = await this.prisma.session.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });

    // Cache session in Redis
    const cacheData: SessionCache = {
      userId,
      firmId,
      role,
      expiresAt: expiresAt.toISOString(),
    };

    const redisKey = `${AUTH_CONSTANTS.SESSION_PREFIX}${session.id}`;
    await this.redis.set(
      redisKey,
      JSON.stringify(cacheData),
      AUTH_CONSTANTS.SESSION_CACHE_TTL,
    );

    this.logger.log(`Session created for user ${userId}: ${session.id}`);
    return session.id;
  }

  /**
   * Validate that a session exists and is not expired.
   * Checks Redis first; falls back to PostgreSQL and repopulates Redis on cache miss.
   *
   * Returns SessionCache if valid, null if session is dead.
   */
  async validateSession(sessionId: string): Promise<SessionCache | null> {
    const redisKey = `${AUTH_CONSTANTS.SESSION_PREFIX}${sessionId}`;

    // 1. Check Redis
    const cached = await this.redis.get(redisKey);
    if (cached) {
      const data: SessionCache = JSON.parse(cached);
      // Check safety-net expiry
      if (new Date(data.expiresAt) > new Date()) {
        return data;
      }
      // Expired — clean up
      await this.redis.del(redisKey);
      await this.prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
      return null;
    }

    // 2. Cache miss — check PostgreSQL
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          select: { firmId: true, role: true },
        },
      },
    });

    if (!session) {
      return null;
    }

    // Check safety-net expiry
    if (session.expiresAt < new Date()) {
      await this.prisma.session.delete({ where: { id: sessionId } });
      return null;
    }

    // Repopulate Redis cache
    const cacheData: SessionCache = {
      userId: session.userId,
      firmId: session.user.firmId,
      role: session.user.role as UserRole,
      expiresAt: session.expiresAt.toISOString(),
    };

    await this.redis.set(
      redisKey,
      JSON.stringify(cacheData),
      AUTH_CONSTANTS.SESSION_CACHE_TTL,
    );

    this.logger.debug(`Session ${sessionId} repopulated in Redis from PostgreSQL`);
    return cacheData;
  }

  /**
   * Delete a single session (logout).
   */
  async deleteSession(sessionId: string): Promise<void> {
    const redisKey = `${AUTH_CONSTANTS.SESSION_PREFIX}${sessionId}`;

    // Delete from both stores in parallel
    await Promise.all([
      this.prisma.session.delete({ where: { id: sessionId } }).catch(() => {}),
      this.redis.del(redisKey),
    ]);

    this.logger.log(`Session deleted: ${sessionId}`);
  }

  /**
   * Delete all sessions for a user (force logout everywhere).
   * Called when: user is deactivated, password is changed, admin force-revoke.
   */
  async deleteAllUserSessions(userId: string): Promise<void> {
    // Get all session IDs first (to clear Redis)
    const sessions = await this.prisma.session.findMany({
      where: { userId },
      select: { id: true },
    });

    // Delete from Redis in parallel
    await Promise.all(
      sessions.map((s) =>
        this.redis.del(`${AUTH_CONSTANTS.SESSION_PREFIX}${s.id}`),
      ),
    );

    // Delete all from PostgreSQL in one query
    await this.prisma.session.deleteMany({ where: { userId } });

    this.logger.log(
      `All sessions deleted for user ${userId} (${sessions.length} sessions)`,
    );
  }

  /**
   * Enforce max concurrent sessions.
   * If user has >= MAX_SESSIONS_PER_USER, delete the oldest session.
   */
  private async enforceMaxSessions(userId: string): Promise<void> {
    const sessions = await this.prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    if (sessions.length >= AUTH_CONSTANTS.MAX_SESSIONS_PER_USER) {
      // Delete oldest sessions to make room for the new one
      const sessionsToDelete = sessions.slice(
        0,
        sessions.length - AUTH_CONSTANTS.MAX_SESSIONS_PER_USER + 1,
      );

      for (const session of sessionsToDelete) {
        await this.deleteSession(session.id);
      }

      this.logger.warn(
        `Evicted ${sessionsToDelete.length} oldest session(s) for user ${userId} (max ${AUTH_CONSTANTS.MAX_SESSIONS_PER_USER})`,
      );
    }
  }
}
```

---

## 2.9 AsyncLocalStorage Context

### `apps/api/src/context/context.module.ts`
```typescript
import { Global, Module } from '@nestjs/common';
import { AsyncContextService } from './async-context.service';

@Global()
@Module({
  providers: [AsyncContextService],
  exports: [AsyncContextService],
})
export class ContextModule {}
```

### `apps/api/src/context/async-context.service.ts`
```typescript
import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { AuthContext } from '../auth/interfaces/auth-context.interface';

@Injectable()
export class AsyncContextService {
  private readonly storage = new AsyncLocalStorage<AuthContext>();

  /**
   * Run a callback within a context.
   * Called by JwtAuthGuard to establish the auth context for the entire request.
   */
  run<T>(context: AuthContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  /**
   * Get the current auth context.
   * Returns undefined if called outside a context (e.g., in cron jobs, startup).
   */
  getContext(): AuthContext | undefined {
    return this.storage.getStore();
  }

  /**
   * Get the current auth context, or throw if not set.
   * Use this in code that MUST run within a request context.
   */
  getContextOrThrow(): AuthContext {
    const ctx = this.storage.getStore();
    if (!ctx) {
      throw new Error(
        'AuthContext not available. This code must run within an authenticated request.',
      );
    }
    return ctx;
  }

  /**
   * Convenience: get the current firm ID or throw.
   * Used by Prisma extension to scope all queries.
   */
  getFirmId(): string {
    return this.getContextOrThrow().firmId;
  }

  /**
   * Convenience: get the current user ID or throw.
   */
  getUserId(): string {
    return this.getContextOrThrow().userId;
  }
}
```

---

## 2.10 JWT Strategy

### `apps/api/src/auth/strategies/jwt.strategy.ts`
```typescript
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { SessionService } from '../../session/session.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly config: ConfigService,
    private readonly sessionService: SessionService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false, // still respect the 365d safety-net
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      issuer: config.getOrThrow<string>('JWT_ISSUER'),
    });
  }

  /**
   * Called by Passport after JWT signature is verified.
   * This is where we check if the session still exists (the kill switch).
   *
   * Returns the validated payload, which becomes `request.user`.
   */
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const session = await this.sessionService.validateSession(payload.sessionId);

    if (!session) {
      this.logger.debug(
        `Session ${payload.sessionId} not found for user ${payload.sub} — token revoked`,
      );
      throw new UnauthorizedException('Session has been revoked');
    }

    // Return the full JWT payload — this becomes request.user
    return payload;
  }
}
```

---

## 2.11 Guards

### `apps/api/src/auth/guards/jwt-auth.guard.ts`
```typescript
import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AsyncContextService } from '../../context/async-context.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { AuthContext } from '../interfaces/auth-context.interface';

/**
 * Global guard applied to every route.
 * - Skips routes marked with @Public()
 * - Validates JWT + session existence (via JwtStrategy)
 * - Sets AsyncLocalStorage context for the entire request
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly asyncContext: AsyncContextService,
  ) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Check for @Public() decorator
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Delegate to Passport JwtStrategy
    return super.canActivate(context);
  }

  /**
   * Called after Passport successfully validates the JWT.
   * We use this hook to set the AsyncLocalStorage context.
   */
  handleRequest<T = JwtPayload>(
    err: Error | null,
    user: T | false,
    _info: unknown,
    context: ExecutionContext,
  ): T {
    if (err || !user) {
      throw err || new UnauthorizedException('Invalid or expired token');
    }

    const payload = user as unknown as JwtPayload;
    const request = context.switchToHttp().getRequest();

    // Set the auth context in AsyncLocalStorage
    const authContext: AuthContext = {
      userId: payload.sub,
      firmId: payload.firmId,
      role: payload.role,
      sessionId: payload.sessionId,
    };

    // Attach to request for decorators
    request.authContext = authContext;

    // Note: AsyncLocalStorage.run() must wrap the rest of the request.
    // This is handled by a middleware (see Section 2.16 — ContextMiddleware).
    // The guard sets request.authContext; the middleware reads it and calls
    // asyncContext.run() to wrap the handler execution.

    return user;
  }
}
```

### `apps/api/src/auth/guards/roles.guard.ts`
```typescript
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@ca-practice-os/shared';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * Checks that the authenticated user's role matches one of the roles
 * specified in the @Roles() decorator.
 *
 * Usage:
 *   @Roles(UserRole.PARTNER, UserRole.ADMIN)
 *   @Get('settings')
 *   getSettings() { ... }
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no @Roles() decorator, allow all authenticated users
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: JwtPayload = request.user;

    if (!user) {
      throw new ForbiddenException('No user context found');
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        `Role '${user.role}' is not authorized. Required: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
```

### `apps/api/src/auth/guards/firm-scope.guard.ts`
```typescript
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * Ensures that the firmId is present in the JWT payload.
 * This is a sanity check — if a request somehow gets past JwtAuthGuard
 * without a firmId, something is very wrong.
 *
 * Applied globally alongside JwtAuthGuard.
 */
@Injectable()
export class FirmScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: JwtPayload = request.user;

    if (!user?.firmId) {
      throw new InternalServerErrorException(
        'Firm context not established. This is a server error.',
      );
    }

    return true;
  }
}
```

---

## 2.12 Decorators

### `apps/api/src/auth/decorators/current-user.decorator.ts`
```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * Extracts the full JWT payload from the request.
 *
 * Usage:
 *   @Get('profile')
 *   getProfile(@CurrentUser() user: JwtPayload) {
 *     return user.sub; // userId
 *   }
 *
 *   @Get('email')
 *   getEmail(@CurrentUser('email') email: string) {
 *     return email;
 *   }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: JwtPayload = request.user;
    return data ? user?.[data] : user;
  },
);
```

### `apps/api/src/auth/decorators/current-firm.decorator.ts`
```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * Extracts the firmId from the JWT payload.
 *
 * Usage:
 *   @Get('clients')
 *   getClients(@CurrentFirm() firmId: string) { ... }
 */
export const CurrentFirm = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const user: JwtPayload = request.user;
    return user.firmId;
  },
);
```

### `apps/api/src/auth/decorators/roles.decorator.ts`
```typescript
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@ca-practice-os/shared';

export const ROLES_KEY = 'roles';

/**
 * Specifies which roles can access a route.
 *
 * Usage:
 *   @Roles(UserRole.PARTNER, UserRole.ADMIN)
 *   @Get('settings')
 *   getSettings() { ... }
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
```

### `apps/api/src/auth/decorators/public.decorator.ts`
```typescript
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as public — JwtAuthGuard will skip it.
 *
 * Usage:
 *   @Public()
 *   @Post('login')
 *   login() { ... }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

---

## 2.13 Auth Service

### `apps/api/src/auth/auth.service.ts`
```typescript
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { SessionService } from '../session/session.service';
import { RedisService } from '../redis/redis.service';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { MeResponseDto } from './dto/me-response.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { AUTH_CONSTANTS } from './constants/auth.constants';
import { UserRole } from '@ca-practice-os/shared';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly sessionService: SessionService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * POST /auth/login
   *
   * 1. Check account lockout
   * 2. Find user by email (any firm — email is unique per firm, not globally)
   * 3. Verify password
   * 4. Create session
   * 5. Sign JWT
   * 6. Return token + user profile
   */
  async login(
    dto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<LoginResponseDto> {
    const { email, password } = dto;

    // Check account lockout
    await this.checkAccountLockout(email);

    // Find user by email (include firm for context)
    const user = await this.prisma.user.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        isActive: true,
        deletedAt: null,
      },
      include: {
        firm: {
          select: { id: true, name: true, deletedAt: true },
        },
      },
    });

    if (!user || user.firm.deletedAt) {
      await this.recordFailedAttempt(email);
      throw new UnauthorizedException('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      await this.recordFailedAttempt(email);
      throw new UnauthorizedException('Invalid email or password');
    }

    // Clear failed login attempts on success
    await this.clearFailedAttempts(email);

    // Build JWT payload
    const payload: Omit<JwtPayload, 'iat'> = {
      sub: user.id,
      firmId: user.firmId,
      role: user.role as UserRole,
      email: user.email,
      sessionId: '', // placeholder — replaced after session creation
    };

    // Sign JWT (sessionId will be set after session creation — we need to do this
    // in two steps because the session needs the JWT hash, and the JWT needs the sessionId)
    // Solution: create session first with a temporary token hash, then update.

    // Actually, better approach: generate sessionId as UUID upfront, use it in both.
    const { v4: uuidv4 } = await import('uuid');
    const sessionId = uuidv4();
    payload.sessionId = sessionId;

    const jwt = this.jwtService.sign(
      { ...payload },
      {
        expiresIn: AUTH_CONSTANTS.JWT_EXPIRY,
        issuer: this.configService.getOrThrow<string>('JWT_ISSUER'),
      },
    );

    // Create session (uses the pre-generated sessionId approach — see note below)
    // Note: We need to create the session with the known ID. Since Prisma auto-generates
    // UUIDs, we pass the ID explicitly.
    const tokenHash = (await import('crypto'))
      .createHash('sha256')
      .update(jwt)
      .digest('hex');

    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    // Enforce max sessions before creating new one
    await this.enforceMaxSessions(user.id);

    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        tokenHash,
        expiresAt,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });

    // Cache session in Redis
    await this.redisService.set(
      `${AUTH_CONSTANTS.SESSION_PREFIX}${sessionId}`,
      JSON.stringify({
        userId: user.id,
        firmId: user.firmId,
        role: user.role,
        expiresAt: expiresAt.toISOString(),
      }),
      AUTH_CONSTANTS.SESSION_CACHE_TTL,
    );

    // Update last login timestamp
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    this.logger.log(`User ${user.id} logged in (session: ${sessionId})`);

    return {
      accessToken: jwt,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role as UserRole,
        firmId: user.firmId,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  /**
   * POST /auth/logout
   *
   * Delete the current session from PostgreSQL + Redis.
   */
  async logout(sessionId: string): Promise<void> {
    await this.sessionService.deleteSession(sessionId);
    this.logger.log(`Session ${sessionId} logged out`);
  }

  /**
   * GET /auth/me
   *
   * Return the current user's profile.
   */
  async getMe(userId: string): Promise<MeResponseDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        firm: { select: { name: true } },
      },
    });

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role as UserRole,
      firmId: user.firmId,
      firmName: user.firm.name,
      avatarUrl: user.avatarUrl,
      phone: user.phone,
      whatsappNumber: user.whatsappNumber,
      notificationPreferences:
        user.notificationPreferences as Record<string, unknown>,
      lastLoginAt: user.lastLoginAt?.toISOString() || null,
      createdAt: user.createdAt.toISOString(),
    };
  }

  /**
   * POST /auth/change-password
   *
   * 1. Verify current password
   * 2. Hash new password
   * 3. Update in DB
   * 4. Delete ALL sessions for this user (force re-login everywhere)
   */
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true },
    });

    const isCurrentValid = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!isCurrentValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    const newHash = await bcrypt.hash(
      dto.newPassword,
      AUTH_CONSTANTS.BCRYPT_ROUNDS,
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    // Invalidate ALL sessions — user must log in again with new password
    await this.sessionService.deleteAllUserSessions(userId);

    this.logger.log(`Password changed for user ${userId} — all sessions revoked`);
  }

  // ─── Private helpers ──────────────────────────────────────

  /**
   * Check if the account is locked due to too many failed login attempts.
   */
  private async checkAccountLockout(email: string): Promise<void> {
    const lockoutKey = `${AUTH_CONSTANTS.LOCKOUT_PREFIX}${email.toLowerCase()}`;
    const isLocked = await this.redisService.exists(lockoutKey);

    if (isLocked) {
      const ttl = await this.redisService.ttl(lockoutKey);
      throw new UnauthorizedException(
        `Account is temporarily locked. Try again in ${Math.ceil(ttl / 60)} minutes.`,
      );
    }
  }

  /**
   * Record a failed login attempt. Lock the account after LOCKOUT_THRESHOLD.
   */
  private async recordFailedAttempt(email: string): Promise<void> {
    const attemptsKey = `${AUTH_CONSTANTS.LOGIN_ATTEMPTS_PREFIX}${email.toLowerCase()}`;
    const attempts = await this.redisService.incr(attemptsKey);

    // Set TTL on first attempt
    if (attempts === 1) {
      await this.redisService.expire(
        attemptsKey,
        AUTH_CONSTANTS.LOCKOUT_DURATION_MINUTES * 60,
      );
    }

    if (attempts >= AUTH_CONSTANTS.LOCKOUT_THRESHOLD) {
      // Lock the account
      const lockoutKey = `${AUTH_CONSTANTS.LOCKOUT_PREFIX}${email.toLowerCase()}`;
      await this.redisService.set(
        lockoutKey,
        '1',
        AUTH_CONSTANTS.LOCKOUT_DURATION_MINUTES * 60,
      );

      // Clear the attempts counter
      await this.redisService.del(attemptsKey);

      this.logger.warn(`Account locked for ${email} after ${attempts} failed attempts`);
    }
  }

  /**
   * Clear failed login attempts (called on successful login).
   */
  private async clearFailedAttempts(email: string): Promise<void> {
    const attemptsKey = `${AUTH_CONSTANTS.LOGIN_ATTEMPTS_PREFIX}${email.toLowerCase()}`;
    await this.redisService.del(attemptsKey);
  }

  /**
   * Enforce max concurrent sessions per user.
   */
  private async enforceMaxSessions(userId: string): Promise<void> {
    const sessions = await this.prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    if (sessions.length >= AUTH_CONSTANTS.MAX_SESSIONS_PER_USER) {
      const toDelete = sessions.slice(
        0,
        sessions.length - AUTH_CONSTANTS.MAX_SESSIONS_PER_USER + 1,
      );

      for (const session of toDelete) {
        await this.sessionService.deleteSession(session.id);
      }

      this.logger.warn(
        `Evicted ${toDelete.length} session(s) for user ${userId}`,
      );
    }
  }
}
```

---

## 2.14 Auth Controller

### `apps/api/src/auth/auth.controller.ts`
```typescript
import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { MeResponseDto } from './dto/me-response.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/login
   * Public — no auth required.
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
  ): Promise<LoginResponseDto> {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip;
    const userAgent = req.headers['user-agent'];

    return this.authService.login(dto, ipAddress, userAgent);
  }

  /**
   * POST /auth/logout
   * Requires auth — deletes the current session.
   */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentUser() user: JwtPayload): Promise<void> {
    await this.authService.logout(user.sessionId);
  }

  /**
   * GET /auth/me
   * Requires auth — returns current user profile.
   */
  @Get('me')
  async getMe(@CurrentUser('sub') userId: string): Promise<MeResponseDto> {
    return this.authService.getMe(userId);
  }

  /**
   * POST /auth/change-password
   * Requires auth — changes password and revokes ALL sessions.
   */
  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentUser('sub') userId: string,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.authService.changePassword(userId, dto);
  }
}
```

---

## 2.15 Auth Module

### `apps/api/src/auth/auth.module.ts`
```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { SessionModule } from '../session/session.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          issuer: config.getOrThrow<string>('JWT_ISSUER'),
          expiresIn: '365d', // safety net — session deletion is the real kill switch
        },
      }),
    }),
    SessionModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
```

---

## 2.16 Context Middleware

The `AsyncLocalStorage` context must wrap the entire request handler chain. A NestJS middleware is the cleanest way to do this because it runs before guards and interceptors.

### `apps/api/src/context/context.middleware.ts`
```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AsyncContextService } from './async-context.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { AuthContext } from '../auth/interfaces/auth-context.interface';

/**
 * Middleware that extracts the JWT (if present), decodes it (without full
 * validation — that's the guard's job), and wraps the rest of the request
 * in an AsyncLocalStorage context.
 *
 * This ensures that AsyncLocalStorage is available inside guards, pipes,
 * interceptors, and handlers.
 *
 * If no JWT is present (public routes), the request proceeds without context.
 */
@Injectable()
export class ContextMiddleware implements NestMiddleware {
  constructor(
    private readonly asyncContext: AsyncContextService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  use(req: Request, _res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      // No token — public route. Proceed without context.
      return next();
    }

    const token = authHeader.slice(7);

    try {
      // Decode JWT to extract context. The guard will do full validation.
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      });

      const context: AuthContext = {
        userId: payload.sub,
        firmId: payload.firmId,
        role: payload.role,
        sessionId: payload.sessionId,
      };

      // Wrap the entire downstream execution in this context
      this.asyncContext.run(context, () => next());
    } catch {
      // Invalid token — let the guard handle the 401.
      next();
    }
  }
}
```

---

## 2.17 App Module Wiring

### `apps/api/src/app.module.ts` (relevant parts)
```typescript
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

import { RedisModule } from './redis/redis.module';
import { ContextModule } from './context/context.module';
import { ContextMiddleware } from './context/context.middleware';
import { AuthModule } from './auth/auth.module';
import { SessionModule } from './session/session.module';
import { PrismaModule } from './prisma/prisma.module';

import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { FirmScopeGuard } from './auth/guards/firm-scope.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RedisModule,        // Global — provides RedisService everywhere
    ContextModule,      // Global — provides AsyncContextService everywhere
    PrismaModule,       // Global — provides PrismaService everywhere
    SessionModule,
    AuthModule,
    // ... other feature modules
  ],
  providers: [
    // Global guards — applied to EVERY route in order:
    // 1. JwtAuthGuard: validates token + session (skips @Public routes)
    // 2. RolesGuard: checks @Roles() decorator
    // 3. FirmScopeGuard: ensures firmId is set
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: FirmScopeGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // ContextMiddleware must run on ALL routes so that AsyncLocalStorage
    // is set before guards execute.
    consumer.apply(ContextMiddleware).forRoutes('*');
  }
}
```

---

## 2.18 RBAC Permission Matrix

This matrix is the source of truth for authorization decisions. It maps directly from the PRD.

```typescript
// apps/api/src/auth/constants/rbac-matrix.ts

import { UserRole } from '@ca-practice-os/shared';

/**
 * Permission levels for RBAC.
 * - FULL: create, read, update, delete (all records)
 * - FULL_ASSIGNED: CRUD but only on records assigned to the user
 * - READ: read-only (all records)
 * - READ_ASSIGNED: read-only on assigned records
 * - OWN: only records created by or assigned to the user
 * - OWN_ASSIGNED: own records + assigned records
 * - APPROVE: can approve/reject
 * - APPROVE_TEAM: can approve for direct reports only
 * - UPLOAD_READ_ASSIGNED: can upload new + read assigned records
 * - NONE: no access
 */
export enum Permission {
  FULL = 'FULL',
  FULL_ASSIGNED = 'FULL_ASSIGNED',
  FULL_SCOPED = 'FULL_SCOPED',
  READ = 'READ',
  READ_ASSIGNED = 'READ_ASSIGNED',
  OWN = 'OWN',
  OWN_ASSIGNED = 'OWN_ASSIGNED',
  APPROVE = 'APPROVE',
  APPROVE_TEAM = 'APPROVE_TEAM',
  UPLOAD_READ_ASSIGNED = 'UPLOAD_READ_ASSIGNED',
  NONE = 'NONE',
}

export type Resource =
  | 'firm_settings'
  | 'users'
  | 'clients'
  | 'engagements'
  | 'tasks'
  | 'task_approval'
  | 'documents'
  | 'credentials'
  | 'dsc'
  | 'compliance'
  | 'leave';

export const RBAC_MATRIX: Record<Resource, Record<UserRole, Permission>> = {
  firm_settings: {
    [UserRole.PARTNER]: Permission.READ,
    [UserRole.MANAGER]: Permission.NONE,
    [UserRole.JUNIOR_CA]: Permission.NONE,
    [UserRole.ARTICLE]: Permission.NONE,
    [UserRole.ADMIN]: Permission.FULL,
  },
  users: {
    [UserRole.PARTNER]: Permission.FULL,
    [UserRole.MANAGER]: Permission.READ_ASSIGNED, // read team members only
    [UserRole.JUNIOR_CA]: Permission.NONE,
    [UserRole.ARTICLE]: Permission.NONE,
    [UserRole.ADMIN]: Permission.FULL,
  },
  clients: {
    [UserRole.PARTNER]: Permission.FULL,
    [UserRole.MANAGER]: Permission.FULL_ASSIGNED,
    [UserRole.JUNIOR_CA]: Permission.READ_ASSIGNED,
    [UserRole.ARTICLE]: Permission.READ_ASSIGNED,
    [UserRole.ADMIN]: Permission.FULL,
  },
  engagements: {
    [UserRole.PARTNER]: Permission.FULL,
    [UserRole.MANAGER]: Permission.FULL_ASSIGNED,
    [UserRole.JUNIOR_CA]: Permission.READ_ASSIGNED,
    [UserRole.ARTICLE]: Permission.READ_ASSIGNED,
    [UserRole.ADMIN]: Permission.FULL,
  },
  tasks: {
    [UserRole.PARTNER]: Permission.FULL,
    [UserRole.MANAGER]: Permission.FULL,
    [UserRole.JUNIOR_CA]: Permission.OWN_ASSIGNED,
    [UserRole.ARTICLE]: Permission.OWN_ASSIGNED,
    [UserRole.ADMIN]: Permission.FULL,
  },
  task_approval: {
    [UserRole.PARTNER]: Permission.APPROVE,
    [UserRole.MANAGER]: Permission.NONE,
    [UserRole.JUNIOR_CA]: Permission.NONE,
    [UserRole.ARTICLE]: Permission.NONE,
    [UserRole.ADMIN]: Permission.NONE,
  },
  documents: {
    [UserRole.PARTNER]: Permission.FULL,
    [UserRole.MANAGER]: Permission.FULL,
    [UserRole.JUNIOR_CA]: Permission.UPLOAD_READ_ASSIGNED,
    [UserRole.ARTICLE]: Permission.UPLOAD_READ_ASSIGNED,
    [UserRole.ADMIN]: Permission.FULL,
  },
  credentials: {
    [UserRole.PARTNER]: Permission.FULL,
    [UserRole.MANAGER]: Permission.FULL_SCOPED,
    [UserRole.JUNIOR_CA]: Permission.READ_ASSIGNED,
    [UserRole.ARTICLE]: Permission.NONE,
    [UserRole.ADMIN]: Permission.FULL,
  },
  dsc: {
    [UserRole.PARTNER]: Permission.FULL,
    [UserRole.MANAGER]: Permission.FULL,
    [UserRole.JUNIOR_CA]: Permission.READ,
    [UserRole.ARTICLE]: Permission.READ,
    [UserRole.ADMIN]: Permission.FULL,
  },
  compliance: {
    [UserRole.PARTNER]: Permission.FULL,
    [UserRole.MANAGER]: Permission.FULL,
    [UserRole.JUNIOR_CA]: Permission.READ,
    [UserRole.ARTICLE]: Permission.READ,
    [UserRole.ADMIN]: Permission.FULL,
  },
  leave: {
    [UserRole.PARTNER]: Permission.APPROVE,       // approve all
    [UserRole.MANAGER]: Permission.APPROVE_TEAM,   // approve team
    [UserRole.JUNIOR_CA]: Permission.OWN,           // own only
    [UserRole.ARTICLE]: Permission.OWN,             // own only
    [UserRole.ADMIN]: Permission.APPROVE,           // approve all
  },
};

/**
 * Helper to check permission at runtime.
 *
 * Usage:
 *   const perm = getPermission('clients', user.role);
 *   if (perm === Permission.NONE) throw new ForbiddenException();
 *   if (perm === Permission.READ_ASSIGNED) { ... filter by assignment ... }
 */
export function getPermission(resource: Resource, role: UserRole): Permission {
  return RBAC_MATRIX[resource]?.[role] ?? Permission.NONE;
}
```

### How Guards Use the RBAC Matrix

For simple role-gating (e.g., "only PARTNER and ADMIN can access this endpoint"), use the `@Roles()` decorator:

```typescript
@Roles(UserRole.PARTNER, UserRole.ADMIN)
@Get('settings')
getFirmSettings() { ... }
```

For resource-level permissions that depend on assignment (e.g., "MANAGER can only see their assigned clients"), use the `getPermission()` function in the service layer:

```typescript
// Inside ClientsService.findAll()
const perm = getPermission('clients', ctx.role);

switch (perm) {
  case Permission.FULL:
    // No filter — return all clients for this firm
    return this.prisma.client.findMany({ where: { firmId } });

  case Permission.FULL_ASSIGNED:
  case Permission.READ_ASSIGNED:
    // Filter by assignment
    return this.prisma.client.findMany({
      where: {
        firmId,
        OR: [
          { assignedPartnerId: ctx.userId },
          { assignedManagerId: ctx.userId },
          { assignedJuniorId: ctx.userId },
          { assignedArticleId: ctx.userId },
        ],
      },
    });

  case Permission.NONE:
    throw new ForbiddenException('You do not have access to clients');
}
```

---

## 2.19 Password Handling

### Hashing
```typescript
import * as bcrypt from 'bcrypt';
import { AUTH_CONSTANTS } from './constants/auth.constants';

// Hash a password (used during user creation and password change)
const hash = await bcrypt.hash(plainPassword, AUTH_CONSTANTS.BCRYPT_ROUNDS);

// Verify a password (used during login)
const isValid = await bcrypt.compare(plainPassword, storedHash);
```

### Rules
- bcrypt with cost factor 12 (AUTH_CONSTANTS.BCRYPT_ROUNDS)
- `passwordHash` is **never** included in any API response — use Prisma `select` or `omit` to exclude it
- Passwords must be at least 8 characters, containing: 1 uppercase, 1 lowercase, 1 digit, 1 special character
- Validated by `ChangePasswordDto` regex
- New password cannot be the same as the current password

### Prisma Query Pattern — Always Exclude `passwordHash`
```typescript
// CORRECT: explicitly select fields
const user = await this.prisma.user.findUnique({
  where: { id: userId },
  select: {
    id: true,
    email: true,
    fullName: true,
    role: true,
    firmId: true,
    avatarUrl: true,
    // passwordHash intentionally omitted
  },
});

// NEVER do this in a response:
// const user = await this.prisma.user.findUnique({ where: { id } });
// return user; // ← leaks passwordHash!
```

---

## 2.20 Session Management Details

### PostgreSQL `sessions` Table (from `auth.prisma`)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key. Also used as `sessionId` in JWT. |
| `user_id` | UUID | FK to `users.id` |
| `token_hash` | VARCHAR(255) | SHA-256 hash of the JWT. Never store raw tokens. |
| `expires_at` | TIMESTAMPTZ | Safety-net expiry (1 year from creation). |
| `ip_address` | VARCHAR(45) | Client IP at login time (for audit). |
| `user_agent` | VARCHAR(500) | Browser/client UA string (for audit). |
| `created_at` | TIMESTAMPTZ | When the session was created. |

### Redis Cache

| Key Pattern | Value | TTL |
|-------------|-------|-----|
| `session:{sessionId}` | `SessionCache` JSON | 365 days |
| `login_attempts:{email}` | Integer counter | 30 minutes |
| `lockout:{email}` | `"1"` | 30 minutes |

### Session Lifecycle

```
Login:
  1. Validate credentials
  2. Count existing sessions for user
  3. If >= 5, delete oldest session(s) from PostgreSQL + Redis
  4. Generate UUID for sessionId
  5. Sign JWT with sessionId
  6. SHA-256 hash the JWT → tokenHash
  7. INSERT into sessions table (id = sessionId)
  8. SET Redis session:{sessionId} with TTL 365d
  9. Return JWT in response body

Every Request:
  1. Extract JWT from Authorization header
  2. Verify signature (passport-jwt)
  3. GET Redis session:{sessionId}
     → Found: proceed
     → Not found: SELECT from sessions table
       → Found: repopulate Redis, proceed
       → Not found: 401 Unauthorized

Logout:
  1. DELETE from sessions WHERE id = sessionId
  2. DEL Redis session:{sessionId}
  3. Return 204

Password Change:
  1. Verify current password
  2. Hash new password, UPDATE users
  3. SELECT all sessions for userId
  4. DEL Redis session:{id} for each
  5. DELETE FROM sessions WHERE user_id = userId
  6. Return 204 (client must re-login)

Admin Force Revoke / User Deactivation:
  1. Same as password change steps 3-5
```

---

## 2.21 Security Considerations

### Token Storage (Frontend)
- Store JWT in `localStorage` — this is acceptable because:
  - Session validation on every request means a stolen token is useless after session deletion
  - No httpOnly cookie needed since the kill switch is server-side
  - Simpler CORS — no cookie-based issues with cross-origin requests
- Frontend sends `Authorization: Bearer <token>` on every request

### Rate Limiting
- Login endpoint: 5 attempts per minute per email address
- Tracked in Redis with key `login_attempts:{email}` and 60-second TTL
- Implementation: check count before processing login, increment after failed attempt

### Account Lockout
- After 10 consecutive failed login attempts, account is locked for 30 minutes
- Tracked in Redis with key `lockout:{email}`
- Successful login clears the failed attempts counter
- Lockout TTL auto-expires after 30 minutes (Redis handles this)

### Password Security
- bcrypt cost 12 — approximately 250ms per hash on modern hardware
- `passwordHash` never leaves the server in any API response
- Password change invalidates all sessions (force re-login everywhere)

### Session Security
- Session ID is a UUID v4 (cryptographically random, 122 bits of entropy)
- JWT is SHA-256 hashed before storage — even if the DB is compromised, tokens cannot be reconstructed
- IP address and user agent stored for audit trail
- Maximum 5 concurrent sessions per user — prevents unlimited session accumulation

### Multi-Tenancy
- `firmId` is embedded in the JWT and set in AsyncLocalStorage
- Every database query is automatically scoped to the firm via Prisma extension (see Phase 1 doc)
- Users cannot access data from other firms — the scoping is enforced at the ORM level, not at the controller level

---

## 2.22 Express Request Type Augmentation

### `apps/api/src/types/express.d.ts`
```typescript
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { AuthContext } from '../auth/interfaces/auth-context.interface';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      authContext?: AuthContext;
    }
  }
}
```

---

## 2.23 Environment Variables Required

Add these to `apps/api/.env` (already defined in Phase 0 `.env.example`):

```env
# JWT
JWT_SECRET=<64-character random string>
JWT_ISSUER=ca-practice-os

# Redis (for session cache)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

Generate a secure JWT secret:
```bash
openssl rand -hex 32
```

---

## 2.24 API Endpoint Summary

| Method | Path | Auth | Body | Response | Status |
|--------|------|------|------|----------|--------|
| POST | `/auth/login` | @Public | `LoginDto` | `LoginResponseDto` | 200 |
| POST | `/auth/logout` | Required | — | — | 204 |
| GET | `/auth/me` | Required | — | `MeResponseDto` | 200 |
| POST | `/auth/change-password` | Required | `ChangePasswordDto` | — | 204 |

### Example: Login Request/Response

```bash
# Request
POST /auth/login
Content-Type: application/json

{
  "email": "partner@acmeca.in",
  "password": "SecureP@ss1"
}

# Response (200)
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "email": "partner@acmeca.in",
    "fullName": "Rajesh Sharma",
    "role": "PARTNER",
    "firmId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "avatarUrl": null
  }
}
```

### Example: Authenticated Request

```bash
# Any authenticated endpoint
GET /auth/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Response (200)
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "email": "partner@acmeca.in",
  "fullName": "Rajesh Sharma",
  "role": "PARTNER",
  "firmId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "firmName": "Acme CA Services LLP",
  "avatarUrl": null,
  "phone": "+919876543210",
  "whatsappNumber": "+919876543210",
  "notificationPreferences": {
    "in_app": true,
    "email": true,
    "whatsapp": false,
    "muted_until": null
  },
  "lastLoginAt": "2026-03-10T09:30:00.000Z",
  "createdAt": "2026-01-15T10:00:00.000Z"
}
```

---

## 2.25 Testing Checklist

### Unit Tests (`apps/api/src/auth/__tests__/`)

- [ ] `auth.service.spec.ts`
  - [ ] `login()` — valid credentials returns JWT + user
  - [ ] `login()` — invalid email returns 401
  - [ ] `login()` — invalid password returns 401
  - [ ] `login()` — inactive user returns 401
  - [ ] `login()` — deleted firm returns 401
  - [ ] `login()` — locked account returns 401 with lockout message
  - [ ] `login()` — 6th concurrent session evicts oldest
  - [ ] `logout()` — deletes session from PostgreSQL + Redis
  - [ ] `getMe()` — returns user profile without passwordHash
  - [ ] `changePassword()` — valid current password succeeds
  - [ ] `changePassword()` — wrong current password returns 400
  - [ ] `changePassword()` — same password returns 400
  - [ ] `changePassword()` — revokes all sessions after change

- [ ] `session.service.spec.ts`
  - [ ] `createSession()` — writes to PostgreSQL + Redis
  - [ ] `validateSession()` — returns cache from Redis on hit
  - [ ] `validateSession()` — falls back to PostgreSQL on Redis miss
  - [ ] `validateSession()` — returns null for non-existent session
  - [ ] `deleteSession()` — removes from both stores
  - [ ] `deleteAllUserSessions()` — removes all sessions for a user
  - [ ] `enforceMaxSessions()` — evicts oldest when at capacity

- [ ] `jwt.strategy.spec.ts`
  - [ ] `validate()` — valid session returns payload
  - [ ] `validate()` — missing session throws UnauthorizedException

- [ ] `roles.guard.spec.ts`
  - [ ] Allows when user role matches @Roles()
  - [ ] Denies when user role does not match
  - [ ] Allows all when no @Roles() decorator

### Integration Tests (`apps/api/test/auth/`)

- [ ] `auth.e2e-spec.ts`
  - [ ] Full login → use token → logout → token rejected flow
  - [ ] Login → change password → all old tokens rejected
  - [ ] Concurrent session limit enforcement
  - [ ] Rate limiting on login (5 per minute)
  - [ ] Account lockout after 10 failures

---

## 2.26 Implementation Order

Execute in this sequence:

1. **RedisModule** — `apps/api/src/redis/redis.module.ts` + `redis.service.ts`
2. **ContextModule** — `apps/api/src/context/context.module.ts` + `async-context.service.ts`
3. **Interfaces** — `apps/api/src/auth/interfaces/*.ts`
4. **Constants** — `apps/api/src/auth/constants/auth.constants.ts` + `rbac-matrix.ts`
5. **DTOs** — `apps/api/src/auth/dto/*.ts`
6. **SessionModule** — `apps/api/src/session/session.module.ts` + `session.service.ts`
7. **Decorators** — `apps/api/src/auth/decorators/*.ts`
8. **JwtStrategy** — `apps/api/src/auth/strategies/jwt.strategy.ts`
9. **Guards** — `apps/api/src/auth/guards/*.ts`
10. **AuthService** — `apps/api/src/auth/auth.service.ts`
11. **AuthController** — `apps/api/src/auth/auth.controller.ts`
12. **AuthModule** — `apps/api/src/auth/auth.module.ts`
13. **ContextMiddleware** — `apps/api/src/context/context.middleware.ts`
14. **AppModule wiring** — register guards, middleware, imports
15. **Express type augmentation** — `apps/api/src/types/express.d.ts`
16. **Tests** — unit tests first, then e2e
