import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';

const PUBLIC_PATHS = ['/login', '/register'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

const authGuard: Handle = async ({ event, resolve }) => {
  const { pathname } = event.url;
  const accessToken = event.cookies.get('access_token');

  // For public paths, check if user is already authenticated and redirect to /
  if (isPublicPath(pathname)) {
    if (accessToken) {
      try {
        const meRes = await event.fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (meRes.ok) {
          throw redirect(303, '/');
        }
      } catch (err) {
        // Re-throw redirects
        if (err && typeof err === 'object' && 'status' in err) {
          throw err;
        }
        // Token invalid, let them access the public page
      }
    }
    return resolve(event);
  }

  // Protected path: try to authenticate
  if (accessToken) {
    try {
      const meRes = await event.fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (meRes.ok) {
        const user = await meRes.json();
        event.locals.accessToken = accessToken;
        event.locals.user = {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          firmId: user.firmId,
          firmName: user.firmName,
          avatarUrl: user.avatarUrl ?? null,
        };
        return resolve(event);
      }
    } catch (err) {
      if (err && typeof err === 'object' && 'status' in err) {
        throw err;
      }
      // Token might be expired, fall through to refresh
    }
  }

  // Try to refresh the token
  try {
    const refreshRes = await event.fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (refreshRes.ok) {
      const { accessToken: newToken } = await refreshRes.json();

      // Set the new access token cookie
      event.cookies.set('access_token', newToken, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 14 * 60, // 14 minutes (slightly less than 15m JWT expiry)
      });

      // Fetch user profile with new token
      const meRes = await event.fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${newToken}` },
      });

      if (meRes.ok) {
        const user = await meRes.json();
        event.locals.accessToken = newToken;
        event.locals.user = {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          firmId: user.firmId,
          firmName: user.firmName,
          avatarUrl: user.avatarUrl ?? null,
        };
        return resolve(event);
      }
    }
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    // Refresh failed, redirect to login
  }

  // All auth attempts failed
  throw redirect(303, '/login');
};

export const handle = sequence(authGuard);
