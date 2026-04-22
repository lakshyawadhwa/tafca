<script lang="ts">
  import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
  import { TaskPriority } from '@ca-practice-os/shared';
  import { api } from '../lib/api';
  import { navigate } from '../lib/router.svelte';
  import { addToast } from '../lib/toast.svelte';

  const qc = useQueryClient();

  let title = $state('');
  let description = $state('');
  let priority = $state<string>(TaskPriority.MEDIUM);
  let assigneeId = $state('');
  let reviewerId = $state('');
  let clientId = $state('');
  let engagementId = $state('');
  let dueDate = $state('');

  // Load users and clients for pickers
  const users = createQuery({
    queryKey: ['users'],
    queryFn: () => api('/users?limit=100'),
  });

  const clients = createQuery({
    queryKey: ['clients-picker'],
    queryFn: () => api('/clients?limit=100'),
  });

  const create = createMutation({
    mutationFn: (data: Record<string, any>) =>
      api('/tasks', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (result: any) => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      addToast('Task created', 'success');
      navigate(`/tasks/${result.id}`);
    },
    onError: (err: any) => addToast(err.message, 'error'),
  });

  function handleSubmit(e: Event) {
    e.preventDefault();
    const data: Record<string, any> = { title, priority };
    if (description) data.description = description;
    if (assigneeId) data.assigneeId = assigneeId;
    if (reviewerId) data.reviewerId = reviewerId;
    if (clientId) data.clientId = clientId;
    if (engagementId) data.engagementId = engagementId;
    if (dueDate) data.dueDate = new Date(dueDate).toISOString();
    $create.mutate(data);
  }
</script>

<div class="max-w-2xl">
  <button onclick={() => navigate('/tasks')} class="text-sm text-gray-500 hover:text-gray-700 mb-2">&larr; Tasks</button>
  <h1 class="text-2xl font-bold text-gray-900 mb-6">New Task</h1>

  <form onsubmit={handleSubmit} class="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
    <div>
      <label for="title" class="block text-sm font-medium text-gray-700 mb-1">Title *</label>
      <input
        id="title"
        type="text"
        bind:value={title}
        required
        maxlength="300"
        class="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>

    <div>
      <label for="desc" class="block text-sm font-medium text-gray-700 mb-1">Description</label>
      <textarea
        id="desc"
        bind:value={description}
        rows="3"
        class="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      ></textarea>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label for="priority" class="block text-sm font-medium text-gray-700 mb-1">Priority</label>
        <select id="priority" bind:value={priority} class="w-full rounded border border-gray-300 px-3 py-2 text-sm">
          {#each Object.values(TaskPriority) as p}
            <option value={p}>{p}</option>
          {/each}
        </select>
      </div>

      <div>
        <label for="dueDate" class="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
        <input
          id="dueDate"
          type="date"
          bind:value={dueDate}
          class="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label for="assignee" class="block text-sm font-medium text-gray-700 mb-1">Assignee</label>
        <select id="assignee" bind:value={assigneeId} class="w-full rounded border border-gray-300 px-3 py-2 text-sm">
          <option value="">Unassigned</option>
          {#if $users.data?.data}
            {#each $users.data.data as u}
              <option value={u.id}>{u.fullName}</option>
            {/each}
          {/if}
        </select>
      </div>

      <div>
        <label for="reviewer" class="block text-sm font-medium text-gray-700 mb-1">Reviewer</label>
        <select id="reviewer" bind:value={reviewerId} class="w-full rounded border border-gray-300 px-3 py-2 text-sm">
          <option value="">None</option>
          {#if $users.data?.data}
            {#each $users.data.data as u}
              <option value={u.id}>{u.fullName}</option>
            {/each}
          {/if}
        </select>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label for="client" class="block text-sm font-medium text-gray-700 mb-1">Client</label>
        <select id="client" bind:value={clientId} class="w-full rounded border border-gray-300 px-3 py-2 text-sm">
          <option value="">None</option>
          {#if $clients.data?.data}
            {#each $clients.data.data as c}
              <option value={c.id}>{c.displayName}</option>
            {/each}
          {/if}
        </select>
      </div>

      <div>
        <label for="engagement" class="block text-sm font-medium text-gray-700 mb-1">Engagement</label>
        <select id="engagement" bind:value={engagementId} class="w-full rounded border border-gray-300 px-3 py-2 text-sm" disabled={!clientId}>
          <option value="">None</option>
        </select>
        {#if !clientId}
          <p class="text-xs text-gray-400 mt-1">Select a client first</p>
        {/if}
      </div>
    </div>

    <div class="flex justify-end gap-2 pt-2">
      <button type="button" onclick={() => navigate('/tasks')} class="px-4 py-2 text-sm rounded border border-gray-300 hover:bg-gray-50">
        Cancel
      </button>
      <button
        type="submit"
        disabled={!title.trim() || $create.isPending}
        class="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {$create.isPending ? 'Creating...' : 'Create Task'}
      </button>
    </div>
  </form>
</div>
