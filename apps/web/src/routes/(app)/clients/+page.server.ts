import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, fetch }) => {
	const page = url.searchParams.get('page') ?? '1';
	const search = url.searchParams.get('search') ?? '';
	const status = url.searchParams.get('status') ?? '';
	const entityType = url.searchParams.get('entityType') ?? '';
	const assignedPartnerId = url.searchParams.get('assignedPartnerId') ?? '';

	const params = new URLSearchParams();
	params.set('page', page);
	params.set('limit', '10');
	if (search) params.set('search', search);
	if (status) params.set('status', status);
	if (entityType) params.set('entityType', entityType);
	if (assignedPartnerId) params.set('assignedPartnerId', assignedPartnerId);

	const res = await fetch(`/api/clients?${params.toString()}`);
	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		throw error(res.status, body.message ?? 'Failed to load clients');
	}

	const result = await res.json();

	// Also fetch users for partner filter
	let users: any[] = [];
	try {
		const usersRes = await fetch('/api/users');
		if (usersRes.ok) {
			const usersData = await usersRes.json();
			users = usersData.data ?? usersData ?? [];
		}
	} catch {
		// Non-critical: filter will work without users
	}

	return {
		clients: result.data ?? [],
		meta: result.meta ?? { total: 0, page: 1, limit: 10, totalPages: 1 },
		filters: { search, status, entityType, assignedPartnerId },
		users,
	};
};
