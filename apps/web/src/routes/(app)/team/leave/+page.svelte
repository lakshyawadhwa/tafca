<script lang="ts">
  import { page } from '$app/stores';
  import { invalidateAll } from '$app/navigation';
  import Tabs from '$lib/components/ui/Tabs.svelte';
  import DataTable from '$lib/components/ui/DataTable.svelte';
  import StatusBadge from '$lib/components/ui/StatusBadge.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
  import LeaveRequestModal from '$lib/components/team/LeaveRequestModal.svelte';
  import LeaveRejectModal from '$lib/components/team/LeaveRejectModal.svelte';
  import { api } from '$lib/utils/api';
  import { addToast } from '$lib/stores/toast.svelte';
  import { Plus, Calendar } from 'lucide-svelte';

  interface LeaveRecord {
    id: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    isHalfDay: boolean;
    status: string;
    reason: string | null;
    userId: string;
    userName: string;
    approvedByName: string | null;
    createdAt: string;
  }

  let data = $derived($page.data as {
    leaves: LeaveRecord[];
    leavesMeta: { total: number; page: number; limit: number; totalPages: number };
    pendingCount: number;
    userRole: string;
  });

  let leaves = $derived(data.leaves ?? []);
  let pendingCount = $derived(data.pendingCount ?? 0);
  let userRole = $derived(data.userRole);
  let isApprover = $derived(userRole === 'PARTNER' || userRole === 'MANAGER');

  let activeTab = $state('my-leave');
  let showRequestModal = $state(false);
  let showRejectModal = $state(false);
  let rejectTarget = $state<LeaveRecord | null>(null);
  let showCancelConfirm = $state(false);
  let cancelTarget = $state<LeaveRecord | null>(null);

  let myLeaves = $derived(leaves.filter((l) => l.userId === $page.data.user?.id));
  let approvalLeaves = $derived(leaves.filter((l) => l.status === 'PENDING' && l.userId !== $page.data.user?.id));

  let tabs = $derived.by(() => {
    const base: { id: string; label: string; count?: number }[] = [{ id: 'my-leave', label: 'My Leave' }];
    if (isApprover) {
      base.push({ id: 'approvals', label: 'Approvals', count: pendingCount });
    }
    return base;
  });

  function formatLeaveType(type: string): string {
    return type
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  function canCancel(leave: LeaveRecord): boolean {
    if (leave.status === 'PENDING') return true;
    if (leave.status === 'APPROVED') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return new Date(leave.startDate + 'T00:00:00') > today;
    }
    return false;
  }

  function handleCancelClick(leave: LeaveRecord): void {
    cancelTarget = leave;
    showCancelConfirm = true;
  }

  async function handleCancelConfirm(): Promise<void> {
    if (!cancelTarget) return;
    try {
      await api(`/team/leave/${cancelTarget.id}/cancel`, { method: 'PATCH' });
      addToast('Leave request cancelled', 'success');
      showCancelConfirm = false;
      cancelTarget = null;
      invalidateAll();
    } catch (err: any) {
      addToast(err.message ?? 'Failed to cancel leave', 'error');
    }
  }

  async function handleApprove(leave: LeaveRecord): Promise<void> {
    try {
      await api(`/team/leave/${leave.id}/approve`, { method: 'PATCH' });
      addToast(`Leave approved for ${leave.userName}`, 'success');
      invalidateAll();
    } catch (err: any) {
      addToast(err.message ?? 'Failed to approve leave', 'error');
    }
  }

  function handleRejectClick(leave: LeaveRecord): void {
    rejectTarget = leave;
    showRejectModal = true;
  }

  async function handleRejectConfirm(reason: string): Promise<void> {
    if (!rejectTarget) return;
    try {
      await api(`/team/leave/${rejectTarget.id}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: reason || undefined }),
      });
      addToast(`Leave rejected for ${rejectTarget.userName}`, 'success');
      showRejectModal = false;
      rejectTarget = null;
      invalidateAll();
    } catch (err: any) {
      addToast(err.message ?? 'Failed to reject leave', 'error');
    }
  }
</script>

<svelte:head>
  <title>Leave Management — CA Practice OS</title>
</svelte:head>

<div>
  <div class="mb-6 flex items-center justify-between">
    <div>
      <h1 class="text-xl font-semibold text-gray-900">Leave Management</h1>
      <p class="mt-1 text-sm text-gray-500">Request and manage leave records</p>
    </div>
    <Button variant="primary" onclick={() => { showRequestModal = true; }}>
      <Plus class="mr-1.5 h-4 w-4" />
      Request Leave
    </Button>
  </div>

  <Tabs {tabs} {activeTab} onTabChange={(id) => { activeTab = id; }} />

  <div class="mt-6">
    {#if activeTab === 'my-leave'}
      {#snippet typeRender(row: any)}
        <span class="text-sm text-gray-900">{formatLeaveType(row.leaveType)}</span>
      {/snippet}

      {#snippet startDateRender(row: any)}
        <span class="text-sm text-gray-900">{formatDate(row.startDate)}</span>
      {/snippet}

      {#snippet endDateRender(row: any)}
        <span class="text-sm text-gray-900">{formatDate(row.endDate)}</span>
      {/snippet}

      {#snippet halfDayRender(row: any)}
        <span class="text-xs {row.isHalfDay ? 'font-semibold text-amber-600' : 'text-gray-400'}">
          {row.isHalfDay ? 'Yes' : 'No'}
        </span>
      {/snippet}

      {#snippet statusRender(row: any)}
        <StatusBadge status={row.status} type="leaveStatus" />
      {/snippet}

      {#snippet reasonRender(row: any)}
        {#if row.reason}
          <span class="text-sm text-gray-600 truncate max-w-[150px] inline-block" title={row.reason}>
            {row.reason}
          </span>
        {:else}
          <span class="text-sm text-gray-400">--</span>
        {/if}
      {/snippet}

      {#snippet actionsRender(row: any)}
        {#if canCancel(row)}
          <button
            type="button"
            onclick={() => handleCancelClick(row)}
            class="text-sm text-red-600 hover:text-red-800"
          >
            Cancel
          </button>
        {:else}
          <span class="text-sm text-gray-400">--</span>
        {/if}
      {/snippet}

      <DataTable
        columns={[
          { key: 'leaveType', label: 'Type', sortable: true, render: typeRender },
          { key: 'startDate', label: 'Start Date', sortable: true, render: startDateRender },
          { key: 'endDate', label: 'End Date', sortable: true, render: endDateRender },
          { key: 'isHalfDay', label: 'Half Day', sortable: false, render: halfDayRender },
          { key: 'status', label: 'Status', sortable: true, render: statusRender },
          { key: 'reason', label: 'Reason', sortable: false, render: reasonRender },
          { key: 'actions', label: '', sortable: false, render: actionsRender },
        ]}
        data={myLeaves}
        loading={false}
        emptyMessage="No leave requests yet"
        paginated={false}
      />
    {:else if activeTab === 'approvals'}
      {#snippet approvalUserRender(row: any)}
        <span class="text-sm font-medium text-gray-900">{row.userName}</span>
      {/snippet}

      {#snippet approvalTypeRender(row: any)}
        <span class="text-sm text-gray-900">{formatLeaveType(row.leaveType)}</span>
      {/snippet}

      {#snippet approvalDatesRender(row: any)}
        <div class="text-sm text-gray-900">
          {formatDate(row.startDate)} - {formatDate(row.endDate)}
          {#if row.isHalfDay}
            <span class="ml-1 text-xs text-amber-600">(Half day)</span>
          {/if}
        </div>
      {/snippet}

      {#snippet approvalReasonRender(row: any)}
        {#if row.reason}
          <span class="text-sm text-gray-600 truncate max-w-[150px] inline-block" title={row.reason}>
            {row.reason}
          </span>
        {:else}
          <span class="text-sm text-gray-400">--</span>
        {/if}
      {/snippet}

      {#snippet approvalActionsRender(row: any)}
        <div class="flex items-center gap-2">
          <button
            type="button"
            onclick={() => handleApprove(row)}
            class="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700"
          >
            Approve
          </button>
          <button
            type="button"
            onclick={() => handleRejectClick(row)}
            class="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
          >
            Reject
          </button>
        </div>
      {/snippet}

      <DataTable
        columns={[
          { key: 'userName', label: 'User', sortable: true, render: approvalUserRender },
          { key: 'leaveType', label: 'Type', sortable: true, render: approvalTypeRender },
          { key: 'startDate', label: 'Dates', sortable: true, render: approvalDatesRender },
          { key: 'reason', label: 'Reason', sortable: false, render: approvalReasonRender },
          { key: 'actions', label: '', sortable: false, render: approvalActionsRender },
        ]}
        data={approvalLeaves}
        loading={false}
        emptyMessage="No pending leave requests"
        paginated={false}
      />
    {/if}
  </div>
</div>

<LeaveRequestModal
  open={showRequestModal}
  onClose={() => { showRequestModal = false; }}
  onCreated={() => { showRequestModal = false; invalidateAll(); }}
/>

<LeaveRejectModal
  open={showRejectModal}
  leaveName={rejectTarget?.userName ?? ''}
  onClose={() => { showRejectModal = false; rejectTarget = null; }}
  onRejected={handleRejectConfirm}
/>

<ConfirmDialog
  open={showCancelConfirm}
  title="Cancel Leave Request"
  message="Are you sure you want to cancel this leave request?"
  confirmLabel="Cancel Leave"
  variant="danger"
  onConfirm={handleCancelConfirm}
  onCancel={() => { showCancelConfirm = false; cancelTarget = null; }}
/>
