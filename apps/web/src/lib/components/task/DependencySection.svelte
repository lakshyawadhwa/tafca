<script lang="ts">
	import { ShieldAlert, ShieldBan, X } from 'lucide-svelte';
	import { StatusBadge } from '$lib/components/ui';
	import TaskSearchPicker from './TaskSearchPicker.svelte';
	import { api } from '$lib/utils/api';
	import { addToast } from '$lib/stores/toast.svelte';
	import { invalidateAll } from '$app/navigation';

	type DependencyItem = {
		id: string;
		taskId: string;
		dependsOnTaskId: string;
		dependsOnTask?: { id: string; title: string; status: string };
		task?: { id: string; title: string; status: string };
	};

	let {
		blockedBy = [],
		blocking = [],
		taskId
	}: {
		blockedBy?: DependencyItem[];
		blocking?: DependencyItem[];
		taskId: string;
	} = $props();

	let showPicker = $state(false);

	async function removeDependency(dependsOnTaskId: string) {
		try {
			await api(`/tasks/${taskId}/dependencies/${dependsOnTaskId}`, {
				method: 'DELETE',
			});
			addToast('Dependency removed', 'success');
			await invalidateAll();
		} catch (err: any) {
			addToast(err.message ?? 'Failed to remove dependency', 'error');
		}
	}

	async function addDependency(dependsOnTaskId: string) {
		try {
			await api(`/tasks/${taskId}/dependencies`, {
				method: 'POST',
				body: JSON.stringify({ dependsOnTaskId }),
			});
			addToast('Dependency added', 'success');
			showPicker = false;
			await invalidateAll();
		} catch (err: any) {
			if (err.message?.includes('circular') || err.message?.includes('cycle')) {
				addToast('Cannot add dependency: circular dependency detected', 'error');
			} else {
				addToast(err.message ?? 'Failed to add dependency', 'error');
			}
			showPicker = false;
		}
	}
</script>

<div class="space-y-4">
	<!-- Blocked by section -->
	<div>
		<div class="flex items-center gap-1.5 mb-2">
			<ShieldAlert size={14} class="text-red-500" />
			<span class="text-xs font-semibold uppercase tracking-wider text-gray-500">Blocked by</span>
		</div>
		{#if blockedBy.length === 0}
			<p class="text-xs text-gray-400">No blocking dependencies</p>
		{:else}
			<div class="space-y-1.5">
				{#each blockedBy as dep}
					{@const depTask = dep.dependsOnTask}
					<div class="flex items-center gap-2 group">
						<a
							href="/tasks/{depTask?.id}"
							class="flex-1 truncate text-sm text-blue-600 hover:underline"
						>
							{depTask?.title ?? 'Unknown task'}
						</a>
						<StatusBadge status={depTask?.status ?? 'TO_DO'} type="task" />
						<button
							type="button"
							onclick={() => removeDependency(dep.dependsOnTaskId)}
							class="rounded p-0.5 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity"
							aria-label="Remove dependency"
						>
							<X size={14} />
						</button>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Blocking section -->
	<div>
		<div class="flex items-center gap-1.5 mb-2">
			<ShieldBan size={14} class="text-amber-500" />
			<span class="text-xs font-semibold uppercase tracking-wider text-gray-500">Blocking</span>
		</div>
		{#if blocking.length === 0}
			<p class="text-xs text-gray-400">Not blocking any tasks</p>
		{:else}
			<div class="space-y-1.5">
				{#each blocking as dep}
					{@const depTask = dep.task}
					<div class="flex items-center gap-2">
						<a
							href="/tasks/{depTask?.id}"
							class="flex-1 truncate text-sm text-blue-600 hover:underline"
						>
							{depTask?.title ?? 'Unknown task'}
						</a>
						<StatusBadge status={depTask?.status ?? 'TO_DO'} type="task" />
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Add dependency -->
	{#if showPicker}
		<div class="mt-2">
			<TaskSearchPicker
				excludeTaskId={taskId}
				onSelect={addDependency}
			/>
		</div>
	{:else}
		<button
			type="button"
			onclick={() => { showPicker = true; }}
			class="text-sm text-blue-600 hover:underline"
		>
			+ Add dependency
		</button>
	{/if}
</div>
