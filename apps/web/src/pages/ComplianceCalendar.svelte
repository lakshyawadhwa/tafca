<script lang="ts">
  import { createQuery, useQueryClient } from '@tanstack/svelte-query';
  import { toStore } from 'svelte/store';
  import {
    ComplianceEntryStatus,
    EngagementCategory,
    COMPLIANCE_ENTRY_TRANSITIONS,
  } from '@ca-practice-os/shared';
  import { api, ApiError } from '../lib/api';
  import { navigate } from '../lib/router.svelte';
  import { addToast } from '../lib/toast.svelte';

  const qc = useQueryClient();

  let tab = $state<'calendar' | 'assignments'>('calendar');

  // ── Calendar filters + window ──────────────────────────────────────────
  let clientFilter = $state('');
  let categoryFilter = $state('');
  let statusFilter = $state('');
  // Window: a 3-month span starting at monthCursor (first of month).
  let monthCursor = $state(startOfMonth(new Date()));

  function startOfMonth(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  }
  function fmt(d: Date): string {
    return d.toISOString().slice(0, 10);
  }
  function addMonths(d: Date, n: number): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  }
  function endOfMonth(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  }
  function prettyDate(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
    });
  }

  const windowFrom = $derived(fmt(monthCursor));
  const windowTo = $derived(fmt(endOfMonth(addMonths(monthCursor, 2))));
  const windowLabel = $derived(
    monthCursor.toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' }) +
      ' – ' +
      endOfMonth(addMonths(monthCursor, 2)).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
  );

  const calendarQuery = createQuery(
    toStore(() => ({
      queryKey: ['compliance-calendar', windowFrom, windowTo, clientFilter, categoryFilter, statusFilter],
      queryFn: () => {
        const p = new URLSearchParams({ from: windowFrom, to: windowTo, pageSize: '200' });
        if (clientFilter) p.set('clientId', clientFilter);
        if (categoryFilter) p.set('category', categoryFilter);
        if (statusFilter) p.set('status', statusFilter);
        return api(`/compliance/calendar?${p.toString()}`);
      },
    })),
  );

  // Clients for the pickers (single generous page).
  const clientsQuery = createQuery(
    toStore(() => ({
      queryKey: ['clients-all'],
      queryFn: () => api(`/clients?page=1&limit=200`),
    })),
  );
  const clients = $derived(($clientsQuery.data?.items ?? []) as any[]);

  // Group calendar items by due date for a scannable list.
  const grouped = $derived.by(() => {
    const items = ($calendarQuery.data?.items ?? []) as any[];
    const map = new Map<string, any[]>();
    for (const it of items) {
      if (!map.has(it.dueDate)) map.set(it.dueDate, []);
      map.get(it.dueDate)!.push(it);
    }
    return [...map.entries()]; // already sorted by dueDate from the API
  });

  const statusStyle: Record<string, string> = {
    PENDING: 'bg-gray-100 text-gray-700',
    IN_PROGRESS: 'bg-blue-50 text-blue-700',
    FILED: 'bg-green-50 text-green-700',
    MISSED: 'bg-red-50 text-red-700',
    NOT_APPLICABLE: 'bg-gray-50 text-gray-400',
  };

  function statusOptions(current: ComplianceEntryStatus): ComplianceEntryStatus[] {
    return [current, ...(COMPLIANCE_ENTRY_TRANSITIONS[current] ?? [])];
  }

  async function changeStatus(item: any, next: string) {
    if (next === item.status) return;
    try {
      await api(`/compliance/calendar/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          clientId: item.clientId,
          statutoryDeadlineId: item.statutoryDeadlineId,
          periodLabel: item.periodLabel,
          status: next,
        }),
      });
      addToast(`Marked ${next.replace('_', ' ').toLowerCase()}`, 'success');
      qc.invalidateQueries({ queryKey: ['compliance-calendar'] });
    } catch (e) {
      const msg = e instanceof ApiError ? (e.body?.message ?? e.message) : 'Update failed';
      addToast(Array.isArray(msg) ? msg.join(', ') : msg, 'error');
      qc.invalidateQueries({ queryKey: ['compliance-calendar'] });
    }
  }

  // ── Assignments tab ────────────────────────────────────────────────────
  let assignClientId = $state('');
  let selectedSuggestions = $state<Set<string>>(new Set());

  const suggestionsQuery = createQuery(
    toStore(() => ({
      queryKey: ['compliance-suggestions', assignClientId],
      queryFn: () => api(`/compliance/suggestions?clientId=${assignClientId}`),
      enabled: !!assignClientId,
    })),
  );
  const assignmentsQuery = createQuery(
    toStore(() => ({
      queryKey: ['compliance-assignments', assignClientId],
      queryFn: () => api(`/compliance/assignments?clientId=${assignClientId}`),
      enabled: !!assignClientId,
    })),
  );

  function toggleSuggestion(id: string) {
    const next = new Set(selectedSuggestions);
    next.has(id) ? next.delete(id) : next.add(id);
    selectedSuggestions = next;
  }

  function refreshAssignments() {
    qc.invalidateQueries({ queryKey: ['compliance-suggestions', assignClientId] });
    qc.invalidateQueries({ queryKey: ['compliance-assignments', assignClientId] });
    qc.invalidateQueries({ queryKey: ['compliance-calendar'] });
  }

  async function assignSelected() {
    if (selectedSuggestions.size === 0) return;
    try {
      const res = await api(`/compliance/assignments/bulk`, {
        method: 'POST',
        body: JSON.stringify({
          clientIds: [assignClientId],
          statutoryDeadlineIds: [...selectedSuggestions],
        }),
      });
      addToast(`Assigned ${res.created} deadline(s)`, 'success');
      selectedSuggestions = new Set();
      refreshAssignments();
    } catch {
      addToast('Assignment failed', 'error');
    }
  }

  async function toggleAssignment(a: any) {
    try {
      await api(`/compliance/assignments/${a.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isEnabled: !a.isEnabled }),
      });
      refreshAssignments();
    } catch {
      addToast('Update failed', 'error');
    }
  }

  async function removeAssignment(a: any) {
    if (!confirm(`Remove ${a.deadline?.name ?? 'this deadline'} from the client?`)) return;
    try {
      await api(`/compliance/assignments/${a.id}`, { method: 'DELETE' });
      addToast('Removed', 'success');
      refreshAssignments();
    } catch {
      addToast('Remove failed', 'error');
    }
  }
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-bold text-gray-900">Compliance</h1>
  </div>

  <!-- Tabs -->
  <div class="border-b border-gray-200 flex gap-6">
    {#each [['calendar', 'Calendar'], ['assignments', 'Assign deadlines']] as [key, label]}
      <button
        onclick={() => (tab = key as any)}
        class="pb-2 text-sm font-medium border-b-2 -mb-px {tab === key
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700'}"
      >
        {label}
      </button>
    {/each}
  </div>

  {#if tab === 'calendar'}
    <!-- Filters -->
    <div class="flex flex-wrap items-center gap-3">
      <div class="flex items-center gap-2">
        <button onclick={() => (monthCursor = addMonths(monthCursor, -1))}
          class="rounded border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50">‹</button>
        <span class="text-sm text-gray-600 w-40 text-center">{windowLabel}</span>
        <button onclick={() => (monthCursor = addMonths(monthCursor, 1))}
          class="rounded border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50">›</button>
      </div>
      <select bind:value={clientFilter} class="rounded border border-gray-300 px-3 py-1.5 text-sm">
        <option value="">All clients</option>
        {#each clients as c}<option value={c.id}>{c.displayName}</option>{/each}
      </select>
      <select bind:value={categoryFilter} class="rounded border border-gray-300 px-3 py-1.5 text-sm">
        <option value="">All categories</option>
        {#each Object.values(EngagementCategory) as c}<option value={c}>{c}</option>{/each}
      </select>
      <select bind:value={statusFilter} class="rounded border border-gray-300 px-3 py-1.5 text-sm">
        <option value="">All statuses</option>
        {#each Object.values(ComplianceEntryStatus) as s}<option value={s}>{s}</option>{/each}
      </select>
    </div>

    {#if $calendarQuery.isLoading}
      <p class="text-sm text-gray-500 py-8 text-center">Loading calendar…</p>
    {:else if $calendarQuery.isError}
      <p class="text-sm text-red-600 py-8 text-center">Failed to load calendar. Retry.</p>
    {:else if grouped.length === 0}
      <div class="text-center py-12 border border-dashed border-gray-200 rounded">
        <p class="text-sm text-gray-500">No compliance items in this window.</p>
        <button onclick={() => (tab = 'assignments')}
          class="mt-2 text-sm text-blue-600 hover:underline">Assign deadlines to a client →</button>
      </div>
    {:else}
      <div class="space-y-5">
        {#each grouped as [dueDate, items]}
          <div>
            <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
              Due {prettyDate(dueDate)}
            </h3>
            <div class="rounded border border-gray-200 divide-y divide-gray-100">
              {#each items as item}
                <div class="flex items-center gap-3 px-3 py-2 text-sm">
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-gray-900 truncate">{item.deadlineName}</div>
                    <div class="text-gray-500 truncate">
                      {item.clientName} · {item.periodLabel} · {item.category}
                    </div>
                  </div>
                  {#if item.isOverdue}
                    <span class="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 font-medium">Overdue</span>
                  {/if}
                  {#if item.linkedTaskId}
                    <button onclick={() => navigate(`/tasks/${item.linkedTaskId}`)}
                      class="text-xs text-blue-600 hover:underline">Task</button>
                  {/if}
                  <select
                    value={item.status}
                    onchange={(e) => changeStatus(item, e.currentTarget.value)}
                    class="text-xs rounded px-2 py-1 border-0 font-medium {statusStyle[item.status]}"
                  >
                    {#each statusOptions(item.status) as opt}
                      <option value={opt}>{opt.replace('_', ' ')}</option>
                    {/each}
                  </select>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {:else}
    <!-- Assignments tab -->
    <div class="max-w-2xl space-y-4">
      <select
        value={assignClientId}
        onchange={(e) => { assignClientId = e.currentTarget.value; selectedSuggestions = new Set(); }}
        class="rounded border border-gray-300 px-3 py-1.5 text-sm w-72"
      >
        <option value="">Select a client…</option>
        {#each clients as c}<option value={c.id}>{c.displayName}</option>{/each}
      </select>

      {#if !assignClientId}
        <p class="text-sm text-gray-500">Pick a client to manage its statutory deadlines.</p>
      {:else}
        <!-- Current assignments -->
        <div>
          <h3 class="text-sm font-semibold text-gray-700 mb-1">Assigned</h3>
          {#if $assignmentsQuery.isLoading}
            <p class="text-sm text-gray-500">Loading…</p>
          {:else if ($assignmentsQuery.data?.items ?? []).length === 0}
            <p class="text-sm text-gray-400">None yet.</p>
          {:else}
            <div class="rounded border border-gray-200 divide-y divide-gray-100">
              {#each $assignmentsQuery.data.items as a}
                <div class="flex items-center gap-3 px-3 py-2 text-sm">
                  <div class="flex-1">
                    <div class="font-medium text-gray-900">{a.deadline?.name}</div>
                    <div class="text-gray-500 text-xs">{a.deadline?.category} · {a.deadline?.recurrence}</div>
                  </div>
                  <label class="flex items-center gap-1 text-xs text-gray-500">
                    <input type="checkbox" checked={a.isEnabled} onchange={() => toggleAssignment(a)} />
                    Enabled
                  </label>
                  <button onclick={() => removeAssignment(a)}
                    class="text-xs text-red-600 hover:underline">Remove</button>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Suggestions -->
        <div>
          <div class="flex items-center justify-between mb-1">
            <h3 class="text-sm font-semibold text-gray-700">Suggested for this client</h3>
            {#if selectedSuggestions.size > 0}
              <button onclick={assignSelected}
                class="bg-blue-600 text-white text-xs px-3 py-1.5 rounded hover:bg-blue-700">
                Assign {selectedSuggestions.size}
              </button>
            {/if}
          </div>
          {#if $suggestionsQuery.isLoading}
            <p class="text-sm text-gray-500">Loading…</p>
          {:else if ($suggestionsQuery.data ?? []).length === 0}
            <p class="text-sm text-gray-400">No further suggestions — all applicable deadlines assigned.</p>
          {:else}
            <div class="rounded border border-gray-200 divide-y divide-gray-100">
              {#each $suggestionsQuery.data as s}
                <label class="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" checked={selectedSuggestions.has(s.id)} onchange={() => toggleSuggestion(s.id)} />
                  <div class="flex-1">
                    <div class="font-medium text-gray-900">{s.name}</div>
                    <div class="text-gray-500 text-xs">{s.category} · {s.recurrence} · {s.reason}</div>
                  </div>
                </label>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>
