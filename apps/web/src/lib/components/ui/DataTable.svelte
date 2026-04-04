<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-svelte';
	import EmptyState from './EmptyState.svelte';
	import LoadingSkeleton from './LoadingSkeleton.svelte';

	type Column = {
		key: string;
		label: string;
		sortable?: boolean;
		render?: Snippet<[any]> | ((...args: any[]) => any);
	};

	let {
		columns,
		data,
		loading = false,
		emptyMessage = 'No results found',
		emptyActionLabel = undefined,
		onEmptyAction = undefined,
		sortable = true,
		paginated = true,
		pageSize = 10,
		totalItems = undefined,
		currentPage = undefined,
		onPageChange = undefined,
		onSort = undefined
	}: {
		columns: Column[];
		data: any[];
		loading?: boolean;
		emptyMessage?: string;
		emptyActionLabel?: string;
		onEmptyAction?: () => void;
		sortable?: boolean;
		paginated?: boolean;
		pageSize?: number;
		totalItems?: number;
		currentPage?: number;
		onPageChange?: (page: number) => void;
		onSort?: (key: string, direction: 'asc' | 'desc') => void;
	} = $props();

	// Internal state
	let sortKey = $state<string | null>(null);
	let sortDirection = $state<'asc' | 'desc'>('asc');
	let page = $state(1);
	let selectedPageSize = $state(pageSize);

	// Server-side mode detection
	let isServerSide = $derived(totalItems !== undefined && onPageChange !== undefined);

	// Client-side sorted data
	let sortedData = $derived.by(() => {
		if (isServerSide || !sortKey) return data;

		return [...data].sort((a, b) => {
			const aVal = a[sortKey!];
			const bVal = b[sortKey!];

			if (aVal == null && bVal == null) return 0;
			if (aVal == null) return 1;
			if (bVal == null) return -1;

			const comparison = typeof aVal === 'string'
				? aVal.localeCompare(bVal)
				: aVal < bVal ? -1 : aVal > bVal ? 1 : 0;

			return sortDirection === 'asc' ? comparison : -comparison;
		});
	});

	// Client-side pagination
	let total = $derived(isServerSide ? totalItems! : sortedData.length);
	let activePage = $derived(isServerSide ? (currentPage ?? 1) : page);
	let totalPages = $derived(Math.max(1, Math.ceil(total / selectedPageSize)));
	let startIndex = $derived((activePage - 1) * selectedPageSize);
	let endIndex = $derived(Math.min(startIndex + selectedPageSize, total));

	let displayedData = $derived.by(() => {
		if (isServerSide) return data;
		if (!paginated) return sortedData;
		return sortedData.slice(startIndex, endIndex);
	});

	// Page numbers to display (with ellipsis logic)
	let pageNumbers = $derived.by(() => {
		const pages: (number | '...')[] = [];
		if (totalPages <= 7) {
			for (let i = 1; i <= totalPages; i++) pages.push(i);
		} else {
			pages.push(1);
			if (activePage > 3) pages.push('...');
			const start = Math.max(2, activePage - 1);
			const end = Math.min(totalPages - 1, activePage + 1);
			for (let i = start; i <= end; i++) pages.push(i);
			if (activePage < totalPages - 2) pages.push('...');
			pages.push(totalPages);
		}
		return pages;
	});

	function handleSort(key: string) {
		if (!sortable) return;
		const column = columns.find((c) => c.key === key);
		if (!column?.sortable) return;

		if (sortKey === key) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortKey = key;
			sortDirection = 'asc';
		}

		if (onSort) {
			onSort(key, sortDirection);
		}
	}

	function goToPage(p: number) {
		if (p < 1 || p > totalPages) return;
		if (isServerSide) {
			onPageChange?.(p);
		} else {
			page = p;
		}
	}

	function handlePageSizeChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		selectedPageSize = parseInt(target.value, 10);
		page = 1;
		if (isServerSide) {
			onPageChange?.(1);
		}
	}
</script>

<div class="w-full">
	{#if loading}
		<LoadingSkeleton variant="table" rows={selectedPageSize > 10 ? 10 : selectedPageSize} columns={columns.length} />
	{:else if data.length === 0}
		<EmptyState heading={emptyMessage} actionLabel={emptyActionLabel} onAction={onEmptyAction} />
	{:else}
		<!-- Table -->
		<div class="overflow-x-auto">
			<table class="w-full">
				<thead>
					<tr class="border-b border-gray-200 bg-gray-50">
						{#each columns as column}
							<th
								class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500
									{sortable && column.sortable ? 'cursor-pointer select-none hover:text-gray-700' : ''}"
								onclick={() => handleSort(column.key)}
							>
								<div class="flex items-center gap-1">
									{column.label}
									{#if sortable && column.sortable}
										{#if sortKey === column.key}
											{#if sortDirection === 'asc'}
												<ArrowUp size={14} class="text-blue-600" />
											{:else}
												<ArrowDown size={14} class="text-blue-600" />
											{/if}
										{:else}
											<ArrowUpDown size={14} class="text-gray-400" />
										{/if}
									{/if}
								</div>
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each displayedData as row, rowIndex}
						<tr class="border-b border-gray-100 hover:bg-gray-50">
							{#each columns as column}
								<td class="px-4 py-3 text-sm text-gray-900">
									{#if column.render}
										{@render column.render(row)}
									{:else}
										{row[column.key] ?? ''}
									{/if}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Pagination -->
		{#if paginated && total > selectedPageSize}
			<div class="flex items-center justify-between border-t border-gray-200 pt-4 mt-4">
				<div class="flex items-center gap-3">
					<span class="text-sm text-gray-500">
						Showing {startIndex + 1}-{endIndex} of {total}
					</span>
					<select
						value={selectedPageSize}
						onchange={handlePageSizeChange}
						class="rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-700 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
					>
						<option value={10}>10</option>
						<option value={25}>25</option>
						<option value={50}>50</option>
					</select>
				</div>

				<div class="flex items-center gap-1">
					<button
						type="button"
						disabled={activePage <= 1}
						onclick={() => goToPage(activePage - 1)}
						class="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
						aria-label="Previous page"
					>
						<ChevronLeft size={16} />
					</button>

					{#each pageNumbers as pn}
						{#if pn === '...'}
							<span class="px-2 text-sm text-gray-400">...</span>
						{:else}
							<button
								type="button"
								onclick={() => goToPage(pn as number)}
								class="rounded-md px-3 py-1 text-sm
									{activePage === pn
										? 'bg-blue-600 font-medium text-white'
										: 'text-gray-700 hover:bg-gray-100'}"
							>
								{pn}
							</button>
						{/if}
					{/each}

					<button
						type="button"
						disabled={activePage >= totalPages}
						onclick={() => goToPage(activePage + 1)}
						class="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
						aria-label="Next page"
					>
						<ChevronRight size={16} />
					</button>
				</div>
			</div>
		{/if}
	{/if}
</div>
