<script lang="ts">
	type Tab = {
		id: string;
		label: string;
		count?: number;
	};

	let {
		tabs,
		activeTab,
		onTabChange
	}: {
		tabs: Tab[];
		activeTab: string;
		onTabChange: (tabId: string) => void;
	} = $props();

	function handleKeydown(event: KeyboardEvent, index: number) {
		let newIndex = index;
		if (event.key === 'ArrowRight') {
			event.preventDefault();
			newIndex = (index + 1) % tabs.length;
		} else if (event.key === 'ArrowLeft') {
			event.preventDefault();
			newIndex = (index - 1 + tabs.length) % tabs.length;
		} else if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			onTabChange(tabs[index].id);
			return;
		} else {
			return;
		}

		// Move focus to the new tab
		const tabButtons = (event.currentTarget as HTMLElement)
			?.parentElement?.querySelectorAll('[role="tab"]');
		if (tabButtons?.[newIndex]) {
			(tabButtons[newIndex] as HTMLElement).focus();
		}
	}

	// Complete class strings for TailwindCSS v4
	const ACTIVE_CLASSES = 'text-blue-600 font-semibold border-b-2 border-blue-600 mb-[-1px]';
	const INACTIVE_CLASSES = 'text-gray-500 font-normal hover:text-gray-700 border-b-2 border-transparent';
</script>

<nav class="border-b border-gray-200" role="tablist">
	<div class="flex">
		{#each tabs as tab, index}
			<button
				type="button"
				role="tab"
				aria-selected={tab.id === activeTab}
				tabindex={tab.id === activeTab ? 0 : -1}
				onclick={() => onTabChange(tab.id)}
				onkeydown={(e) => handleKeydown(e, index)}
				class="px-4 h-11 text-sm whitespace-nowrap transition-colors focus:outline-none
					{tab.id === activeTab ? ACTIVE_CLASSES : INACTIVE_CLASSES}"
			>
				{tab.label}
				{#if tab.count !== undefined}
					<span class="text-gray-400 ml-1">({tab.count})</span>
				{/if}
			</button>
		{/each}
	</div>
</nav>
