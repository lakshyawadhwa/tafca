<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import {
		Plus, Search, ClipboardList, SearchX, LayoutList, LayoutGrid,
		MoreHorizontal, ChevronRight, Trash2, Eye
	} from 'lucide-svelte';
	import {
		Button, DataTable, Select, FilterBar, EmptyState, ConfirmDialog,
		StatusBadge, StatusTransitionDropdown, ViewToggle, MultiSelect,
		LoadingSkeleton
	} from '$lib/components/ui';
	import UserPicker from '$lib/components/ui/UserPicker.svelte';
	import ClientPicker from '$lib/components/ui/ClientPicker.svelte';
	import DatePicker from '$lib/components/ui/DatePicker.svelte';
	import KanbanBoard from '$lib/components/task/KanbanBoard.svelte';
	import { api } from '$lib/utils/api';
	import { addToast } from '$lib/stores/toast.svelte';
	import { TASK_STATUS_TRANSITIONS, TaskStatus, TaskPriority } from '@ca-practice-os/shared';

	let { data } = $props();

	// Local search state with debounce
	let searchInput = $state(data.filters.search ?? '');
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	// Confirm dialog state
	let confirmOpen = $state(false);
	let deleteTaskId = $state<string | null>(null);
	let deleteTaskTitle = $state('');

	// Expanded subtask state
	let expandedParents = $state<Set<string>>(new Set());
	let subtaskCache = $state<Record<string, any[]>>({});

	// Actions dropdown state
	let openActionId = $state<string | null>(null);

	// View toggle options
	const viewOptions = [
		{ id: 'table', label: 'Table', icon: LayoutList },
		{ id: 'board', label: 'Board', icon: LayoutGrid },
	];

	// Filter options
	const statusOptions = Object.values(TaskStatus).map((v) => ({
		value: v,
		label: v.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())
	}));

	const priorityOptions = Object.values(TaskPriority).map((v) => ({
		value: v,
		label: v.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())
	}));

	const engagementOptions = $derived([
		{ value: '', label: 'All engagements' },
		...data.engagements.map((e: any) => ({
			value: e.id,
			label: e.name ?? e.displayName ?? e.id
		}))
	]);

	// Determine display state
	let hasFilters = $derived(
		!!(data.filters.search || data.filters.assigneeId || data.filters.clientId ||
		   data.filters.engagementId || data.filters.status || data.filters.priority ||
		   data.filters.dueDateFrom || data.filters.dueDateTo || data.filters.overdue)
	);
	let isEmpty = $derived(data.tasks.length === 0 && !hasFilters);
	let isFilteredEmpty = $derived(data.tasks.length === 0 && hasFilters);

	// Parsed multi-select values
	let selectedStatuses = $derived(data.filters.status ? data.filters.status.split(',') : []);
	let selectedPriorities = $derived(data.filters.priority ? data.filters.priority.split(',') : []);

	function updateFilters(key: string, value: string) {
		const url = new URL($page.url);
		if (value) {
			url.searchParams.set(key, value);
		} else {
			url.searchParams.delete(key);
		}
		url.searchParams.set('page', '1');
		goto(url.toString(), { replaceState: true, noScroll: true });
	}

	function handleSearch() {
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			updateFilters('search', searchInput);
		}, 300);
	}

	function handleViewChange(viewId: string) {
		const url = new URL($page.url);
		url.searchParams.set('view', viewId);
		goto(url.toString(), { replaceState: true, noScroll: true });
	}

	function clearFilters() {
		searchInput = '';
		const url = new URL($page.url);
		// Preserve view but clear everything else
		const view = url.searchParams.get('view') ?? 'table';
		goto(`/tasks?view=${view}`, { replaceState: true });
	}

	function handlePageChange(newPage: number) {
		const url = new URL($page.url);
		url.searchParams.set('page', String(newPage));
		goto(url.toString(), { replaceState: true, noScroll: true });
	}

	function handleSort(key: string, direction: 'asc' | 'desc') {
		const url = new URL($page.url);
		url.searchParams.set('sortBy', key);
		url.searchParams.set('sortOrder', direction);
		url.searchParams.set('page', '1');
		goto(url.toString(), { replaceState: true, noScroll: true });
	}

	// Status transition handler (used by both table and Kanban)
	async function handleStatusChange(taskId: string, newStatus: string) {
		try {
			await api(`/tasks/${taskId}/status`, {
				method: 'PATCH',
				body: JSON.stringify({ status: newStatus }),
			});
			addToast('Task status updated', 'success');
			await invalidateAll();
		} catch (err: any) {
			const statusCode = (err as any).statusCode;
			if (statusCode === 409) {
				addToast(err.message ?? 'Cannot mark as done: required checklist items are incomplete', 'error');
			} else {
				addToast(err.message ?? 'Failed to update task status', 'error');
			}
			throw err; // Re-throw for Kanban revert
		}
	}

	// Subtask expansion
	async function toggleSubtasks(taskId: string) {
		if (expandedParents.has(taskId)) {
			const next = new Set(expandedParents);
			next.delete(taskId);
			expandedParents = next;
		} else {
			if (!subtaskCache[taskId]) {
				try {
					const result = await api<any>(`/tasks?parentTaskId=${taskId}&limit=50`);
					subtaskCache[taskId] = result.data ?? [];
				} catch {
					addToast('Failed to load subtasks', 'error');
					return;
				}
			}
			const next = new Set(expandedParents);
			next.add(taskId);
			expandedParents = next;
		}
	}

	// Delete task
	function confirmDelete(task: any) {
		deleteTaskId = task.id;
		deleteTaskTitle = task.title;
		confirmOpen = true;
		openActionId = null;
	}

	async function executeDelete() {
		if (!deleteTaskId) return;
		try {
			await api(`/tasks/${deleteTaskId}`, { method: 'DELETE' });
			addToast(`Task deleted successfully`, 'success');
			confirmOpen = false;
			deleteTaskId = null;
			await invalidateAll();
		} catch (err: any) {
			addToast(err.message ?? 'Failed to delete task', 'error');
		}
	}

	// Due date coloring helpers
	const DUE_NORMAL = 'text-gray-500';
	const DUE_SOON = 'text-amber-600';
	const DUE_OVERDUE = 'text-red-600 font-semibold';

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
		if (!dateStr) return '--';
		const d = new Date(dateStr + 'T00:00:00');
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}
</script>

