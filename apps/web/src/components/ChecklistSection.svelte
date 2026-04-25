<script lang="ts">
  import { createMutation, useQueryClient } from '@tanstack/svelte-query';
  import { api } from '../lib/api';
  import { addToast } from '../lib/toast.svelte';
  import { track } from '../lib/analytics';

  interface ChecklistItem {
    id: string;
    label: string;
    isCompleted: boolean;
    isRequired: boolean;
    displayOrder: number;
  }

  interface Progress {
    completed: number;
    total: number;
    requiredCompleted?: number;
    requiredTotal?: number;
  }

  let {
    taskId,
    items: initialItems,
    progress: initialProgress,
  }: {
    taskId: string;
    items: ChecklistItem[];
    progress?: Progress;
  } = $props();

  const qc = useQueryClient();

  // Local optimistic state
  let items = $state<ChecklistItem[]>([...initialItems]);

  // Sync when parent rerenders with new items
  $effect(() => {
    items = [...initialItems];
  });

  const progressTotal = $derived(items.length);
  const progressCompleted = $derived(items.filter((i) => i.isCompleted).length);
  const progressReqTotal = $derived(items.filter((i) => i.isRequired).length);
  const progressReqCompleted = $derived(items.filter((i) => i.isRequired && i.isCompleted).length);

  // Add item state
  let addLabel = $state('');
  let showAddInput = $state(false);
  let addPending = $state(false);

  // Drag state
  let dragSrcIndex = $state<number | null>(null);

  const MAX_ITEMS = 30;
  const atLimit = $derived(items.length >= MAX_ITEMS);

  // ── Toggle ──────────────────────────────────────────────────────

  async function toggleItem(item: ChecklistItem) {
    const prev = [...items];
    // Optimistic update
    items = items.map((i) =>
      i.id === item.id ? { ...i, isCompleted: !i.isCompleted } : i
    );

    try {
      await api(`/tasks/${taskId}/checklist/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isCompleted: !item.isCompleted }),
      });
      track('checklist_item_toggled', { isCompleted: !item.isCompleted });
      qc.invalidateQueries({ queryKey: ['task', taskId] });
    } catch (err: any) {
      items = prev;
      addToast(err?.message ?? 'Failed to update item', 'error');
    }
  }

  // ── Add ─────────────────────────────────────────────────────────

  async function submitAdd() {
    const label = addLabel.trim();
    if (!label) return;

    addPending = true;
    try {
      const created: ChecklistItem = await api(`/tasks/${taskId}/checklist`, {
        method: 'POST',
        body: JSON.stringify({ label, isRequired: false }),
      });
      items = [...items, created];
      addLabel = '';
      showAddInput = false;
      qc.invalidateQueries({ queryKey: ['task', taskId] });
    } catch (err: any) {
      addToast(err?.message ?? 'Failed to add item', 'error');
    } finally {
      addPending = false;
    }
  }

  function onAddKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitAdd();
    } else if (e.key === 'Escape') {
      addLabel = '';
      showAddInput = false;
    }
  }

  // ── Delete ───────────────────────────────────────────────────────

  async function deleteItem(itemId: string) {
    const prev = [...items];
    items = items.filter((i) => i.id !== itemId);

    try {
      await api(`/tasks/${taskId}/checklist/${itemId}`, { method: 'DELETE' });
      qc.invalidateQueries({ queryKey: ['task', taskId] });
    } catch (err: any) {
      items = prev;
      addToast(err?.message ?? 'Failed to delete item', 'error');
    }
  }

  // ── Drag reorder ─────────────────────────────────────────────────

  function onDragStart(e: DragEvent, index: number) {
    dragSrcIndex = index;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
    }
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  }

  async function onDrop(e: DragEvent, targetIndex: number) {
    e.preventDefault();
    if (dragSrcIndex === null || dragSrcIndex === targetIndex) {
      dragSrcIndex = null;
      return;
    }

    const prev = [...items];
    const reordered = [...items];
    const [moved] = reordered.splice(dragSrcIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    // Optimistic
    items = reordered.map((item, i) => ({ ...item, displayOrder: i }));
    dragSrcIndex = null;

    // Persist each moved item's displayOrder
    try {
      await Promise.all(
        items.map((item, i) =>
          api(`/tasks/${taskId}/checklist/${item.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ displayOrder: i }),
          })
        )
      );
      qc.invalidateQueries({ queryKey: ['task', taskId] });
    } catch (err: any) {
      items = prev;
      addToast(err?.message ?? 'Failed to reorder items', 'error');
    }
  }

  function onDragEnd() {
    dragSrcIndex = null;
  }
