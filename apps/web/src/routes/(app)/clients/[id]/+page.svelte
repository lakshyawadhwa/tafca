<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import {
		Pencil, Trash2, Plus, Check, MoreHorizontal
	} from 'lucide-svelte';
	import {
		Button, Tabs, StatusBadge, ConfirmDialog, DataTable, EmptyState, InlineEdit
	} from '$lib/components/ui';
	import StatusTransitionDropdown from '$lib/components/ui/StatusTransitionDropdown.svelte';
	import GstNumberModal from '$lib/components/client/GstNumberModal.svelte';
	import EngagementCreateModal from '$lib/components/engagement/EngagementCreateModal.svelte';
	import { api } from '$lib/utils/api';
	import { addToast } from '$lib/stores/toast.svelte';
	import { ENGAGEMENT_STATUS_TRANSITIONS } from '@ca-practice-os/shared';

	let { data } = $props();

	// Tab state
	let activeTab = $state(data.activeTab);

	function handleTabChange(tabId: string) {
		activeTab = tabId;
		const url = new URL($page.url);
		url.searchParams.set('tab', tabId);
		goto(url.toString(), { replaceState: true, noScroll: true });
	}

	// Tab definitions
	let tabs = $derived([
		{ id: 'overview', label: 'Overview' },
		{ id: 'engagements', label: 'Engagements', count: data.engagements.length },
		{ id: 'tasks', label: 'Tasks', count: 0 },
	]);

	// Delete client
	let deleteConfirmOpen = $state(false);

	async function deleteClient() {
		try {
			await api(`/clients/${data.client.id}`, { method: 'DELETE' });
			addToast('Client deleted successfully', 'success');
			goto('/clients');
		} catch (err: any) {
			addToast(err.message ?? 'Failed to delete client', 'error');
		}
		deleteConfirmOpen = false;
	}

	// Inline edit handler
	async function saveField(field: string, value: string) {
		await api(`/clients/${data.client.id}`, {
			method: 'PATCH',
			body: JSON.stringify({ [field]: value || null }),
		});
		await invalidateAll();
	}

	// GST Number Modal
	let gstModalOpen = $state(false);
	let editingGst = $state<any>(undefined);

	function openGstModal(gst?: any) {
		editingGst = gst ?? undefined;
		gstModalOpen = true;
	}

	async function handleGstSaved() {
		gstModalOpen = false;
		editingGst = undefined;
		await invalidateAll();
	}

	async function deleteGst(gstId: string) {
		try {
			await api(`/clients/${data.client.id}/gst-numbers/${gstId}`, { method: 'DELETE' });
			addToast('GST number removed', 'success');
			await invalidateAll();
		} catch (err: any) {
			addToast(err.message ?? 'Failed to delete GST number', 'error');
		}
	}

	async function setPrimaryGst(gstId: string) {
		try {
			await api(`/clients/${data.client.id}/gst-numbers/${gstId}`, {
				method: 'PATCH',
				body: JSON.stringify({ isPrimary: true }),
			});
			addToast('Primary GST number updated', 'success');
			await invalidateAll();
		} catch (err: any) {
			addToast(err.message ?? 'Failed to set primary', 'error');
		}
	}

	// Engagement Create Modal
	let engCreateOpen = $state(false);

	async function handleEngCreated() {
		engCreateOpen = false;
		await invalidateAll();
	}

	// Status transition confirmations
	let statusConfirmOpen = $state(false);
	let statusConfirmTitle = $state('');
	let statusConfirmMessage = $state('');
	let statusConfirmLabel = $state('');
	let statusConfirmVariant = $state<'danger' | 'default'>('default');
	let pendingStatusChange = $state<{ engagementId: string; newStatus: string } | null>(null);

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

	function formatEntityType(value: string): string {
		if (!value) return '';
		return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase());
	}

	function findUserName(userId: string | null): string {
		if (!userId) return 'Unassigned';
		const user = data.users.find((u: any) => u.id === userId);
		return user?.fullName ?? 'Unknown';
	}
</script>

<svelte:head>
	<title>{data.client.displayName} -- CA Practice OS</title>
</svelte:head>