<svelte:head>
	<title>Tasks -- CA Practice OS</title>
</svelte:head>

<div>
	<!-- Page Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-xl font-semibold text-gray-900">Tasks</h1>
			<p class="mt-1 text-sm text-gray-500">Manage and track all tasks</p>
		</div>
		<Button variant="primary" onclick={() => goto('/tasks/new')}>
			<Plus size={16} class="mr-1.5" />
			Add Task
		</Button>
	</div>

	{#if isEmpty}
		<div class="mt-6">
			<EmptyState
				icon={ClipboardList}
				heading="No tasks yet"
				body="Create your first task to start tracking work."
				actionLabel="Add Task"
				onAction={() => goto('/tasks/new')}
			/>
		</div>
	{:else}
		<!-- Search & Filters -->
		<div class="mt-4">
			<div class="relative mb-3 max-w-xs">
				<Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
				<input
					type="text"
					bind:value={searchInput}
					oninput={handleSearch}
					placeholder="Search tasks by title..."
					class="h-10 w-full rounded-md border border-gray-200 pl-9 pr-4 text-sm text-gray-900 placeholder:text-gray-400 hover:border-gray-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
				/>
			</div>

			<FilterBar>
				<div class="min-w-[180px]">
					<span class="mb-1 block text-xs font-semibold text-gray-500">Assignee</span>
					<UserPicker
						value={data.filters.assigneeId || null}
						onSelect={(id) => updateFilters('assigneeId', id)}
						options={data.users}
						placeholder="All assignees"
					/>
				</div>
				<div class="min-w-[180px]">
					<span class="mb-1 block text-xs font-semibold text-gray-500">Client</span>
					<ClientPicker
						value={data.filters.clientId || null}
						onSelect={(id) => {
							updateFilters('clientId', id);
							// Clear engagement filter when client changes
							if (data.filters.engagementId) {
								updateFilters('engagementId', '');
							}
						}}
						options={data.clients}
						placeholder="All clients"
					/>
				</div>
				<div class="min-w-[160px]">
					<Select
						options={engagementOptions}
						value={data.filters.engagementId}
						onSelect={(val) => updateFilters('engagementId', val)}
						placeholder="All engagements"
						label="Engagement"
					/>
				</div>
				<div class="min-w-[160px]">
					<MultiSelect
						options={statusOptions}
						selected={selectedStatuses}
						onChange={(vals) => updateFilters('status', vals.join(','))}
						placeholder="All statuses"
						label="Status"
					/>
				</div>
				<div class="min-w-[140px]">
					<MultiSelect
						options={priorityOptions}
						selected={selectedPriorities}
						onChange={(vals) => updateFilters('priority', vals.join(','))}
						placeholder="All priorities"
						label="Priority"
					/>
				</div>
				<div class="min-w-[130px]">
					<span class="mb-1 block text-xs font-semibold text-gray-500">Due from</span>
					<DatePicker
						value={data.filters.dueDateFrom || null}
						onChange={(val) => updateFilters('dueDateFrom', val)}
						placeholder="Start date"
					/>
				</div>
				<div class="min-w-[130px]">
					<span class="mb-1 block text-xs font-semibold text-gray-500">Due to</span>
					<DatePicker
						value={data.filters.dueDateTo || null}
						onChange={(val) => updateFilters('dueDateTo', val)}
						placeholder="End date"
					/>
				</div>
				<div class="flex items-end pb-2">
					<label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
						<input
							type="checkbox"
							checked={data.filters.overdue === 'true'}
							onchange={(e) => updateFilters('overdue', (e.target as HTMLInputElement).checked ? 'true' : '')}
							class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
						/>
						Overdue only
					</label>
				</div>
			</FilterBar>
		</div>

		<!-- View Toggle -->
		<div class="flex justify-end mt-3 mb-4">
			<ViewToggle
				options={viewOptions}
				active={data.view}
				onChange={handleViewChange}
			/>
		</div>

		<!-- Content Area -->
		{#if isFilteredEmpty}
			<EmptyState
				icon={SearchX}
				heading="No tasks match your filters"
				body="Try adjusting your search or filters."
				actionLabel="Clear filters"
				onAction={clearFilters}
			/>
		{:else if data.view === 'board'}
			<!-- Kanban Board View -->
			<KanbanBoard
				tasks={data.tasks}
				onStatusChange={handleStatusChange}
			/>
		{:else}
			<!-- Table View -->
			<div class="rounded-lg border border-gray-200 bg-white shadow-sm">
				{#snippet titleRender(row: any)}
					<div class="flex items-center gap-1">
						{#if row.subtaskCount > 0}
							<button
								type="button"
								onclick={() => toggleSubtasks(row.id)}
								class="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
							>
								<ChevronRight
									size={16}
									class="transition-transform duration-150 {expandedParents.has(row.id) ? 'rotate-90' : ''}"
								/>
							</button>
						{/if}
						<a href="/tasks/{row.id}" class="font-medium text-blue-600 hover:text-blue-800 hover:underline">
							{row.title}
						</a>
					</div>
				{/snippet}

				{#snippet clientRender(row: any)}
					<span class={row.client?.displayName ? 'text-gray-900' : 'text-gray-400'}>
						{row.client?.displayName ?? '--'}
					</span>
				{/snippet}

				{#snippet engagementRender(row: any)}
					<span class={row.engagement?.name ? 'text-gray-900' : 'text-gray-400'}>
						{row.engagement?.name ?? '--'}
					</span>
				{/snippet}

				{#snippet statusRender(row: any)}
					<StatusTransitionDropdown
						currentStatus={row.status}
						transitions={TASK_STATUS_TRANSITIONS}
						onTransition={(newStatus) => handleStatusChange(row.id, newStatus)}
						entityType="task"
					/>
				{/snippet}

				{#snippet priorityRender(row: any)}
					<StatusBadge status={row.priority} type="priority" />
				{/snippet}

				{#snippet assigneeRender(row: any)}
					<span class={row.assignee?.fullName ? 'text-gray-900' : 'text-gray-400 italic'}>
						{row.assignee?.fullName ?? 'Unassigned'}
					</span>
				{/snippet}

				{#snippet dueDateRender(row: any)}
					<span class={getDueDateClass(row.dueDate)}>
						{formatDate(row.dueDate)}
					</span>
				{/snippet}

				{#snippet checklistRender(row: any)}
					{@const progress = row.checklistProgress}
					{#if progress && progress.total > 0}
						<div class="flex items-center gap-1.5">
							<span class="text-xs text-gray-500">{progress.completed}/{progress.total}</span>
							<span class="inline-block w-12 h-1 rounded-full bg-gray-200 overflow-hidden">
								<span
									class="block h-full rounded-full bg-green-600"
									style="width: {(progress.completed / progress.total) * 100}%"
								></span>
							</span>
						</div>
					{/if}
				{/snippet}

				{#snippet blockedRender(row: any)}
					{#if row.isBlocked}
						<span class="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
							Blocked
						</span>
					{/if}
				{/snippet}

				{#snippet actionsRender(row: any)}
					<div class="relative">
						<button
							type="button"
							onclick={(e) => {
								e.stopPropagation();
								openActionId = openActionId === row.id ? null : row.id;
							}}
							class="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
						>
							<MoreHorizontal size={14} />
						</button>
						{#if openActionId === row.id}
							<div class="absolute right-0 z-20 mt-1 w-40 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
								<a
									href="/tasks/{row.id}"
									class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
								>
									<Eye size={14} />
									View Details
								</a>
								<button
									type="button"
									onclick={() => confirmDelete(row)}
									class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-gray-100"
								>
									<Trash2 size={14} />
									Delete Task
								</button>
							</div>
						{/if}
					</div>
				{/snippet}

				<DataTable
					columns={[
						{ key: 'title', label: 'Title', sortable: true, render: titleRender },
						{ key: 'client', label: 'Client', sortable: true, render: clientRender },
						{ key: 'engagement', label: 'Engagement', sortable: true, render: engagementRender },
						{ key: 'status', label: 'Status', sortable: true, render: statusRender },
						{ key: 'priority', label: 'Priority', sortable: true, render: priorityRender },
						{ key: 'assignee', label: 'Assignee', sortable: false, render: assigneeRender },
						{ key: 'dueDate', label: 'Due Date', sortable: true, render: dueDateRender },
						{ key: 'checklistProgress', label: 'Checklist', sortable: false, render: checklistRender },
						{ key: 'isBlocked', label: 'Blocked', sortable: false, render: blockedRender },
						{ key: 'actions', label: '', sortable: false, render: actionsRender },
					]}
					data={data.tasks}
					totalItems={data.meta.total}
					currentPage={data.meta.page}
					onPageChange={handlePageChange}
					onSort={handleSort}
					pageSize={data.meta.limit}
				/>

				<!-- Expanded subtask rows -->
				{#each data.tasks as task}
					{#if expandedParents.has(task.id) && subtaskCache[task.id]}
						{#each subtaskCache[task.id] as subtask}
							<div class="flex items-center gap-4 border-b border-gray-100 bg-gray-50 px-4 py-2 pl-10 text-sm">
								<div class="min-w-[220px]">
									<a href="/tasks/{subtask.id}" class="font-medium text-blue-600 hover:text-blue-800 hover:underline">
										{subtask.title}
									</a>
								</div>
								<div class="w-[140px] text-gray-400">--</div>
								<div class="w-[140px] text-gray-400">--</div>
								<div class="w-[120px]">
									<StatusBadge status={subtask.status} type="task" />
								</div>
								<div class="w-[90px]">
									<StatusBadge status={subtask.priority} type="priority" />
								</div>
								<div class="w-[120px]">
									<span class={subtask.assignee?.fullName ? 'text-gray-900' : 'text-gray-400 italic'}>
										{subtask.assignee?.fullName ?? 'Unassigned'}
									</span>
								</div>
								<div class="w-[100px]">
									<span class={getDueDateClass(subtask.dueDate)}>
										{formatDate(subtask.dueDate)}
									</span>
								</div>
							</div>
						{/each}
					{/if}
				{/each}
			</div>
		{/if}
	{/if}
</div>

<ConfirmDialog
	open={confirmOpen}
	title="Delete Task"
	message="Are you sure you want to delete '{deleteTaskTitle}'? This action cannot be undone."
	confirmLabel="Delete"
	variant="danger"
	onConfirm={executeDelete}
	onCancel={() => { confirmOpen = false; }}
/>
