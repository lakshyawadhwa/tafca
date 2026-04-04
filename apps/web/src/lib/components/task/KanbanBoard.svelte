<script lang="ts">
	import { dndzone, TRIGGERS, SOURCES } from 'svelte-dnd-action';
	import { TASK_STATUS_TRANSITIONS, TaskStatus } from '@ca-practice-os/shared';
	import { addToast } from '$lib/stores/toast.svelte';
	import KanbanCard from './KanbanCard.svelte';
	import { StatusBadge } from '$lib/components/ui';

	type TaskItem = {
		id: string;
		title: string;
		status: string;
		priority: string;
		assignee?: { fullName: string } | null;
		dueDate?: string | null;
		checklistProgress?: { completed: number; total: number } | null;
		isBlocked?: boolean;
		_originalStatus?: string;
	};

	let {
		tasks,
		onStatusChange,
		loading = false
	}: {
		tasks: TaskItem[];
		onStatusChange: (taskId: string, newStatus: string) => Promise<void>;
		loading?: boolean;
	} = $props();

	// Column order — CANCELLED omitted per CONTEXT.md
	const COLUMN_ORDER: string[] = [
		TaskStatus.TO_DO,
		TaskStatus.IN_PROGRESS,
		TaskStatus.AWAITING_CLIENT,
		TaskStatus.UNDER_REVIEW,
		TaskStatus.PARTNER_APPROVAL,
		TaskStatus.DONE
	];

	const STATUS_LABELS: Record<string, string> = {
		TO_DO: 'To Do',
		IN_PROGRESS: 'In Progress',
		AWAITING_CLIENT: 'Awaiting Client',
		UNDER_REVIEW: 'Under Review',
		PARTNER_APPROVAL: 'Partner Approval',
		DONE: 'Done'
	};

	// Group tasks into columns with _originalStatus for revert tracking
	let columns = $state<Record<string, TaskItem[]>>({});

	// Snapshot for revert on error
	let columnsSnapshot: Record<string, TaskItem[]> | null = null;

	// Rebuild columns when tasks prop changes
	$effect(() => {
		const grouped: Record<string, TaskItem[]> = {};
		for (const status of COLUMN_ORDER) {
			grouped[status] = [];
		}
		for (const task of tasks) {
			const status = task.status;
			if (grouped[status]) {
				grouped[status].push({ ...task, _originalStatus: status });
			}
		}
		columns = grouped;
	});

	function saveSnapshot() {
		columnsSnapshot = {};
		for (const status of COLUMN_ORDER) {
			columnsSnapshot[status] = [...(columns[status] ?? [])];
		}
	}

	function restoreSnapshot() {
		if (columnsSnapshot) {
			columns = columnsSnapshot;
			columnsSnapshot = null;
		}
	}

	function handleConsider(status: string, e: CustomEvent<{ items: TaskItem[] }>) {
		columns[status] = e.detail.items;
	}

	async function handleFinalize(status: string, e: CustomEvent<{ items: TaskItem[]; info: { id: string; trigger: string; source: string } }>) {
		const items = e.detail.items;
		const info = e.detail.info;

		// Find the moved item (the one whose _originalStatus differs from target column)
		const movedItem = items.find((item) => item._originalStatus && item._originalStatus !== status);

		if (!movedItem) {
			// No cross-column move, just reorder within same column
			columns[status] = items;
			return;
		}

		// Save snapshot before any changes
		saveSnapshot();
		columns[status] = items;

		const originalStatus = movedItem._originalStatus!;
		const targetStatus = status;

		// Client-side pre-validation
		const allowed = TASK_STATUS_TRANSITIONS[originalStatus as TaskStatus] ?? [];
		if (!allowed.includes(targetStatus as TaskStatus)) {
			const allowedLabels = allowed.map((s: string) => STATUS_LABELS[s] ?? s).join(', ');
			addToast(
				`Cannot move to ${STATUS_LABELS[targetStatus] ?? targetStatus}. Allowed: ${allowedLabels || 'none'}.`,
				'error'
			);
			restoreSnapshot();
			return;
		}

		// Call API for status change
		try {
			await onStatusChange(movedItem.id, targetStatus);
			// Update _originalStatus on success
			const idx = columns[status].findIndex((t) => t.id === movedItem.id);
			if (idx >= 0) {
				columns[status][idx] = { ...columns[status][idx], _originalStatus: targetStatus };
			}
			columnsSnapshot = null;
		} catch (err: any) {
			addToast(err.message ?? 'Failed to update task status', 'error');
			restoreSnapshot();
		}
	}

	const flipDurationMs = 200;
</script>

{#if loading}
	<div class="flex gap-4 overflow-x-auto pb-4">
		{#each COLUMN_ORDER as _}
			<div class="min-w-[280px] max-w-[320px] flex-shrink-0 rounded-lg bg-gray-100 p-3">
				<div class="mb-3 h-6 w-24 animate-pulse rounded bg-gray-200"></div>
				<div class="space-y-2">
					{#each Array(3) as _}
						<div class="h-24 animate-pulse rounded-md bg-gray-200"></div>
					{/each}
				</div>
			</div>
		{/each}
	</div>
{:else}
	<div class="flex gap-4 overflow-x-auto pb-4">
		{#each COLUMN_ORDER as status}
			{@const items = columns[status] ?? []}
			<div class="min-w-[280px] max-w-[320px] flex-shrink-0 rounded-lg bg-gray-100">
				<!-- Column header -->
				<div class="px-3 py-2 flex items-center justify-between">
					<span class="text-sm font-semibold text-gray-900">{STATUS_LABELS[status]}</span>
					<span class="text-sm font-normal text-gray-400">({items.length})</span>
				</div>

				<!-- Card list with DnD -->
				<div
					class="px-2 pb-2 space-y-2 overflow-y-auto"
					style="max-height: calc(100vh - 320px);"
					use:dndzone={{ items, type: 'task', flipDurationMs, dropTargetStyle: { outline: 'none' }, dropTargetClasses: ['bg-blue-50', 'border-2', 'border-dashed', 'border-blue-300', 'rounded-lg'] }}
					onconsider={(e: CustomEvent) => handleConsider(status, e)}
					onfinalize={(e: CustomEvent) => handleFinalize(status, e)}
				>
					{#each items as task (task.id)}
						<KanbanCard {task} />
					{/each}
				</div>

				{#if items.length === 0}
					<p class="text-gray-400 text-xs text-center py-8">No tasks</p>
				{/if}
			</div>
		{/each}
	</div>
{/if}
