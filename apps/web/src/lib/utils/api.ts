import { goto } from '$app/navigation';
import { getAccessToken, setAuth, clearAuth } from '$lib/stores/auth.svelte';

const API_BASE = '/api';

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    return data.accessToken ?? null;
  } catch {
    return null;
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE}${path}`;

  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getAccessToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  // On 401, attempt token refresh and retry once
  if (res.status === 401) {
    // Deduplicate concurrent refresh calls
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }

    const newToken = await refreshPromise;

    if (newToken) {
      // We need to refetch the user to update the store
      try {
        const meRes = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${newToken}` },
          credentials: 'include',
        });
        if (meRes.ok) {
          const user = await meRes.json();
          setAuth(newToken, user);
        }
      } catch {
        // Non-critical: store might have stale user, but token is valid
      }

      // Retry original request with new token
      headers.set('Authorization', `Bearer ${newToken}`);
      res = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
      });
    } else {
      clearAuth();
      await goto('/login');
      throw new Error('Session expired. Please sign in again.');
    }
  }

  if (!res.ok) {
    let errorBody: Record<string, unknown>;
    try {
      errorBody = await res.json();
    } catch {
      errorBody = { message: res.statusText, statusCode: res.status };
    }

    const error = new Error(
      (errorBody.message as string) ?? 'An unexpected error occurred',
    );
    (error as unknown as Record<string, unknown>).statusCode = res.status;
    (error as unknown as Record<string, unknown>).body = errorBody;
    throw error;
  }

  // Handle 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}
