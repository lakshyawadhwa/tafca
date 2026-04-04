import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, fetch }) => {
	const page = url.searchParams.get('page') ?? '1';
	const limit = url.searchParams.get('limit') ?? '10';
	const search = url.searchParams.get('search') ?? '';
	const assigneeId = url.searchParams.get('assigneeId') ?? '';
	const clientId = url.searchParams.get('clientId') ?? '';
	const engagementId = url.searchParams.get('engagementId') ?? '';
	const status = url.searchParams.get('status') ?? '';
	const priority = url.searchParams.get('priority') ?? '';
	const dueDateFrom = url.searchParams.get('dueDateFrom') ?? '';
	const dueDateTo = url.searchParams.get('dueDateTo') ?? '';
	const overdue = url.searchParams.get('overdue') ?? '';
	const sortBy = url.searchParams.get('sortBy') ?? '';
	const sortOrder = url.searchParams.get('sortOrder') ?? '';
	const view = url.searchParams.get('view') ?? 'table';

	const params = new URLSearchParams();
	params.set('page', page);
	params.set('limit', limit);
	if (search) params.set('search', search);
	if (assigneeId) params.set('assigneeId', assigneeId);
	if (clientId) params.set('clientId', clientId);
	if (engagementId) params.set('engagementId', engagementId);
	if (status) params.set('status', status);
	if (priority) params.set('priority', priority);
	if (dueDateFrom) params.set('dueDateFrom', dueDateFrom);
	if (dueDateTo) params.set('dueDateTo', dueDateTo);
	if (overdue) params.set('overdue', overdue);
	if (sortBy) params.set('sortBy', sortBy);
	if (sortOrder) params.set('sortOrder', sortOrder);

	const res = await fetch(`/api/tasks?${params.toString()}`);
	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		throw error(res.status, body.message ?? 'Failed to load tasks');
	}

	const result = await res.json();

	// Fetch users for assignee filter
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

	// Fetch clients for client filter
	let clients: any[] = [];
	try {
		const clientsRes = await fetch('/api/clients?limit=200');
		if (clientsRes.ok) {
			const clientsData = await clientsRes.json();
			clients = clientsData.data ?? clientsData ?? [];
		}
	} catch {
		// Non-critical
	}

	// Fetch engagements (optionally filtered by client)
	let engagements: any[] = [];
	try {
		const engParams = new URLSearchParams({ limit: '200' });
		if (clientId) engParams.set('clientId', clientId);
		const engRes = await fetch(`/api/engagements?${engParams.toString()}`);
		if (engRes.ok) {
			const engData = await engRes.json();
			engagements = engData.data ?? engData ?? [];
		}
	} catch {
		// Non-critical
	}

	return {
		tasks: result.data ?? [],
		meta: result.meta ?? { total: 0, page: 1, limit: 10, totalPages: 1 },
		filters: {
			search,
			assigneeId,
			clientId,
			engagementId,
			status,
			priority,
			dueDateFrom,
			dueDateTo,
			overdue,
			sortBy,
			sortOrder,
		},
		users,
		clients,
		engagements,
		view,
	};
};
