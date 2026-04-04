import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, fetch }) => {
	// Load task detail
	const taskRes = await fetch(`/api/tasks/${params.id}`);
	if (!taskRes.ok) {
		const body = await taskRes.json().catch(() => ({}));
		throw error(taskRes.status, body.message ?? 'Task not found');
	}
	const task = await taskRes.json();

	// Parallel fetch all sub-resources
	const [checklistRes, dependenciesRes, commentsRes, activityRes, usersRes] = await Promise.all([
		fetch(`/api/tasks/${params.id}/checklist`).catch(() => null),
		fetch(`/api/tasks/${params.id}/dependencies`).catch(() => null),
		fetch(`/api/tasks/${params.id}/comments?page=1&limit=20`).catch(() => null),
		fetch(`/api/tasks/${params.id}/activity?page=1&limit=20`).catch(() => null),
		fetch('/api/users').catch(() => null),
	]);

	let checklist: any[] = [];
	if (checklistRes?.ok) {
		const checklistData = await checklistRes.json();
		checklist = checklistData.data ?? checklistData ?? [];
	}

	let dependencies = { blockedBy: [] as any[], blocking: [] as any[] };
	if (dependenciesRes?.ok) {
		const depsData = await dependenciesRes.json();
		dependencies = depsData ?? dependencies;
	}

	let comments: any[] = [];
	let commentsMeta = { total: 0, page: 1, limit: 20, totalPages: 1 };
	if (commentsRes?.ok) {
		const commentsData = await commentsRes.json();
		comments = commentsData.data ?? [];
		commentsMeta = commentsData.meta ?? commentsMeta;
	}

	let activity: any[] = [];
	let activityMeta = { total: 0, page: 1, limit: 20, totalPages: 1 };
	if (activityRes?.ok) {
		const activityData = await activityRes.json();
		activity = activityData.data ?? [];
		activityMeta = activityData.meta ?? activityMeta;
	}

	let users: any[] = [];
	if (usersRes?.ok) {
		const usersData = await usersRes.json();
		users = usersData.data ?? usersData ?? [];
	}

	// Load subtasks if task has subtaskCount > 0 and is not itself a subtask
	let subtasks: any[] = [];
	if (task.subtaskCount > 0 || !task.parentTaskId) {
		try {
			const subtasksRes = await fetch(`/api/tasks?parentTaskId=${params.id}&limit=50`);
			if (subtasksRes.ok) {
				const subtasksData = await subtasksRes.json();
				subtasks = subtasksData.data ?? [];
			}
		} catch {
			// Non-critical
		}
	}

	return {
		task,
		checklist,
		dependencies,
		comments,
		commentsMeta,
		activity,
		activityMeta,
		users,
		subtasks,
	};
};
