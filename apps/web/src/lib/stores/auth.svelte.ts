import type { UserRole } from '@ca-practice-os/shared';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  firmId: string;
  firmName: string;
  avatarUrl: string | null;
}

const authState = $state<{ accessToken: string | null; user: AuthUser | null }>({
  accessToken: null,
  user: null,
});

export function getAccessToken(): string | null {
  return authState.accessToken;
}

export function getUser(): AuthUser | null {
  return authState.user;
}

export function setAuth(token: string, user: AuthUser): void {
  authState.accessToken = token;
  authState.user = user;
}

export function clearAuth(): void {
  authState.accessToken = null;
  authState.user = null;
}
