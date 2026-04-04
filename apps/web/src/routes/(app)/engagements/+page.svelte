<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { Plus, Search, Briefcase, SearchX } from 'lucide-svelte';
	import {
		Button, DataTable, Select, FilterBar, EmptyState,
		ConfirmDialog, StatusBadge, GroupedSelect
	} from '$lib/components/ui';
	import ClientPicker from '$lib/components/ui/ClientPicker.svelte';
	import StatusTransitionDropdown from '$lib/components/ui/StatusTransitionDropdown.svelte';
	import EngagementCreateModal from '$lib/components/engagement/EngagementCreateModal.svelte';
	import { api } from '$lib/utils/api';
	import { addToast } from '$lib/stores/toast.svelte';
	import { EngagementStatus, ENGAGEMENT_STATUS_TRANSITIONS } from '@ca-practice-os/shared';

	let { data } = $props();

	// Search state
	let searchInput = $state(data.filters.search ?? '');
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	// Create modal
	let createModalOpen = $state(false);

	// Status transition confirm
	let statusConfirmOpen = $state(false);
	let statusConfirmTitle = $state('');
	let statusConfirmMessage = $state('');
	let statusConfirmLabel = $state('');
	let statusConfirmVariant = $state<'danger' | 'default'>('default');
	let pendingStatusChange = $state<{ engagementId: string; newStatus: string } | null>(null);

	// Filter options
	const statusOptions = [
		{ value: '', label: 'All statuses' },
		...Object.values(EngagementStatus).map((v) => ({
			value: v,
			label: v.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())
		}))
	];

	// Group engagement types by category for filter
	let typeGroups = $derived.by(() => {
		const groupMap = new Map<string, Array<{ value: string; label: string }>>();
		// Add "All types" as an empty option
		for (const t of data.engagementTypes) {
			const category = (t.category ?? 'Other')
				.replace(/_/g, ' ')
				.toLowerCase()
				.replace(/\b\w/g, (c: string) => c.toUpperCase());
			if (!groupMap.has(category)) {
				groupMap.set(category, []);
			}
			groupMap.get(category)!.push({ value: t.id, label: t.name });
		}
		return Array.from(groupMap.entries()).map(([label, options]) => ({ label, options }));
	});

	// Display state
	let hasFilters = $derived(
		!!(data.filters.search || data.filters.clientId || data.filters.engagementTypeId || data.filters.status)
	);
	let isEmpty = $derived(data.engagements.length === 0 && !hasFilters);
	let isFilteredEmpty = $derived(data.engagements.length === 0 && hasFilters);

	function updateFilters(key: string, value: string) {
		const url = new URL($page.url);
		if (value) {
			url.searchParams.set(key, value);
		} else {
			url.searchParams.delete(key);
		}
		url.searchParams.set('page', '1');
		goto(url.toString(), { replaceState: true, noScroll: true });
	}

	function handleSearch() {
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			updateFilters('search', searchInput);
		}, 300);
	}

	function clearFilters() {
		searchInput = '';
		goto('/engagements', { replaceState: true });
	}

	function handlePageChange(newPage: number) {
		const url = new URL($page.url);
		url.searchParams.set('page', String(newPage));
		goto(url.toString(), { replaceState: true, noScroll: true });
	}

	function handleSort(key: string, direction: 'asc' | 'desc') {
		const url = new URL($page.url);
		url.searchParams.set('sortBy', key);
		url.searchParams.set('sortOrder', direction);
		url.searchParams.set('page', '1');
		goto(url.toString(), { replaceState: true, noScroll: true });
	}

	function handleStatusTransition(engagementId: string, newStatus: string) {
		if (newStatus === 'COMPLETED') {
			statusConfirmTitle = 'Complete this engagement?';
			statusConfirmMessage = 'This is permanent. The engagement cannot be reopened.';
			statusConfirmLabel = 'Complete';
			statusConfirmVariant = 'default';
			pendingStatusChange = { engagementId, newStatus };
			statusConfirmOpen = true;
		} else if (newStatus === 'CANCELLED') {
			statusConfirmTitle = 'Cancel this engagement?';
			statusConfirmMessage = 'This will permanently cancel this engagement and its open tasks. This action cannot be undone.';
			statusConfirmLabel = 'Cancel Engagement';
			statusConfirmVariant = 'danger';
			pendingStatusChange = { engagementId, newStatus };
			statusConfirmOpen = true;
		} else {
			executeStatusChange(engagementId, newStatus);
		}
	}

	async function executeStatusChange(engagementId: string, newStatus: string) {
		try {
			await api(`/engagements/${engagementId}/status`, {
				method: 'PATCH',
				body: JSON.stringify({ status: newStatus }),
			});
			addToast('Engagement status updated', 'success');
			await invalidateAll();
		} catch (err: any) {
			addToast(err.message ?? 'Failed to update status', 'error');
		}
	}

	async function confirmStatusChange() {
		if (pendingStatusChange) {
			await executeStatusChange(pendingStatusChange.engagementId, pendingStatusChange.newStatus);
		}
		statusConfirmOpen = false;
		pendingStatusChange = null;
	}

	async function handleCreated() {
		createModalOpen = false;
		await invalidateAll();
	}
</script>

<svelte:head>
	<title>Engagements -- CA Practice OS</title>
</svelte:head>

