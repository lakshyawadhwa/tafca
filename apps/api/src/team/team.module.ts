import { Module } from '@nestjs/common';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';
import { LeaveService } from './leave.service';

@Module({
  controllers: [TeamController],
  providers: [TeamService, LeaveService],
  exports: [TeamService, LeaveService],
})
export class TeamModule {}
