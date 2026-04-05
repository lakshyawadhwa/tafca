<script lang="ts">
  import { page } from '$app/stores';
  import { goto, invalidateAll } from '$app/navigation';
  import DataTable from '$lib/components/ui/DataTable.svelte';
  import Select from '$lib/components/ui/Select.svelte';
  import CountdownBadge from '$lib/components/ui/CountdownBadge.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';
  import { api } from '$lib/utils/api';
  import { addToast } from '$lib/stores/toast.svelte';
  import { RotateCcw, Trash2 } from 'lucide-svelte';

  interface DeletedItem {
    entityType: string;
    entityId: string;
    name: string;
    deletedAt: string;
    deletedByName: string;
    daysRemaining: number;
  }

  let data = $derived($page.data as unknown as {
    items: DeletedItem[];
    currentFilter: string;
  });

  let items = $derived(data.items ?? []);
  let currentFilter = $derived(data.currentFilter ?? '');

  // Restore state
  let showRestoreConfirm = $state(false);
  let restoreTarget = $state<DeletedItem | null>(null);
  let restoring = $state(false);

  // Entity type badge colors -- complete Tailwind class strings
  const ENTITY_TYPE_COLORS: Record<string, string> = {
    Client: 'bg-blue-50 text-blue-700',
    Engagement: 'bg-purple-50 text-purple-700',
    Task: 'bg-green-50 text-green-700',
  };

  const entityTypeFilterOptions = [
    { value: '', label: 'All Types' },
    { value: 'Client', label: 'Client' },
    { value: 'Engagement', label: 'Engagement' },
    { value: 'Task', label: 'Task' },
  ];

  function handleFilterChange(value: string): void {
    const url = new URL($page.url);
    if (value) {
      url.searchParams.set('entityType', value);
    } else {
      url.searchParams.delete('entityType');
    }
    goto(url.toString(), { replaceState: true });
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  function handleRestoreClick(item: DeletedItem): void {
    restoreTarget = item;
    showRestoreConfirm = true;
  }

  async function handleRestoreConfirm(): Promise<void> {
    if (!restoreTarget) return;
    restoring = true;
    try {
      await api(`/recently-deleted/${restoreTarget.entityType}/${restoreTarget.entityId}/restore`, {
        method: 'POST',
      });
      addToast(`${restoreTarget.entityType} '${restoreTarget.name}' restored successfully.`, 'success');
      showRestoreConfirm = false;
      restoreTarget = null;
      invalidateAll();
    } catch (err: any) {
      addToast(err.message ?? 'Failed to restore item', 'error');
    } finally {
      restoring = false;
    }
  }
</script>

<svelte:head>
  <title>Recently Deleted — CA Practice OS</title>
</svelte:head>

<div>
  <div class="mb-6">
    <h1 class="text-xl font-semibold text-gray-900">Recently Deleted</h1>
    <p class="mt-1 text-sm text-gray-500">Soft-deleted records are kept for 30 days before permanent removal</p>
  </div>

  <!-- Filter -->
  <div class="mb-4 max-w-xs">
    <Select
      label="Entity Type"
      options={entityTypeFilterOptions}
      value={currentFilter}
      onSelect={handleFilterChange}
      placeholder="All Types"
    />
  </div>

  {#snippet entityTypeRender(row: any)}
    <span class="rounded-full px-2 py-0.5 text-xs font-medium {ENTITY_TYPE_COLORS[row.entityType] ?? 'bg-gray-100 text-gray-700'}">
      {row.entityType}
    </span>
  {/snippet}

  {#snippet nameRender(row: any)}
    <span class="text-sm text-gray-900">{row.name}</span>
  {/snippet}

  {#snippet deletedByRender(row: any)}
    <span class="text-sm text-gray-600">{row.deletedByName}</span>
  {/snippet}

  {#snippet deletedAtRender(row: any)}
    <span class="text-sm text-gray-600">{formatDate(row.deletedAt)}</span>
  {/snippet}

  {#snippet daysRemainingRender(row: any)}
    <CountdownBadge daysRemaining={row.daysRemaining} />
  {/snippet}

  {#snippet actionsRender(row: any)}
    <Button
      variant="secondary"
      size="sm"
      onclick={() => handleRestoreClick(row)}
    >
      <RotateCcw class="mr-1 h-3.5 w-3.5" />
      Restore
    </Button>
  {/snippet}

  <DataTable
    columns={[
      { key: 'entityType', label: 'Entity Type', sortable: true, render: entityTypeRender },
      { key: 'name', label: 'Name', sortable: true, render: nameRender },
      { key: 'deletedByName', label: 'Deleted By', sortable: true, render: deletedByRender },
      { key: 'deletedAt', label: 'Deleted At', sortable: true, render: deletedAtRender },
      { key: 'daysRemaining', label: 'Days Remaining', sortable: true, render: daysRemainingRender },
      { key: 'actions', label: '', sortable: false, render: actionsRender },
    ]}
    data={items}
    loading={false}
    emptyMessage="Nothing in the trash"
    paginated={false}
  />
</div>

<ConfirmDialog
  open={showRestoreConfirm}
  title="Restore {restoreTarget?.entityType ?? 'item'}?"
  message="This will restore '{restoreTarget?.name ?? ''}' and make it visible again."
  confirmLabel="Restore"
  variant="default"
  onConfirm={handleRestoreConfirm}
  onCancel={() => { showRestoreConfirm = false; restoreTarget = null; }}
/>
