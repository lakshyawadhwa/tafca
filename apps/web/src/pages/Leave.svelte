<script lang="ts">
  import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
  import { toStore } from 'svelte/store';
  import { LeaveType, LeaveStatus } from '@ca-practice-os/shared';
  import { api } from '../lib/api';
  import { navigate } from '../lib/router.svelte';
  import { addToast } from '../lib/toast.svelte';
  import { getUser } from '../lib/auth.svelte';

  const qc = useQueryClient();
  const user = $derived(getUser());
  const canApprove = $derived(user?.role === 'PARTNER' || user?.role === 'MANAGER');

  let page = $state(1);
  let statusFilter = $state('');

  const queryParams = $derived(() => {
    const p = new URLSearchParams();
    p.set('page', String(page));
    p.set('limit', '20');
    if (statusFilter) p.set('status', statusFilter);
    return p.toString();
  });

  const leaves = createQuery(toStore(() => ({
    queryKey: ['leaves', page, statusFilter],
    queryFn: () => api(`/team/leave?${queryParams()}`),
  })));

  // Create leave
  let showCreate = $state(false);
  let leaveType = $state<string>(LeaveType.CASUAL);
  let startDate = $state('');
  let endDate = $state('');
  let reason = $state('');

  const createLeave = createMutation({
    mutationFn: (data: Record<string, any>) =>
      api('/team/leave', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leaves'] });
      showCreate = false;
      startDate = '';
      endDate = '';
      reason = '';
      addToast('Leave request submitted', 'success');
    },
    onError: (err: any) => addToast(err.message, 'error'),
  });

  const approveLeave = createMutation({
    mutationFn: (leaveId: string) =>
      api(`/team/leave/${leaveId}/approve`, { method: 'PATCH' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leaves'] });
      addToast('Leave approved', 'success');
    },
    onError: (err: any) => addToast(err.message, 'error'),
  });

  const rejectLeave = createMutation({
    mutationFn: (leaveId: string) =>
      api(`/team/leave/${leaveId}/reject`, { method: 'PATCH' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leaves'] });
      addToast('Leave rejected', 'success');
    },
    onError: (err: any) => addToast(err.message, 'error'),
  });

  function handleCreateLeave(e: Event) {
    e.preventDefault();
    const data: Record<string, any> = { leaveType, startDate, endDate };
    if (reason) data.reason = reason;
    $createLeave.mutate(data);
  }

  const statusColors: Record<string, string> = {
    PENDING: 'text-amber-700 bg-amber-50',
    APPROVED: 'text-green-700 bg-green-50',
    REJECTED: 'text-red-700 bg-red-50',
    CANCELLED: 'text-gray-500 bg-gray-100',
  };

  function formatDate(d: string): string {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <div>
      <button onclick={() => navigate('/team')} class="text-sm text-gray-500 hover:text-gray-700">&larr; Team</button>
      <h1 class="text-2xl font-bold text-gray-900">Leave Management</h1>
    </div>
    <button onclick={() => (showCreate = true)} class="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700">
      Request Leave
    </button>
  </div>

  <select value={statusFilter} onchange={(e) => { statusFilter = e.currentTarget.value; page = 1; }}
    class="rounded border border-gray-300 px-3 py-1.5 text-sm">
    <option value="">All statuses</option>
    {#each Object.values(LeaveStatus) as s}
      <option value={s}>{s}</option>
    {/each}
  </select>

  {#if $leaves.isLoading}
    <p class="text-sm text-gray-500 py-8 text-center">Loading...</p>
  {:else if $leaves.data?.data?.length === 0}
    <p class="text-sm text-gray-500 py-8 text-center">No leave requests found.</p>
  {:else if $leaves.data}
    <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-100 text-left text-gray-500 text-xs uppercase tracking-wide">
            <th class="px-4 py-3 font-medium">Name</th>
            <th class="px-4 py-3 font-medium">Type</th>
            <th class="px-4 py-3 font-medium">Dates</th>
            <th class="px-4 py-3 font-medium">Status</th>
            {#if canApprove}
              <th class="px-4 py-3 font-medium">Actions</th>
            {/if}
          </tr>
        </thead>
        <tbody>
          {#each $leaves.data.data as leave (leave.id)}
            <tr class="border-b border-gray-50">
              <td class="px-4 py-3 text-gray-900">{leave.userName}</td>
              <td class="px-4 py-3 text-gray-600">{leave.leaveType.replace(/_/g, ' ')}</td>
              <td class="px-4 py-3 text-gray-600 text-xs">{formatDate(leave.startDate)} - {formatDate(leave.endDate)}</td>
              <td class="px-4 py-3">
                <span class="text-xs px-2 py-0.5 rounded-full font-medium {statusColors[leave.status] ?? ''}">{leave.status}</span>
              </td>
              {#if canApprove}
                <td class="px-4 py-3">
                  {#if leave.status === 'PENDING'}
                    <div class="flex gap-2">
                      <button onclick={() => $approveLeave.mutate(leave.id)} class="text-xs text-green-600 hover:underline">Approve</button>
                      <button onclick={() => $rejectLeave.mutate(leave.id)} class="text-xs text-red-600 hover:underline">Reject</button>
                    </div>
                  {/if}
                </td>
              {/if}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

{#if showCreate}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
    <div class="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
      <h3 class="font-semibold text-gray-900 mb-4">Request Leave</h3>
      <form onsubmit={handleCreateLeave} class="space-y-3">
        <div>
          <label for="lType" class="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <select id="lType" bind:value={leaveType} class="w-full rounded border border-gray-300 px-3 py-2 text-sm">
            {#each Object.values(LeaveType) as t}
              <option value={t}>{t.replace(/_/g, ' ')}</option>
            {/each}
          </select>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="lStart" class="block text-sm font-medium text-gray-700 mb-1">Start</label>
            <input id="lStart" type="date" bind:value={startDate} required class="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label for="lEnd" class="block text-sm font-medium text-gray-700 mb-1">End</label>
            <input id="lEnd" type="date" bind:value={endDate} required class="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          </div>
        </div>
        <div>
          <label for="lReason" class="block text-sm font-medium text-gray-700 mb-1">Reason</label>
          <textarea id="lReason" bind:value={reason} rows="2" maxlength="500"
            class="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" onclick={() => (showCreate = false)} class="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={!startDate || !endDate || $createLeave.isPending}
            class="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">Submit</button>
        </div>
      </form>
    </div>
  </div>
{/if}
