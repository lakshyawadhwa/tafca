<script lang="ts">
	import {
		StatusBadge, StatusTransitionDropdown, TagInput, DatePicker
	} from '$lib/components/ui';
	import UserPicker from '$lib/components/ui/UserPicker.svelte';
	import DependencySection from './DependencySection.svelte';
	import ActivityTimeline from './ActivityTimeline.svelte';
	import { TASK_STATUS_TRANSITIONS, TaskPriority } from '@ca-practice-os/shared';
	import { clickOutside } from '$lib/actions/clickOutside';

	type UserOption = { id: string; fullName: string; role: string };

	let {
		task,
		users = [],
		onUpdate,
		dependencies = { blockedBy: [], blocking: [] },
		activity = [],
		activityMeta = { total: 0, page: 1, limit: 20, totalPages: 1 },
		onLoadMoreActivity
	}: {
		task: any;
		users?: UserOption[];
		onUpdate: (field: string, value: any) => void;
		dependencies?: { blockedBy: any[]; blocking: any[] };
		activity?: any[];
		activityMeta?: { total: number; page: number; limit: number; totalPages: number };
		onLoadMoreActivity?: () => void;
	} = $props();

	let showPriorityPicker = $state(false);

	const priorityOptions = Object.values(TaskPriority);

	const PRIORITY_LABELS: Record<string, string> = {
		LOW: 'Low',
		MEDIUM: 'Medium',
		HIGH: 'High',
		URGENT: 'Urgent',
	};

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return '';
		const d = new Date(dateStr + 'T00:00:00');
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	let activityHasMore = $derived(activityMeta.page < activityMeta.totalPages);
</script>

<div class="rounded-lg border border-gray-200 bg-white p-4 space-y-5 sticky top-4">
	<!-- Status -->
	<div>
		<div class="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Status</div>
		<StatusTransitionDropdown
			currentStatus={task.status}
			transitions={TASK_STATUS_TRANSITIONS}
			onTransition={(newStatus) => onUpdate('status', newStatus)}
			entityType="task"
		/>
	</div>

	<div class="border-b border-gray-100"></div>

	<!-- Priority -->
	<div>
		<div class="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Priority</div>
		<div class="relative" use:clickOutside={() => { showPriorityPicker = false; }}>
			<button
				type="button"
				onclick={() => { showPriorityPicker = !showPriorityPicker; }}
				class="cursor-pointer"
			>
				<StatusBadge status={task.priority} type="priority" />
			</button>
			{#if showPriorityPicker}
				<div class="absolute left-0 z-20 mt-1 min-w-[140px] rounded-md border border-gray-200 bg-white py-1 shadow-lg">
					{#each priorityOptions as p}
						<button
							type="button"
							onclick={() => { onUpdate('priority', p); showPriorityPicker = false; }}
							class="flex w-full items-center px-3 py-2 text-left hover:bg-gray-100"
						>
							<StatusBadge status={p} type="priority" />
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<div class="border-b border-gray-100"></div>

	<!-- Assignee -->
	<div>
		<div class="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Assignee</div>
		<UserPicker
			value={task.assigneeId ?? null}
			onSelect={(id) => onUpdate('assigneeId', id)}
			options={users}
			placeholder="Unassigned"
		/>
	</div>

	<div class="border-b border-gray-100"></div>

	<!-- Reviewer -->
	<div>
		<div class="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Reviewer</div>
		<UserPicker
			value={task.reviewerId ?? null}
			onSelect={(id) => onUpdate('reviewerId', id)}
			options={users}
			placeholder="No reviewer"
		/>
	</div>

	<div class="border-b border-gray-100"></div>

	<!-- Due Date -->
	<div>
		<div class="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Due Date</div>
		<DatePicker
			value={task.dueDate ?? null}
			onChange={(val) => onUpdate('dueDate', val)}
			placeholder="No due date"
		/>
	</div>

	<div class="border-b border-gray-100"></div>

	<!-- Internal Deadline -->
	<div>
		<div class="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Internal Deadline</div>
		{#if task.internalDueDate}
			<DatePicker
				value={task.internalDueDate}
				onChange={(val) => onUpdate('internalDueDate', val)}
				placeholder="Auto-computed"
				max={task.dueDate ?? undefined}
			/>
		{:else if task.dueDate}
			<span class="text-sm text-gray-400">Auto-computed</span>
		{:else}
			<span class="text-sm text-gray-400">No due date set</span>
		{/if}
	</div>

	<div class="border-b border-gray-100"></div>

	<!-- Client -->
	<div>
		<div class="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Client</div>
		{#if task.client}
			<a href="/clients/{task.client.id}" class="text-sm text-blue-600 hover:underline">
				{task.client.displayName}
			</a>
		{:else}
			<span class="text-sm text-gray-400">None</span>
		{/if}
	</div>

	<div class="border-b border-gray-100"></div>

	<!-- Engagement -->
	<div>
		<div class="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Engagement</div>
		{#if task.engagement}
			<span class="text-sm text-gray-900">{task.engagement.name}</span>
		{:else}
			<span class="text-sm text-gray-400">Standalone</span>
		{/if}
	</div>

	<div class="border-b border-gray-100"></div>

	<!-- Tags -->
	<div>
		<div class="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Tags</div>
		{#if task.tags && task.tags.length > 0}
			<TagInput
				tags={task.tags}
				onChange={(newTags) => onUpdate('tags', newTags)}
				max={10}
			/>
		{:else}
			<span class="text-sm text-gray-400">No tags</span>
		{/if}
	</div>

	<div class="border-b border-gray-100"></div>

	<!-- Dependencies -->
	<DependencySection
		blockedBy={dependencies.blockedBy}
		blocking={dependencies.blocking}
		taskId={task.id}
	/>

	<div class="border-b border-gray-100"></div>

	<!-- Activity Timeline -->
	<ActivityTimeline
		entries={activity}
		hasMore={activityHasMore}
		onLoadMore={onLoadMoreActivity}
	/>
</div>
