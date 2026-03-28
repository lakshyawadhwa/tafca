import { UserRole } from '@ca-practice-os/shared';

export class RegisterResponseDto {
  accessToken!: string;
  user!: { id: string; email: string; fullName: string; role: UserRole; firmId: string };
  firm!: { id: string; name: string; displayName: string | null };
}
