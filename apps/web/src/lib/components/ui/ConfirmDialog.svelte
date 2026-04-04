<script lang="ts">
	import Modal from './Modal.svelte';

	let {
		open,
		title,
		message,
		confirmLabel = 'Confirm',
		variant = 'default',
		onConfirm,
		onCancel
	}: {
		open: boolean;
		title: string;
		message: string;
		confirmLabel?: string;
		variant?: 'danger' | 'default';
		onConfirm: () => void;
		onCancel: () => void;
	} = $props();

	// Button classes — complete strings for TailwindCSS v4
	const CONFIRM_CLASSES: Record<string, string> = {
		danger:
			'inline-flex items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:ring-2 focus:ring-red-600 focus:ring-offset-2 focus:outline-none',
		default:
			'inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 focus:outline-none'
	};

	const CANCEL_CLASSES =
		'inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 focus:outline-none';

	let confirmClass = $derived(CONFIRM_CLASSES[variant] ?? CONFIRM_CLASSES.default);
</script>

<Modal {open} {title} size="sm" onClose={onCancel}>
	<p class="text-sm text-gray-600">{message}</p>

	{#snippet footer()}
		<button type="button" class={CANCEL_CLASSES} onclick={onCancel}>
			Cancel
		</button>
		<button type="button" class={confirmClass} onclick={onConfirm}>
			{confirmLabel}
		</button>
	{/snippet}
</Modal>
