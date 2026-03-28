import { UserRole } from '@ca-practice-os/shared';

export class MeResponseDto {
  id!: string;
  email!: string;
  fullName!: string;
  role!: UserRole;
  firmId!: string;
  firmName!: string;
  avatarUrl!: string | null;
  phone!: string | null;
  whatsappNumber!: string | null;
  notificationPreferences!: Record<string, unknown>;
  lastLoginAt!: string | null;
  createdAt!: string;
}
