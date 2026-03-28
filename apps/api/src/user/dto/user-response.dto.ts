import { UserRole } from '@ca-practice-os/shared';

export class UserResponseDto {
  id!: string;
  email!: string;
  fullName!: string;
  role!: UserRole;
  phone!: string | null;
  isActive!: boolean;
  avatarUrl!: string | null;
  lastLoginAt!: string | null;
  createdAt!: string;
}

export class PaginatedUsersResponseDto {
  data!: UserResponseDto[];
  meta!: { total: number; page: number; limit: number; totalPages: number };
}

export class DeactivateUserResponseDto {
  user!: { id: string; isActive: boolean };
  openTasksCount!: number;
}