<div>
	<!-- Page Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-xl font-semibold text-gray-900">Engagements</h1>
			<p class="mt-1 text-sm text-gray-500">Track engagement lifecycle</p>
		</div>
		<Button variant="primary" onclick={() => { createModalOpen = true; }}>
			<Plus size={16} class="mr-1.5" />
			New Engagement
		</Button>
	</div>

	{#if isEmpty}
		<div class="mt-6">
			<EmptyState
				icon={Briefcase}
				heading="No engagements yet"
				body="Create your first engagement to start tracking work."
				actionLabel="New Engagement"
				onAction={() => { createModalOpen = true; }}
			/>
		</div>
	{:else}
		<!-- Search & Filters -->
		<div class="mt-4">
			<div class="relative mb-3 max-w-xs">
				<Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
				<input
					type="text"
					bind:value={searchInput}
					oninput={handleSearch}
					placeholder="Search engagements..."
					class="h-10 w-full rounded-md border border-gray-200 pl-9 pr-4 text-sm text-gray-900 placeholder:text-gray-400 hover:border-gray-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
				/>
			</div>

			<FilterBar>
				<div class="min-w-[180px]">
					<span class="mb-1 block text-xs font-semibold text-gray-500">Client</span>
					<ClientPicker
						value={data.filters.clientId || null}
						onSelect={(id) => updateFilters('clientId', id)}
						options={data.clients}
						placeholder="All clients"
					/>
				</div>
				<div class="min-w-[180px]">
					<span class="mb-1 block text-xs font-semibold text-gray-500">Type</span>
					<GroupedSelect
						groups={typeGroups}
						value={data.filters.engagementTypeId || null}
						onSelect={(val) => updateFilters('engagementTypeId', val)}
						placeholder="All types"
					/>
				</div>
				<div class="min-w-[140px]">
					<Select
						options={statusOptions}
						value={data.filters.status}
						onSelect={(val) => updateFilters('status', val)}
						placeholder="All statuses"
						label="Status"
					/>
				</div>
			</FilterBar>
		</div>

		<!-- DataTable -->
		<div class="mt-4 rounded-lg border border-gray-200 bg-white shadow-sm">
			{#if isFilteredEmpty}
				<EmptyState
					icon={SearchX}
					heading="No engagements match your filters"
					body="Try adjusting your search or filters."
					actionLabel="Clear filters"
					onAction={clearFilters}
				/>
			{:else}
				{#snippet engNameRender(row: any)}
					<a
						href="/clients/{row.client?.id ?? row.clientId}?tab=engagements"
						class="font-medium text-blue-600 hover:text-blue-800 hover:underline"
					>
						{row.name}
					</a>
				{/snippet}

				{#snippet clientRender(row: any)}
					<span>{row.client?.displayName ?? '--'}</span>
				{/snippet}

				{#snippet typeRender(row: any)}
					<span>{row.engagementType?.name ?? '--'}</span>
				{/snippet}

				{#snippet statusRender(row: any)}
					<StatusTransitionDropdown
						currentStatus={row.status}
						transitions={ENGAGEMENT_STATUS_TRANSITIONS}
						onTransition={(newStatus) => handleStatusTransition(row.id, newStatus)}
						entityType="engagement"
					/>
				{/snippet}

				{#snippet periodRender(row: any)}
					<span class={row.periodLabel ? 'text-gray-900' : 'text-gray-400'}>{row.periodLabel ?? '--'}</span>
				{/snippet}

				{#snippet partnerRender(row: any)}
					<span class={row.assignedPartner?.fullName ? 'text-gray-900' : 'text-gray-400'}>
						{row.assignedPartner?.fullName ?? '--'}
					</span>
				{/snippet}

				{#snippet progressRender(row: any)}
					{@const done = row.taskDoneCount ?? 0}
					{@const total = row.taskTotalCount ?? 0}
					<div class="flex flex-col gap-1">
						<span class="text-xs text-gray-600">{done}/{total} done</span>
						{#if total > 0}
							<div class="h-1 w-12 rounded-full bg-gray-200">
								<div
									class="h-1 rounded-full bg-green-600"
									style="width: {Math.round((done / total) * 100)}%"
								></div>
							</div>
						{/if}
					</div>
				{/snippet}

				<DataTable
					columns={[
						{ key: 'name', label: 'Name', sortable: true, render: engNameRender },
						{ key: 'client', label: 'Client', sortable: true, render: clientRender },
						{ key: 'engagementType', label: 'Type', sortable: true, render: typeRender },
						{ key: 'status', label: 'Status', sortable: true, render: statusRender },
						{ key: 'periodLabel', label: 'Period', sortable: false, render: periodRender },
						{ key: 'assignedPartner', label: 'Partner', sortable: false, render: partnerRender },
						{ key: 'taskProgress', label: 'Progress', sortable: false, render: progressRender },
					]}
					data={data.engagements}
					totalItems={data.meta.total}
					currentPage={data.meta.page}
					onPageChange={handlePageChange}
					onSort={handleSort}
					pageSize={data.meta.limit}
				/>
			{/if}
		</div>
	{/if}
</div>

<!-- Engagement Create Modal -->
<EngagementCreateModal
	open={createModalOpen}
	clients={data.clients}
	engagementTypes={data.engagementTypes}
	onClose={() => { createModalOpen = false; }}
	onCreated={handleCreated}
/>

<!-- Status Change Confirm -->
<ConfirmDialog
	open={statusConfirmOpen}
	title={statusConfirmTitle}
	message={statusConfirmMessage}
	confirmLabel={statusConfirmLabel}
	variant={statusConfirmVariant}
	onConfirm={confirmStatusChange}
	onCancel={() => { statusConfirmOpen = false; pendingStatusChange = null; }}
/>
