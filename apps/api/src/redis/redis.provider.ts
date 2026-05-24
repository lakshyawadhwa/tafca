import { Provider } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: (configService: ConfigService) => {
    const url = configService.get<string>('REDIS_URL');
    if (url) {
      return new Redis(url, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });
    }
    return new Redis({
      host: configService.get<string>('REDIS_HOST', 'localhost'),
      port: configService.get<number>('REDIS_PORT', 6379),
      password: configService.get<string>('REDIS_PASSWORD', ''),
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  },
  inject: [ConfigService],
};
