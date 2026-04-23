<script lang="ts">
  import { useQueryClient } from '@tanstack/svelte-query';
  import { api } from '../lib/api';
  import { addToast } from '../lib/toast.svelte';

  interface DepTask {
    id: string;
    title: string;
    status: string;
  }

  interface BlockedByDep {
    id: string;
    dependsOnTask: DepTask;
  }

  interface BlockingDep {
    id: string;
    task: DepTask;
  }

  let {
    taskId,
    blockedBy: initialBlockedBy,
    blocks: initialBlocks,
    isBlocked,
  }: {
    taskId: string;
    blockedBy: BlockedByDep[];
    blocks: BlockingDep[];
    isBlocked: boolean;
  } = $props();

  const qc = useQueryClient();

  let blockedBy = $state<BlockedByDep[]>([...initialBlockedBy]);
  let blocks = $state<BlockingDep[]>([...initialBlocks]);

  $effect(() => {
    blockedBy = [...initialBlockedBy];
    blocks = [...initialBlocks];
  });

  // Typeahead state
  let searchQuery = $state('');
  let searchResults = $state<DepTask[]>([]);
  let searchLoading = $state(false);
  let showResults = $state(false);
  let addPending = $state(false);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function onSearchInput() {
    if (debounceTimer) clearTimeout(debounceTimer);
    const q = searchQuery.trim();
    if (!q) {
      searchResults = [];
      showResults = false;
      return;
    }
    debounceTimer = setTimeout(() => fetchResults(q), 250);
  }

  async function fetchResults(q: string) {
    searchLoading = true;
    try {
      const res = await api(`/tasks?search=${encodeURIComponent(q)}&limit=10`);
      const allTasks: DepTask[] = res.data ?? [];

      // Exclude self
      const existingBlockedByIds = new Set(blockedBy.map((d) => d.dependsOnTask.id));
      const existingBlocksIds = new Set(blocks.map((d) => d.task.id));

      searchResults = allTasks.filter(
        (t) =>
          t.id !== taskId &&
          !existingBlockedByIds.has(t.id) &&
          !existingBlocksIds.has(t.id)
      );
      showResults = true;
    } catch {
      searchResults = [];
    } finally {
      searchLoading = false;
    }
  }

  async function addDep(target: DepTask) {
    showResults = false;
    searchQuery = '';
    addPending = true;

    try {
      const created = await api(`/tasks/${taskId}/dependencies`, {
        method: 'POST',
        body: JSON.stringify({ dependsOnTaskId: target.id }),
      });
      // Optimistically append
      blockedBy = [...blockedBy, { id: created.id, dependsOnTask: target }];
      qc.invalidateQueries({ queryKey: ['task', taskId] });
    } catch (err: any) {
      const status = err?.status ?? 0;
      if (status === 400) {
        addToast("Circular dependency — can't add", 'error');
      } else if (status === 409) {
        addToast('Already a dependency', 'error');
      } else {
        addToast(err?.message ?? 'Failed to add dependency', 'error');
      }
    } finally {
      addPending = false;
    }
  }

  async function removeBlockedBy(dep: BlockedByDep) {
    const prev = [...blockedBy];
    blockedBy = blockedBy.filter((d) => d.id !== dep.id);

    try {
      await api(`/tasks/${taskId}/dependencies/${dep.dependsOnTask.id}`, {
        method: 'DELETE',
      });
      qc.invalidateQueries({ queryKey: ['task', taskId] });
    } catch (err: any) {
      blockedBy = prev;
      addToast(err?.message ?? 'Failed to remove dependency', 'error');
    }
  }

  async function removeBlocking(dep: BlockingDep) {
    const prev = [...blocks];
    blocks = blocks.filter((d) => d.id !== dep.id);

    try {
      // dep.task is the task that depends on us; taskId is the one it depends on (us)
      await api(`/tasks/${dep.task.id}/dependencies/${taskId}`, {
        method: 'DELETE',
      });
      qc.invalidateQueries({ queryKey: ['task', taskId] });
    } catch (err: any) {
      blocks = prev;
      addToast(err?.message ?? 'Failed to remove dependency', 'error');
    }
  }

  function hideResults() {
    // Small delay so click on result fires first
    setTimeout(() => { showResults = false; }, 150);
  }

  const statusColors: Record<string, string> = {
    TODO: 'bg-gray-100 text-gray-600',
    IN_PROGRESS: 'bg-blue-50 text-blue-700',
    IN_REVIEW: 'bg-yellow-50 text-yellow-700',
    DONE: 'bg-green-50 text-green-700',
    CANCELLED: 'bg-red-50 text-red-600',
    BLOCKED: 'bg-red-100 text-red-700',
  };

  function statusLabel(s: string) {
    return s.replace(/_/g, ' ');
  }
