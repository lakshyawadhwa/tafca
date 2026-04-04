<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		label,
		error = null,
		helpText = null,
		required = false,
		id = undefined,
		children
	}: {
		label: string;
		error?: string | null;
		helpText?: string | null;
		required?: boolean;
		id?: string;
		children: Snippet;
	} = $props();
</script>

<div class="flex flex-col gap-1">
	<label for={id} class="text-sm font-semibold leading-snug text-gray-700">
		{label}
		{#if required}
			<span class="text-red-500">*</span>
		{/if}
	</label>

	{@render children()}

	{#if error}
		<p class="mt-1 text-xs text-red-600">{error}</p>
	{:else if helpText}
		<p class="mt-1 text-xs text-gray-500">{helpText}</p>
	{/if}
</div>
