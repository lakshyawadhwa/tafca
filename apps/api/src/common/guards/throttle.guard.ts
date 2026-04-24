import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { RedisService } from '../services/redis.service';

export function createThrottleGuard(
  max: number,
  windowSeconds: number,
  keyPrefix: string,
): new (redis: RedisService) => CanActivate {
  @Injectable()
  class ThrottleGuard implements CanActivate {
    constructor(readonly redis: RedisService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
      // Tests spin up many accounts behind the same loopback IP; skip the
      // IP-throttle in NODE_ENV=test so e2e suites aren't fighting the guard.
      if (process.env.NODE_ENV === 'test') return true;

      const request = context.switchToHttp().getRequest();
      const ip =
        (request.headers['x-forwarded-for'] as string)
          ?.split(',')[0]
          ?.trim() || request.ip;
      const key = `${keyPrefix}${ip}`;

      const current = await this.redis.incr(key);
      if (current === 1) {
        await this.redis.expire(key, windowSeconds);
      }

      if (current > max) {
        throw new HttpException(
          'Too many requests. Please try again later.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      return true;
    }
  }

  return ThrottleGuard;
}

export const LoginThrottleGuard = createThrottleGuard(5, 60, 'rl:login:');
export const RegisterThrottleGuard = createThrottleGuard(3, 60, 'rl:register:');
