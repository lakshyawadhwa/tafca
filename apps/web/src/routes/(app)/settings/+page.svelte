<script lang="ts">
  import { page } from '$app/stores';
  import { goto, invalidateAll } from '$app/navigation';
  import Tabs from '$lib/components/ui/Tabs.svelte';
  import FormField from '$lib/components/ui/FormField.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import MultiSelect from '$lib/components/ui/MultiSelect.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import DataTable from '$lib/components/ui/DataTable.svelte';
  import StatusBadge from '$lib/components/ui/StatusBadge.svelte';
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
  import InviteUserModal from '$lib/components/settings/InviteUserModal.svelte';
  import EditUserModal from '$lib/components/settings/EditUserModal.svelte';
  import { api } from '$lib/utils/api';
  import { addToast } from '$lib/stores/toast.svelte';
  import { Plus, Pencil, UserX } from 'lucide-svelte';

  interface FirmSettings {
    default_internal_deadline_buffer_days: number;
    auto_task_generation_enabled: boolean;
    require_partner_approval_for: string[];
  }

  interface UserRecord {
    id: string;
    fullName: string;
    email: string;
    role: string;
    isActive: boolean;
    phone: string | null;
    lastLoginAt: string | null;
  }

  let data = $derived($page.data as {
    settings: FirmSettings;
    users: UserRecord[];
    usersMeta: { total: number; page: number; limit: number; totalPages: number };
    engagementTypes: { id: string; code: string; name: string }[];
  });

  // Tab state from URL
  let activeTab = $derived($page.url.searchParams.get('tab') ?? 'general');

  function handleTabChange(tabId: string): void {
    const url = new URL($page.url);
    url.searchParams.set('tab', tabId);
    goto(url.toString(), { replaceState: true, noScroll: true });
  }

  // Settings form state
  let bufferDays = $state(3);
  let approvalFor = $state<string[]>([]);
  let settingsSaving = $state(false);

  // Sync settings form when data loads
  $effect(() => {
    if (data.settings) {
      bufferDays = data.settings.default_internal_deadline_buffer_days ?? 3;
      approvalFor = data.settings.require_partner_approval_for ?? [];
    }
  });

  let settingsDirty = $derived.by(() => {
    if (!data.settings) return false;
    return (
      bufferDays !== (data.settings.default_internal_deadline_buffer_days ?? 3) ||
      JSON.stringify(approvalFor.sort()) !== JSON.stringify((data.settings.require_partner_approval_for ?? []).sort())
    );
  });

  let engagementTypeOptions = $derived(
    (data.engagementTypes ?? []).map((et: any) => ({
      value: et.code ?? et.id,
      label: et.name ?? et.code,
    })),
  );

  async function saveSettings(): Promise<void> {
    settingsSaving = true;
    try {
      await api('/firms/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          default_internal_deadline_buffer_days: bufferDays,
          require_partner_approval_for: approvalFor,
        }),
      });
      addToast('Settings saved successfully', 'success');
      invalidateAll();
    } catch (err: any) {
      addToast(err.message ?? 'Failed to save settings', 'error');
    } finally {
      settingsSaving = false;
    }
  }

  // User management state
  let showInviteModal = $state(false);
  let showEditModal = $state(false);
  let editTarget = $state<UserRecord | null>(null);
  let showDeactivateConfirm = $state(false);
  let deactivateTarget = $state<UserRecord | null>(null);
  let deactivating = $state(false);

  function handleEditClick(user: UserRecord): void {
    editTarget = user;
    showEditModal = true;
  }

  function handleDeactivateClick(user: UserRecord): void {
    deactivateTarget = user;
    showDeactivateConfirm = true;
  }

  async function handleDeactivateConfirm(): Promise<void> {
    if (!deactivateTarget) return;
    deactivating = true;
    try {
      const res = await api<{ openTasksCount?: number }>(`/users/${deactivateTarget.id}/deactivate`, {
        method: 'PATCH',
      });
      const count = res.openTasksCount ?? 0;
      const msg = count > 0
        ? `${deactivateTarget.fullName} deactivated. ${count} open tasks need reassignment.`
        : `${deactivateTarget.fullName} deactivated.`;
      addToast(msg, 'success');
      showDeactivateConfirm = false;
      deactivateTarget = null;
      invalidateAll();
    } catch (err: any) {
      addToast(err.message ?? 'Failed to deactivate user', 'error');
    } finally {
      deactivating = false;
    }
  }

  function formatRelativeTime(dateStr: string | null): string {
    if (!dateStr) return 'Never';
    const now = Date.now();
    const date = new Date(dateStr).getTime();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 30) return `${diffDay}d ago`;
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'users', label: 'Users' },
  ];
</script>

<svelte:head>
  <title>Settings — CA Practice OS</title>
