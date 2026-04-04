<script lang="ts">
	import { ChevronDown } from 'lucide-svelte';
	import { Button } from '$lib/components/ui';
	import { TaskAction } from '@ca-practice-os/shared';

	type ActivityEntry = {
		id: string;
		action: string;
		actorName?: string;
		oldValue?: string | null;
		newValue?: string | null;
		createdAt: string;
	};

	let {
		entries = [],
		loading = false,
		hasMore = false,
		onLoadMore
	}: {
		entries?: ActivityEntry[];
		loading?: boolean;
		hasMore?: boolean;
		onLoadMore?: () => void;
	} = $props();

	let isExpanded = $state(false);

	// Dot color by action type -- complete class strings for TailwindCSS v4
	const DOT_BLUE = 'bg-blue-600';
	const DOT_GREEN = 'bg-green-600';
	const DOT_DEFAULT = 'bg-gray-300';

	function getDotColor(action: string): string {
		switch (action) {
			case TaskAction.STATUS_CHANGED:
				return DOT_BLUE;
			case TaskAction.COMMENT_ADDED:
			case TaskAction.CHECKLIST_ITEM_COMPLETED:
			case TaskAction.CHECKLIST_ITEM_UNCOMPLETED:
				return DOT_GREEN;
			default:
				return DOT_DEFAULT;
		}
	}

	// Action sentence templates
	function formatAction(entry: ActivityEntry): string {
		const actor = entry.actorName ?? 'Someone';
		const oldVal = formatValue(entry.oldValue);
		const newVal = formatValue(entry.newValue);

		switch (entry.action) {
			case TaskAction.CREATED:
				return `${actor} created this task`;
			case TaskAction.STATUS_CHANGED:
				return `${actor} changed status from ${oldVal} to ${newVal}`;
			case TaskAction.ASSIGNEE_CHANGED:
				return entry.newValue
					? `${actor} assigned to ${newVal}`
					: `${actor} removed assignee`;
			case TaskAction.REVIEWER_CHANGED:
				return entry.newValue
					? `${actor} set reviewer to ${newVal}`
					: `${actor} removed reviewer`;
			case TaskAction.DUE_DATE_CHANGED:
				return entry.newValue
					? `${actor} changed due date to ${newVal}`
					: `${actor} removed due date`;
			case TaskAction.PRIORITY_CHANGED:
				return `${actor} changed priority from ${oldVal} to ${newVal}`;
			case TaskAction.CHECKLIST_ITEM_COMPLETED:
				return `${actor} completed '${newVal}'`;
			case TaskAction.CHECKLIST_ITEM_UNCOMPLETED:
				return `${actor} unchecked '${newVal}'`;
			case TaskAction.COMMENT_ADDED:
				return `${actor} commented`;
			case TaskAction.DEPENDENCY_ADDED:
				return `${actor} added dependency on '${newVal}'`;
			case TaskAction.DEPENDENCY_REMOVED:
				return `${actor} removed dependency on '${newVal}'`;
			default:
				return `${actor} performed ${entry.action.toLowerCase().replace(/_/g, ' ')}`;
		}
	}

	function formatValue(val: string | null | undefined): string {
		if (!val) return 'none';
		return val.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
	}

	function formatRelativeTime(dateStr: string): string {
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / (1000 * 60));
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}
</script>

<div>
	<!-- Toggle header -->
	<button
		type="button"
		onclick={() => { isExpanded = !isExpanded; }}
		class="flex items-center gap-1.5 text-sm font-semibold text-gray-700 hover:text-gray-900"
	>
		<ChevronDown
			size={16}
			class="transition-transform duration-200 {isExpanded ? 'rotate-0' : '-rotate-90'}"
		/>
		Activity
		{#if entries.length > 0}
			<span class="text-xs font-normal text-gray-400">({entries.length})</span>
		{/if}
	</button>

	{#if isExpanded}
		<div class="mt-3 max-h-[400px] overflow-y-auto">
			{#if entries.length === 0}
				<p class="text-xs text-gray-400 py-4">No activity recorded yet</p>
			{:else}
				<div class="space-y-3 relative">
					{#each entries as entry, index (entry.id)}
						<div class="flex gap-3">
							<!-- Timeline dot and line -->
							<div class="flex flex-col items-center">
								<div class="w-2 h-2 rounded-full shrink-0 mt-1.5 {getDotColor(entry.action)}"></div>
								{#if index < entries.length - 1}
									<div class="w-px flex-1 bg-gray-200 mt-1"></div>
								{/if}
							</div>

							<!-- Content -->
							<div class="flex-1 pb-3 min-w-0">
								<p class="text-sm text-gray-600">
									{formatAction(entry)}
								</p>
								<p class="text-xs text-gray-400 mt-0.5">
									{formatRelativeTime(entry.createdAt)}
								</p>
							</div>
						</div>
					{/each}
				</div>

				{#if hasMore}
					<div class="mt-2 text-center">
						<Button size="sm" variant="secondary" onclick={onLoadMore} {loading}>
							Load more
						</Button>
					</div>
				{/if}
			{/if}
		</div>
	{/if}
</div>
