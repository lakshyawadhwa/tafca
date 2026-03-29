export class ActionLogEntryDto {
  id!: string;
  user!: { id: string; fullName: string };
  action!: string;
  entityType!: string;
  entityId!: string | null;
  metadata!: Record<string, unknown>;
  ipAddress!: string | null;
  occurredAt!: string;
}

export class PaginatedActionLogResponseDto {
  data!: ActionLogEntryDto[];
  meta!: { total: number; page: number; limit: number; totalPages: number };
}
