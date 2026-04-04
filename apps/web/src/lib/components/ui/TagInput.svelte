<script lang="ts">
	import { X } from 'lucide-svelte';

	let {
		tags = [],
		onChange,
		max = 10,
		placeholder = 'Type and press comma or Enter...'
	}: {
		tags?: string[];
		onChange: (tags: string[]) => void;
		max?: number;
		placeholder?: string;
	} = $props();

	let inputValue = $state('');
	let error = $state<string | null>(null);

	function addTag(raw: string) {
		const tag = raw.trim();
		if (!tag) return;
		if (tags.includes(tag)) {
			inputValue = '';
			return;
		}
		if (tags.length >= max) {
			error = `Maximum ${max} tags`;
			return;
		}
		error = null;
		onChange([...tags, tag]);
		inputValue = '';
	}

	function removeTag(index: number) {
		const updated = tags.filter((_, i) => i !== index);
		onChange(updated);
		error = null;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === ',' || event.key === 'Enter') {
			event.preventDefault();
			addTag(inputValue);
		} else if (event.key === 'Backspace' && !inputValue && tags.length > 0) {
			removeTag(tags.length - 1);
		}
	}

	function handleBlur() {
		if (inputValue.trim()) {
			addTag(inputValue);
		}
	}
</script>

<div>
	<div class="flex flex-wrap items-center gap-1.5 rounded-md border border-gray-200 px-2 py-1.5 focus-within:border-blue-600 focus-within:ring-1 focus-within:ring-blue-600">
		{#each tags as tag, index}
			<span class="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
				{tag}
				<button
					type="button"
					onclick={() => removeTag(index)}
					class="rounded-full p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
					aria-label="Remove {tag}"
				>
					<X size={12} />
				</button>
			</span>
		{/each}
		<input
			type="text"
			bind:value={inputValue}
			onkeydown={handleKeydown}
			onblur={handleBlur}
			{placeholder}
			class="min-w-[120px] flex-1 border-0 bg-transparent py-0.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
		/>
	</div>
	{#if error}
		<p class="mt-1 text-xs text-red-600">{error}</p>
	{/if}
</div>
