import { UserRole } from '@ca-practice-os/shared';

export class LoginUserDto {
  id!: string;
  email!: string;
  fullName!: string;
  role!: UserRole;
  firmId!: string;
  firmName!: string;
  avatarUrl!: string | null;
}

export class LoginResponseDto {
  accessToken!: string;
  user!: LoginUserDto;
}
