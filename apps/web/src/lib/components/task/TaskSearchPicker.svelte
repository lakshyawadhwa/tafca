<script lang="ts">
	import { Search } from 'lucide-svelte';
	import { StatusBadge } from '$lib/components/ui';
	import { api } from '$lib/utils/api';
	import { clickOutside } from '$lib/actions/clickOutside';

	let {
		excludeTaskId,
		onSelect
	}: {
		excludeTaskId: string;
		onSelect: (taskId: string) => void;
	} = $props();

	let query = $state('');
	let results = $state<any[]>([]);
	let isOpen = $state(false);
	let isLoading = $state(false);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		const q = query.trim();
		if (debounceTimer) clearTimeout(debounceTimer);

		if (!q) {
			results = [];
			return;
		}

		debounceTimer = setTimeout(async () => {
			isLoading = true;
			try {
				const res = await api<any>(`/tasks?search=${encodeURIComponent(q)}&limit=10`);
				results = (res.data ?? []).filter((t: any) => t.id !== excludeTaskId);
			} catch {
				results = [];
			} finally {
				isLoading = false;
			}
		}, 300);

		return () => {
			if (debounceTimer) clearTimeout(debounceTimer);
		};
	});

	function handleSelect(taskId: string) {
		onSelect(taskId);
		query = '';
		results = [];
		isOpen = false;
	}
</script>

<div class="relative" use:clickOutside={() => { isOpen = false; }}>
	<div class="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5">
		<Search size={14} class="text-gray-400 shrink-0" />
		<input
			type="text"
			bind:value={query}
			onfocus={() => { isOpen = true; }}
			placeholder="Search tasks..."
			class="w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
		/>
	</div>

	{#if isOpen && (results.length > 0 || isLoading || query.trim())}
		<div class="absolute left-0 z-20 mt-1 w-full max-h-60 overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg">
			{#if isLoading}
				<div class="px-3 py-2 text-sm text-gray-500">Searching...</div>
			{:else if results.length === 0 && query.trim()}
				<div class="px-3 py-2 text-sm text-gray-500">No tasks found</div>
			{:else}
				{#each results as task}
					<button
						type="button"
						onclick={() => handleSelect(task.id)}
						class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100"
					>
						<span class="flex-1 truncate text-gray-900">{task.title}</span>
						<StatusBadge status={task.status} type="task" />
					</button>
				{/each}
			{/if}
		</div>
	{/if}
</div>
