<script lang="ts">
  import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
  import { toStore } from 'svelte/store';
  import { api } from '../lib/api';
  import { addToast } from '../lib/toast.svelte';

  const qc = useQueryClient();
  let entityTypeFilter = $state('');

  const queryParams = $derived(() => {
    const p = new URLSearchParams();
    if (entityTypeFilter) p.set('entityType', entityTypeFilter);
    return p.toString();
  });

  const items = createQuery(toStore(() => ({
    queryKey: ['recently-deleted', entityTypeFilter],
    queryFn: () => api(`/recently-deleted?${queryParams()}`),
  })));

  const restore = createMutation({
    mutationFn: (item: { entityType: string; entityId: string }) =>
      api(`/recently-deleted/${item.entityType}/${item.entityId}/restore`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recently-deleted'] });
      addToast('Item restored', 'success');
    },
    onError: (err: any) => addToast(err.message, 'error'),
  });

  function formatDate(d: string): string {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }
</script>

<div class="space-y-4">
  <h1 class="text-2xl font-bold text-gray-900">Recently Deleted</h1>

  <select value={entityTypeFilter} onchange={(e) => { entityTypeFilter = e.currentTarget.value; }}
    class="rounded border border-gray-300 px-3 py-1.5 text-sm">
    <option value="">All types</option>
    <option value="Client">Client</option>
    <option value="Engagement">Engagement</option>
    <option value="Task">Task</option>
  </select>

  {#if $items.isLoading}
    <p class="text-sm text-gray-500 py-8 text-center">Loading...</p>
  {:else if $items.data?.data?.length === 0}
    <p class="text-sm text-gray-500 py-8 text-center">No recently deleted items.</p>
  {:else if $items.data}
    <div class="bg-white rounded-lg border border-gray-200">
      <div class="divide-y divide-gray-50">
        {#each $items.data.data as item}
          <div class="px-4 py-3 flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-900">{item.name}</p>
              <p class="text-xs text-gray-500">
                {item.entityType} &middot; deleted by {item.deletedByName} &middot; {formatDate(item.deletedAt)}
                &middot; <span class="{item.daysRemaining < 7 ? 'text-red-500' : ''}">{item.daysRemaining} days remaining</span>
              </p>
            </div>
            <button
              onclick={() => $restore.mutate({ entityType: item.entityType, entityId: item.entityId })}
              disabled={$restore.isPending}
              class="text-sm text-blue-600 hover:underline disabled:opacity-50"
            >
              Restore
            </button>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
