<script lang="ts">
  import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
  import { toStore } from 'svelte/store';
  import { EngagementStatus } from '@ca-practice-os/shared';
  import { api } from '../lib/api';
  import { addToast } from '../lib/toast.svelte';
  import { navigate } from '../lib/router.svelte';

  const qc = useQueryClient();

  let page = $state(1);
  let statusFilter = $state('');
  let search = $state('');
  let debouncedSearch = $state('');
  let searchTimeout: ReturnType<typeof setTimeout>;

  function onSearchInput(value: string) {
    search = value;
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => { debouncedSearch = value; page = 1; }, 300);
  }

  const queryParams = $derived(() => {
    const p = new URLSearchParams();
    p.set('page', String(page));
    p.set('limit', '20');
    if (debouncedSearch) p.set('search', debouncedSearch);
    if (statusFilter) p.set('status', statusFilter);
    return p.toString();
  });

  const engagements = createQuery(toStore(() => ({
    queryKey: ['engagements', page, debouncedSearch, statusFilter],
    queryFn: () => api(`/engagements?${queryParams()}`),
  })));

  // Create engagement modal state
  let showCreate = $state(false);
  let newName = $state('');
  let newClientId = $state('');
  let newEngagementTypeId = $state('');

  const clients = createQuery({
    queryKey: ['clients-picker'],
    queryFn: () => api('/clients?limit=100'),
  });

  const engagementTypes = createQuery({
    queryKey: ['engagement-types'],
    queryFn: () => api('/engagement-types'),
  });

  const createEngagement = createMutation({
    mutationFn: (data: Record<string, any>) =>
      api('/engagements', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['engagements'] });
      showCreate = false;
      newName = '';
      newClientId = '';
      newEngagementTypeId = '';
      addToast('Engagement created', 'success');
    },
    onError: (err: any) => addToast(err.message, 'error'),
  });

  function handleCreate(e: Event) {
    e.preventDefault();
    const data: Record<string, any> = {
      clientId: newClientId,
      engagementTypeId: newEngagementTypeId,
    };
    if (newName) data.name = newName;
    $createEngagement.mutate(data);
  }

  const statusColors: Record<string, string> = {
    ACTIVE: 'text-green-700 bg-green-50',
    ON_HOLD: 'text-amber-700 bg-amber-50',
    COMPLETED: 'text-blue-700 bg-blue-50',
    CANCELLED: 'text-gray-500 bg-gray-100',
  };

  function formatDate(d: string | null): string {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-bold text-gray-900">Engagements</h1>
    <button onclick={() => (showCreate = true)} class="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700">
      New Engagement
    </button>
  </div>

  <div class="flex flex-wrap gap-3">
    <input type="text" placeholder="Search..." value={search} oninput={(e) => onSearchInput(e.currentTarget.value)}
      class="rounded border border-gray-300 px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500" />
    <select value={statusFilter} onchange={(e) => { statusFilter = e.currentTarget.value; page = 1; }}
      class="rounded border border-gray-300 px-3 py-1.5 text-sm">
      <option value="">All statuses</option>
      {#each Object.values(EngagementStatus) as s}
        <option value={s}>{s.replace(/_/g, ' ')}</option>
      {/each}
    </select>
  </div>

  {#if $engagements.isLoading}
    <p class="text-sm text-gray-500 py-8 text-center">Loading...</p>
  {:else if $engagements.data?.data?.length === 0}
    <p class="text-sm text-gray-500 py-8 text-center">No engagements found.</p>
  {:else if $engagements.data}
    <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-100 text-left text-gray-500 text-xs uppercase tracking-wide">
            <th class="px-4 py-3 font-medium">Name</th>
            <th class="px-4 py-3 font-medium">Client</th>
            <th class="px-4 py-3 font-medium hidden md:table-cell">Type</th>
            <th class="px-4 py-3 font-medium">Status</th>
            <th class="px-4 py-3 font-medium hidden md:table-cell">Tasks</th>
            <th class="px-4 py-3 font-medium hidden md:table-cell">Period</th>
          </tr>
        </thead>
        <tbody>
          {#each $engagements.data.data as eng (eng.id)}
            <tr class="border-b border-gray-50 hover:bg-gray-50">
              <td class="px-4 py-3 font-medium text-gray-900">{eng.name}</td>
              <td class="px-4 py-3">
                <button onclick={() => navigate(`/clients/${eng.client.id}`)} class="text-blue-600 hover:underline text-sm">
                  {eng.client.displayName}
                </button>
              </td>
              <td class="px-4 py-3 hidden md:table-cell text-gray-600 text-xs">{eng.engagementType.name}</td>
              <td class="px-4 py-3">
                <span class="text-xs px-2 py-0.5 rounded-full font-medium {statusColors[eng.status] ?? ''}">
                  {eng.status.replace(/_/g, ' ')}
                </span>
              </td>
              <td class="px-4 py-3 hidden md:table-cell text-gray-600">{eng.taskProgress.done}/{eng.taskProgress.total}</td>
              <td class="px-4 py-3 hidden md:table-cell text-gray-600 text-xs">{eng.periodLabel ?? formatDate(eng.periodStart)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    {#if $engagements.data?.meta?.totalPages > 1}
      <div class="flex items-center justify-between text-sm text-gray-500">
        <span>Page {$engagements.data.meta.page} of {$engagements.data.meta.totalPages}</span>
        <div class="flex gap-2">
          <button disabled={page <= 1} onclick={() => page--} class="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40">Prev</button>
          <button disabled={page >= $engagements.data.meta.totalPages} onclick={() => page++} class="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40">Next</button>
        </div>
      </div>
    {/if}
  {/if}
</div>

<!-- Create modal -->
{#if showCreate}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
    <div class="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
      <h3 class="font-semibold text-gray-900 mb-4">New Engagement</h3>
      <form onsubmit={handleCreate} class="space-y-3">
        <div>
          <label for="eClient" class="block text-sm font-medium text-gray-700 mb-1">Client *</label>
          <select id="eClient" bind:value={newClientId} required class="w-full rounded border border-gray-300 px-3 py-2 text-sm">
            <option value="">Select client</option>
            {#if $clients.data?.data}
              {#each $clients.data.data as c}
                <option value={c.id}>{c.displayName}</option>
              {/each}
            {/if}
          </select>
        </div>
        <div>
          <label for="eType" class="block text-sm font-medium text-gray-700 mb-1">Type *</label>
          <select id="eType" bind:value={newEngagementTypeId} required class="w-full rounded border border-gray-300 px-3 py-2 text-sm">
            <option value="">Select type</option>
            {#if $engagementTypes.data}
              {#each $engagementTypes.data as t}
                <option value={t.id}>{t.name} ({t.category})</option>
              {/each}
            {/if}
          </select>
        </div>
        <div>
          <label for="eName" class="block text-sm font-medium text-gray-700 mb-1">Name (optional)</label>
          <input id="eName" type="text" bind:value={newName} maxlength="200"
            class="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" onclick={() => (showCreate = false)} class="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={!newClientId || !newEngagementTypeId || $createEngagement.isPending}
            class="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
            Create
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
