import { Module } from '@nestjs/common';
import { ActionLogController } from './action-log.controller';
import { ActionLogService } from './action-log.service';
import { ActionLogInterceptor } from './action-log.interceptor';

@Module({
  controllers: [ActionLogController],
  providers: [ActionLogService, ActionLogInterceptor],
  exports: [ActionLogService, ActionLogInterceptor],
})
export class ActionLogModule {}
