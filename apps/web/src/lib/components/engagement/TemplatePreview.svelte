<script lang="ts">
	type TemplateItem = {
		title: string;
		assigneeRole: string;
		displayOrder: number;
	};

	let {
		templateItems = [],
		loading = false,
		templateName = 'Template'
	}: {
		templateItems?: TemplateItem[];
		loading?: boolean;
		templateName?: string;
	} = $props();

	let sortedItems = $derived(
		[...templateItems].sort((a, b) => a.displayOrder - b.displayOrder)
	);

	function formatRole(role: string): string {
		return role
			.replace(/_/g, ' ')
			.toLowerCase()
			.replace(/\b\w/g, (c: string) => c.toUpperCase());
	}
</script>

<div class="mt-3 rounded-r-md border-l-2 border-blue-600 bg-gray-50 p-4">
	{#if loading}
		<div class="flex flex-col gap-3">
			<div class="h-4 w-48 animate-pulse rounded bg-gray-200"></div>
			<div class="h-3 w-full animate-pulse rounded bg-gray-200"></div>
			<div class="h-3 w-4/5 animate-pulse rounded bg-gray-200"></div>
			<div class="h-3 w-3/5 animate-pulse rounded bg-gray-200"></div>
		</div>
	{:else if sortedItems.length === 0}
		<p class="text-sm text-gray-500">No template tasks defined for this engagement type.</p>
	{:else}
		<div class="mb-2 text-sm font-semibold text-gray-900">
			{templateName} ({sortedItems.length} {sortedItems.length === 1 ? 'task' : 'tasks'})
		</div>
		<ol class="flex flex-col gap-1.5">
			{#each sortedItems as item, index}
				<li class="flex items-center justify-between text-sm">
					<span class="text-gray-700">
						<span class="mr-1.5 text-gray-400">{index + 1}.</span>
						{item.title}
					</span>
					<span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
						{formatRole(item.assigneeRole)}
					</span>
				</li>
			{/each}
		</ol>
	{/if}
</div>
