import { LeaveType, LeaveStatus } from '@ca-practice-os/shared';

export class LeaveDto {
  id!: string;
  userId!: string;
  userName!: string;
  leaveType!: LeaveType;
  startDate!: string;
  endDate!: string;
  isHalfDay!: boolean;
  reason!: string | null;
  status!: LeaveStatus;
  approvedBy!: string | null;
  approvedByName!: string | null;
  approvedAt!: string | null;
  createdAt!: string;
}

export class PaginatedLeaveResponseDto {
  data!: LeaveDto[];
  meta!: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
