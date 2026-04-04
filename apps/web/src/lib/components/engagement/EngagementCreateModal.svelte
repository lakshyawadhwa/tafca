<script lang="ts">
	import { Modal, Button, FormField, Input, GroupedSelect } from '$lib/components/ui';
	import ClientPicker from '$lib/components/ui/ClientPicker.svelte';
	import DatePicker from '$lib/components/ui/DatePicker.svelte';
	import TemplatePreview from './TemplatePreview.svelte';
	import { api } from '$lib/utils/api';
	import { addToast } from '$lib/stores/toast.svelte';
	import { ChevronDown } from 'lucide-svelte';

	type ClientOption = {
		id: string;
		displayName: string;
		status: string;
	};

	type EngagementType = {
		id: string;
		name: string;
		category: string;
		description?: string;
	};

	type TemplateItem = {
		title: string;
		assigneeRole: string;
		displayOrder: number;
	};

	let {
		open,
		clientId = null,
		clients = [],
		engagementTypes = [],
		onClose,
		onCreated
	}: {
		open: boolean;
		clientId?: string | null;
		clients?: ClientOption[];
		engagementTypes?: EngagementType[];
		onClose: () => void;
		onCreated: () => void;
	} = $props();

	// Form state
	let selectedClientId = $state<string | null>(clientId);
	let selectedTypeId = $state<string | null>(null);
	let periodLabel = $state('');
	let periodStart = $state<string | null>(null);
	let periodEnd = $state<string | null>(null);
	let autoCreateTasks = $state(false);
	let feeAmount = $state('');
	let notes = $state('');
	let showMoreOptions = $state(false);

	let templateItems = $state<TemplateItem[]>([]);
	let templateLoading = $state(false);
	let isSaving = $state(false);

	// Derived state
	let isClientPreselected = $derived(!!clientId);

	let selectedType = $derived(engagementTypes.find((t) => t.id === selectedTypeId));

	// Selected client for inheritance display
	let selectedClient = $derived(clients.find((c) => c.id === selectedClientId));

	// Group engagement types by category
	let typeGroups = $derived.by(() => {
		const groupMap = new Map<string, Array<{ value: string; label: string }>>();
		for (const t of engagementTypes) {
			const category = t.category
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

	let showTemplatePreview = $derived(!!selectedTypeId && autoCreateTasks);

	// Reset form when modal opens
	$effect(() => {
		if (open) {
			selectedClientId = clientId;
			selectedTypeId = null;
			periodLabel = '';
			periodStart = null;
			periodEnd = null;
			autoCreateTasks = false;
			feeAmount = '';
			notes = '';
			showMoreOptions = false;
			templateItems = [];
		}
	});

	// Fetch template when type is selected and autoCreateTasks is checked
	$effect(() => {
		if (selectedTypeId && autoCreateTasks) {
			fetchTemplate(selectedTypeId);
		} else {
			templateItems = [];
		}
	});

	async function fetchTemplate(typeId: string) {
		templateLoading = true;
		try {
			const items = await api<TemplateItem[]>(`/engagement-types/${typeId}/template`);
			templateItems = items;
		} catch {
			templateItems = [];
		} finally {
			templateLoading = false;
		}
	}

	async function handleSubmit() {
		if (!selectedClientId || !selectedTypeId) return;

		isSaving = true;
		try {
			const body: Record<string, any> = {
				clientId: selectedClientId,
				engagementTypeId: selectedTypeId,
				autoCreateTasks,
			};
			if (periodLabel) body.periodLabel = periodLabel.trim();
			if (periodStart) body.periodStart = periodStart;
			if (periodEnd) body.periodEnd = periodEnd;
			if (feeAmount) body.feeAmount = parseFloat(feeAmount);
			if (notes) body.notes = notes.trim();

			const result = await api<any>('/engagements', {
				method: 'POST',
				body: JSON.stringify(body),
			});

			const taskInfo = autoCreateTasks && result.taskCount
				? ` with ${result.taskCount} tasks`
				: '';
			addToast(`Engagement created successfully${taskInfo}`, 'success');
			onCreated();
		} catch (err: any) {
			addToast(err.message ?? 'Failed to create engagement', 'error');
		} finally {
			isSaving = false;
		}
	}
</script>

<Modal {open} title="New Engagement" size="lg" onClose={onClose}>
	<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="flex flex-col gap-4">
		<!-- Client Picker -->
		<FormField label="Client" required>
			{#if isClientPreselected}
				<div class="flex items-center rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
					{selectedClient?.displayName ?? 'Selected client'}
				</div>
			{:else}
				<ClientPicker
					value={selectedClientId}
					onSelect={(id) => { selectedClientId = id; }}
					options={clients}
					placeholder="Select a client"
				/>
			{/if}
		</FormField>

		<!-- Engagement Type -->
		<FormField label="Engagement Type" required>
			<GroupedSelect
				groups={typeGroups}
				value={selectedTypeId}
				onSelect={(val) => { selectedTypeId = val; }}
				placeholder="Select engagement type"
			/>
		</FormField>

		<!-- Period -->
		<div class="grid grid-cols-3 gap-3">
			<FormField label="Period Label">
				<Input bind:value={periodLabel} placeholder="e.g., Q1 FY25-26" />
			</FormField>
			<FormField label="Period Start">
				<DatePicker value={periodStart} onChange={(d) => { periodStart = d; }} placeholder="Start date" />
			</FormField>
			<FormField label="Period End">
				<DatePicker value={periodEnd} onChange={(d) => { periodEnd = d; }} placeholder="End date" />
			</FormField>
		</div>

		<!-- Auto-create tasks -->
		<label class="flex items-center gap-2 text-sm text-gray-700">
			<input
				type="checkbox"
				bind:checked={autoCreateTasks}
				class="h-4 w-4 rounded border-gray-300 accent-blue-600"
			/>
			Auto-create tasks from template
		</label>

		<!-- Template Preview -->
		{#if showTemplatePreview}
			<TemplatePreview
				{templateItems}
				loading={templateLoading}
				templateName={selectedType?.name ?? 'Template'}
			/>
		{/if}

		<!-- More options toggle -->
		<button
			type="button"
			onclick={() => { showMoreOptions = !showMoreOptions; }}
			class="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
		>
			<ChevronDown
				size={16}
				class="transition-transform duration-200 {showMoreOptions ? 'rotate-180' : ''}"
			/>
			More options
		</button>

		{#if showMoreOptions}
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<FormField label="Fee Amount">
					<div class="flex items-center gap-2">
						<span class="text-sm text-gray-500">INR</span>
						<Input bind:value={feeAmount} type="number" placeholder="0.00" />
					</div>
				</FormField>
				<FormField label="Notes">
					<textarea
						bind:value={notes}
						rows={3}
						placeholder="Additional notes..."
						class="w-full rounded-md border border-gray-200 px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 hover:border-gray-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
					></textarea>
				</FormField>
			</div>
		{/if}
	</form>

	{#snippet footer()}
		<Button variant="secondary" onclick={onClose}>Cancel</Button>
		<Button
			variant="primary"
			onclick={handleSubmit}
			loading={isSaving}
			disabled={isSaving || !selectedClientId || !selectedTypeId}
		>
			{isSaving ? 'Creating...' : 'Create Engagement'}
		</Button>
	{/snippet}
</Modal>