</script>

<div class="bg-white rounded-lg border border-gray-200 p-4">
  <h3 class="text-sm font-medium text-gray-500 mb-3">
    Checklist ({progressCompleted}/{progressTotal})
  </h3>

  <!-- Dual progress bar -->
  {#if progressTotal > 0}
    <div class="space-y-1.5 mb-3">
      <!-- All items -->
      <div>
        <div class="flex justify-between text-xs text-gray-400 mb-0.5">
          <span>Overall</span>
          <span>{progressCompleted}/{progressTotal}</span>
        </div>
        <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            class="h-full bg-blue-500 rounded-full transition-all"
            style="width: {(progressCompleted / progressTotal) * 100}%"
          ></div>
        </div>
      </div>
      <!-- Required items only -->
      {#if progressReqTotal > 0}
        <div>
          <div class="flex justify-between text-xs text-gray-400 mb-0.5">
            <span>Required</span>
            <span>{progressReqCompleted}/{progressReqTotal}</span>
          </div>
          <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              class="h-full bg-red-400 rounded-full transition-all"
              style="width: {(progressReqCompleted / progressReqTotal) * 100}%"
            ></div>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Item list -->
  <div class="space-y-1">
    {#each items as item, i (item.id)}
      <div
        role="listitem"
        class="flex items-center gap-2 group rounded px-1 py-0.5 {dragSrcIndex === i ? 'opacity-40' : ''}"
        draggable="true"
        ondragstart={(e) => onDragStart(e, i)}
        ondragover={onDragOver}
        ondrop={(e) => onDrop(e, i)}
        ondragend={onDragEnd}
      >
        <!-- Drag handle -->
        <span class="text-gray-300 cursor-grab active:cursor-grabbing select-none text-xs opacity-0 group-hover:opacity-100">&#9776;</span>

        <input
          type="checkbox"
          checked={item.isCompleted}
          onchange={() => toggleItem(item)}
          class="rounded border-gray-300 cursor-pointer"
        />

        <span class="flex-1 text-sm {item.isCompleted ? 'line-through text-gray-400' : 'text-gray-700'}">
          {item.label}
        </span>

        {#if item.isRequired}
          <span title="Required" class="text-red-400 text-xs">&#128274;</span>
        {/if}

        <button
          onclick={() => deleteItem(item.id)}
          class="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 text-xs leading-none"
          title="Delete item"
        >&#10005;</button>
      </div>
    {/each}
  </div>

  <!-- Add item area -->
  {#if showAddInput}
    <div class="mt-2 flex items-center gap-2">
      <input
        type="text"
        bind:value={addLabel}
        onkeydown={onAddKeydown}
        placeholder="Item label..."
        disabled={addPending}
        class="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      />
      <button
        onclick={submitAdd}
        disabled={!addLabel.trim() || addPending}
        class="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-40"
      >Add</button>
      <button
        onclick={() => { addLabel = ''; showAddInput = false; }}
        class="text-sm text-gray-500 hover:text-gray-700"
      >Cancel</button>
    </div>
  {:else if atLimit}
    <p class="mt-2 text-xs text-gray-400">Max 30 items reached</p>
  {:else}
    <button
      onclick={() => (showAddInput = true)}
      class="mt-2 text-sm text-blue-600 hover:text-blue-800"
    >+ Add item</button>
  {/if}
</div>
