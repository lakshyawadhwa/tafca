<script lang="ts">
  import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
  import { TASK_STATUS_TRANSITIONS, type TaskStatus } from '@ca-practice-os/shared';
  import { api } from '../lib/api';
  import { navigate } from '../lib/router.svelte';
  import { addToast } from '../lib/toast.svelte';
  import ChecklistSection from '../components/ChecklistSection.svelte';
  import DependencySection from '../components/DependencySection.svelte';

  let { id }: { id: string } = $props();

  const qc = useQueryClient();

  const task = createQuery(() => ({
    queryKey: ['task', id],
    queryFn: () => api(`/tasks/${id}`),
  }));

  const checklist = createQuery(() => ({
    queryKey: ['task', id, 'checklist'],
    queryFn: () => api(`/tasks/${id}/checklist`),
  }));

  const comments = createQuery(() => ({
    queryKey: ['task', id, 'comments'],
    queryFn: () => api(`/tasks/${id}/comments?limit=50`),
  }));

  const activity = createQuery(() => ({
    queryKey: ['task', id, 'activity'],
    queryFn: () => api(`/tasks/${id}/activity?limit=20`),
  }));

  const dependencies = createQuery(() => ({
    queryKey: ['task', id, 'dependencies'],
    queryFn: () => api(`/tasks/${id}/dependencies`),
  }));

  // Status change mutation
  const changeStatus = createMutation({
    mutationFn: (status: string) =>
      api(`/tasks/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', id] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      addToast('Status updated', 'success');
    },
    onError: (err: any) => addToast(err.message, 'error'),
  });

  // Comment mutation
  let commentBody = $state('');
  const addComment = createMutation({
    mutationFn: (body: string) =>
      api(`/tasks/${id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', id, 'comments'] });
      commentBody = '';
      addToast('Comment added', 'success');
    },
    onError: (err: any) => addToast(err.message, 'error'),
  });

  // Delete mutation
  const deleteTask = createMutation({
    mutationFn: () => api(`/tasks/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      addToast('Task deleted', 'success');
      navigate('/tasks');
    },
    onError: (err: any) => addToast(err.message, 'error'),
  });

  function getValidTransitions(current: string): string[] {
    return (TASK_STATUS_TRANSITIONS as Record<string, string[]>)[current] ?? [];
  }

  function formatDate(d: string | null): string {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  function timeAgo(d: string): string {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  let showDeleteConfirm = $state(false);

  const priorityColors: Record<string, string> = {
    URGENT: 'text-red-700 bg-red-50',
    HIGH: 'text-orange-700 bg-orange-50',
    MEDIUM: 'text-yellow-700 bg-yellow-50',
    LOW: 'text-gray-600 bg-gray-100',
  };
</script>

{#if $task.isLoading}
  <p class="text-gray-500 py-8 text-center">Loading...</p>
{:else if $task.isError}
  <p class="text-red-600 py-8 text-center">Failed to load task.</p>
{:else if $task.data}
  {@const t = $task.data}
  <div class="max-w-5xl space-y-6">
    <!-- Header -->
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <button onclick={() => navigate('/tasks')} class="text-sm text-gray-500 hover:text-gray-700 mb-1">&larr; Tasks</button>
        <h1 class="text-2xl font-bold text-gray-900 break-words">{t.title}</h1>
      </div>
      <button
        onclick={() => (showDeleteConfirm = true)}
        class="text-sm text-red-500 hover:text-red-700 shrink-0"
      >
        Delete
      </button>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Main content -->
      <div class="lg:col-span-2 space-y-6">
        <!-- Description -->
        {#if t.description}
          <div class="bg-white rounded-lg border border-gray-200 p-4">
            <h3 class="text-sm font-medium text-gray-500 mb-2">Description</h3>
            <p class="text-sm text-gray-700 whitespace-pre-wrap">{t.description}</p>
          </div>
        {/if}

        <!-- Checklist -->
        {#if !$checklist.isLoading}
          <ChecklistSection
            taskId={id}
            items={$checklist.data ?? []}
            progress={t.checklistProgress}
          />
        {/if}

        <!-- Dependencies -->
        {#if !$dependencies.isLoading}
          <DependencySection
            taskId={id}
            blockedBy={$dependencies.data?.blockedBy ?? []}
            blocks={$dependencies.data?.blocking ?? []}
            isBlocked={t.isBlocked ?? false}
          />
        {/if}

        <!-- Comments -->
        <div class="bg-white rounded-lg border border-gray-200 p-4">
          <h3 class="text-sm font-medium text-gray-500 mb-3">Comments</h3>

          <form
            onsubmit={(e) => { e.preventDefault(); if (commentBody.trim()) $addComment.mutate(commentBody.trim()); }}
            class="flex gap-2 mb-4"
          >
            <input
              type="text"
              bind:value={commentBody}
              placeholder="Add a comment..."
              class="flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={!commentBody.trim() || $addComment.isPending}
              class="bg-blue-600 text-white text-sm px-4 py-1.5 rounded hover:bg-blue-700 disabled:opacity-40"
            >
              Send
            </button>
          </form>

          {#if $comments.data?.data?.length > 0}
            <div class="space-y-3">
              {#each $comments.data.data as c (c.id)}
                <div class="text-sm">
                  <span class="font-medium text-gray-800">{c.author?.fullName ?? 'Unknown'}</span>
                  <span class="text-gray-400 ml-2">{timeAgo(c.createdAt)}</span>
                  <p class="text-gray-600 mt-0.5">{c.body}</p>
                </div>
              {/each}
            </div>
          {:else if !$comments.isLoading}
            <p class="text-sm text-gray-400">No comments yet.</p>
          {/if}
        </div>

        <!-- Activity -->
        {#if $activity.data?.data?.length > 0}
          <div class="bg-white rounded-lg border border-gray-200 p-4">
            <h3 class="text-sm font-medium text-gray-500 mb-3">Activity</h3>
            <div class="space-y-2">
              {#each $activity.data.data as entry (entry.id)}
                <div class="text-xs text-gray-500 flex items-start gap-2">
                  <span class="text-gray-400 shrink-0">{timeAgo(entry.occurredAt)}</span>
                  <span>
                    <span class="font-medium text-gray-700">{entry.actor?.fullName}</span>
                    {entry.action.replace(/_/g, ' ').toLowerCase()}
                    {#if entry.newValue}
                      <span class="text-gray-700">{typeof entry.newValue === 'string' ? entry.newValue : ''}</span>
                    {/if}
                  </span>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <!-- Metadata sidebar -->
      <div class="space-y-4">
        <div class="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          <!-- Status -->
          <div>
            <span class="text-xs text-gray-500 block mb-1">Status</span>
            <select
              value={t.status}
              onchange={(e) => $changeStatus.mutate(e.currentTarget.value)}
              class="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              disabled={$changeStatus.isPending}
            >
              <option value={t.status}>{t.status.replace(/_/g, ' ')}</option>
              {#each getValidTransitions(t.status) as next}
                <option value={next}>{next.replace(/_/g, ' ')}</option>
              {/each}
            </select>
          </div>

          <!-- Priority -->
          <div>
            <span class="text-xs text-gray-500 block mb-1">Priority</span>
            <span class="text-sm px-2 py-0.5 rounded font-medium {priorityColors[t.priority] ?? ''}">
              {t.priority}
            </span>
          </div>

          <!-- Assignee -->
          <div>
            <span class="text-xs text-gray-500 block mb-1">Assignee</span>
            <p class="text-sm text-gray-800">{t.assignee?.fullName ?? 'Unassigned'}</p>
          </div>

          <!-- Reviewer -->
          <div>
            <span class="text-xs text-gray-500 block mb-1">Reviewer</span>
            <p class="text-sm text-gray-800">{t.reviewer?.fullName ?? 'None'}</p>
          </div>

          <!-- Due Date -->
          <div>
            <span class="text-xs text-gray-500 block mb-1">Due Date</span>
            <p class="text-sm text-gray-800">{formatDate(t.dueDate)}</p>
          </div>

          <!-- Client -->
          {#if t.client}
            <div>
              <span class="text-xs text-gray-500 block mb-1">Client</span>
              <button
                onclick={() => navigate(`/clients/${t.client.id}`)}
                class="text-sm text-blue-600 hover:underline"
              >
                {t.client.displayName}
              </button>
            </div>
          {/if}

          <!-- Engagement -->
          {#if t.engagement}
            <div>
              <span class="text-xs text-gray-500 block mb-1">Engagement</span>
              <p class="text-sm text-gray-800">{t.engagement.name}</p>
            </div>
          {/if}

          <!-- Tags -->
          {#if t.tags?.length > 0}
            <div>
              <span class="text-xs text-gray-500 block mb-1">Tags</span>
              <div class="flex flex-wrap gap-1">
                {#each t.tags as tag}
                  <span class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{tag}</span>
                {/each}
              </div>
            </div>
          {/if}

          <div class="text-xs text-gray-400 pt-2 border-t border-gray-100">
            Created {formatDate(t.createdAt)}
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Delete confirmation -->
  {#if showDeleteConfirm}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div class="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full mx-4">
        <h3 class="font-semibold text-gray-900 mb-2">Delete task?</h3>
        <p class="text-sm text-gray-600 mb-4">This action can be undone from the "Recently Deleted" page.</p>
        <div class="flex justify-end gap-2">
          <button onclick={() => (showDeleteConfirm = false)} class="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onclick={() => $deleteTask.mutate()}
            disabled={$deleteTask.isPending}
            class="px-3 py-1.5 text-sm rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  {/if}
{/if}
