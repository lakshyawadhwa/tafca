<script lang="ts">
	import type { Component } from 'svelte';

	type ToggleOption = {
		id: string;
		label: string;
		icon?: Component<{ size?: number; class?: string }>;
	};

	let {
		options,
		active,
		onChange
	}: {
		options: ToggleOption[];
		active: string;
		onChange: (id: string) => void;
	} = $props();

	const ACTIVE_CLASSES = 'bg-gray-100 text-gray-900 font-semibold';
	const INACTIVE_CLASSES = 'bg-white text-gray-500 hover:text-gray-700';
</script>

<div class="inline-flex overflow-hidden rounded-md border border-gray-200">
	{#each options as option}
		<button
			type="button"
			onclick={() => onChange(option.id)}
			class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors
				{active === option.id ? ACTIVE_CLASSES : INACTIVE_CLASSES}
				{options.indexOf(option) > 0 ? 'border-l border-gray-200' : ''}"
		>
			{#if option.icon}
				{@const Icon = option.icon}
				<Icon size={16} />
			{/if}
			{option.label}
		</button>
	{/each}
</div>
