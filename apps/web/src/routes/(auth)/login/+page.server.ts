import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
  default: async ({ request, fetch, cookies }) => {
    const formData = await request.formData();
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (!email || !password) {
      return fail(400, {
        error: 'Email and password are required.',
        email,
      });
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        let message: string;

        switch (res.status) {
          case 401:
            message = 'Invalid email or password. Please try again.';
            break;
          case 403:
            message = 'Your account has been deactivated. Contact your firm administrator.';
            break;
          case 429:
            message = 'Too many attempts. Please wait a moment and try again.';
            break;
          default:
            message = body.message || 'Something went wrong on our end. Please try again in a few moments.';
        }

        return fail(res.status, { error: message, email });
      }

      const data = await res.json();

      // Set the access_token cookie for SSR auth
      cookies.set('access_token', data.accessToken, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 14 * 60, // 14 minutes
      });

      return { success: true, accessToken: data.accessToken, user: data.user };
    } catch {
      return fail(500, {
        error: 'Unable to connect to the server. Check your internet connection and try again.',
        email,
      });
    }
  },
};
