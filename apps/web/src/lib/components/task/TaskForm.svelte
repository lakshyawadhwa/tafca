<script lang="ts">
	import { FormField, Input, Button, Select, TagInput } from '$lib/components/ui';
	import UserPicker from '$lib/components/ui/UserPicker.svelte';
	import ClientPicker from '$lib/components/ui/ClientPicker.svelte';
	import DatePicker from '$lib/components/ui/DatePicker.svelte';
	import { TaskPriority } from '@ca-practice-os/shared';
	import { X, Plus } from 'lucide-svelte';

	type UserOption = { id: string; fullName: string; role: string };
	type ClientOption = { id: string; displayName: string; status: string };
	type EngagementOption = { id: string; name: string; clientId: string };

	type Prefill = {
		clientId?: string;
		engagementId?: string;
		parentTaskId?: string;
	};

	let {
		users = [],
		clients = [],
		engagements = [],
		prefill = undefined,
		onSubmit,
		onCancel
	}: {
		users?: UserOption[];
		clients?: ClientOption[];
		engagements?: EngagementOption[];
		prefill?: Prefill;
		onSubmit: (data: Record<string, any>) => Promise<void>;
		onCancel: () => void;
	} = $props();

	// Form state
	let title = $state('');
	let description = $state('');
	let clientId = $state<string | null>(prefill?.clientId ?? null);
	let engagementId = $state<string | null>(prefill?.engagementId ?? null);
	let assigneeId = $state<string | null>(null);
	let reviewerId = $state<string | null>(null);
	let priority = $state(TaskPriority.MEDIUM);
	let dueDate = $state<string | null>(null);
	let internalDueDate = $state<string | null>(null);
	let tags = $state<string[]>([]);
	let parentTaskId = $state<string | null>(prefill?.parentTaskId ?? null);

	// Checklist state
	let showChecklist = $state(false);
	let checklistItems = $state<Array<{ label: string; isRequired: boolean }>>([]);
	let newChecklistLabel = $state('');

	// UI state
	let errors = $state<Record<string, string | null>>({});
	let isSaving = $state(false);

	// Priority options
	const priorityOptions = Object.values(TaskPriority).map((v) => ({
		value: v,
		label: v.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())
	}));

	// Filtered engagements when client is selected
	let filteredEngagements = $derived.by(() => {
		if (!clientId) return engagements;
		return engagements.filter((e) => e.clientId === clientId);
	});

	let engagementSelectOptions = $derived([
		{ value: '', label: 'Select engagement...' },
		...filteredEngagements.map((e) => ({ value: e.id, label: e.name }))
	]);

	// Computed internal due date hint
	let computedInternalDueDate = $derived.by(() => {
		if (!dueDate) return null;
		const d = new Date(dueDate + 'T00:00:00');
		d.setDate(d.getDate() - 3); // Default 3 day buffer
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	});

	// Pre-fill readonly indicators
	let clientReadonly = $derived(!!prefill?.clientId);
	let engagementReadonly = $derived(!!prefill?.engagementId);

	function handleClientChange(id: string) {
		clientId = id;
		// Reset engagement if it doesn't belong to the new client
		if (engagementId) {
			const eng = engagements.find((e) => e.id === engagementId);
			if (eng && eng.clientId !== id) {
				engagementId = null;
			}
		}
	}

	function handleEngagementChange(id: string) {
		engagementId = id || null;
		// Auto-set client from engagement
		if (id) {
			const eng = engagements.find((e) => e.id === id);
			if (eng && !clientId) {
				clientId = eng.clientId;
			}
		}
	}

	function addChecklistItem() {
		const label = newChecklistLabel.trim();
		if (!label) return;
		if (checklistItems.length >= 30) return;
		checklistItems = [...checklistItems, { label, isRequired: true }];
		newChecklistLabel = '';
	}

	function removeChecklistItem(index: number) {
		checklistItems = checklistItems.filter((_, i) => i !== index);
	}

	function handleChecklistKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			addChecklistItem();
		}
	}

	function validateForm(): boolean {
		const newErrors: Record<string, string | null> = {};
		if (!title.trim()) {
			newErrors.title = 'Title is required';
		} else if (title.length > 300) {
			newErrors.title = 'Title must be 300 characters or less';
		}
		errors = newErrors;
		return !Object.values(newErrors).some(Boolean);
	}

	async function handleSubmit() {
		if (!validateForm()) return;

		isSaving = true;
		try {
			const data: Record<string, any> = {
				title: title.trim(),
				priority,
			};
			if (description.trim()) data.description = description.trim();
			if (clientId) data.clientId = clientId;
			if (engagementId) data.engagementId = engagementId;
			if (assigneeId) data.assigneeId = assigneeId;
			if (reviewerId) data.reviewerId = reviewerId;
			if (dueDate) data.dueDate = dueDate;
			if (internalDueDate) data.internalDueDate = internalDueDate;
			if (tags.length > 0) data.tags = tags;
			if (parentTaskId) data.parentTaskId = parentTaskId;
			if (checklistItems.length > 0) {
				data.initialChecklistItems = checklistItems;
			}

			await onSubmit(data);
		} finally {
			isSaving = false;
		}
	}
</script>

<form
	onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}
	class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
