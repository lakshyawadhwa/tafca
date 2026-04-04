import { Module } from '@nestjs/common';
import { EngagementTypeController } from './engagement-type.controller';
import { EngagementTypeService } from './engagement-type.service';

@Module({
  controllers: [EngagementTypeController],
  providers: [EngagementTypeService],
  exports: [EngagementTypeService],
})
export class EngagementTypeModule {}
