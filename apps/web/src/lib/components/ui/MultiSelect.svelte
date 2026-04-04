<script lang="ts">
	import { ChevronDown, Check } from 'lucide-svelte';
	import { clickOutside } from '$lib/actions/clickOutside';

	type Option = {
		value: string;
		label: string;
	};

	let {
		options,
		selected = [],
		onChange,
		placeholder = 'Select...',
		label = undefined
	}: {
		options: Option[];
		selected?: string[];
		onChange: (selected: string[]) => void;
		placeholder?: string;
		label?: string;
	} = $props();

	let isOpen = $state(false);

	let displayText = $derived.by(() => {
		if (selected.length === 0) return placeholder;
		if (selected.length === 1) {
			const opt = options.find((o) => o.value === selected[0]);
			return opt?.label ?? selected[0];
		}
		return `${selected.length} selected`;
	});

	function toggle(value: string) {
		if (selected.includes(value)) {
			onChange(selected.filter((v) => v !== value));
		} else {
			onChange([...selected, value]);
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			isOpen = false;
		}
	}
</script>

<div class="relative" use:clickOutside={() => (isOpen = false)}>
	{#if label}
		<span class="mb-1 block text-xs font-semibold text-gray-500">{label}</span>
	{/if}
	<button
		type="button"
		onclick={() => (isOpen = !isOpen)}
		onkeydown={handleKeydown}
		class="flex w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm
			{selected.length > 0 ? 'text-gray-900' : 'text-gray-400'}
			hover:border-gray-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
	>
		<span class="truncate">{displayText}</span>
		<ChevronDown size={16} class="shrink-0 text-gray-400" />
	</button>

	{#if isOpen}
		<div
			class="absolute left-0 z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg"
			role="listbox"
			onkeydown={handleKeydown}
		>
			{#each options as option}
				{@const isSelected = selected.includes(option.value)}
				<button
					type="button"
					onclick={() => toggle(option.value)}
					class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100"
					role="option"
					aria-selected={isSelected}
				>
					<span
						class="flex h-4 w-4 shrink-0 items-center justify-center rounded border
							{isSelected ? 'border-blue-600 bg-blue-600' : 'border-gray-300'}"
					>
						{#if isSelected}
							<Check size={12} class="text-white" />
						{/if}
					</span>
					<span class={isSelected ? 'font-medium text-gray-900' : 'text-gray-700'}>{option.label}</span>
				</button>
			{/each}
		</div>
	{/if}
</div>
