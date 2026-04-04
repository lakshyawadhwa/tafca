import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
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

	return { users };
};
