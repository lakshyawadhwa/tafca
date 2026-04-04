import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, fetch }) => {
	// Pre-fill params from URL
	const clientId = url.searchParams.get('clientId') ?? '';
	const engagementId = url.searchParams.get('engagementId') ?? '';
	const parentTaskId = url.searchParams.get('parentTaskId') ?? '';

	// Load users for pickers
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

	// Load clients for picker
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

	// Load engagements
	let engagements: any[] = [];
	try {
		const engRes = await fetch('/api/engagements?limit=200');
		if (engRes.ok) {
			const engData = await engRes.json();
			engagements = engData.data ?? engData ?? [];
		}
	} catch {
		// Non-critical
	}

	const prefill: Record<string, string> = {};
	if (clientId) prefill.clientId = clientId;
	if (engagementId) prefill.engagementId = engagementId;
	if (parentTaskId) prefill.parentTaskId = parentTaskId;

	return {
		users,
		clients,
		engagements,
		prefill: Object.keys(prefill).length > 0 ? prefill : undefined,
	};
};
