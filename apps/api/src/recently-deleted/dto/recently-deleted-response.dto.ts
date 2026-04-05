export interface RecentlyDeletedItemDto {
  entityType: string;
  entityId: string;
  name: string;
  deletedAt: Date;
  deletedByName: string;
  daysRemaining: number;
}

export interface RecentlyDeletedResponseDto {
  data: RecentlyDeletedItemDto[];
}