<div>
	<!-- Page Header -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-3">
			<h1 class="text-xl font-semibold text-gray-900">{data.client.displayName}</h1>
			<span class="rounded-full bg-gray-100 border border-gray-200 px-2.5 py-0.5 text-xs font-medium text-gray-700">
				{formatEntityType(data.client.entityType)}
			</span>
			<StatusBadge status={data.client.status} type="client" />
		</div>
		<div class="flex items-center gap-2">
			<Button variant="secondary" onclick={() => goto(`/clients/${data.client.id}/edit`)}>
				<Pencil size={14} class="mr-1.5" />
				Edit
			</Button>
			<Button variant="danger" onclick={() => { deleteConfirmOpen = true; }}>
				<Trash2 size={14} class="mr-1.5" />
				Delete
			</Button>
		</div>
	</div>

	<!-- Tabs -->
	<div class="mt-6">
		<Tabs {tabs} {activeTab} onTabChange={handleTabChange} />
	</div>

	<!-- Tab Content -->
	<div class="mt-6">
		{#if activeTab === 'overview'}
			<!-- OVERVIEW TAB -->
			<div class="grid grid-cols-1 gap-6 lg:grid-cols-5">
				<!-- Left column: Client Information -->
				<div class="lg:col-span-3">
					<div class="rounded-lg border border-gray-200 bg-white p-6">
						<h2 class="mb-4 text-sm font-semibold text-gray-900">Client Information</h2>
						<div class="grid grid-cols-2 gap-y-3">
							<span class="text-sm font-semibold text-gray-500">Entity Type</span>
							<InlineEdit
								value={formatEntityType(data.client.entityType)}
								onSave={(val) => saveField('entityType', val)}
							/>

							<span class="text-sm font-semibold text-gray-500">Constitution</span>
							<InlineEdit
								value={data.client.constitution ? formatEntityType(data.client.constitution) : ''}
								onSave={(val) => saveField('constitution', val)}
							/>

							<span class="text-sm font-semibold text-gray-500">PAN</span>
							<InlineEdit
								value={data.client.pan ?? ''}
								onSave={(val) => saveField('pan', val)}
								inputClass="font-mono"
							/>

							<span class="text-sm font-semibold text-gray-500">TAN</span>
							<InlineEdit
								value={data.client.tan ?? ''}
								onSave={(val) => saveField('tan', val)}
								inputClass="font-mono"
							/>

							<span class="text-sm font-semibold text-gray-500">CIN</span>
							<InlineEdit
								value={data.client.cin ?? ''}
								onSave={(val) => saveField('cin', val)}
								inputClass="font-mono"
							/>

							<span class="text-sm font-semibold text-gray-500">Contact Person</span>
							<InlineEdit
								value={data.client.contactPerson ?? ''}
								onSave={(val) => saveField('contactPerson', val)}
							/>

							<span class="text-sm font-semibold text-gray-500">Phone</span>
							<InlineEdit
								value={data.client.phone ?? ''}
								onSave={(val) => saveField('phone', val)}
							/>

							<span class="text-sm font-semibold text-gray-500">Email</span>
							<InlineEdit
								value={data.client.email ?? ''}
								onSave={(val) => saveField('email', val)}
							/>

							<span class="text-sm font-semibold text-gray-500">Address</span>
							<InlineEdit
								value={data.client.address ?? ''}
								onSave={(val) => saveField('address', val)}
							/>

							<span class="text-sm font-semibold text-gray-500">Notes</span>
							<InlineEdit
								value={data.client.notes ?? ''}
								onSave={(val) => saveField('notes', val)}
							/>
						</div>
					</div>
				</div>

				<!-- Right column: GST Numbers + Team -->
				<div class="lg:col-span-2 flex flex-col gap-6">
					<!-- GST Numbers -->
					<div class="rounded-lg border border-gray-200 bg-white p-6">
						<div class="mb-4 flex items-center justify-between">
							<h2 class="text-sm font-semibold text-gray-900">GST Numbers</h2>
							<Button variant="secondary" size="sm" onclick={() => openGstModal()}>
								<Plus size={14} class="mr-1" />
								Add GST
							</Button>
						</div>

						{#if !data.client.gstNumbers || data.client.gstNumbers.length === 0}
							<p class="text-sm text-gray-500">No GST numbers added</p>
						{:else}
							<div class="overflow-x-auto">
								<table class="w-full">
									<thead>
										<tr class="border-b border-gray-200">
											<th class="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">GSTIN</th>
											<th class="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">State</th>
											<th class="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Primary</th>
											<th class="pb-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
										</tr>
									</thead>
									<tbody>
										{#each data.client.gstNumbers as gst}
											<tr class="border-b border-gray-100">
												<td class="py-2 font-mono text-sm text-gray-900">{gst.gstin}</td>
												<td class="py-2 text-sm text-gray-700">{gst.stateCode}</td>
												<td class="py-2">
													{#if gst.isPrimary}
														<Check size={16} class="text-green-600" />
													{:else}
														<span class="text-gray-400">--</span>
													{/if}
												</td>
												<td class="py-2 text-right">
													<div class="flex items-center justify-end gap-1">
														{#if !gst.isPrimary}
															<button
																type="button"
																onclick={() => setPrimaryGst(gst.id)}
																class="text-xs text-blue-600 hover:text-blue-800"
															>
																Set Primary
															</button>
														{/if}
														<button
															type="button"
															onclick={() => openGstModal(gst)}
															class="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
															aria-label="Edit GST"
														>
															<Pencil size={12} />
														</button>
														<button
															type="button"
															onclick={() => deleteGst(gst.id)}
															class="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600"
															aria-label="Delete GST"
														>
															<Trash2 size={12} />
														</button>
													</div>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						{/if}
					</div>

					<!-- Team Assignment -->
					<div class="rounded-lg border border-gray-200 bg-white p-6">
						<h2 class="mb-4 text-sm font-semibold text-gray-900">Team</h2>
						<div class="flex flex-col gap-3">
							{#each [
								{ label: 'PARTNER', userId: data.client.assignedPartnerId },
								{ label: 'MANAGER', userId: data.client.assignedManagerId },
								{ label: 'JUNIOR CA', userId: data.client.assignedJuniorCaId },
								{ label: 'ARTICLE', userId: data.client.assignedArticleId },
							] as role}
								<div class="flex items-center justify-between">
									<span class="text-xs font-semibold uppercase text-gray-500">{role.label}</span>
									<span class="text-sm {role.userId ? 'text-gray-900' : 'italic text-gray-400'}">
										{findUserName(role.userId)}
									</span>
								</div>
							{/each}
						</div>
					</div>
				</div>
			</div>

		{:else if activeTab === 'engagements'}
			<!-- ENGAGEMENTS TAB -->
			<div class="mb-4 flex items-center justify-end">
				<Button variant="primary" onclick={() => { engCreateOpen = true; }}>
					<Plus size={16} class="mr-1.5" />
					New Engagement
				</Button>
			</div>

			{#if data.engagements.length === 0}
				<EmptyState
					heading="No engagements yet"
					body="Create the first engagement for this client."
					actionLabel="New Engagement"
					onAction={() => { engCreateOpen = true; }}
				/>
			{:else}
				{#snippet engNameRender(row: any)}
					<span class="font-medium text-gray-900">{row.name}</span>
				{/snippet}

				{#snippet engTypeRender(row: any)}
					<span>{row.engagementType?.name ?? '--'}</span>
				{/snippet}

				{#snippet engStatusRender(row: any)}
					<StatusTransitionDropdown
						currentStatus={row.status}
						transitions={ENGAGEMENT_STATUS_TRANSITIONS}
						onTransition={(newStatus) => handleStatusTransition(row.id, newStatus)}
						entityType="engagement"
					/>
				{/snippet}

				{#snippet engPeriodRender(row: any)}
					<span class={row.periodLabel ? 'text-gray-900' : 'text-gray-400'}>{row.periodLabel ?? '--'}</span>
				{/snippet}

				{#snippet engPartnerRender(row: any)}
					<span class={row.assignedPartner?.fullName ? 'text-gray-900' : 'text-gray-400'}>
						{row.assignedPartner?.fullName ?? '--'}
					</span>
				{/snippet}

				{#snippet engProgressRender(row: any)}
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

				<div class="rounded-lg border border-gray-200 bg-white shadow-sm">
					<DataTable
						columns={[
							{ key: 'name', label: 'Name', sortable: true, render: engNameRender },
							{ key: 'engagementType', label: 'Type', sortable: true, render: engTypeRender },
							{ key: 'status', label: 'Status', sortable: true, render: engStatusRender },
							{ key: 'periodLabel', label: 'Period', sortable: false, render: engPeriodRender },
							{ key: 'assignedPartner', label: 'Partner', sortable: false, render: engPartnerRender },
							{ key: 'taskProgress', label: 'Progress', sortable: false, render: engProgressRender },
						]}
						data={data.engagements}
						paginated={false}
					/>
				</div>
			{/if}

		{:else if activeTab === 'tasks'}
			<!-- TASKS TAB -->
			<EmptyState
				heading="No tasks yet"
				body="Tasks will appear here when engagements have tasks."
			/>
		{/if}
	</div>
</div>

<!-- GST Number Modal -->
<GstNumberModal
	open={gstModalOpen}
	clientId={data.client.id}
	gstNumber={editingGst}
	onClose={() => { gstModalOpen = false; editingGst = undefined; }}
	onSaved={handleGstSaved}
/>

<!-- Engagement Create Modal -->
<EngagementCreateModal
	open={engCreateOpen}
	clientId={data.client.id}
	clients={data.clients}
	engagementTypes={data.engagementTypes}
	onClose={() => { engCreateOpen = false; }}
	onCreated={handleEngCreated}
/>

<!-- Delete Client Confirm -->
<ConfirmDialog
	open={deleteConfirmOpen}
	title="Delete Client"
	message="Are you sure you want to delete {data.client.displayName}? This action cannot be undone."
	confirmLabel="Delete"
	variant="danger"
	onConfirm={deleteClient}
	onCancel={() => { deleteConfirmOpen = false; }}
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
