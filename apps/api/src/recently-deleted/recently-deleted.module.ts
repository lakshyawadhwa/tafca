import { Module } from '@nestjs/common';
import { RecentlyDeletedService } from './recently-deleted.service';
import { RecentlyDeletedController } from './recently-deleted.controller';

@Module({
  controllers: [RecentlyDeletedController],
  providers: [RecentlyDeletedService],
})
export class RecentlyDeletedModule {}
