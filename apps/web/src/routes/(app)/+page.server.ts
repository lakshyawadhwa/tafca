import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
  const res = await fetch('/api/dashboard');
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw error(res.status, body.message ?? 'Failed to load dashboard');
  }

  const dashboard = await res.json();

  return {
    dashboard,
  };
};
