import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.provider';
import Redis from 'ioredis';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async check(): Promise<{
    status: 'ok' | 'degraded' | 'down';
    checks: {
      database: { status: 'up' | 'down'; latency_ms?: number; error?: string };
      redis: { status: 'up' | 'down'; latency_ms?: number; error?: string };
    };
    timestamp: string;
  }> {
    const dbCheck = await this.checkDatabase();
    const redisCheck = await this.checkRedis();

    const allUp = dbCheck.status === 'up' && redisCheck.status === 'up';
    const allDown = dbCheck.status === 'down' && redisCheck.status === 'down';

    return {
      status: allUp ? 'ok' : allDown ? 'down' : 'degraded',
      checks: {
        database: dbCheck,
        redis: redisCheck,
      },
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<{
    status: 'up' | 'down';
    latency_ms?: number;
    error?: string;
  }> {
    const start = Date.now();
    try {
      await this.prisma.unscoped.$queryRawUnsafe('SELECT 1');
      return { status: 'up', latency_ms: Date.now() - start };
    } catch (err) {
      return {
        status: 'down',
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  private async checkRedis(): Promise<{
    status: 'up' | 'down';
    latency_ms?: number;
    error?: string;
  }> {
    const start = Date.now();
    try {
      const pong = await this.redis.ping();
      return {
        status: pong === 'PONG' ? 'up' : 'down',
        latency_ms: Date.now() - start,
      };
    } catch (err) {
      return {
        status: 'down',
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }
}
