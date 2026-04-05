import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
  const res = await fetch('/api/team/workload');
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw error(res.status, body.message ?? 'Failed to load team workload');
  }

  const result = await res.json();

  return {
    workload: result.data ?? [],
    firmAverage: result.firmAverage ?? 0,
  };
};
