import { UserRole } from '@ca-practice-os/shared';
import type { WorkloadStatus } from '@ca-practice-os/shared';

export class WorkloadUserDto {
  userId!: string;
  fullName!: string;
  role!: UserRole;
  avatarUrl!: string | null;
  openTaskCount!: number;
  overdueTaskCount!: number;
  dueThisWeekCount!: number;
  loadStatus!: WorkloadStatus;
}

export class WorkloadResponseDto {
  data!: WorkloadUserDto[];
  firmAverage!: number;
}
