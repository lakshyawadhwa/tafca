<script lang="ts">
	import { ChevronDown, Check, Search } from 'lucide-svelte';
	import { clickOutside } from '$lib/actions/clickOutside';

	type SelectOption = {
		value: string;
		label: string;
	};

	type OptionGroup = {
		label: string;
		options: SelectOption[];
	};

	let {
		groups,
		value = null,
		onSelect,
		placeholder = 'Select...',
		disabled = false
	}: {
		groups: OptionGroup[];
		value?: string | null;
		onSelect: (val: string) => void;
		placeholder?: string;
		disabled?: boolean;
	} = $props();

	let isOpen = $state(false);
	let query = $state('');

	// All options flattened for lookup
	let allOptions = $derived(groups.flatMap((g) => g.options));
	let selectedOption = $derived(allOptions.find((o) => o.value === value));

	// Filtered groups based on search
	let filteredGroups = $derived.by(() => {
		if (!query.trim()) return groups;
		const search = query.toLowerCase();
		return groups
			.map((group) => ({
				...group,
				options: group.options.filter((o) => o.label.toLowerCase().includes(search))
			}))
			.filter((group) => group.options.length > 0);
	});

	function toggleOpen() {
		if (!disabled) {
			isOpen = !isOpen;
			if (isOpen) {
				query = '';
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
		}
	}
</script>

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
			onkeydown={handleKeydown}
		>
			<!-- Search input -->
			<div class="flex items-center gap-2 border-b border-gray-200 px-3 py-2">
				<Search size={14} class="text-gray-400" />
				<input
					type="text"
					bind:value={query}
					placeholder="Search..."
					class="w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
				/>
			</div>

			<!-- Grouped options -->
			<div class="max-h-60 overflow-y-auto py-1">
				{#if filteredGroups.length === 0}
					<div class="px-3 py-2 text-sm text-gray-500">No options found</div>
				{:else}
					{#each filteredGroups as group, groupIndex}
						{#if groupIndex > 0}
							<div class="my-1 border-t border-gray-100"></div>
						{/if}
						<div class="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
							{group.label}
						</div>
						{#each group.options as option}
							<button
								type="button"
								onclick={() => selectOption(option)}
								class="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-100"
								role="option"
								aria-selected={option.value === value}
							>
								<span class="text-gray-900">{option.label}</span>
								{#if option.value === value}
									<Check size={16} class="text-blue-600" />
								{/if}
							</button>
						{/each}
					{/each}
				{/if}
			</div>
		</div>
	{/if}
</div>
