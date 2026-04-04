import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
  default: async ({ request, fetch, cookies }) => {
    const formData = await request.formData();
    const firmName = (formData.get('firmName') as string)?.trim();
    const fullName = (formData.get('fullName') as string)?.trim();
    const email = (formData.get('email') as string)?.trim();
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    // Server-side validation
    if (!firmName || !fullName || !email || !password || !confirmPassword) {
      return fail(400, {
        error: 'All fields are required.',
        firmName,
        fullName,
        email,
      });
    }

    if (password.length < 8) {
      return fail(400, {
        error: 'Password must be at least 8 characters.',
        firmName,
        fullName,
        email,
      });
    }

    if (password !== confirmPassword) {
      return fail(400, {
        error: 'Passwords do not match.',
        firmName,
        fullName,
        email,
      });
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName, firmName }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        let message: string;

        switch (res.status) {
          case 409:
            message = body.message?.includes('firm')
              ? 'A firm with this name already exists.'
              : 'An account with this email already exists.';
            break;
          case 429:
            message = 'Too many attempts. Please wait a moment and try again.';
            break;
          default:
            message = body.message || 'Something went wrong on our end. Please try again in a few moments.';
        }

        return fail(res.status, { error: message, firmName, fullName, email });
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
        firmName,
        fullName,
        email,
      });
    }
  },
};
