<script lang="ts">
	import { Plus } from 'lucide-svelte';
	import { Button, StatusBadge } from '$lib/components/ui';

	type Subtask = {
		id: string;
		title: string;
		status: string;
		priority: string;
		assignee?: { fullName: string } | null;
		dueDate?: string | null;
	};

	let {
		subtasks = [],
		parentTaskId
	}: {
		subtasks?: Subtask[];
		parentTaskId: string;
	} = $props();

	// Due date coloring
	const DUE_NORMAL = 'text-gray-500';
	const DUE_SOON = 'text-amber-600';
	const DUE_OVERDUE = 'text-red-600';

	function getDueDateClass(dueDate: string | null): string {
		if (!dueDate) return DUE_NORMAL;
		const now = new Date();
		now.setHours(0, 0, 0, 0);
		const due = new Date(dueDate + 'T00:00:00');
		const diffMs = due.getTime() - now.getTime();
		const diffDays = diffMs / (1000 * 60 * 60 * 24);
		if (diffDays < 0) return DUE_OVERDUE;
		if (diffDays <= 3) return DUE_SOON;
		return DUE_NORMAL;
	}

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return '';
		const d = new Date(dateStr + 'T00:00:00');
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}
</script>

<div>
	<!-- Section heading -->
	<div class="flex items-center gap-2 mb-2">
		<h3 class="text-sm font-semibold text-gray-900">Subtasks</h3>
		{#if subtasks.length > 0}
			<span class="text-xs text-gray-500">({subtasks.length})</span>
		{/if}
		<a href="/tasks/new?parentTaskId={parentTaskId}" class="ml-auto">
			<Button variant="secondary" size="sm">
				<Plus size={14} class="mr-1" />
				Add Subtask
			</Button>
		</a>
	</div>

	{#if subtasks.length === 0}
		<p class="text-sm text-gray-400">No subtasks</p>
	{:else}
		<div class="space-y-0">
			{#each subtasks as subtask (subtask.id)}
				<div class="flex items-center gap-3 py-2 border-b border-gray-100">
					<StatusBadge status={subtask.status} type="task" />
					<a
						href="/tasks/{subtask.id}"
						class="flex-1 truncate text-sm text-blue-600 hover:underline"
					>
						{subtask.title}
					</a>
					<span class="text-xs text-gray-500 shrink-0">
						{subtask.assignee?.fullName ?? ''}
					</span>
					{#if subtask.dueDate}
						<span class="text-xs shrink-0 {getDueDateClass(subtask.dueDate)}">
							{formatDate(subtask.dueDate)}
						</span>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
