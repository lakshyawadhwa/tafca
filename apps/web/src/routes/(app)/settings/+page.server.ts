import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, fetch }) => {
  // Fetch firm settings
  const settingsRes = await fetch('/api/firms/settings');
  if (!settingsRes.ok) {
    const body = await settingsRes.json().catch(() => ({}));
    throw error(settingsRes.status, body.message ?? 'Failed to load settings');
  }
  const settings = await settingsRes.json();

  // Fetch users for users tab
  const usersPage = url.searchParams.get('usersPage') ?? '1';
  const usersParams = new URLSearchParams();
  usersParams.set('page', usersPage);
  usersParams.set('limit', '20');

  let users: any[] = [];
  let usersMeta = { total: 0, page: 1, limit: 20, totalPages: 1 };
  try {
    const usersRes = await fetch(`/api/users?${usersParams.toString()}`);
    if (usersRes.ok) {
      const usersData = await usersRes.json();
      users = usersData.data ?? usersData ?? [];
      usersMeta = usersData.meta ?? usersMeta;
    }
  } catch {
    // Non-critical
  }

  // Fetch engagement types for approval config
  let engagementTypes: any[] = [];
  try {
    const etRes = await fetch('/api/engagement-types');
    if (etRes.ok) {
      const etData = await etRes.json();
      engagementTypes = etData.data ?? etData ?? [];
    }
  } catch {
    // Non-critical
  }

  return {
    settings,
    users,
    usersMeta,
    engagementTypes,
  };
};
