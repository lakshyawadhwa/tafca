<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { Plus, Search, Pencil, Trash2, Users, SearchX } from 'lucide-svelte';
	import {
		Button, DataTable, Select, FilterBar, EmptyState, ConfirmDialog, StatusBadge
	} from '$lib/components/ui';
	import UserPicker from '$lib/components/ui/UserPicker.svelte';
	import { api } from '$lib/utils/api';
	import { addToast } from '$lib/stores/toast.svelte';
	import { EntityType, ClientStatus } from '@ca-practice-os/shared';

	let { data } = $props();

	// Local search state with debounce
	let searchInput = $state(data.filters.search ?? '');
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	// Confirm dialog state
	let confirmOpen = $state(false);
	let deleteClientId = $state<string | null>(null);
	let deleteClientName = $state('');

	// Filter options
	const statusOptions = [
		{ value: '', label: 'All statuses' },
		...Object.values(ClientStatus).map((v) => ({
			value: v,
			label: v.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())
		}))
	];

	const entityTypeOptions = [
		{ value: '', label: 'All types' },
		...Object.values(EntityType).map((v) => ({
			value: v,
			label: v.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())
		}))
	];

	// Determine display state
	let hasFilters = $derived(
		!!(data.filters.search || data.filters.status || data.filters.entityType || data.filters.assignedPartnerId)
	);
	let isEmpty = $derived(data.clients.length === 0 && !hasFilters);
	let isFilteredEmpty = $derived(data.clients.length === 0 && hasFilters);

	function formatEntityType(value: string): string {
		if (!value) return '--';
		return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase());
	}

	// DataTable columns
	const columns = [
		{ key: 'displayName', label: 'Name', sortable: true },
		{ key: 'entityType', label: 'Entity Type', sortable: true },
		{ key: 'pan', label: 'PAN', sortable: false },
		{ key: 'status', label: 'Status', sortable: true },
		{ key: 'assignedPartner', label: 'Partner', sortable: false },
		{ key: '_count', label: 'Open Tasks', sortable: false },
		{ key: 'actions', label: '', sortable: false },
	];

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
		goto('/clients', { replaceState: true });
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

	function confirmDelete(client: any) {
		deleteClientId = client.id;
		deleteClientName = client.displayName;
		confirmOpen = true;
	}

	async function executeDelete() {
		if (!deleteClientId) return;
		try {
			await api(`/clients/${deleteClientId}`, { method: 'DELETE' });
			addToast(`${deleteClientName} deleted successfully`, 'success');
			confirmOpen = false;
			deleteClientId = null;
			await invalidateAll();
		} catch (err: any) {
			addToast(err.message ?? 'Failed to delete client', 'error');
		}
	}
</script>

<svelte:head>
	<title>Clients -- CA Practice OS</title>
</svelte:head>

<div>
	<!-- Page Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-xl font-semibold text-gray-900">Clients</h1>
			<p class="mt-1 text-sm text-gray-500">Manage your client base</p>
		</div>
		<Button variant="primary" onclick={() => goto('/clients/new')}>
			<Plus size={16} class="mr-1.5" />
			Add Client
		</Button>
	</div>

	{#if isEmpty}
		<div class="mt-6">
			<EmptyState
				icon={Users}
				heading="No clients yet"
				body="Add your first client to start managing engagements and tasks."
				actionLabel="Add Client"
				onAction={() => goto('/clients/new')}
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
					placeholder="Search by name or PAN..."
					class="h-10 w-full rounded-md border border-gray-200 pl-9 pr-4 text-sm text-gray-900 placeholder:text-gray-400 hover:border-gray-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
				/>
			</div>

			<FilterBar>
				<div class="min-w-[140px]">
					<Select
						options={statusOptions}
						value={data.filters.status}
						onSelect={(val) => updateFilters('status', val)}
						placeholder="All statuses"
						label="Status"
					/>
				</div>
				<div class="min-w-[160px]">
					<Select
						options={entityTypeOptions}
						value={data.filters.entityType}
						onSelect={(val) => updateFilters('entityType', val)}
						placeholder="All types"
						label="Entity Type"
					/>
				</div>
				<div class="min-w-[180px]">
					<span class="mb-1 block text-xs font-semibold text-gray-500">Partner</span>
					<UserPicker
						value={data.filters.assignedPartnerId || null}
						onSelect={(id) => updateFilters('assignedPartnerId', id)}
						options={data.users}
						roleFilter={['PARTNER']}
						placeholder="All partners"
					/>
				</div>
			</FilterBar>
		</div>

		<!-- DataTable -->
		<div class="mt-4 rounded-lg border border-gray-200 bg-white shadow-sm">
			{#if isFilteredEmpty}
				<EmptyState
					icon={SearchX}
					heading="No clients match your filters"
					body="Try adjusting your search or filters."
					actionLabel="Clear filters"
					onAction={clearFilters}
				/>
			{:else}
				{#snippet nameRender(row: any)}
					<a href="/clients/{row.id}" class="font-medium text-blue-600 hover:text-blue-800 hover:underline">
						{row.displayName}
					</a>
				{/snippet}

				{#snippet entityTypeRender(row: any)}
					<span>{formatEntityType(row.entityType)}</span>
				{/snippet}

				{#snippet panRender(row: any)}
					<span class="font-mono text-sm">{row.pan ?? '--'}</span>
				{/snippet}

				{#snippet statusRender(row: any)}
					<StatusBadge status={row.status} type="client" />
				{/snippet}

				{#snippet partnerRender(row: any)}
					<span class={row.assignedPartner?.fullName ? 'text-gray-900' : 'text-gray-400'}>
						{row.assignedPartner?.fullName ?? '--'}
					</span>
				{/snippet}

				{#snippet openTasksRender(row: any)}
					{@const count = row._count?.engagements ?? 0}
					<span class="text-right {count > 0 ? 'text-gray-900' : 'text-gray-400'}">{count}</span>
				{/snippet}

				{#snippet actionsRender(row: any)}
					<div class="flex items-center gap-1">
						<button
							type="button"
							onclick={() => goto(`/clients/${row.id}/edit`)}
							class="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
							aria-label="Edit {row.displayName}"
						>
							<Pencil size={14} />
						</button>
						<button
							type="button"
							onclick={() => confirmDelete(row)}
							class="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600"
							aria-label="Delete {row.displayName}"
						>
							<Trash2 size={14} />
						</button>
					</div>
				{/snippet}

				<DataTable
					columns={[
						{ key: 'displayName', label: 'Name', sortable: true, render: nameRender },
						{ key: 'entityType', label: 'Entity Type', sortable: true, render: entityTypeRender },
						{ key: 'pan', label: 'PAN', sortable: false, render: panRender },
						{ key: 'status', label: 'Status', sortable: true, render: statusRender },
						{ key: 'assignedPartner', label: 'Partner', sortable: false, render: partnerRender },
						{ key: '_count', label: 'Open Tasks', sortable: false, render: openTasksRender },
						{ key: 'actions', label: '', sortable: false, render: actionsRender },
					]}
					data={data.clients}
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

<ConfirmDialog
	open={confirmOpen}
	title="Delete Client"
	message="Are you sure you want to delete {deleteClientName}? This action cannot be undone."
	confirmLabel="Delete"
	variant="danger"
	onConfirm={executeDelete}
	onCancel={() => { confirmOpen = false; }}
/>
