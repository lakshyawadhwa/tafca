<script lang="ts">
	import { GripVertical } from 'lucide-svelte';
	import { StatusBadge } from '$lib/components/ui';

	type TaskCard = {
		id: string;
		title: string;
		status: string;
		priority: string;
		assignee?: { fullName: string } | null;
		dueDate?: string | null;
		checklistProgress?: { completed: number; total: number } | null;
		isBlocked?: boolean;
	};

	let { task }: { task: TaskCard } = $props();

	// Due date coloring — complete class strings for TailwindCSS v4
	const DUE_NORMAL = 'text-gray-500';
	const DUE_SOON = 'text-amber-600';
	const DUE_OVERDUE = 'text-red-600';

	let dueDateDisplay = $derived.by(() => {
		if (!task.dueDate) return null;
		const d = new Date(task.dueDate + 'T00:00:00');
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	});

	let dueDateClass = $derived.by(() => {
		if (!task.dueDate) return DUE_NORMAL;
		const now = new Date();
		now.setHours(0, 0, 0, 0);
		const due = new Date(task.dueDate + 'T00:00:00');
		const diffMs = due.getTime() - now.getTime();
		const diffDays = diffMs / (1000 * 60 * 60 * 24);
		if (diffDays < 0) return DUE_OVERDUE;
		if (diffDays <= 3) return DUE_SOON;
		return DUE_NORMAL;
	});

	let hasChecklist = $derived(
		task.checklistProgress && task.checklistProgress.total > 0
	);

	let checklistPercent = $derived.by(() => {
		if (!task.checklistProgress || task.checklistProgress.total === 0) return 0;
		return (task.checklistProgress.completed / task.checklistProgress.total) * 100;
	});
</script>

<a
	href="/tasks/{task.id}"
	class="block rounded-md border border-gray-200 bg-white p-3 cursor-grab hover:border-gray-300 hover:shadow-sm transition-all duration-150"
>
	<!-- Title -->
	<p class="text-sm font-semibold text-gray-900 line-clamp-2">{task.title}</p>

	<!-- Priority + Blocked badges -->
	<div class="mt-1.5 flex items-center gap-1.5 flex-wrap">
		<StatusBadge status={task.priority} type="priority" />
		{#if task.isBlocked}
			<span class="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
				Blocked
			</span>
		{/if}
	</div>

	<!-- Bottom row: Assignee, Due Date, Checklist -->
	<div class="flex items-center justify-between mt-2 text-xs text-gray-500">
		<span class="truncate max-w-[100px]">
			{#if task.assignee?.fullName}
				{task.assignee.fullName}
			{:else}
				<span class="italic">Unassigned</span>
			{/if}
		</span>

		{#if dueDateDisplay}
			<span class={dueDateClass}>{dueDateDisplay}</span>
		{/if}

		{#if hasChecklist}
			<span class="flex items-center gap-1">
				{task.checklistProgress?.completed}/{task.checklistProgress?.total}
				<span class="inline-block w-8 h-[3px] rounded-full bg-gray-200 overflow-hidden">
					<span
						class="block h-full rounded-full bg-green-600 transition-all duration-200"
						style="width: {checklistPercent}%"
					></span>
				</span>
			</span>
		{/if}
	</div>
</a>
