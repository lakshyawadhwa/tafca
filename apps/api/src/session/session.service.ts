import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/services/redis.service';
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
   * Enforces MAX_SESSIONS_PER_USER -- if exceeded, the oldest session is revoked.
   *
   * Returns the session ID (UUID).
   */
  async createSession(params: {
    id?: string;
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

    // Create session in PostgreSQL (use unscoped -- Session is a global model)
    const sessionData: any = {
      userId,
      tokenHash,
      expiresAt,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
    };

    // If explicit ID provided (for pre-generated sessionId in JWT), use it
    if (params.id) {
      sessionData.id = params.id;
    }

    const session = await this.prisma.unscoped.session.create({
      data: sessionData,
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
      // Expired -- clean up
      await this.redis.del(redisKey);
      await this.prisma.unscoped.session
        .delete({ where: { id: sessionId } })
        .catch(() => {});
      return null;
    }

    // 2. Cache miss -- check PostgreSQL
    const session = await this.prisma.unscoped.session.findUnique({
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
      await this.prisma.unscoped.session.delete({
        where: { id: sessionId },
      });
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

    this.logger.debug(
      `Session ${sessionId} repopulated in Redis from PostgreSQL`,
    );
    return cacheData;
  }

  /**
   * Delete a single session (logout).
   */
  async deleteSession(sessionId: string): Promise<void> {
    const redisKey = `${AUTH_CONSTANTS.SESSION_PREFIX}${sessionId}`;

    // Delete from both stores in parallel
    await Promise.all([
      this.prisma.unscoped.session
        .delete({ where: { id: sessionId } })
        .catch(() => {}),
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
    const sessions = await this.prisma.unscoped.session.findMany({
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
    await this.prisma.unscoped.session.deleteMany({ where: { userId } });

    this.logger.log(
      `All sessions deleted for user ${userId} (${sessions.length} sessions)`,
    );
  }

  /**
   * Enforce max concurrent sessions.
   * If user has >= MAX_SESSIONS_PER_USER, delete the oldest session.
   */
  private async enforceMaxSessions(userId: string): Promise<void> {
    const sessions = await this.prisma.unscoped.session.findMany({
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
