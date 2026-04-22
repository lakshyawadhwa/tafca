import type { UserRole } from '@ca-practice-os/shared';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  firmId: string;
  firmName: string;
  avatarUrl?: string;
}

const TOKEN_KEY = 'ca_access_token';
const USER_KEY = 'ca_user';

function loadStoredToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

function loadStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

let accessToken = $state<string | null>(loadStoredToken());
let user = $state<AuthUser | null>(loadStoredUser());

export function getAccessToken() {
  return accessToken;
}

export function getUser() {
  return user;
}

export function isAuthenticated() {
  return !!accessToken && !!user;
}

export function setAuth(token: string, userData: AuthUser) {
  accessToken = token;
  user = userData;
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
  } catch {
    // localStorage full or unavailable — auth still works in-memory for this session
  }
}

export function clearAuth() {
  accessToken = null;
  user = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // best effort
  }
}
