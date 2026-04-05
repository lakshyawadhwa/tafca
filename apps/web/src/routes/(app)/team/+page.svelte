<script lang="ts">
  import { page } from '$app/stores';
  import DataTable from '$lib/components/ui/DataTable.svelte';
  import StatusBadge from '$lib/components/ui/StatusBadge.svelte';
  import WorkloadBadge from '$lib/components/team/WorkloadBadge.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';
  import { BarChart3, UserCircle } from 'lucide-svelte';

  interface WorkloadUser {
    userId: string;
    fullName: string;
    role: string;
    avatarUrl: string | null;
    openTaskCount: number;
    overdueTaskCount: number;
    dueThisWeekCount: number;
    loadStatus: string;
  }

  let data = $derived($page.data as { workload: WorkloadUser[]; firmAverage: number });
  let workload = $derived(data.workload ?? []);
  let firmAverage = $derived(data.firmAverage ?? 0);

  function getInitials(name: string): string {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  const INITIALS_BG_COLORS: string[] = [
    'bg-blue-100 text-blue-700',
    'bg-green-100 text-green-700',
    'bg-purple-100 text-purple-700',
    'bg-amber-100 text-amber-700',
    'bg-red-100 text-red-700',
    'bg-teal-100 text-teal-700',
  ];
</script>

<svelte:head>
  <title>Team — CA Practice OS</title>
</svelte:head>

<div>
  <div class="mb-6">
    <h1 class="text-xl font-semibold text-gray-900">Team Workload</h1>
    <p class="mt-1 text-sm text-gray-500">Monitor team capacity and task distribution</p>
  </div>

  {#if workload.length > 0}
    <div class="mb-6 inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2">
      <BarChart3 class="h-4 w-4 text-blue-600" />
      <span class="text-sm text-blue-800">
        Firm Average: <strong>{firmAverage}</strong> open tasks per person
      </span>
    </div>
  {/if}

  {#snippet userRender(row: any)}
    <div class="flex items-center gap-3">
      <div class="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold {INITIALS_BG_COLORS[workload.indexOf(row) % INITIALS_BG_COLORS.length]}">
        {getInitials(row.fullName)}
      </div>
      <span class="text-sm font-medium text-gray-900">{row.fullName}</span>
    </div>
  {/snippet}

  {#snippet roleRender(row: any)}
    <StatusBadge status={row.role} type="role" />
  {/snippet}

  {#snippet openTasksRender(row: any)}
    <span class="text-sm {row.openTaskCount > firmAverage ? 'font-semibold text-gray-900' : 'text-gray-900'}">
      {row.openTaskCount}
    </span>
  {/snippet}

  {#snippet overdueRender(row: any)}
    <span class="text-sm {row.overdueTaskCount > 0 ? 'font-semibold text-red-600' : 'text-gray-500'}">
      {row.overdueTaskCount}
    </span>
  {/snippet}

  {#snippet dueThisWeekRender(row: any)}
    <span class="text-sm text-gray-900">{row.dueThisWeekCount}</span>
  {/snippet}

  {#snippet loadStatusRender(row: any)}
    <WorkloadBadge status={row.loadStatus} />
  {/snippet}

  <DataTable
    columns={[
      { key: 'fullName', label: 'User', sortable: true, render: userRender },
      { key: 'role', label: 'Role', sortable: true, render: roleRender },
      { key: 'openTaskCount', label: 'Open Tasks', sortable: true, render: openTasksRender },
      { key: 'overdueTaskCount', label: 'Overdue', sortable: true, render: overdueRender },
      { key: 'dueThisWeekCount', label: 'Due This Week', sortable: true, render: dueThisWeekRender },
      { key: 'loadStatus', label: 'Load Status', sortable: true, render: loadStatusRender },
    ]}
    data={workload}
    loading={false}
    emptyMessage="No team members found"
    paginated={false}
  />
</div>
