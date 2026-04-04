<script lang="ts">
	import type { Component } from 'svelte';
	import { Inbox } from 'lucide-svelte';

	let {
		icon = undefined,
		heading,
		body = undefined,
		actionLabel = undefined,
		onAction = undefined
	}: {
		icon?: Component;
		heading: string;
		body?: string;
		actionLabel?: string;
		onAction?: () => void;
	} = $props();

	const IconComponent = $derived(icon ?? Inbox);
</script>

<div class="flex flex-col items-center justify-center px-4 py-12 text-center">
	<div class="mb-4 text-gray-400">
		<svelte:component this={IconComponent} size={48} />
	</div>

	<h3 class="text-sm font-semibold text-gray-900">{heading}</h3>

	{#if body}
		<p class="mt-1 max-w-sm text-sm text-gray-500">{body}</p>
	{/if}

	{#if actionLabel && onAction}
		<button
			type="button"
			onclick={onAction}
			class="mt-4 inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 focus:outline-none"
		>
			{actionLabel}
		</button>
	{/if}
</div>
