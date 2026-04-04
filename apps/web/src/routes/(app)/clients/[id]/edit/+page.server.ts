import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, fetch }) => {
	const clientRes = await fetch(`/api/clients/${params.id}`);
	if (!clientRes.ok) {
		const body = await clientRes.json().catch(() => ({}));
		throw error(clientRes.status, body.message ?? 'Client not found');
	}
	const client = await clientRes.json();

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

	return { client, users };
};
