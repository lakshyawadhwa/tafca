<script lang="ts">
  import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
  import { toStore } from 'svelte/store';
  import {
    ENGAGEMENT_STATUS_TRANSITIONS,
    type EngagementStatus,
  } from '@ca-practice-os/shared';
  import { api, ApiError } from '../lib/api';
  import { navigate } from '../lib/router.svelte';
  import { addToast } from '../lib/toast.svelte';
  import { can } from '../lib/permissions';

  let { id }: { id: string } = $props();

  const qc = useQueryClient();

  // Engagement detail
  const engagement = createQuery(toStore(() => ({
    queryKey: ['engagement', id],
    queryFn: () => api(`/engagements/${id}`),
  })));

  // Tasks scoped to this engagement, sorted by due_date ASC
  const tasks = createQuery(toStore(() => ({
    queryKey: ['tasks', 'engagement', id],
    queryFn: () => api(`/tasks?engagement_id=${id}&limit=200&sortBy=dueDate&sortOrder=asc`),
  })));

  // Status change
  let pendingStatus = $state('');
  let showBlockingModal = $state(false);
  let blockingTasks = $state<Array<{ id: string; title: string; status: string }>>([]);
  let blockingTaskCount = $state(0);

  const changeStatus = createMutation({
    mutationFn: (status: string) =>
      api(`/engagements/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['engagement', id] });
      qc.invalidateQueries({ queryKey: ['engagements'] });
      addToast('Status updated', 'success');
      pendingStatus = '';
    },
    onError: (err: any) => {
      if (err instanceof ApiError) {
        if (err.status === 400 && err.body?.allowed_transitions) {
          const body = err.body;
          addToast(
            `Invalid transition. Allowed: ${(body.allowed_transitions as string[]).join(', ') || 'none'}`,
            'error',
          );
        } else if (err.status === 409 && err.body?.blocking_tasks) {
          blockingTasks = err.body.blocking_tasks ?? [];
          blockingTaskCount = err.body.open_task_count ?? blockingTasks.length;
          showBlockingModal = true;
        } else {
          addToast(err.message, 'error');
        }
      } else {
        addToast('Status change failed', 'error');
      }
      pendingStatus = '';
    },
  });

  function onStatusChange(e: Event) {
    const next = (e.currentTarget as HTMLSelectElement).value;
    if (!next || next === $engagement.data?.status) return;
    pendingStatus = next;
    $changeStatus.mutate(next);
  }

  function getValidTransitions(current: string): string[] {
    return (ENGAGEMENT_STATUS_TRANSITIONS as Record<string, string[]>)[current] ?? [];
  }

  function formatDate(d: string | null | undefined): string {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  function formatCurrency(amount: number | null, currency: string): string {
    if (amount == null) return '-';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  }

  const canChangeStatus = $derived(can('engagement', 'status_change'));
  const canCreateTask = $derived(can('task', 'create'));

  const now = new Date();

  function isOverdue(task: any): boolean {
    if (!task.dueDate) return false;
    if (task.status === 'DONE' || task.status === 'CANCELLED') return false;
    return new Date(task.dueDate) < now;
  }

  const taskList = $derived.by(() => {
    const d = $tasks.data;
    if (!d) return [] as any[];
    return Array.isArray(d) ? d : (d.data ?? []);
  });

  const statusColors: Record<string, string> = {
    ACTIVE: 'text-green-700 bg-green-50',
    ON_HOLD: 'text-amber-700 bg-amber-50',
    COMPLETED: 'text-blue-700 bg-blue-50',
    CANCELLED: 'text-gray-500 bg-gray-100',
  };

  const taskStatusColors: Record<string, string> = {
    TO_DO: 'text-gray-600 bg-gray-100',
    IN_PROGRESS: 'text-blue-700 bg-blue-50',
    AWAITING_CLIENT: 'text-yellow-700 bg-yellow-50',
    UNDER_REVIEW: 'text-purple-700 bg-purple-50',
    PARTNER_APPROVAL: 'text-orange-700 bg-orange-50',
    DONE: 'text-green-700 bg-green-50',
    CANCELLED: 'text-gray-400 bg-gray-100',
  };
</script>

{#if $engagement.isLoading}
  <p class="text-gray-500 py-8 text-center">Loading...</p>
{:else if $engagement.isError}
  <p class="text-red-600 py-8 text-center">Failed to load engagement.</p>
{:else if $engagement.data}
  {@const eng = $engagement.data}
  <div class="max-w-5xl space-y-6">
    <!-- Header -->
    <div>
      <button onclick={() => navigate('/engagements')} class="text-sm text-gray-500 hover:text-gray-700 mb-1">&larr; Engagements</button>
      <div class="flex items-start justify-between gap-4 mt-1">
        <div class="min-w-0">
          <h1 class="text-2xl font-bold text-gray-900 break-words">{eng.name}</h1>
          <div class="flex flex-wrap items-center gap-2 mt-2">
            <span class="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">
              {eng.engagementType.name}
            </span>
            <span class="text-xs px-2 py-0.5 rounded-full font-medium {statusColors[eng.status] ?? ''}">
              {eng.status.replace(/_/g, ' ')}
            </span>
            {#if eng.periodLabel}
              <span class="text-xs text-gray-500">{eng.periodLabel}</span>
            {:else if eng.periodStart}
              <span class="text-xs text-gray-500">{formatDate(eng.periodStart)} – {formatDate(eng.periodEnd)}</span>
            {/if}
          </div>
        </div>

        {#if canCreateTask}
          <button
            onclick={() => navigate(`/tasks/new?engagement_id=${id}&client_id=${eng.client.id}`)}
            class="shrink-0 text-sm bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Add Task
          </button>
        {/if}
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Left: tasks -->
      <div class="lg:col-span-2 space-y-4">
        <div class="bg-white rounded-lg border border-gray-200 p-4">
          <h3 class="text-sm font-medium text-gray-500 mb-3">
            Tasks
            {#if eng.taskProgress}
              <span class="text-gray-400 font-normal">({eng.taskProgress.done}/{eng.taskProgress.total})</span>
            {/if}
          </h3>

          {#if $tasks.isLoading}
            <p class="text-sm text-gray-400">Loading tasks...</p>
          {:else if taskList.length === 0}
            <p class="text-sm text-gray-400">No tasks yet.</p>
          {:else}
            <div class="divide-y divide-gray-50">
              {#each taskList as task (task.id)}
                <div class="py-2.5 flex items-center gap-3">
                  <div class="flex-1 min-w-0">
                    <button
                      onclick={() => navigate(`/tasks/${task.id}`)}
                      class="text-sm font-medium text-gray-900 hover:text-blue-600 truncate text-left"
                    >
                      {task.title}
                    </button>
                    {#if task.assignee}
                      <p class="text-xs text-gray-400 mt-0.5">{task.assignee.fullName}</p>
                    {/if}
                  </div>

                  {#if task.isBlocked}
                    <span class="text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded shrink-0">Blocked</span>
                  {/if}

                  <span class="text-xs {isOverdue(task) ? 'text-red-600 bg-red-50 px-1.5 py-0.5 rounded font-medium' : 'text-gray-400'} shrink-0">
                    {formatDate(task.dueDate)}
                  </span>

                  <span class="text-xs px-2 py-0.5 rounded font-medium shrink-0 {taskStatusColors[task.status] ?? 'text-gray-500 bg-gray-100'}">
                    {task.status.replace(/_/g, ' ')}
                  </span>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <!-- Right: metadata sidebar -->
      <div class="space-y-4">
        <!-- Status control -->
        <div class="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          <div>
            <span class="text-xs text-gray-500 block mb-1">Status</span>
            {#if canChangeStatus}
              <select
                value={eng.status}
                onchange={onStatusChange}
                disabled={$changeStatus.isPending}
                class="w-full rounded border border-gray-300 px-2 py-1.5 text-sm disabled:opacity-50"
              >
                <option value={eng.status}>{eng.status.replace(/_/g, ' ')}</option>
                {#each getValidTransitions(eng.status) as next}
                  <option value={next}>{next.replace(/_/g, ' ')}</option>
                {/each}
              </select>
            {:else}
              <span class="text-sm text-gray-700">{eng.status.replace(/_/g, ' ')}</span>
            {/if}
          </div>

          <!-- Client -->
          <div>
            <span class="text-xs text-gray-500 block mb-1">Client</span>
            <button
              onclick={() => navigate(`/clients/${eng.client.id}`)}
              class="text-sm text-blue-600 hover:underline text-left"
            >
              {eng.client.displayName}
            </button>
          </div>

          <!-- Type -->
          <div>
            <span class="text-xs text-gray-500 block mb-1">Type</span>
            <p class="text-sm text-gray-700">{eng.engagementType.name}</p>
            <p class="text-xs text-gray-400">{eng.engagementType.category?.replace(/_/g, ' ')}</p>
          </div>

          <!-- Fee -->
          {#if eng.feeAmount != null}
            <div>
              <span class="text-xs text-gray-500 block mb-1">Fee</span>
              <p class="text-sm text-gray-700">{formatCurrency(eng.feeAmount, eng.feeCurrency)}</p>
            </div>
          {/if}

          <!-- Period -->
          {#if eng.periodStart || eng.periodLabel}
            <div>
              <span class="text-xs text-gray-500 block mb-1">Period</span>
              {#if eng.periodLabel}
                <p class="text-sm text-gray-700">{eng.periodLabel}</p>
              {/if}
              {#if eng.periodStart}
                <p class="text-xs text-gray-400">{formatDate(eng.periodStart)} – {formatDate(eng.periodEnd)}</p>
              {/if}
            </div>
          {/if}

          <!-- Completed -->
          {#if eng.completedAt}
            <div>
              <span class="text-xs text-gray-500 block mb-1">Completed</span>
              <p class="text-sm text-gray-700">{formatDate(eng.completedAt)}</p>
            </div>
          {/if}

          <div class="text-xs text-gray-400 pt-2 border-t border-gray-100">
            Created {formatDate(eng.createdAt)}
          </div>
        </div>

        <!-- Team section -->
        <div class="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          <h3 class="text-sm font-medium text-gray-500">Team</h3>

          <div>
            <span class="text-xs text-gray-400 block">Partner</span>
            <p class="text-sm text-gray-700 mt-0.5">
              {eng.assignedPartner?.fullName ?? (eng.assignedPartnerId ? eng.assignedPartnerId : 'Unassigned')}
            </p>
          </div>

          <div>
            <span class="text-xs text-gray-400 block">Manager</span>
            <p class="text-sm text-gray-700 mt-0.5">
              {eng.assignedManager?.fullName ?? (eng.assignedManagerId ? eng.assignedManagerId : 'Unassigned')}
            </p>
          </div>

          {#if eng.assignedTeam?.length > 0}
            <div>
              <span class="text-xs text-gray-400 block mb-1">Team Members</span>
              <div class="space-y-1">
                {#each eng.assignedTeam as member}
                  <p class="text-sm text-gray-700">
                    {typeof member === 'string' ? member : (member.fullName ?? member.id)}
                  </p>
                {/each}
              </div>
            </div>
          {/if}
        </div>

        <!-- Notes -->
        {#if eng.notes}
          <div class="bg-white rounded-lg border border-gray-200 p-4">
            <h3 class="text-sm font-medium text-gray-500 mb-2">Notes</h3>
            <p class="text-sm text-gray-700 whitespace-pre-wrap">{eng.notes}</p>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Blocking tasks modal (409) -->
  {#if showBlockingModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div class="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
        <h3 class="font-semibold text-gray-900 mb-2">Cannot complete engagement</h3>
        <p class="text-sm text-gray-600 mb-4">
          {blockingTaskCount} open {blockingTaskCount === 1 ? 'task' : 'tasks'} must be completed or cancelled first.
        </p>
        {#if blockingTasks.length > 0}
          <ul class="space-y-1 mb-4">
            {#each blockingTasks as bt}
              <li class="text-sm text-gray-700 flex items-center gap-2">
                <span class="text-gray-400">&bull;</span>
                <button
                  onclick={() => { showBlockingModal = false; navigate(`/tasks/${bt.id}`); }}
                  class="hover:underline text-blue-600 text-left"
                >
                  {bt.title}
                </button>
                <span class="text-xs text-gray-400">({bt.status?.replace(/_/g, ' ')})</span>
              </li>
            {/each}
          </ul>
        {/if}
        <div class="flex justify-end">
          <button
            onclick={() => (showBlockingModal = false)}
            class="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  {/if}
{/if}
