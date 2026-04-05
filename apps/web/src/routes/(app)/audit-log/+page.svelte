<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import DataTable from '$lib/components/ui/DataTable.svelte';
  import Select from '$lib/components/ui/Select.svelte';
  import UserPicker from '$lib/components/ui/UserPicker.svelte';
  import DatePicker from '$lib/components/ui/DatePicker.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';
  import LoadingSkeleton from '$lib/components/ui/LoadingSkeleton.svelte';
  import { FileText, ChevronRight } from 'lucide-svelte';

  interface AuditLogEntry {
    id: string;
    userId: string;
    userName: string;
    action: string;
    entityType: string;
    entityId: string;
    ipAddress: string | null;
    metadata: Record<string, any> | null;
    occurredAt: string;
  }

  let data = $derived($page.data as unknown as {
    logs: AuditLogEntry[];
    meta: { total: number; page: number; limit: number; totalPages: number };
    filters: { userId: string; entityType: string; action: string; from: string; to: string };
    users: { id: string; fullName: string; role: string }[];
  });

  let logs = $derived(data.logs ?? []);
  let meta = $derived(data.meta);
  let filters = $derived(data.filters);
  let users = $derived(data.users ?? []);

  // Expanded row state
  let expandedRows = $state<Set<string>>(new Set());

  // Filter state with debounce for action search
  let actionSearch = $state(filters.action ?? '');
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function updateFilter(key: string, value: string): void {
    const url = new URL($page.url);
    if (value) {
      url.searchParams.set(key, value);
    } else {
      url.searchParams.delete(key);
    }
    url.searchParams.set('page', '1');
    goto(url.toString(), { replaceState: true });
  }

  function handleActionInput(e: Event): void {
    const val = (e.target as HTMLInputElement).value;
    actionSearch = val;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      updateFilter('action', val);
    }, 300);
  }

  function handlePageChange(newPage: number): void {
    const url = new URL($page.url);
    url.searchParams.set('page', String(newPage));
    goto(url.toString(), { replaceState: true });
  }

  function toggleExpand(id: string): void {
    const next = new Set(expandedRows);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    expandedRows = next;
  }

  function formatTimestamp(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    }) + ' ' + d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  function getEntityLink(entityType: string, entityId: string): string | null {
    const ROUTE_MAP: Record<string, string> = {
      Task: `/tasks/${entityId}`,
      Client: `/clients/${entityId}`,
      Engagement: `/engagements/${entityId}`,
    };
    return ROUTE_MAP[entityType] ?? null;
  }

  function isDeleteAction(action: string): boolean {
    return action.toUpperCase().includes('DELETE');
  }

  const entityTypeOptions = [
    { value: '', label: 'All Types' },
    { value: 'Client', label: 'Client' },
    { value: 'Engagement', label: 'Engagement' },
    { value: 'Task', label: 'Task' },
    { value: 'User', label: 'User' },
    { value: 'Firm', label: 'Firm' },
    { value: 'LeaveRecord', label: 'Leave Record' },
    { value: 'Notification', label: 'Notification' },
  ];
</script>

<svelte:head>
  <title>Audit Log — CA Practice OS</title>
</svelte:head>

