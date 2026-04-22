<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { toStore } from 'svelte/store';
  import { api } from '../lib/api';

  let page = $state(1);
  let entityTypeFilter = $state('');
  let actionFilter = $state('');

  const queryParams = $derived(() => {
    const p = new URLSearchParams();
    p.set('page', String(page));
    p.set('limit', '30');
    if (entityTypeFilter) p.set('entityType', entityTypeFilter);
    if (actionFilter) p.set('action', actionFilter);
    return p.toString();
  });

  const logs = createQuery(toStore(() => ({
    queryKey: ['audit-log', page, entityTypeFilter, actionFilter],
    queryFn: () => api(`/audit-log?${queryParams()}`),
  })));

  function timeAgo(d: string): string {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
</script>

<div class="space-y-4">
  <h1 class="text-2xl font-bold text-gray-900">Audit Log</h1>

  <div class="flex gap-3">
    <select value={entityTypeFilter} onchange={(e) => { entityTypeFilter = e.currentTarget.value; page = 1; }}
      class="rounded border border-gray-300 px-3 py-1.5 text-sm">
      <option value="">All entities</option>
      <option value="Task">Task</option>
      <option value="Client">Client</option>
      <option value="Engagement">Engagement</option>
      <option value="User">User</option>
    </select>
  </div>

  {#if $logs.isLoading}
    <p class="text-sm text-gray-500 py-8 text-center">Loading...</p>
  {:else if $logs.data?.data?.length === 0}
    <p class="text-sm text-gray-500 py-8 text-center">No log entries found.</p>
  {:else if $logs.data}
    <div class="bg-white rounded-lg border border-gray-200">
      <div class="divide-y divide-gray-50">
        {#each $logs.data.data as entry (entry.id)}
          <div class="px-4 py-3 flex items-start gap-3">
            <div class="flex-1 min-w-0">
              <p class="text-sm">
                <span class="font-medium text-gray-900">{entry.user.fullName}</span>
                <span class="text-gray-500"> {entry.action.replace(/_/g, ' ').toLowerCase()}</span>
                <span class="text-gray-600"> {entry.entityType}</span>
              </p>
              {#if entry.metadata && Object.keys(entry.metadata).length > 0}
                <p class="text-xs text-gray-400 mt-0.5 truncate">
                  {JSON.stringify(entry.metadata)}
                </p>
              {/if}
            </div>
            <span class="text-xs text-gray-400 shrink-0">{timeAgo(entry.occurredAt)}</span>
          </div>
        {/each}
      </div>
    </div>

    {#if $logs.data?.meta?.totalPages > 1}
      <div class="flex items-center justify-between text-sm text-gray-500">
        <span>Page {$logs.data.meta.page} of {$logs.data.meta.totalPages}</span>
        <div class="flex gap-2">
          <button disabled={page <= 1} onclick={() => page--} class="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40">Prev</button>
          <button disabled={page >= $logs.data.meta.totalPages} onclick={() => page++} class="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40">Next</button>
        </div>
      </div>
    {/if}
  {/if}
</div>
