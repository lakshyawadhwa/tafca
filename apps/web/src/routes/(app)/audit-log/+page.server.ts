import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, fetch }) => {
  const userId = url.searchParams.get('userId') ?? '';
  const entityType = url.searchParams.get('entityType') ?? '';
  const action = url.searchParams.get('action') ?? '';
  const from = url.searchParams.get('from') ?? '';
  const to = url.searchParams.get('to') ?? '';
  const pageNum = url.searchParams.get('page') ?? '1';
  const limit = url.searchParams.get('limit') ?? '25';

  const params = new URLSearchParams();
  params.set('page', pageNum);
  params.set('limit', limit);
  if (userId) params.set('userId', userId);
  if (entityType) params.set('entityType', entityType);
  if (action) params.set('action', action);
  if (from) params.set('from', from);
  if (to) params.set('to', to);

  const res = await fetch(`/api/audit-log?${params.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw error(res.status, body.message ?? 'Failed to load audit log');
  }

  const result = await res.json();

  // Also fetch users for the user filter picker
  let users: any[] = [];
  try {
    const usersRes = await fetch('/api/users');
    if (usersRes.ok) {
      const usersData = await usersRes.json();
      users = usersData.data ?? usersData ?? [];
    }
  } catch {
    // Non-critical
  }

  return {
    logs: result.data ?? [],
    meta: result.meta ?? { total: 0, page: 1, limit: 25, totalPages: 1 },
    filters: { userId, entityType, action, from, to },
    users,
  };
};
