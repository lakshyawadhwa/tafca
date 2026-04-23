<script lang="ts">
  import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
  import { api } from '../lib/api';
  import { addToast } from '../lib/toast.svelte';

  let { canRevoke }: { canRevoke: boolean } = $props();

  const qc = useQueryClient();

  const invites = createQuery({
    queryKey: ['invites'],
    queryFn: () => api('/invites'),
  });

  const revokeInvite = createMutation({
    mutationFn: (id: string) => api(`/invites/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invites'] });
      addToast('Invite revoked', 'success');
    },
    onError: (err: any) => addToast(err.message ?? 'Failed to revoke invite', 'error'),
  });

  const roleColors: Record<string, string> = {
    PARTNER: 'text-purple-700 bg-purple-50',
    ADMIN: 'text-indigo-700 bg-indigo-50',
    MANAGER: 'text-blue-700 bg-blue-50',
    JUNIOR_CA: 'text-green-700 bg-green-50',
    ARTICLE: 'text-amber-700 bg-amber-50',
  };

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
</script>

{#if $invites.isLoading}
  <p class="text-sm text-gray-500">Loading invites…</p>
{:else if $invites.isError}
  <p class="text-sm text-red-600">Failed to load invites.</p>
{:else if !$invites.data?.data?.length}
  <p class="text-sm text-gray-500">No pending invites.</p>
{:else}
  <div class="space-y-2">
    {#each $invites.data.data as inv (inv.id)}
      <div class="flex items-center justify-between py-2 px-3 rounded hover:bg-gray-50">
        <div class="min-w-0">
          <p class="text-sm font-medium text-gray-900 truncate">{inv.fullName}</p>
          <p class="text-xs text-gray-500 truncate">{inv.email}</p>
        </div>
        <div class="flex items-center gap-3 shrink-0">
          <span class="text-xs text-gray-500">Expires {formatDate(inv.expiresAt)}</span>
          <span class="text-xs px-2 py-0.5 rounded-full font-medium {roleColors[inv.role] ?? ''}">
            {inv.role.replace(/_/g, ' ')}
          </span>
          {#if canRevoke}
            <button
              onclick={() => $revokeInvite.mutate(inv.id)}
              disabled={$revokeInvite.isPending}
              class="text-xs text-red-500 hover:underline disabled:opacity-50"
            >
              Revoke
            </button>
          {/if}
        </div>
      </div>
    {/each}
  </div>
{/if}
