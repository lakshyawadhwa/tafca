<script lang="ts">
	import { ChevronDown } from 'lucide-svelte';
	import { clickOutside } from '$lib/actions/clickOutside';
	import StatusBadge from './StatusBadge.svelte';

	let {
		currentStatus,
		transitions,
		onTransition,
		entityType
	}: {
		currentStatus: string;
		transitions: Record<string, string[]>;
		onTransition: (newStatus: string) => void;
		entityType: 'engagement' | 'task';
	} = $props();

	let isOpen = $state(false);

	let validTargets = $derived(transitions[currentStatus] ?? []);

	function handleSelect(status: string) {
		isOpen = false;
		onTransition(status);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			isOpen = false;
		}
	}
</script>

<div class="relative inline-block" use:clickOutside={() => (isOpen = false)}>
	<button
		type="button"
		onclick={() => { if (validTargets.length > 0) isOpen = !isOpen; }}
		onkeydown={handleKeydown}
		class="inline-flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-gray-50 focus:outline-none
			{validTargets.length === 0 ? 'cursor-default' : 'cursor-pointer'}"
		disabled={validTargets.length === 0}
	>
		<StatusBadge status={currentStatus} type={entityType} />
		{#if validTargets.length > 0}
			<ChevronDown size={14} class="text-gray-400" />
		{/if}
	</button>

	{#if isOpen}
		<div
			class="absolute right-0 z-20 mt-1 min-w-[160px] rounded-md border border-gray-200 bg-white py-1 shadow-lg"
			role="listbox"
			onkeydown={handleKeydown}
		>
			{#each validTargets as target}
				<button
					type="button"
					onclick={() => handleSelect(target)}
					class="flex w-full items-center px-3 py-2 text-left hover:bg-gray-100"
					role="option"
				>
					<StatusBadge status={target} type={entityType} />
				</button>
			{/each}
		</div>
	{/if}
</div>
