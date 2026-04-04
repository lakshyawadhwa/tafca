<script lang="ts">
	import { ChevronDown, Check } from 'lucide-svelte';
	import { clickOutside } from '$lib/actions/clickOutside';

	type SelectOption = {
		value: string;
		label: string;
	};

	let {
		options,
		value = null,
		onSelect,
		placeholder = 'Select...',
		disabled = false,
		label = undefined
	}: {
		options: SelectOption[];
		value?: string | null;
		onSelect: (val: string) => void;
		placeholder?: string;
		disabled?: boolean;
		label?: string;
	} = $props();

	let isOpen = $state(false);
	let focusedIndex = $state(-1);

	let selectedOption = $derived(options.find((o) => o.value === value));

	function toggleOpen() {
		if (!disabled) {
			isOpen = !isOpen;
			if (isOpen) {
				focusedIndex = options.findIndex((o) => o.value === value);
			}
		}
	}

	function selectOption(option: SelectOption) {
		onSelect(option.value);
		isOpen = false;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			isOpen = false;
			return;
		}

		if (!isOpen) {
			if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
				event.preventDefault();
				isOpen = true;
				focusedIndex = options.findIndex((o) => o.value === value);
				if (focusedIndex < 0) focusedIndex = 0;
			}
			return;
		}

		if (event.key === 'ArrowDown') {
			event.preventDefault();
			focusedIndex = Math.min(focusedIndex + 1, options.length - 1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			focusedIndex = Math.max(focusedIndex - 1, 0);
		} else if (event.key === 'Enter') {
			event.preventDefault();
			if (focusedIndex >= 0 && focusedIndex < options.length) {
				selectOption(options[focusedIndex]);
			}
		}
	}
</script>

{#if label}
	<span class="mb-1 block text-xs font-semibold text-gray-500">{label}</span>
{/if}

<div class="relative" use:clickOutside={() => (isOpen = false)}>
	<button
		type="button"
		{disabled}
		onclick={toggleOpen}
		onkeydown={handleKeydown}
		class="flex w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm
			{disabled ? 'cursor-not-allowed bg-gray-100 text-gray-400' : 'hover:border-gray-300'}
			focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
		role="combobox"
		aria-expanded={isOpen}
		aria-haspopup="listbox"
	>
		<span class={selectedOption ? 'text-gray-900' : 'text-gray-400'}>
			{selectedOption?.label ?? placeholder}
		</span>
		<ChevronDown size={16} class="text-gray-400" />
	</button>

	{#if isOpen}
		<div
			class="absolute left-0 z-20 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg"
			role="listbox"
		>
			<div class="max-h-60 overflow-y-auto py-1">
				{#each options as option, index}
					<button
						type="button"
						onclick={() => selectOption(option)}
						class="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-100
							{focusedIndex === index ? 'bg-gray-50' : ''}"
						role="option"
						aria-selected={option.value === value}
					>
						<span class="text-gray-900">{option.label}</span>
						{#if option.value === value}
							<Check size={16} class="text-blue-600" />
						{/if}
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>
