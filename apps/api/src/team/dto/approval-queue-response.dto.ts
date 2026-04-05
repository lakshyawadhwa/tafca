import { TaskPriority } from '@ca-practice-os/shared';

export class ApprovalQueueItemDto {
  id!: string;
  title!: string;
  clientName!: string | null;
  dueDate!: string | null;
  priority!: TaskPriority;
  assigneeName!: string | null;
}

export class PaginatedApprovalQueueResponseDto {
  data!: ApprovalQueueItemDto[];
  meta!: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