</script>

<div class="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
  <h3 class="text-sm font-medium text-gray-500">Dependencies</h3>

  {#if isBlocked}
    <div class="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2 font-medium">
      This task is blocked by incomplete dependencies
    </div>
  {/if}

  <!-- Blocked by -->
  <div>
    <p class="text-xs font-medium text-gray-400 mb-1.5">Blocked by</p>
    {#if blockedBy.length === 0}
      <p class="text-xs text-gray-400">None</p>
    {:else}
      <div class="space-y-1">
        {#each blockedBy as dep (dep.id)}
          <div class="flex items-center gap-2 text-sm">
            <span class="flex-1 text-gray-700 truncate">{dep.dependsOnTask.title}</span>
            <span class="text-xs px-1.5 py-0.5 rounded {statusColors[dep.dependsOnTask.status] ?? 'bg-gray-100 text-gray-600'}">
              {statusLabel(dep.dependsOnTask.status)}
            </span>
            <button
              onclick={() => removeBlockedBy(dep)}
              class="text-gray-300 hover:text-red-500 text-xs"
              title="Remove"
            >&#10005;</button>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Blocks -->
  <div>
    <p class="text-xs font-medium text-gray-400 mb-1.5">Blocks</p>
    {#if blocks.length === 0}
      <p class="text-xs text-gray-400">None</p>
    {:else}
      <div class="space-y-1">
        {#each blocks as dep (dep.id)}
          <div class="flex items-center gap-2 text-sm">
            <span class="flex-1 text-gray-700 truncate">{dep.task.title}</span>
            <span class="text-xs px-1.5 py-0.5 rounded {statusColors[dep.task.status] ?? 'bg-gray-100 text-gray-600'}">
              {statusLabel(dep.task.status)}
            </span>
            <button
              onclick={() => removeBlocking(dep)}
              class="text-gray-300 hover:text-red-500 text-xs"
              title="Remove"
            >&#10005;</button>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Add dependency typeahead -->
  <div class="relative">
    <p class="text-xs font-medium text-gray-400 mb-1.5">Add "blocked by"</p>
    <input
      type="text"
      bind:value={searchQuery}
      oninput={onSearchInput}
      onblur={hideResults}
      placeholder="Search tasks..."
      disabled={addPending}
      class="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
    />
    {#if searchLoading}
      <p class="absolute left-0 right-0 mt-0.5 text-xs text-gray-400 px-2">Searching...</p>
    {:else if showResults && searchResults.length > 0}
      <div class="absolute left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded shadow-md z-10 max-h-48 overflow-y-auto">
        {#each searchResults as t (t.id)}
          <button
            class="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
            onmousedown={() => addDep(t)}
          >
            <span class="flex-1 truncate text-gray-700">{t.title}</span>
            <span class="text-xs px-1.5 py-0.5 rounded shrink-0 {statusColors[t.status] ?? 'bg-gray-100 text-gray-600'}">
              {statusLabel(t.status)}
            </span>
          </button>
        {/each}
      </div>
    {:else if showResults && searchResults.length === 0 && !searchLoading}
      <div class="absolute left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded shadow-md z-10 px-3 py-2 text-sm text-gray-400">
        No matching tasks
      </div>
    {/if}
  </div>
</div>
