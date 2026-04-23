<script lang="ts">
  import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
  import { EngagementCategory } from '@ca-practice-os/shared';
  import { api } from '../lib/api';
  import { addToast } from '../lib/toast.svelte';
  import { getUser } from '../lib/auth.svelte';
  import InviteModal from '../components/InviteModal.svelte';

  const qc = useQueryClient();
  const currentUser = $derived(getUser());
  const isAdmin = $derived(currentUser?.role === 'PARTNER' || currentUser?.role === 'ADMIN');

  // Users
  const users = createQuery({
    queryKey: ['users'],
    queryFn: () => api('/users?limit=100'),
  });

  // Firm settings
  const firmSettings = createQuery({
    queryKey: ['firm-settings'],
    queryFn: () => api('/firms/settings'),
  });

  let showInvite = $state(false);

  const deactivateUser = createMutation({
    mutationFn: (userId: string) =>
      api(`/users/${userId}/deactivate`, { method: 'PATCH' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      addToast('User deactivated', 'success');
    },
    onError: (err: any) => addToast(err.message, 'error'),
  });

  const roleColors: Record<string, string> = {
    PARTNER: 'text-purple-700 bg-purple-50',
    ADMIN: 'text-indigo-700 bg-indigo-50',
    MANAGER: 'text-blue-700 bg-blue-50',
    JUNIOR_CA: 'text-green-700 bg-green-50',
    ARTICLE: 'text-amber-700 bg-amber-50',
  };

  // Firm settings edit
  let editingSettings = $state(false);
  let bufferDays = $state(3);
  let autoTaskGen = $state(true);
  let approvalFor = $state<string[]>([]);

  function startEditSettings() {
    const s = $firmSettings.data;
    if (!s) return;
    bufferDays = s.default_internal_deadline_buffer_days ?? 3;
    autoTaskGen = s.auto_task_generation_enabled ?? true;
    approvalFor = [...(s.require_partner_approval_for ?? [])];
    editingSettings = true;
  }

  function toggleApproval(cat: string) {
    if (approvalFor.includes(cat)) {
      approvalFor = approvalFor.filter((c: string) => c !== cat);
    } else {
      approvalFor = [...approvalFor, cat];
    }
  }

  const updateSettings = createMutation({
    mutationFn: (data: Record<string, any>) =>
      api('/firms/settings', { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['firm-settings'] });
      editingSettings = false;
      addToast('Settings updated', 'success');
    },
    onError: (err: any) => addToast(err.message, 'error'),
  });

  function handleSaveSettings(e: Event) {
    e.preventDefault();
    $updateSettings.mutate({
      default_internal_deadline_buffer_days: bufferDays,
      auto_task_generation_enabled: autoTaskGen,
      require_partner_approval_for: approvalFor,
    });
  }
</script>

<div class="space-y-6">
  <h1 class="text-2xl font-bold text-gray-900">Settings</h1>

  <!-- Users section -->
  <div class="bg-white rounded-lg border border-gray-200 p-4">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-gray-800">Team Members</h2>
      {#if isAdmin}
        <button onclick={() => (showInvite = true)} class="bg-blue-600 text-white text-sm px-3 py-1.5 rounded hover:bg-blue-700">
          Invite member
        </button>
      {/if}
    </div>

    {#if $users.isLoading}
      <p class="text-sm text-gray-500">Loading...</p>
    {:else if $users.data?.data}
      <div class="space-y-2">
        {#each $users.data.data as u (u.id)}
          <div class="flex items-center justify-between py-2 px-3 rounded hover:bg-gray-50 {u.isActive ? '' : 'opacity-50'}">
            <div class="flex items-center gap-3">
              <div>
                <p class="text-sm font-medium text-gray-900">{u.fullName}</p>
                <p class="text-xs text-gray-500">{u.email}</p>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-xs px-2 py-0.5 rounded-full font-medium {roleColors[u.role] ?? ''}">{u.role.replace(/_/g, ' ')}</span>
              {#if !u.isActive}
                <span class="text-xs text-gray-400">Inactive</span>
              {:else if isAdmin && u.id !== currentUser?.id}
                <button onclick={() => $deactivateUser.mutate(u.id)} class="text-xs text-red-500 hover:underline">Deactivate</button>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Firm settings -->
  {#if isAdmin && $firmSettings.data}
    <div class="bg-white rounded-lg border border-gray-200 p-4">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-lg font-semibold text-gray-800">Firm Settings</h2>
        {#if !editingSettings}
          <button onclick={startEditSettings} class="text-sm text-blue-600 hover:underline">Edit</button>
        {/if}
      </div>

      {#if editingSettings}
        <form onsubmit={handleSaveSettings} class="space-y-4">
          <div>
            <label for="bufferDays" class="block text-sm font-medium text-gray-700 mb-1">Internal deadline buffer (days)</label>
            <input id="bufferDays" type="number" bind:value={bufferDays} min="1" max="30" required
              class="w-32 rounded border border-gray-300 px-3 py-2 text-sm" />
          </div>

          <div class="flex items-center gap-2">
            <input id="autoTaskGen" type="checkbox" bind:checked={autoTaskGen}
              class="rounded border-gray-300" />
            <label for="autoTaskGen" class="text-sm text-gray-700">Auto task generation</label>
          </div>

          <div>
            <p class="text-sm font-medium text-gray-700 mb-2">Require partner approval for</p>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {#each Object.values(EngagementCategory) as cat}
                <label class="flex items-center gap-2 text-sm text-gray-600">
                  <input type="checkbox" checked={approvalFor.includes(cat)} onchange={() => toggleApproval(cat)}
                    class="rounded border-gray-300" />
                  {cat.replace(/_/g, ' ')}
                </label>
              {/each}
            </div>
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <button type="button" onclick={() => (editingSettings = false)} class="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={$updateSettings.isPending} class="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
              {$updateSettings.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      {:else}
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-500">Internal deadline buffer</span>
            <span class="text-gray-800">{$firmSettings.data.default_internal_deadline_buffer_days} days</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500">Auto task generation</span>
            <span class="text-gray-800">{$firmSettings.data.auto_task_generation_enabled ? 'Enabled' : 'Disabled'}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500">Partner approval required for</span>
            <span class="text-gray-800">{$firmSettings.data.require_partner_approval_for?.join(', ') || 'None'}</span>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

{#if showInvite}
  <InviteModal onClose={() => (showInvite = false)} />
{/if}
