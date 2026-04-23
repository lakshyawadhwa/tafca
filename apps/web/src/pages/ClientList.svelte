<script lang="ts">
  import { onMount } from 'svelte';
  import { createQuery } from '@tanstack/svelte-query';
  import { toStore } from 'svelte/store';
  import { ClientStatus } from '@ca-practice-os/shared';
  import { api } from '../lib/api';
  import { navigate } from '../lib/router.svelte';
  import { can } from '../lib/permissions';

  // URL-synced filter state
  let page = $state(1);
  let search = $state('');
  let statusFilter = $state('');
  let debouncedSearch = $state('');
  let searchTimeout: ReturnType<typeof setTimeout>;

  function readFromUrl() {
    const p = new URLSearchParams(window.location.search);
    const q = p.get('q') ?? '';
    search = q;
    debouncedSearch = q;
    statusFilter = p.get('status') ?? '';
    const pg = Number(p.get('page'));
    page = Number.isFinite(pg) && pg > 0 ? pg : 1;
  }

  function writeToUrl() {
    const p = new URLSearchParams();
    if (debouncedSearch) p.set('q', debouncedSearch);
    if (statusFilter) p.set('status', statusFilter);
    if (page > 1) p.set('page', String(page));
    const qs = p.toString();
    const target = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, '', target);
  }

  // Sync URL whenever any filter changes
  $effect(() => {
    // touch all reactive inputs
    debouncedSearch;
    statusFilter;
    page;
    writeToUrl();
  });

  onMount(() => {
    readFromUrl();
    const onPop = () => readFromUrl();
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  });

  function onSearchInput(value: string) {
    search = value;
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      debouncedSearch = value;
      page = 1;
    }, 300);
  }

  const queryParams = $derived(() => {
    const p = new URLSearchParams();
    p.set('page', String(page));
    p.set('limit', '20');
    if (debouncedSearch) p.set('search', debouncedSearch);
    if (statusFilter) p.set('status', statusFilter);
    return p.toString();
  });

  const clients = createQuery(toStore(() => ({
    queryKey: ['clients', page, debouncedSearch, statusFilter],
    queryFn: () => api(`/clients?${queryParams()}`),
  })));

  const statusColors: Record<string, string> = {
    ACTIVE: 'text-green-700 bg-green-50',
    INACTIVE: 'text-gray-500 bg-gray-100',
    PROSPECT: 'text-blue-700 bg-blue-50',
  };

  const canCreate = $derived(can('client', 'create'));
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-bold text-gray-900">Clients</h1>
    {#if canCreate}
      <button
        onclick={() => navigate('/clients/new')}
        class="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700"
      >
        New Client
      </button>
    {/if}
  </div>

  <div class="flex flex-wrap gap-3">
    <input
      type="text"
      placeholder="Search clients..."
      value={search}
      oninput={(e) => onSearchInput(e.currentTarget.value)}
      class="rounded border border-gray-300 px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
    <select
      value={statusFilter}
      onchange={(e) => { statusFilter = e.currentTarget.value; page = 1; }}
      class="rounded border border-gray-300 px-3 py-1.5 text-sm"
    >
      <option value="">All statuses</option>
      {#each Object.values(ClientStatus) as s}
        <option value={s}>{s}</option>
      {/each}
    </select>
  </div>

  {#if $clients.isLoading}
    <p class="text-sm text-gray-500 py-8 text-center">Loading clients...</p>
  {:else if $clients.isError}
    <p class="text-sm text-red-600 py-8 text-center">Failed to load clients.</p>
  {:else if $clients.data?.data?.length === 0}
    <div class="py-16 text-center">
      <p class="text-sm text-gray-500 mb-4">
        {debouncedSearch || statusFilter ? 'No clients match your filters.' : 'No clients yet.'}
      </p>
      {#if canCreate && !debouncedSearch && !statusFilter}
        <button
          onclick={() => navigate('/clients/new')}
          class="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700"
        >
          Add your first client
        </button>
      {/if}
    </div>
  {:else}
    <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-100 text-left text-gray-500 text-xs uppercase tracking-wide">
            <th class="px-4 py-3 font-medium">Name</th>
            <th class="px-4 py-3 font-medium">Entity Type</th>
            <th class="px-4 py-3 font-medium">Status</th>
            <th class="px-4 py-3 font-medium hidden md:table-cell">PAN</th>
            <th class="px-4 py-3 font-medium hidden md:table-cell">Engagements</th>
            <th class="px-4 py-3 font-medium hidden md:table-cell">Tasks</th>
          </tr>
        </thead>
        <tbody>
          {#each $clients.data.data as client (client.id)}
            <tr
              onclick={() => navigate(`/clients/${client.id}`)}
              class="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
            >
              <td class="px-4 py-3 font-medium text-gray-900">{client.displayName}</td>
              <td class="px-4 py-3 text-gray-600 text-xs">{client.entityType.replace(/_/g, ' ')}</td>
              <td class="px-4 py-3">
                <span class="text-xs px-2 py-0.5 rounded-full font-medium {statusColors[client.status] ?? ''}">
                  {client.status}
                </span>
              </td>
              <td class="px-4 py-3 hidden md:table-cell text-gray-600 font-mono text-xs">{client.pan ?? '-'}</td>
              <td class="px-4 py-3 hidden md:table-cell text-gray-600">{client._count?.engagements ?? 0}</td>
              <td class="px-4 py-3 hidden md:table-cell text-gray-600">{client._count?.tasks ?? 0}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    {#if $clients.data?.meta?.totalPages > 1}
      <div class="flex items-center justify-between text-sm text-gray-500">
        <span>Page {$clients.data.meta.page} of {$clients.data.meta.totalPages}</span>
        <div class="flex gap-2">
          <button disabled={page <= 1} onclick={() => page--} class="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40">Prev</button>
          <button disabled={page >= $clients.data.meta.totalPages} onclick={() => page++} class="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40">Next</button>
        </div>
      </div>
    {/if}
  {/if}
</div>
