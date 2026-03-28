import { Global, Module } from '@nestjs/common';
import { redisProvider, REDIS_CLIENT } from './redis.provider';
import { RedisService } from '../common/services/redis.service';

@Global()
@Module({
  providers: [redisProvider, RedisService],
  exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule {}
