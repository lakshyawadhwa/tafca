<script lang="ts">
	import { X, Plus } from 'lucide-svelte';
	import { InlineEdit } from '$lib/components/ui';
	import { api } from '$lib/utils/api';
	import { addToast } from '$lib/stores/toast.svelte';
	import { invalidateAll } from '$app/navigation';

	type ChecklistItem = {
		id: string;
		label: string;
		isCompleted: boolean;
		isRequired: boolean;
		displayOrder: number;
	};

	let {
		items = [],
		taskId,
		maxItems = 30
	}: {
		items?: ChecklistItem[];
		taskId: string;
		maxItems?: number;
	} = $props();

	let newItemLabel = $state('');

	let completedCount = $derived(items.filter((i) => i.isCompleted).length);
	let totalCount = $derived(items.length);
	let progressPercent = $derived(totalCount > 0 ? (completedCount / totalCount) * 100 : 0);

	async function toggleItem(item: ChecklistItem) {
		try {
			await api(`/tasks/${taskId}/checklist/${item.id}`, {
				method: 'PATCH',
				body: JSON.stringify({ isCompleted: !item.isCompleted }),
			});
			await invalidateAll();
		} catch (err: any) {
			addToast(err.message ?? 'Failed to update checklist item', 'error');
		}
	}

	async function updateLabel(item: ChecklistItem, newLabel: string) {
		await api(`/tasks/${taskId}/checklist/${item.id}`, {
			method: 'PATCH',
			body: JSON.stringify({ label: newLabel }),
		});
		await invalidateAll();
	}

	async function deleteItem(item: ChecklistItem) {
		try {
			await api(`/tasks/${taskId}/checklist/${item.id}`, {
				method: 'DELETE',
			});
			await invalidateAll();
		} catch (err: any) {
			addToast(err.message ?? 'Failed to delete checklist item', 'error');
		}
	}

	async function addItem() {
		const label = newItemLabel.trim();
		if (!label) return;
		if (items.length >= maxItems) return;

		try {
			await api(`/tasks/${taskId}/checklist`, {
				method: 'POST',
				body: JSON.stringify({ label, isRequired: true }),
			});
			newItemLabel = '';
			await invalidateAll();
		} catch (err: any) {
			addToast(err.message ?? 'Failed to add checklist item', 'error');
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			addItem();
		}
	}
</script>

<div>
	<!-- Section heading with progress -->
	<div class="flex items-center gap-2 mb-2">
		<h3 class="text-sm font-semibold text-gray-900">Checklist</h3>
		{#if totalCount > 0}
			<span class="text-xs text-gray-500">{completedCount}/{totalCount}</span>
		{/if}
	</div>

	<!-- Progress bar -->
	{#if totalCount > 0}
		<div class="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
			<div
				class="h-full rounded-full bg-green-600 transition-all duration-200"
				style="width: {progressPercent}%"
			></div>
		</div>
	{/if}

	<!-- Item list -->
	<div class="space-y-1">
		{#each items as item (item.id)}
			<div class="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-gray-50">
				<!-- Checkbox -->
				<input
					type="checkbox"
					checked={item.isCompleted}
					onchange={() => toggleItem(item)}
					class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 cursor-pointer"
				/>

				<!-- Label -->
				<div class="flex-1 min-w-0">
					<InlineEdit
						value={item.label}
						onSave={(newVal) => updateLabel(item, newVal)}
						inputClass={item.isCompleted ? 'line-through text-gray-400' : ''}
						placeholder="Item label"
					/>
				</div>

				<!-- Required tag -->
				{#if item.isRequired}
					<span class="text-xs font-semibold text-red-600 bg-red-50 rounded px-1.5 py-0.5 shrink-0">
						Required
					</span>
				{/if}

				<!-- Delete button -->
				<button
					type="button"
					onclick={() => deleteItem(item)}
					class="rounded p-1 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity"
					aria-label="Delete item"
				>
					<X size={14} />
				</button>
			</div>
		{/each}
	</div>

	<!-- Add item input -->
	<div class="mt-2 flex items-center gap-2">
		<input
			type="text"
			bind:value={newItemLabel}
			onkeydown={handleKeydown}
			placeholder={items.length >= maxItems ? `(${maxItems}/${maxItems} max)` : 'Add checklist item...'}
			disabled={items.length >= maxItems}
			class="flex-1 h-8 rounded-md border border-gray-200 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
		/>
		<button
			type="button"
			onclick={addItem}
			disabled={items.length >= maxItems || !newItemLabel.trim()}
			class="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
		>
			<Plus size={16} />
		</button>
	</div>
</div>
