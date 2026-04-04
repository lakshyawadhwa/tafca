<script lang="ts">
	import { Search, ChevronDown, Check } from 'lucide-svelte';
	import { clickOutside } from '$lib/actions/clickOutside';
	import StatusBadge from './StatusBadge.svelte';

	type ClientOption = {
		id: string;
		displayName: string;
		status: string;
	};

	let {
		value = null,
		onSelect,
		options = [],
		placeholder = 'Select client',
		disabled = false
	}: {
		value?: string | null;
		onSelect: (clientId: string, client: ClientOption) => void;
		options?: ClientOption[];
		placeholder?: string;
		disabled?: boolean;
	} = $props();

	let isOpen = $state(false);
	let query = $state('');
	let debouncedQuery = $state('');
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	// Debounced search (300ms)
	$effect(() => {
		const q = query;
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			debouncedQuery = q;
		}, 300);
		return () => {
			if (debounceTimer) clearTimeout(debounceTimer);
		};
	});

	// Filter options based on search
	let filteredOptions = $derived.by(() => {
		if (!debouncedQuery.trim()) return options;

		const search = debouncedQuery.toLowerCase();
		return options.filter((c) =>
			c.displayName.toLowerCase().includes(search)
		);
	});

	// Selected client display name
	let selectedClient = $derived(options.find((c) => c.id === value));

	function toggleOpen() {
		if (!disabled) {
			isOpen = !isOpen;
			if (isOpen) {
				query = '';
			}
		}
	}

	function selectClient(client: ClientOption) {
		onSelect(client.id, client);
		isOpen = false;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			isOpen = false;
		}
	}
</script>

<div class="relative" use:clickOutside={() => (isOpen = false)}>
	<!-- Trigger button -->
	<button
		type="button"
		{disabled}
		onclick={toggleOpen}
		onkeydown={handleKeydown}
		class="flex w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm
			{disabled ? 'cursor-not-allowed bg-gray-100 text-gray-400' : 'hover:border-gray-300'}
			focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
	>
		<span class={selectedClient ? 'text-gray-900' : 'text-gray-400'}>
			{selectedClient?.displayName ?? placeholder}
		</span>
		<ChevronDown size={16} class="text-gray-400" />
	</button>

	<!-- Dropdown -->
	{#if isOpen}
		<div
			class="absolute left-0 z-20 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg"
			onkeydown={handleKeydown}
			role="listbox"
			aria-label="Select client"
		>
			<!-- Search input -->
			<div class="flex items-center gap-2 border-b border-gray-200 px-3 py-2">
				<Search size={14} class="text-gray-400" />
				<input
					type="text"
					bind:value={query}
					placeholder="Search clients..."
					class="w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
				/>
			</div>

			<!-- Options list -->
			<div class="max-h-60 overflow-y-auto py-1">
				{#if filteredOptions.length === 0}
					<div class="px-3 py-2 text-sm text-gray-500">No clients found</div>
				{:else}
					{#each filteredOptions as client}
						<button
							type="button"
							onclick={() => selectClient(client)}
							class="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-100"
							role="option"
							aria-selected={client.id === value}
						>
							<div class="flex items-center gap-2">
								<span class="font-medium text-gray-900">{client.displayName}</span>
								<StatusBadge status={client.status} type="client" />
							</div>
							{#if client.id === value}
								<Check size={16} class="text-blue-600" />
							{/if}
						</button>
					{/each}
				{/if}
			</div>
		</div>
	{/if}
</div>
