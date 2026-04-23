<script lang="ts">
  import { createMutation, useQueryClient } from '@tanstack/svelte-query';
  import { UserRole } from '@ca-practice-os/shared';
  import { api } from '../lib/api';
  import { addToast } from '../lib/toast.svelte';

  let { onClose }: { onClose: () => void } = $props();

  const qc = useQueryClient();

  let name = $state('');
  let email = $state('');
  let role = $state<string>(UserRole.JUNIOR_CA);

  let inviteUrl = $state<string | null>(null);
  let expiresAt = $state<string | null>(null);
  let copied = $state(false);

  const createInvite = createMutation({
    mutationFn: (data: Record<string, any>) =>
      api('/invites', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['invites'] });
      qc.invalidateQueries({ queryKey: ['users'] });
      inviteUrl = data.inviteUrl;
      expiresAt = data.expiresAt;
    },
    onError: (err: any) => addToast(err.message ?? 'Failed to create invite', 'error'),
  });

  function handleSubmit(e: Event) {
    e.preventDefault();
    $createInvite.mutate({ fullName: name, email, role });
  }

  async function copyUrl() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      addToast('Copy failed — select and copy manually', 'error');
    }
  }

  const formattedExpiry = $derived(
    expiresAt ? new Date(expiresAt).toLocaleDateString() : '',
  );
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
  <div class="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
    {#if !inviteUrl}
      <h3 class="font-semibold text-gray-900 mb-4">Invite team member</h3>
      <form onsubmit={handleSubmit} class="space-y-3">
        <div>
          <label for="invName" class="block text-sm font-medium text-gray-700 mb-1">Full name</label>
          <input
            id="invName"
            type="text"
            bind:value={name}
            required
            minlength="2"
            maxlength="100"
            class="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label for="invEmail" class="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            id="invEmail"
            type="email"
            bind:value={email}
            required
            class="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label for="invRole" class="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <select id="invRole" bind:value={role} class="w-full rounded border border-gray-300 px-3 py-2 text-sm">
            {#each Object.values(UserRole) as r}
              <option value={r}>{r.replace(/_/g, ' ')}</option>
            {/each}
          </select>
        </div>
        <p class="text-xs text-gray-500">
          Generates an invite link. The member sets their own password on first visit.
        </p>
        <div class="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onclick={onClose}
            class="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={$createInvite.isPending}
            class="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {$createInvite.isPending ? 'Creating…' : 'Create invite'}
          </button>
        </div>
      </form>
    {:else}
      <h3 class="font-semibold text-gray-900 mb-2">Invite created</h3>
      <p class="text-sm text-gray-600 mb-3">
        Share this link with <span class="font-medium">{name || email}</span>. It expires on {formattedExpiry}.
      </p>
      <div class="flex items-center gap-2 mb-4">
        <input
          type="text"
          readonly
          value={inviteUrl}
          class="flex-1 rounded border border-gray-300 px-2 py-1.5 text-xs font-mono bg-gray-50"
        />
        <button
          type="button"
          onclick={copyUrl}
          class="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div class="flex justify-end">
        <button
          type="button"
          onclick={onClose}
          class="px-3 py-1.5 text-sm rounded bg-gray-900 text-white hover:bg-gray-800"
        >
          Done
        </button>
      </div>
    {/if}
  </div>
</div>
