import {
  EngagementStatus,
  EngagementCategory,
  RecurrenceType,
} from '@ca-practice-os/shared';

export class EngagementResponseDto {
  id!: string;
  name!: string;
  status!: EngagementStatus;
  periodLabel!: string | null;
  periodStart!: string | null;
  periodEnd!: string | null;
  assignedPartnerId!: string | null;
  assignedManagerId!: string | null;
  assignedTeam!: string[];
  feeAmount!: number | null;
  feeCurrency!: string;
  notes!: string | null;
  completedAt!: string | null;
  createdAt!: string;
  updatedAt!: string;

  client!: {
    id: string;
    displayName: string;
  };

  engagementType!: {
    id: string;
    name: string;
    code: string;
    category: EngagementCategory;
    recurrence: RecurrenceType;
  };

  taskProgress!: {
    total: number;
    done: number;
  };

  tasksCreated?: number;
}

export class PaginatedEngagementsResponseDto {
  data!: EngagementResponseDto[];
  meta!: { total: number; page: number; limit: number; totalPages: number };
}
