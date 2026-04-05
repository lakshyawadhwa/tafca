import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, fetch }) => {
  const entityType = url.searchParams.get('entityType') ?? '';

  const params = new URLSearchParams();
  if (entityType) params.set('entityType', entityType);

  const res = await fetch(`/api/recently-deleted?${params.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw error(res.status, body.message ?? 'Failed to load recently deleted items');
  }

  const result = await res.json();

  return {
    items: result.data ?? [],
    currentFilter: entityType,
  };
};
