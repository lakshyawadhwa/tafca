import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, fetch }) => {
	const page = url.searchParams.get('page') ?? '1';
	const search = url.searchParams.get('search') ?? '';
	const clientId = url.searchParams.get('clientId') ?? '';
	const engagementTypeId = url.searchParams.get('engagementTypeId') ?? '';
	const status = url.searchParams.get('status') ?? '';

	const params = new URLSearchParams();
	params.set('page', page);
	params.set('limit', '10');
	if (search) params.set('search', search);
	if (clientId) params.set('clientId', clientId);
	if (engagementTypeId) params.set('engagementTypeId', engagementTypeId);
	if (status) params.set('status', status);

	const res = await fetch(`/api/engagements?${params.toString()}`);
	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		throw error(res.status, body.message ?? 'Failed to load engagements');
	}
	const result = await res.json();

	// Fetch engagement types for filter dropdown
	let engagementTypes: any[] = [];
	try {
		const typesRes = await fetch('/api/engagement-types');
		if (typesRes.ok) {
			engagementTypes = await typesRes.json();
		}
	} catch {
		// Non-critical
	}

	// Fetch clients for filter + create modal
	let clients: any[] = [];
	try {
		const clientsRes = await fetch('/api/clients?limit=100');
		if (clientsRes.ok) {
			const clientsData = await clientsRes.json();
			clients = (clientsData.data ?? []).map((c: any) => ({
				id: c.id,
				displayName: c.displayName,
				status: c.status,
			}));
		}
	} catch {
		// Non-critical
	}

	return {
		engagements: result.data ?? [],
		meta: result.meta ?? { total: 0, page: 1, limit: 10, totalPages: 1 },
		filters: { search, clientId, engagementTypeId, status },
		engagementTypes,
		clients,
	};
};
