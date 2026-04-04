<script lang="ts">
	import { Pencil, Loader2 } from 'lucide-svelte';
	import Input from './Input.svelte';
	import { addToast } from '$lib/stores/toast.svelte';

	let {
		value,
		onSave,
		type = 'text',
		placeholder = '--',
		inputClass = ''
	}: {
		value: string;
		onSave: (newVal: string) => Promise<void>;
		type?: 'text' | 'select';
		placeholder?: string;
		inputClass?: string;
	} = $props();

	let isEditing = $state(false);
	let editValue = $state('');
	let isSaving = $state(false);
	let inputEl: HTMLInputElement | undefined = $state(undefined);

	function startEdit() {
		editValue = value ?? '';
		isEditing = true;
		// Auto-focus on next tick
		setTimeout(() => {
			inputEl?.focus();
		}, 0);
	}

	async function save() {
		if (editValue === value) {
			isEditing = false;
			return;
		}
		isSaving = true;
		try {
			await onSave(editValue);
			isEditing = false;
		} catch (err: any) {
			addToast(err.message ?? 'Failed to save', 'error');
			// Revert
			editValue = value ?? '';
			isEditing = false;
		} finally {
			isSaving = false;
		}
	}

	function cancel() {
		editValue = value ?? '';
		isEditing = false;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			save();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			cancel();
		}
	}
</script>

{#if isEditing}
	<div class="flex items-center gap-2">
		{#if isSaving}
			<Loader2 size={14} class="animate-spin text-gray-400" />
		{/if}
		<input
			type="text"
			bind:this={inputEl}
			bind:value={editValue}
			onblur={save}
			onkeydown={handleKeydown}
			class="h-8 w-full rounded-md border border-gray-200 px-2 text-sm text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none {inputClass}"
		/>
	</div>
{:else}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="group flex cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 hover:bg-gray-100"
		onclick={startEdit}
	>
		<span class="text-sm {value ? 'text-gray-900' : 'text-gray-400'}">
			{value || placeholder}
		</span>
		<Pencil size={14} class="hidden text-gray-400 group-hover:block" />
	</div>
{/if}
