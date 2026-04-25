import { getAccessToken, clearAuth } from './auth.svelte';
import { navigate } from './router.svelte';
import { addToast } from './toast.svelte';

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: any,
  ) {
    super(body?.message ?? `Request failed with status ${status}`);
  }
}

let lockoutUntil = 0;

export function getLockoutRemainingMs(): number {
  return Math.max(0, lockoutUntil - Date.now());
}

export async function api<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  // 429 lockout: short-circuit before even hitting the network
  if (Date.now() < lockoutUntil) {
    throw new ApiError(429, { message: 'Too many requests' });
  }

  const token = getAccessToken();
  const headers = new Headers(options.headers);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`/api${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  // 401 = session dead (expired or revoked). Clear and redirect.
  if (res.status === 401) {
    clearAuth();
    navigate('/login');
    throw new ApiError(401, { message: 'Session expired' });
  }

  if (res.status === 429) {
    lockoutUntil = Date.now() + 5_000;
    addToast('Too many requests — wait 5s', 'error');
    throw new ApiError(429, { message: 'Too many requests' });
  }

  if (res.status === 204) return undefined as T;

  const body = await res.json();
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}
