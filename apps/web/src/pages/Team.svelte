<script lang="ts">
  import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
  import { UserRole } from '@ca-practice-os/shared';
  import { api } from '../lib/api';
  import { navigate } from '../lib/router.svelte';
  import { addToast } from '../lib/toast.svelte';
  import { getUser } from '../lib/auth.svelte';

  const qc = useQueryClient();
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

  // Invite modal
  let showInvite = $state(false);
  let invEmail = $state('');
  let invName = $state('');
  let invRole = $state<string>(UserRole.JUNIOR_CA);
  let invPassword = $state('');

  const createUser = createMutation({
    mutationFn: (data: Record<string, any>) =>
      api('/users', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['team-workload'] });
      showInvite = false;
      invEmail = '';
      invName = '';
      invPassword = '';
      addToast('Team member added', 'success');
    },
    onError: (err: any) => addToast(err.message, 'error'),
  });

  function handleInvite(e: Event) {
    e.preventDefault();
    $createUser.mutate({
      email: invEmail,
      fullName: invName,
      role: invRole,
      password: invPassword,
    });
  }
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-bold text-gray-900">Team</h1>
    <div class="flex gap-2">
      {#if isAdmin}
        <button onclick={() => (showInvite = true)} class="text-sm px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">
          Add Member
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

<!-- Invite modal -->
{#if showInvite}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
    <div class="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
      <h3 class="font-semibold text-gray-900 mb-4">Add Team Member</h3>
      <form onsubmit={handleInvite} class="space-y-3">
        <div>
          <label for="iName" class="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
          <input id="iName" type="text" bind:value={invName} required minlength="2" maxlength="100"
            class="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label for="iEmail" class="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input id="iEmail" type="email" bind:value={invEmail} required
            class="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label for="iRole" class="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <select id="iRole" bind:value={invRole} class="w-full rounded border border-gray-300 px-3 py-2 text-sm">
            {#each Object.values(UserRole) as r}
              <option value={r}>{r.replace(/_/g, ' ')}</option>
            {/each}
          </select>
        </div>
        <div>
          <label for="iPass" class="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input id="iPass" type="password" bind:value={invPassword} required minlength="8"
            class="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" onclick={() => (showInvite = false)} class="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={$createUser.isPending} class="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
            {$createUser.isPending ? 'Adding...' : 'Add Member'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
