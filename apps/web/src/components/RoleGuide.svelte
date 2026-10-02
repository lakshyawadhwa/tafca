<script lang="ts">
  /**
   * Explains what a role can do when picking one for an invite or a new user.
   *
   * Every line is derived from DEFAULT_ROLE_PERMISSIONS — the same matrix the
   * API enforces — so this panel cannot drift from the real permissions. Only
   * the one-line summary is written copy.
   */
  import { UserRole, DEFAULT_ROLE_PERMISSIONS } from '@ca-practice-os/shared';
  import type { RolePermissionMap, Scope } from '@ca-practice-os/shared';

  let { role }: { role: string } = $props();

  const SUMMARY: Record<string, string> = {
    [UserRole.PARTNER]: 'Full access. Signs off work and owns the client relationship.',
    [UserRole.MANAGER]: 'Runs day-to-day delivery across all clients, but cannot delete clients.',
    [UserRole.JUNIOR_CA]: 'Works on what they are assigned. Cannot see other people’s clients.',
    [UserRole.ARTICLE]: 'Article assistant. Assigned work only, no access to client credentials.',
    [UserRole.ADMIN]: 'Office administrator. Full data access for setup and record-keeping.',
  };

  const permissions = $derived(
    (DEFAULT_ROLE_PERMISSIONS[role as UserRole] ?? {}) as RolePermissionMap,
  );

  /** "all" / "assigned" / "own" reads better as plain English in a hint panel. */
  function describeScope(scope: Scope | undefined): string {
    if (scope === 'all') return 'every client in the firm';
    if (scope === 'assigned') return 'only what they are assigned to';
    if (scope === 'own') return 'only what they created';
    return '';
  }

  const capabilities = $derived.by(() => {
    const p = permissions;
    const lines: { label: string; value: string; granted: boolean }[] = [];

    lines.push({
      label: 'Sees',
      value: describeScope(p['client:view']) || 'nothing until assigned',
      granted: !!p['client:view'],
    });

    lines.push({
      label: 'Clients',
      value: p['client:create']
        ? p['client:delete']
          ? 'create, edit and delete'
          : 'create and edit, cannot delete'
        : 'view only',
      granted: !!p['client:create'],
    });

    lines.push({
      label: 'Tasks',
      value: p['task:assign']
        ? 'create, edit and assign to anyone'
        : p['task:create']
          ? 'create tasks, but can only edit their own'
          : 'view only',
      granted: !!p['task:create'],
    });

    // The credential locker is not built yet (no CredentialModule in the API),
    // so the matrix's credentials entries would promise a feature that does not
    // exist. Left out until it ships.

    return lines;
  });

  const canInviteOthers = $derived(role === UserRole.PARTNER || role === UserRole.ADMIN);
</script>

<div class="rounded border border-gray-200 bg-gray-50 p-3">
  <p class="text-xs text-gray-700 mb-2">{SUMMARY[role] ?? ''}</p>
  <dl class="space-y-1">
    {#each capabilities as cap}
      <div class="flex gap-2 text-xs">
        <dt class="w-20 shrink-0 text-gray-500">{cap.label}</dt>
        <dd class={cap.granted ? 'text-gray-800' : 'text-gray-500'}>{cap.value}</dd>
      </div>
    {/each}
    <div class="flex gap-2 text-xs">
      <dt class="w-20 shrink-0 text-gray-500">Team</dt>
      <dd class={canInviteOthers ? 'text-gray-800' : 'text-gray-500'}>
        {canInviteOthers ? 'can invite and deactivate members' : 'cannot manage team members'}
      </dd>
    </div>
  </dl>
</div>