</svelte:head>

<div>
  <div class="mb-6">
    <h1 class="text-xl font-semibold text-gray-900">Settings</h1>
  </div>

  <Tabs {tabs} {activeTab} onTabChange={handleTabChange} />

  <div class="mt-6">
    {#if activeTab === 'general'}
      <div class="max-w-2xl rounded-lg border border-gray-200 bg-white p-6">
        <!-- Task Defaults section -->
        <div class="mb-8">
          <h3 class="mb-4 text-sm font-semibold text-gray-900">Task Defaults</h3>
          <FormField
            label="Internal Deadline Buffer (days)"
            helpText="How many days before the due date to set the internal deadline"
          >
            <input
              type="number"
              bind:value={bufferDays}
              min={1}
              max={30}
              class="h-10 w-24 rounded-md border border-gray-200 px-3 text-sm text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
            />
          </FormField>
        </div>

        <!-- Workflow section -->
        <div class="mb-8">
          <h3 class="mb-4 text-sm font-semibold text-gray-900">Workflow</h3>
          <FormField
            label="Require Partner Approval For"
            helpText="Select engagement types that require partner approval before marking tasks as Done"
          >
            <MultiSelect
              options={engagementTypeOptions}
              selected={approvalFor}
              onChange={(val) => { approvalFor = val; }}
              placeholder="Select engagement types"
            />
          </FormField>
        </div>

        <!-- Save button -->
        <div class="flex justify-end border-t border-gray-200 pt-4">
          <Button
            variant="primary"
            loading={settingsSaving}
            disabled={!settingsDirty}
            onclick={saveSettings}
          >
            Save Settings
          </Button>
        </div>
      </div>

    {:else if activeTab === 'users'}
      <div class="mb-4 flex items-center justify-end">
        <Button variant="primary" onclick={() => { showInviteModal = true; }}>
          <Plus class="mr-1.5 h-4 w-4" />
          Invite User
        </Button>
      </div>

      {#snippet nameRender(row: any)}
        <span class="text-sm font-medium text-gray-900">{row.fullName}</span>
      {/snippet}

      {#snippet emailRender(row: any)}
        <span class="text-sm text-gray-600">{row.email}</span>
      {/snippet}

      {#snippet roleRender(row: any)}
        <StatusBadge status={row.role} type="role" />
      {/snippet}

      {#snippet statusRender(row: any)}
        <StatusBadge status={row.isActive ? 'Active' : 'Inactive'} type="userStatus" />
      {/snippet}

      {#snippet lastLoginRender(row: any)}
        <span class="text-sm text-gray-500">{formatRelativeTime(row.lastLoginAt)}</span>
      {/snippet}

      {#snippet actionsRender(row: any)}
        <div class="flex items-center gap-1">
          <button
            type="button"
            onclick={() => handleEditClick(row)}
            class="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Edit {row.fullName}"
          >
            <Pencil size={14} />
          </button>
          {#if row.isActive}
            <button
              type="button"
              onclick={() => handleDeactivateClick(row)}
              class="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600"
              aria-label="Deactivate {row.fullName}"
            >
              <UserX size={14} />
            </button>
          {/if}
        </div>
      {/snippet}

      <DataTable
        columns={[
          { key: 'fullName', label: 'Name', sortable: true, render: nameRender },
          { key: 'email', label: 'Email', sortable: true, render: emailRender },
          { key: 'role', label: 'Role', sortable: true, render: roleRender },
          { key: 'isActive', label: 'Status', sortable: true, render: statusRender },
          { key: 'lastLoginAt', label: 'Last Login', sortable: true, render: lastLoginRender },
          { key: 'actions', label: '', sortable: false, render: actionsRender },
        ]}
        data={data.users ?? []}
        loading={false}
        emptyMessage="No users found"
        paginated={true}
        totalItems={data.usersMeta?.total}
        currentPage={data.usersMeta?.page}
        pageSize={data.usersMeta?.limit}
      />
    {/if}
  </div>
</div>

<InviteUserModal
  open={showInviteModal}
  onClose={() => { showInviteModal = false; }}
  onCreated={() => { showInviteModal = false; invalidateAll(); }}
/>

<EditUserModal
  open={showEditModal}
  user={editTarget}
  onClose={() => { showEditModal = false; editTarget = null; }}
  onSaved={() => { showEditModal = false; editTarget = null; invalidateAll(); }}
/>

<ConfirmDialog
  open={showDeactivateConfirm}
  title="Deactivate User"
  message="Are you sure you want to deactivate {deactivateTarget?.fullName ?? 'this user'}?"
  confirmLabel="Deactivate"
  variant="danger"
  onConfirm={handleDeactivateConfirm}
  onCancel={() => { showDeactivateConfirm = false; deactivateTarget = null; }}
/>
