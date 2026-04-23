<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { api } from '../lib/api';
  import { navigate } from '../lib/router.svelte';
  import { getUser } from '../lib/auth.svelte';
  import InviteModal from '../components/InviteModal.svelte';

  const currentUser = $derived(getUser());
  const isAdmin = $derived(currentUser?.role === 'PARTNER' || currentUser?.role === 'ADMIN');

  const workload = createQuery({
    queryKey: ['team-workload'],
    queryFn: () => api('/team/workload'),
  });

  const loadColors: Record<string, string> = {
    UNDERUTILISED: 'text-blue-700 bg-blue-50',
    BALANCED: 'text-green-700 bg-green-50',
    OVERLOADED: 'text-red-700 bg-red-50',
  };

  let showInvite = $state(false);
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-bold text-gray-900">Team</h1>
    <div class="flex gap-2">
      {#if isAdmin}
        <button onclick={() => (showInvite = true)} class="text-sm px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">
          Invite member
        </button>
      {/if}
      <button onclick={() => navigate('/team/leave')} class="text-sm px-4 py-2 rounded border border-gray-300 hover:bg-gray-50">
        Leave Management
      </button>
    </div>
  </div>

  {#if $workload.isLoading}
    <p class="text-sm text-gray-500 py-8 text-center">Loading...</p>
  {:else if $workload.data}
    <p class="text-sm text-gray-500">Firm average: {$workload.data.firmAverage} open tasks</p>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each $workload.data.data as member (member.userId)}
        <div class="bg-white rounded-lg border border-gray-200 p-4">
          <div class="flex items-center justify-between mb-2">
            <span class="font-medium text-gray-900 text-sm">{member.fullName}</span>
            <span class="text-xs px-2 py-0.5 rounded-full font-medium {loadColors[member.loadStatus] ?? ''}">
              {member.loadStatus}
            </span>
          </div>
          <div class="text-xs text-gray-500 space-y-1">
            <p>Role: {member.role.replace(/_/g, ' ')}</p>
            <p>Open tasks: <span class="text-gray-800 font-medium">{member.openTaskCount}</span></p>
            <p>Overdue: <span class="{member.overdueTaskCount > 0 ? 'text-red-600 font-medium' : 'text-gray-800'}">{member.overdueTaskCount}</span></p>
            <p>Due this week: {member.dueThisWeekCount}</p>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if showInvite}
  <InviteModal onClose={() => (showInvite = false)} />
{/if}
