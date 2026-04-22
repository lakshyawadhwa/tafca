<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { toStore } from 'svelte/store';
  import { TaskStatus, TaskPriority } from '@ca-practice-os/shared';
  import { api } from '../lib/api';
  import { navigate } from '../lib/router.svelte';

  let page = $state(1);
  let search = $state('');
  let statusFilter = $state('');
  let priorityFilter = $state('');
  let searchTimeout: ReturnType<typeof setTimeout>;

  let debouncedSearch = $state('');

  function onSearchInput(value: string) {
    search = value;
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      debouncedSearch = value;
      page = 1;
    }, 300);
  }

  const queryParams = $derived(() => {
    const p = new URLSearchParams();
    p.set('page', String(page));
    p.set('limit', '20');
    if (debouncedSearch) p.set('search', debouncedSearch);
    if (statusFilter) p.set('status', statusFilter);
    if (priorityFilter) p.set('priority', priorityFilter);
    return p.toString();
  });

  const tasks = createQuery(toStore(() => ({
    queryKey: ['tasks', page, debouncedSearch, statusFilter, priorityFilter],
    queryFn: () => api(`/tasks?${queryParams()}`),
  })));

  const priorityColors: Record<string, string> = {
    URGENT: 'text-red-700 bg-red-50',
    HIGH: 'text-orange-700 bg-orange-50',
    MEDIUM: 'text-yellow-700 bg-yellow-50',
    LOW: 'text-gray-600 bg-gray-50',
  };

  const statusColors: Record<string, string> = {
    TO_DO: 'text-gray-700 bg-gray-100',
    IN_PROGRESS: 'text-blue-700 bg-blue-50',
    AWAITING_CLIENT: 'text-amber-700 bg-amber-50',
    UNDER_REVIEW: 'text-purple-700 bg-purple-50',
    PARTNER_APPROVAL: 'text-indigo-700 bg-indigo-50',
    DONE: 'text-green-700 bg-green-50',
    CANCELLED: 'text-gray-500 bg-gray-50',
  };

  function formatDate(d: string | null): string {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  }

  function isOverdue(dueDate: string | null, status: string): boolean {
    if (!dueDate || status === 'DONE' || status === 'CANCELLED') return false;
    return new Date(dueDate) < new Date();
  }
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-bold text-gray-900">Tasks</h1>
    <button
      onclick={() => navigate('/tasks/new')}
      class="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700"
    >
      New Task
    </button>
  </div>

  <!-- Filters -->
  <div class="flex flex-wrap gap-3">
    <input
      type="text"
      placeholder="Search tasks..."
      value={search}
      oninput={(e) => onSearchInput(e.currentTarget.value)}
      class="rounded border border-gray-300 px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
    <select
      value={statusFilter}
      onchange={(e) => { statusFilter = e.currentTarget.value; page = 1; }}
      class="rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="">All statuses</option>
      {#each Object.values(TaskStatus) as s}
        <option value={s}>{s.replace(/_/g, ' ')}</option>
      {/each}
    </select>
    <select
      value={priorityFilter}
      onchange={(e) => { priorityFilter = e.currentTarget.value; page = 1; }}
      class="rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="">All priorities</option>
      {#each Object.values(TaskPriority) as p}
        <option value={p}>{p}</option>
      {/each}
    </select>
  </div>

  <!-- Table -->
  {#if $tasks.isLoading}
    <p class="text-sm text-gray-500 py-8 text-center">Loading tasks...</p>
  {:else if $tasks.isError}
    <p class="text-sm text-red-600 py-8 text-center">Failed to load tasks.</p>
  {:else if $tasks.data?.data?.length === 0}
    <p class="text-sm text-gray-500 py-8 text-center">No tasks found.</p>
  {:else}
    <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-100 text-left text-gray-500 text-xs uppercase tracking-wide">
            <th class="px-4 py-3 font-medium">Title</th>
            <th class="px-4 py-3 font-medium">Status</th>
            <th class="px-4 py-3 font-medium">Priority</th>
            <th class="px-4 py-3 font-medium hidden md:table-cell">Assignee</th>
            <th class="px-4 py-3 font-medium hidden md:table-cell">Client</th>
            <th class="px-4 py-3 font-medium">Due</th>
          </tr>
        </thead>
        <tbody>
          {#each $tasks.data.data as task (task.id)}
            <tr
              onclick={() => navigate(`/tasks/${task.id}`)}
              class="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
            >
              <td class="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">
                {task.title}
                {#if task.subtaskCount > 0}
                  <span class="text-xs text-gray-400 ml-1">({task.subtaskCount})</span>
                {/if}
              </td>
              <td class="px-4 py-3">
                <span class="text-xs px-2 py-0.5 rounded-full font-medium {statusColors[task.status] ?? ''}">
                  {task.status.replace(/_/g, ' ')}
                </span>
              </td>
              <td class="px-4 py-3">
                <span class="text-xs px-2 py-0.5 rounded font-medium {priorityColors[task.priority] ?? ''}">
                  {task.priority}
                </span>
              </td>
              <td class="px-4 py-3 hidden md:table-cell text-gray-600">
                {task.assignee?.fullName ?? '-'}
              </td>
              <td class="px-4 py-3 hidden md:table-cell text-gray-600">
                {task.client?.displayName ?? '-'}
              </td>
              <td class="px-4 py-3 {isOverdue(task.dueDate, task.status) ? 'text-red-600 font-medium' : 'text-gray-600'}">
                {formatDate(task.dueDate)}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    {#if $tasks.data?.meta?.totalPages > 1}
      <div class="flex items-center justify-between text-sm text-gray-500">
        <span>
          Page {$tasks.data.meta.page} of {$tasks.data.meta.totalPages}
          ({$tasks.data.meta.total} total)
        </span>
        <div class="flex gap-2">
          <button
            disabled={page <= 1}
            onclick={() => page--}
            class="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40"
          >
            Prev
          </button>
          <button
            disabled={page >= $tasks.data.meta.totalPages}
            onclick={() => page++}
            class="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    {/if}
  {/if}
</div>
