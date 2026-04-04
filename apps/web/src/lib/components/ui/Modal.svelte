<script lang="ts">
	import type { Snippet } from 'svelte';
	import { X } from 'lucide-svelte';
	import { focusTrap } from '$lib/actions/focusTrap';
	import { clickOutside } from '$lib/actions/clickOutside';

	let {
		open,
		title,
		size = 'md',
		onClose,
		children,
		footer = undefined
	}: {
		open: boolean;
		title: string;
		size?: 'sm' | 'md' | 'lg';
		onClose: () => void;
		children: Snippet;
		footer?: Snippet;
	} = $props();

	// Size map with complete class strings (TailwindCSS v4 — no interpolation)
	const SIZE_CLASSES: Record<string, string> = {
		sm: 'max-w-[400px]',
		md: 'max-w-[560px]',
		lg: 'max-w-[720px]'
	};

	let sizeClass = $derived(SIZE_CLASSES[size] ?? SIZE_CLASSES.md);
</script>

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
		onkeydown={(e) => { if (e.key === 'Escape') onClose(); }}
	>
		<div
			class="relative mx-4 flex w-full flex-col rounded-lg bg-white shadow-xl {sizeClass}"
			use:focusTrap={onClose}
			use:clickOutside={onClose}
			role="dialog"
			aria-modal="true"
			aria-label={title}
		>
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-gray-200 px-6 py-4">
				<h2 class="text-lg font-semibold text-gray-900">{title}</h2>
				<button
					type="button"
					onclick={onClose}
					class="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:ring-2 focus:ring-blue-600 focus:outline-none"
					aria-label="Close"
				>
					<X size={20} />
				</button>
			</div>

			<!-- Body -->
			<div class="max-h-[70vh] overflow-y-auto px-6 py-4">
				{@render children()}
			</div>

			<!-- Footer -->
			{#if footer}
				<div class="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
					{@render footer()}
				</div>
			{/if}
		</div>
	</div>
{/if}