>
	<!-- BASIC INFORMATION -->
	<div class="text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-200 pb-2 mb-4">
		Basic Information
	</div>
	<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
		<div class="md:col-span-2">
			<FormField label="Title" required error={errors.title}>
				<Input
					bind:value={title}
					placeholder="Task title"
					onblur={() => { if (!title.trim()) errors.title = 'Title is required'; else errors.title = null; }}
					error={errors.title}
				/>
			</FormField>
		</div>

		<div class="md:col-span-2">
			<FormField label="Description">
				<textarea
					bind:value={description}
					placeholder="Describe the task..."
					rows={5}
					maxlength={10000}
					class="w-full rounded-md border border-gray-200 px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 hover:border-gray-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
				></textarea>
			</FormField>
		</div>
	</div>

	<!-- ASSIGNMENT -->
	<div class="mt-8 text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-200 pb-2 mb-4">
		Assignment
	</div>
	<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
		<FormField label="Client">
			<ClientPicker
				value={clientId}
				onSelect={(id) => handleClientChange(id)}
				options={clients}
				placeholder="Select client"
				disabled={clientReadonly}
			/>
		</FormField>

		<FormField label="Engagement">
			<Select
				options={engagementSelectOptions}
				value={engagementId ?? ''}
				onSelect={handleEngagementChange}
				placeholder="Select engagement"
				disabled={engagementReadonly}
			/>
		</FormField>

		<FormField label="Assignee">
			<UserPicker
				value={assigneeId}
				onSelect={(id) => { assigneeId = id; }}
				options={users}
				placeholder="Select assignee"
			/>
		</FormField>

		<FormField label="Reviewer">
			<UserPicker
				value={reviewerId}
				onSelect={(id) => { reviewerId = id; }}
				options={users}
				placeholder="Select reviewer"
			/>
		</FormField>
	</div>

	<!-- SCHEDULING -->
	<div class="mt-8 text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-200 pb-2 mb-4">
		Scheduling
	</div>
	<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
		<FormField label="Priority" required>
			<Select
				options={priorityOptions}
				value={priority}
				onSelect={(val) => { priority = val as TaskPriority; }}
				placeholder="Select priority"
			/>
		</FormField>

		<FormField label="Due Date">
			<DatePicker
				value={dueDate}
				onChange={(val) => { dueDate = val; }}
				placeholder="Select due date"
			/>
		</FormField>

		<FormField label="Internal Deadline">
			<DatePicker
				value={internalDueDate}
				onChange={(val) => { internalDueDate = val; }}
				placeholder={computedInternalDueDate ? `Auto: ${computedInternalDueDate}` : 'Select date'}
				max={dueDate ?? undefined}
			/>
			{#if dueDate && !internalDueDate && computedInternalDueDate}
				<p class="mt-1 text-xs text-gray-400">Auto-calculated: {computedInternalDueDate}</p>
			{/if}
		</FormField>
	</div>

	<!-- TAGS -->
	<div class="mt-8 text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-200 pb-2 mb-4">
		Tags
	</div>
	<div class="grid grid-cols-1 gap-4">
		<FormField label="Tags">
			<TagInput {tags} onChange={(t) => { tags = t; }} max={10} placeholder="Type a tag and press comma..." />
		</FormField>
	</div>

	<!-- INITIAL CHECKLIST (optional) -->
	<div class="mt-8 text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-200 pb-2 mb-4">
		Initial Checklist
		{#if !showChecklist}
			<button
				type="button"
				onclick={() => { showChecklist = true; }}
				class="ml-2 text-xs font-medium text-blue-600 hover:text-blue-800 normal-case tracking-normal"
			>
				Add initial checklist items
			</button>
		{/if}
	</div>

	{#if showChecklist}
		<div class="space-y-2">
			{#each checklistItems as item, index}
				<div class="flex items-center gap-2">
					<label class="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
						<input
							type="checkbox"
							checked={item.isRequired}
							onchange={() => {
								checklistItems[index] = { ...item, isRequired: !item.isRequired };
								checklistItems = [...checklistItems];
							}}
							class="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
						/>
						Required
					</label>
					<span class="flex-1 text-sm text-gray-900">{item.label}</span>
					<button
						type="button"
						onclick={() => removeChecklistItem(index)}
						class="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500"
					>
						<X size={14} />
					</button>
				</div>
			{/each}

			<div class="flex items-center gap-2">
				<input
					type="text"
					bind:value={newChecklistLabel}
					onkeydown={handleChecklistKeydown}
					placeholder={checklistItems.length >= 30 ? '(30/30 max)' : 'Add checklist item...'}
					disabled={checklistItems.length >= 30}
					class="flex-1 h-8 rounded-md border border-gray-200 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
				/>
				<button
					type="button"
					onclick={addChecklistItem}
					disabled={checklistItems.length >= 30 || !newChecklistLabel.trim()}
					class="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					<Plus size={16} />
				</button>
			</div>

			{#if checklistItems.length > 0}
				<p class="text-xs text-gray-400">{checklistItems.length}/30 items</p>
			{/if}
		</div>
	{/if}

	<!-- FOOTER -->
	<div class="mt-6 flex justify-end gap-3 border-t border-gray-200 pt-6">
		<Button variant="secondary" onclick={onCancel}>Cancel</Button>
		<Button variant="primary" type="submit" loading={isSaving} disabled={isSaving}>
			Create Task
		</Button>
	</div>
</form>
