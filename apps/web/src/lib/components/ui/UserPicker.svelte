<script lang="ts">
	import { Search, ChevronDown, Check } from 'lucide-svelte';
	import { clickOutside } from '$lib/actions/clickOutside';

	type UserOption = {
		id: string;
		fullName: string;
		role: string;
	};

	let {
		value = null,
		onSelect,
		options = [],
		roleFilter = null,
		placeholder = 'Select user',
		disabled = false,
		fetchUrl = undefined
	}: {
		value?: string | null;
		onSelect: (userId: string, user: UserOption) => void;
		options?: UserOption[];
		roleFilter?: string[] | null;
		placeholder?: string;
		disabled?: boolean;
		fetchUrl?: string;
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

	// Filter options based on search and role filter
	let filteredOptions = $derived.by(() => {
		let filtered = options;

		if (roleFilter && roleFilter.length > 0) {
			filtered = filtered.filter((u) => roleFilter!.includes(u.role));
		}

		if (debouncedQuery.trim()) {
			const search = debouncedQuery.toLowerCase();
			filtered = filtered.filter(
				(u) =>
					u.fullName.toLowerCase().includes(search) ||
					u.role.toLowerCase().includes(search)
			);
		}

		return filtered;
	});

	// Selected user display name
	let selectedUser = $derived(options.find((u) => u.id === value));

	// Role display text (format enum to human-readable)
	function formatRole(role: string): string {
		return role
			.replace(/_/g, ' ')
			.toLowerCase()
			.replace(/\b\w/g, (c) => c.toUpperCase());
	}

	function toggleOpen() {
		if (!disabled) {
			isOpen = !isOpen;
			if (isOpen) {
				query = '';
			}
		}
	}

	function selectUser(user: UserOption) {
		onSelect(user.id, user);
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
		<span class={selectedUser ? 'text-gray-900' : 'text-gray-400'}>
			{selectedUser?.fullName ?? placeholder}
		</span>
		<ChevronDown size={16} class="text-gray-400" />
	</button>

	<!-- Dropdown -->
	{#if isOpen}
		<div
			class="absolute left-0 z-20 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg"
			onkeydown={handleKeydown}
			role="listbox"
			aria-label="Select user"
		>
			<!-- Search input -->
			<div class="flex items-center gap-2 border-b border-gray-200 px-3 py-2">
				<Search size={14} class="text-gray-400" />
				<input
					type="text"
					bind:value={query}
					placeholder="Search users..."
					class="w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
				/>
			</div>

			<!-- Options list -->
			<div class="max-h-60 overflow-y-auto py-1">
				{#if filteredOptions.length === 0}
					<div class="px-3 py-2 text-sm text-gray-500">No users found</div>
				{:else}
					{#each filteredOptions as user}
						<button
							type="button"
							onclick={() => selectUser(user)}
							class="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-100"
							role="option"
							aria-selected={user.id === value}
						>
							<div>
								<div class="font-medium text-gray-900">{user.fullName}</div>
								<div class="text-xs text-gray-500">{formatRole(user.role)}</div>
							</div>
							{#if user.id === value}
								<Check size={16} class="text-blue-600" />
							{/if}
						</button>
					{/each}
				{/if}
			</div>
		</div>
	{/if}
</div>