<div>
  <div class="mb-6">
    <h1 class="text-xl font-semibold text-gray-900">Audit Log</h1>
    <p class="mt-1 text-sm text-gray-500">Track all actions performed in your firm</p>
  </div>

  <!-- Filters -->
  <div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
    <div>
      <span class="mb-1 block text-xs font-semibold text-gray-500">User</span>
      <UserPicker
        value={filters.userId || null}
        onSelect={(id) => updateFilter('userId', id)}
        options={users}
        placeholder="All users"
      />
    </div>
    <div>
      <Select
        label="Entity Type"
        options={entityTypeOptions}
        value={filters.entityType || ''}
        onSelect={(v) => updateFilter('entityType', v)}
        placeholder="All types"
      />
    </div>
    <div>
      <span class="mb-1 block text-xs font-semibold text-gray-500">Action</span>
      <Input
        value={actionSearch}
        oninput={handleActionInput}
        placeholder="Search actions..."
      />
    </div>
    <div>
      <span class="mb-1 block text-xs font-semibold text-gray-500">From</span>
      <DatePicker
        value={filters.from || null}
        onChange={(d) => updateFilter('from', d)}
        placeholder="From date"
      />
    </div>
    <div>
      <span class="mb-1 block text-xs font-semibold text-gray-500">To</span>
      <DatePicker
        value={filters.to || null}
        onChange={(d) => updateFilter('to', d)}
        placeholder="To date"
      />
    </div>
  </div>

  {#if logs.length === 0}
    <EmptyState icon={FileText} heading="No audit log entries" body="No entries match your current filters." />
  {:else}
    <!-- Custom table (since we need expandable rows) -->
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead>
          <tr class="border-b border-gray-200 bg-gray-50">
            <th class="w-8 px-2 py-3"></th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Timestamp</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">User</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Action</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Entity Type</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Entity</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">IP Address</th>
          </tr>
        </thead>
        <tbody>
          {#each logs as log (log.id)}
            {@const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0}
            {@const isExpanded = expandedRows.has(log.id)}
            {@const entityLink = getEntityLink(log.entityType, log.entityId)}
            <tr class="border-b border-gray-100 hover:bg-gray-50">
              <td class="px-2 py-3">
                {#if hasMetadata}
                  <button
                    type="button"
                    onclick={() => toggleExpand(log.id)}
                    class="rounded p-1 text-gray-400 hover:text-gray-600"
                    aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                  >
                    <ChevronRight
                      size={12}
                      class="transition-transform {isExpanded ? 'rotate-90' : ''}"
                    />
                  </button>
                {/if}
              </td>
              <td class="px-4 py-3 text-xs font-mono text-gray-600">{formatTimestamp(log.occurredAt)}</td>
              <td class="px-4 py-3 text-sm text-gray-900">{log.userName}</td>
              <td class="px-4 py-3 text-sm {isDeleteAction(log.action) ? 'font-semibold text-red-600' : 'text-gray-900'}">
                {log.action}
              </td>
              <td class="px-4 py-3">
                <span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                  {log.entityType}
                </span>
              </td>
              <td class="px-4 py-3">
                {#if entityLink}
                  <a href={entityLink} class="text-sm text-blue-600 hover:text-blue-800">
                    {log.entityId.slice(0, 8)}...
                  </a>
                {:else}
                  <span class="font-mono text-xs text-gray-400">{log.entityId.slice(0, 8)}...</span>
                {/if}
              </td>
              <td class="px-4 py-3 font-mono text-xs text-gray-500">{log.ipAddress ?? '--'}</td>
            </tr>

            <!-- Expandable metadata row -->
            {#if hasMetadata && isExpanded}
              <tr>
                <td colspan="7" class="border-b border-gray-100 bg-gray-50 px-6 py-3">
                  <div class="grid grid-cols-2 gap-x-8 gap-y-2">
                    {#each Object.entries(log.metadata ?? {}) as [key, value]}
                      <div class="flex gap-2">
                        <span class="text-xs font-semibold text-gray-500">{key}:</span>
                        {#if key === 'oldValue' || key === 'old'}
                          <span class="text-xs text-red-500">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                        {:else if key === 'newValue' || key === 'new'}
                          <span class="text-xs text-green-600">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                        {:else}
                          <span class="text-xs text-gray-700">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                        {/if}
                      </div>
                    {/each}
                  </div>
                </td>
              </tr>
            {/if}
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    {#if meta.totalPages > 1}
      <div class="mt-4 flex items-center justify-between border-t border-gray-200 pt-4">
        <span class="text-sm text-gray-500">
          Showing {(meta.page - 1) * meta.limit + 1}-{Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
        </span>
        <div class="flex items-center gap-1">
          <button
            type="button"
            disabled={meta.page <= 1}
            onclick={() => handlePageChange(meta.page - 1)}
            class="rounded-md px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <span class="px-2 text-sm text-gray-500">Page {meta.page} of {meta.totalPages}</span>
          <button
            type="button"
            disabled={meta.page >= meta.totalPages}
            onclick={() => handlePageChange(meta.page + 1)}
            class="rounded-md px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    {/if}
  {/if}
</div>
