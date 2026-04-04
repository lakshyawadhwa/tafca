import { Module } from '@nestjs/common';
import { EngagementTypeModule } from '../engagement-type/engagement-type.module';
import { EngagementController } from './engagement.controller';
import { EngagementService } from './engagement.service';

@Module({
  imports: [EngagementTypeModule],
  controllers: [EngagementController],
  providers: [EngagementService],
  exports: [EngagementService],
})
export class EngagementModule {}
