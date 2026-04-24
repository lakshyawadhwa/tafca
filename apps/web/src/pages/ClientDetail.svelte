<script lang="ts">
  import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
  import { toStore } from 'svelte/store';
  import { api } from '../lib/api';
  import { navigate } from '../lib/router.svelte';
  import { addToast } from '../lib/toast.svelte';

  let { id }: { id: string } = $props();

  const qc = useQueryClient();

  const client = createQuery(toStore(() => ({
    queryKey: ['client', id],
    queryFn: () => api(`/clients/${id}`),
  })));

  const engagements = createQuery(toStore(() => ({
    queryKey: ['engagements', 'client', id],
    queryFn: () => api(`/engagements?clientId=${id}&limit=50&sortBy=createdAt&sortDir=desc`),
  })));

  const deleteClient = createMutation({
    mutationFn: () => api(`/clients/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      addToast('Client deleted', 'success');
      navigate('/clients');
    },
    onError: (err: any) => addToast(err.message, 'error'),
  });

  let showDeleteConfirm = $state(false);
  let copiedField = $state('');

  function formatDate(d: string | null): string {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  async function copyToClipboard(value: string, field: string) {
    try {
      await navigator.clipboard.writeText(value);
      copiedField = field;
      setTimeout(() => { copiedField = ''; }, 1500);
    } catch {
      addToast('Copy failed', 'error');
    }
  }

  const statusColors: Record<string, string> = {
    ACTIVE: 'text-green-700 bg-green-50',
    INACTIVE: 'text-gray-500 bg-gray-100',
    PROSPECT: 'text-blue-700 bg-blue-50',
  };

  const engagementStatusColors: Record<string, string> = {
    ACTIVE: 'text-green-700 bg-green-50',
    ON_HOLD: 'text-amber-700 bg-amber-50',
    COMPLETED: 'text-blue-700 bg-blue-50',
    CANCELLED: 'text-gray-500 bg-gray-100',
  };
</script>

{#if $client.isLoading}
  <p class="text-gray-500 py-8 text-center">Loading...</p>
{:else if $client.isError}
  <div class="py-16 text-center">
    <p class="text-gray-500 mb-2">Client not found or failed to load.</p>
    <button onclick={() => navigate('/clients')} class="text-sm text-blue-600 hover:underline">&larr; Back to Clients</button>
  </div>
{:else if $client.data}
  {@const c = $client.data}
  <div class="max-w-4xl space-y-6">

    <!-- Header -->
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <button onclick={() => navigate('/clients')} class="text-sm text-gray-500 hover:text-gray-700 mb-1">&larr; Clients</button>
        <div class="flex items-center gap-3 mt-1">
          <h1 class="text-2xl font-bold text-gray-900 truncate">{c.displayName}</h1>
          <span class="text-xs px-2 py-0.5 rounded-full font-medium shrink-0 {statusColors[c.status] ?? ''}">{c.status}</span>
        </div>
        {#if c.legalName && c.legalName !== c.displayName}
          <p class="text-sm text-gray-500 mt-0.5">{c.legalName}</p>
        {/if}
      </div>
      <div class="flex gap-2 shrink-0">
        <button onclick={() => navigate(`/clients/${id}/edit`)}
          class="text-sm px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50">Edit</button>
        <button onclick={() => (showDeleteConfirm = true)}
          class="text-sm text-red-500 hover:text-red-700 px-3 py-1.5 rounded border border-red-200 hover:bg-red-50">Delete</button>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Details -->
      <div class="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <h3 class="text-sm font-semibold text-gray-700">Details</h3>

        <div class="flex justify-between text-sm">
          <span class="text-gray-500">Entity Type</span>
          <span class="text-gray-800">{c.entityType.replace(/_/g, ' ')}</span>
        </div>
        {#if c.constitution}
          <div class="flex justify-between text-sm">
            <span class="text-gray-500">Constitution</span>
            <span class="text-gray-800">{c.constitution.replace(/_/g, ' ')}</span>
          </div>
        {/if}

        {#if c.pan}
          <div class="flex justify-between items-center text-sm">
            <span class="text-gray-500">PAN</span>
            <div class="flex items-center gap-2">
              <span class="text-gray-800 font-mono">{c.pan}</span>
              <button
                onclick={() => copyToClipboard(c.pan, 'pan')}
                class="text-xs text-gray-400 hover:text-blue-600"
                title="Copy PAN"
              >
                {copiedField === 'pan' ? '✓' : '⎘'}
              </button>
            </div>
          </div>
        {/if}
        {#if c.tan}
          <div class="flex justify-between items-center text-sm">
            <span class="text-gray-500">TAN</span>
            <div class="flex items-center gap-2">
              <span class="text-gray-800 font-mono">{c.tan}</span>
              <button onclick={() => copyToClipboard(c.tan, 'tan')} class="text-xs text-gray-400 hover:text-blue-600">
                {copiedField === 'tan' ? '✓' : '⎘'}
              </button>
            </div>
          </div>
        {/if}
        {#if c.cin}
          <div class="flex justify-between items-center text-sm">
            <span class="text-gray-500">CIN</span>
            <div class="flex items-center gap-2">
              <span class="text-gray-800 font-mono text-xs">{c.cin}</span>
              <button onclick={() => copyToClipboard(c.cin, 'cin')} class="text-xs text-gray-400 hover:text-blue-600">
                {copiedField === 'cin' ? '✓' : '⎘'}
              </button>
            </div>
          </div>
        {/if}

        <div class="border-t border-gray-100 pt-3 space-y-3">
          {#if c.assignedPartner}
            <div class="flex justify-between text-sm">
              <span class="text-gray-500">Partner</span>
              <span class="text-gray-800">{c.assignedPartner.fullName}</span>
            </div>
          {/if}
          {#if c.assignedManager}
            <div class="flex justify-between text-sm">
              <span class="text-gray-500">Manager</span>
              <span class="text-gray-800">{c.assignedManager.fullName}</span>
            </div>
          {/if}
          {#if c.assignedJunior}
            <div class="flex justify-between text-sm">
              <span class="text-gray-500">Junior CA</span>
              <span class="text-gray-800">{c.assignedJunior.fullName}</span>
            </div>
          {/if}
          {#if c.assignedArticle}
            <div class="flex justify-between text-sm">
              <span class="text-gray-500">Article</span>
              <span class="text-gray-800">{c.assignedArticle.fullName}</span>
            </div>
          {/if}
        </div>

        <div class="border-t border-gray-100 pt-3 space-y-3">
          <div class="flex justify-between text-sm">
            <span class="text-gray-500">Open Tasks</span>
            <button onclick={() => navigate(`/tasks?clientId=${id}`)} class="text-blue-600 font-medium hover:underline">
              {c.openTaskCount ?? c._count?.tasks ?? 0}
            </button>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-gray-500">Engagements</span>
            <span class="text-gray-800">{c.engagementCount ?? c._count?.engagements ?? 0}</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-gray-500">Since</span>
            <span class="text-gray-800">{formatDate(c.onboardedAt ?? c.createdAt)}</span>
          </div>
        </div>
      </div>

      <!-- Contact -->
      <div class="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <h3 class="text-sm font-semibold text-gray-700">Contact</h3>
        <div class="flex justify-between text-sm">
          <span class="text-gray-500">Name</span>
          <span class="text-gray-800">{c.primaryContactName ?? '-'}</span>
        </div>
        <div class="flex justify-between text-sm">
          <span class="text-gray-500">Email</span>
          {#if c.primaryContactEmail}
            <a href="mailto:{c.primaryContactEmail}" class="text-blue-600 hover:underline text-sm">{c.primaryContactEmail}</a>
          {:else}
            <span class="text-gray-800">-</span>
          {/if}
        </div>
        <div class="flex justify-between text-sm">
          <span class="text-gray-500">Phone</span>
          <span class="text-gray-800">{c.primaryContactPhone ?? '-'}</span>
        </div>
        {#if c.notes}
          <div class="pt-2 border-t border-gray-100">
            <span class="text-xs text-gray-500 block mb-1">Notes</span>
            <p class="text-sm text-gray-700 whitespace-pre-wrap">{c.notes}</p>
          </div>
        {/if}

        {#if c.tags?.length > 0}
          <div class="pt-2 border-t border-gray-100">
            <span class="text-xs text-gray-500 block mb-2">Tags</span>
            <div class="flex flex-wrap gap-1">
              {#each c.tags as tag}
                <span class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{tag}</span>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>

    <!-- GST Numbers -->
    {#if c.gstNumbers?.length > 0}
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <h3 class="text-sm font-semibold text-gray-700 mb-3">GST Registrations</h3>
        <div class="space-y-2">
          {#each c.gstNumbers as gst (gst.id)}
            <div class="flex items-center justify-between text-sm bg-gray-50 rounded px-3 py-2">
              <div class="flex items-center gap-3">
                <span class="font-mono text-gray-800">{gst.gstin}</span>
                {#if gst.tradeName}
                  <span class="text-gray-500">({gst.tradeName})</span>
                {/if}
                {#if gst.isPrimary}
                  <span class="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">Primary</span>
                {/if}
              </div>
              <div class="flex items-center gap-3">
                <span class="text-xs text-gray-500">{gst.registrationType.replace(/_/g, ' ')}</span>
                <button onclick={() => copyToClipboard(gst.gstin, gst.id)} class="text-xs text-gray-400 hover:text-blue-600">
                  {copiedField === gst.id ? '✓' : '⎘'}
                </button>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Engagements -->
    <div class="bg-white rounded-lg border border-gray-200 p-4">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-semibold text-gray-700">Engagements</h3>
        <button
          onclick={() => navigate(`/engagements?clientId=${id}&new=1`)}
          class="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          + New Engagement
        </button>
      </div>

      {#if $engagements.isLoading}
        <p class="text-sm text-gray-400 py-4 text-center">Loading engagements...</p>
      {:else if !$engagements.data?.data?.length}
        <div class="py-8 text-center">
          <p class="text-sm text-gray-400 mb-3">No engagements yet</p>
          <button
            onclick={() => navigate(`/engagements?clientId=${id}&new=1`)}
            class="text-sm text-blue-600 hover:text-blue-700"
          >
            Create first engagement
          </button>
        </div>
      {:else}
        <div class="space-y-2">
          {#each $engagements.data.data as eng (eng.id)}
            {@const total = eng.taskProgress?.total ?? 0}
            {@const done = eng.taskProgress?.done ?? 0}
            {@const pct = total > 0 ? Math.round((done / total) * 100) : 0}
            <button
              onclick={() => navigate(`/engagements/${eng.id}`)}
              class="w-full text-left rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 px-4 py-3 transition-colors"
            >
              <div class="flex items-start justify-between gap-4">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-gray-900 truncate">{eng.name}</p>
                  <p class="text-xs text-gray-500 mt-0.5">{eng.engagementType.name} {eng.periodLabel ? `• ${eng.periodLabel}` : ''}</p>
                </div>
                <div class="flex items-center gap-3 shrink-0">
                  {#if total > 0}
                    <span class="text-xs text-gray-500">{done}/{total} tasks</span>
                  {/if}
                  <span class="text-xs px-2 py-0.5 rounded-full font-medium {engagementStatusColors[eng.status] ?? ''}">
                    {eng.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
              {#if total > 0}
                <div class="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div class="h-full bg-blue-500 rounded-full" style="width: {pct}%"></div>
                </div>
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <!-- Delete confirmation -->
  {#if showDeleteConfirm}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div class="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full mx-4">
        <h3 class="font-semibold text-gray-900 mb-2">Delete client?</h3>
        <p class="text-sm text-gray-600 mb-4">This will soft-delete the client and all associated data. You can restore it from Recently Deleted within 30 days.</p>
        <div class="flex justify-end gap-2">
          <button onclick={() => (showDeleteConfirm = false)} class="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50">Cancel</button>
          <button onclick={() => $deleteClient.mutate()} disabled={$deleteClient.isPending}
            class="px-3 py-1.5 text-sm rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
            {$deleteClient.isPending ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  {/if}
{/if}
