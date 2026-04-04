<script lang="ts">
	let {
		variant = 'text',
		rows = 5,
		columns = 4
	}: {
		variant?: 'table' | 'card' | 'text' | 'page';
		rows?: number;
		columns?: number;
	} = $props();
</script>

{#if variant === 'table'}
	<div class="w-full">
		<!-- Header row -->
		<div class="flex gap-4 border-b border-gray-200 pb-3">
			{#each Array(columns) as _, i}
				<div class="h-3 flex-1 animate-pulse rounded bg-gray-200"></div>
			{/each}
		</div>
		<!-- Body rows -->
		{#each Array(rows) as _, r}
			<div class="flex gap-4 border-b border-gray-100 py-3">
				{#each Array(columns) as _, c}
					<div class="h-3 flex-1 animate-pulse rounded bg-gray-200" style="opacity: {0.7 + Math.random() * 0.3}"></div>
				{/each}
			</div>
		{/each}
	</div>

{:else if variant === 'card'}
	<div class="grid gap-4">
		{#each Array(rows) as _}
			<div class="h-32 w-full animate-pulse rounded-lg bg-gray-200"></div>
		{/each}
	</div>

{:else if variant === 'text'}
	<div class="flex flex-col gap-3">
		{#each Array(rows) as _, i}
			<div
				class="h-3 animate-pulse rounded bg-gray-200"
				style="width: {i === 0 ? '100%' : i % 3 === 0 ? '60%' : '80%'}"
			></div>
		{/each}
	</div>

{:else if variant === 'page'}
	<div class="flex flex-col gap-6">
		<!-- Header skeleton -->
		<div class="flex flex-col gap-2">
			<div class="h-6 w-48 animate-pulse rounded bg-gray-200"></div>
			<div class="h-3 w-72 animate-pulse rounded bg-gray-200"></div>
		</div>
		<!-- Text skeleton -->
		<div class="flex flex-col gap-3">
			<div class="h-3 w-full animate-pulse rounded bg-gray-200"></div>
			<div class="h-3 w-4/5 animate-pulse rounded bg-gray-200"></div>
			<div class="h-3 w-3/5 animate-pulse rounded bg-gray-200"></div>
		</div>
		<!-- Card skeletons -->
		<div class="grid gap-4">
			<div class="h-32 w-full animate-pulse rounded-lg bg-gray-200"></div>
			<div class="h-32 w-full animate-pulse rounded-lg bg-gray-200"></div>
		</div>
	</div>
{/if}
