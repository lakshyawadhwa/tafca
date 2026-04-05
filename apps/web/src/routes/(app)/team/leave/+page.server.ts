import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, fetch, parent }) => {
  const parentData = await parent();
  const userRole = parentData.user?.role;

  const status = url.searchParams.get('status') ?? '';
  const pageNum = url.searchParams.get('page') ?? '1';

  const params = new URLSearchParams();
  params.set('page', pageNum);
  params.set('limit', '20');
  if (status) params.set('status', status);

  const res = await fetch(`/api/team/leave?${params.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw error(res.status, body.message ?? 'Failed to load leave records');
  }

  const result = await res.json();

  // Fetch pending count for approvals tab badge (Partner/Manager only)
  let pendingCount = 0;
  if (userRole === 'PARTNER' || userRole === 'MANAGER') {
    try {
      const pendingRes = await fetch('/api/team/leave?status=PENDING&limit=1');
      if (pendingRes.ok) {
        const pendingData = await pendingRes.json();
        pendingCount = pendingData.meta?.total ?? 0;
      }
    } catch {
      // Non-critical
    }
  }

  return {
    leaves: result.data ?? [],
    leavesMeta: result.meta ?? { total: 0, page: 1, limit: 20, totalPages: 1 },
    pendingCount,
    userRole,
  };
};
