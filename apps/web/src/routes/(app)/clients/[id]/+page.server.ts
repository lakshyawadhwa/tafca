import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url, fetch }) => {
	const clientRes = await fetch(`/api/clients/${params.id}`);
	if (!clientRes.ok) {
		const body = await clientRes.json().catch(() => ({}));
		throw error(clientRes.status, body.message ?? 'Client not found');
	}
	const client = await clientRes.json();

	// Load engagements for this client
	let engagements: any[] = [];
	let engagementsMeta = { total: 0, page: 1, limit: 10, totalPages: 1 };
	try {
		const engRes = await fetch(`/api/engagements?clientId=${params.id}&limit=50`);
		if (engRes.ok) {
			const engData = await engRes.json();
			engagements = engData.data ?? [];
			engagementsMeta = engData.meta ?? engagementsMeta;
		}
	} catch {
		// Non-critical
	}

	// Load users for team pickers / inline edit
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

	// Load engagement types for create modal
	let engagementTypes: any[] = [];
	try {
		const typesRes = await fetch('/api/engagement-types');
		if (typesRes.ok) {
			engagementTypes = await typesRes.json();
		}
	} catch {
		// Non-critical
	}

	// Load clients list for engagement create modal
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

	const activeTab = url.searchParams.get('tab') ?? 'overview';

	return {
		client,
		engagements,
		engagementsMeta,
		users,
		engagementTypes,
		clients,
		activeTab,
	};
};
