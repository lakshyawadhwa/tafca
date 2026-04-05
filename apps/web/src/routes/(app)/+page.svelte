<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { invalidateAll } from '$app/navigation';
  import TaskSummaryCard from '$lib/components/dashboard/TaskSummaryCard.svelte';
  import StatusBadge from '$lib/components/ui/StatusBadge.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';
  import LoadingSkeleton from '$lib/components/ui/LoadingSkeleton.svelte';
  import { getNotificationIcon, getNotificationRoute } from '$lib/utils/notifications';
  import { Bell, AlertCircle } from 'lucide-svelte';

  interface DashboardTask {
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate: string | null;
    clientName?: string;
    assigneeName?: string;
  }

  interface DashboardNotification {
    id: string;
    type: string;
    title: string;
    body: string | null;
    entityType: string | null;
    entityId: string | null;
    readAt: string | null;
    createdAt: string;
  }

  interface DashboardData {
    taskSummary: {
      overdue: number;
      dueToday: number;
      dueThisWeek: number;
      inReview: number;
    };
    myTasks: DashboardTask[];
    approvalQueue: DashboardTask[];
    recentNotifications: DashboardNotification[];
  }

  let data = $derived($page.data as unknown as { dashboard: DashboardData; user: { fullName: string; role: string } });
  let dashboard = $derived(data.dashboard);
  let user = $derived(data.user);

  let firstName = $derived(user?.fullName?.split(' ')[0] ?? 'User');
  let isPartnerOrManager = $derived(user?.role === 'PARTNER' || user?.role === 'MANAGER');

  let todayFormatted = $derived(
    new Date().toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
  );

  let hasError = $state(false);

  // Priority dot colors -- complete class strings
  const PRIORITY_DOT_COLORS: Record<string, string> = {
    LOW: 'bg-gray-400',
    MEDIUM: 'bg-blue-500',
    HIGH: 'bg-orange-500',
    URGENT: 'bg-red-500',
  };

  function formatDueDate(dateStr: string | null): string {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  function isDueDateOverdue(dateStr: string | null): boolean {
    if (!dateStr) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(dateStr + 'T00:00:00') < today;
  }

  function isDueDateSoon(dateStr: string | null): boolean {
    if (!dateStr) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dateStr + 'T00:00:00');
    const diffDays = (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 3;
  }

  function formatTimeAgo(dateStr: string): string {
    const now = Date.now();
    const date = new Date(dateStr).getTime();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  // Due date text color classes -- complete strings
  const DUE_DATE_OVERDUE_CLASS = 'text-xs text-red-600 font-semibold';
  const DUE_DATE_SOON_CLASS = 'text-xs text-amber-600';
  const DUE_DATE_NORMAL_CLASS = 'text-xs text-gray-500';
</script>

<svelte:head>
  <title>Dashboard — CA Practice OS</title>
</svelte:head>

{#if hasError}
  <div class="flex flex-col items-center justify-center py-16 text-center">
    <AlertCircle class="mb-4 h-12 w-12 text-gray-400" />
    <h3 class="text-sm font-semibold text-gray-900">Failed to load dashboard</h3>
    <p class="mt-1 text-sm text-gray-500">Something went wrong. Please try again.</p>
    <button
      type="button"
      onclick={() => { hasError = false; invalidateAll(); }}
      class="mt-4 inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
    >
      Retry
    </button>
  </div>
{:else if !dashboard}
  <LoadingSkeleton variant="page" />
{:else}
  <div>
    <!-- Greeting -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-semibold text-gray-900">Welcome back, {firstName}</h1>
        <p class="mt-1 text-sm font-normal text-gray-500">{todayFormatted}</p>
      </div>
    </div>

    <!-- Task Summary Cards -->
    <div class="grid grid-cols-2 gap-4 {isPartnerOrManager ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}">
      <TaskSummaryCard
        count={dashboard.taskSummary.overdue}
        label="Overdue"
        accentColor="red"
        href="/tasks?overdue=true&assignee=me"
      />
      <TaskSummaryCard
        count={dashboard.taskSummary.dueToday}
        label="Due Today"
        accentColor="amber"
        href="/tasks?dueDate=today&assignee=me"
      />
      <TaskSummaryCard
        count={dashboard.taskSummary.dueThisWeek}
        label="Due This Week"
        accentColor="blue"
        href="/tasks?dueDateRange=thisWeek&assignee=me"
      />
      {#if isPartnerOrManager}
        <TaskSummaryCard
          count={dashboard.taskSummary.inReview}
          label="In Review"
          accentColor="purple"
          href="/tasks?status=PARTNER_APPROVAL"
        />
      {/if}
    </div>

    <!-- My Tasks + Approval Queue -->
    <div class="grid grid-cols-1 gap-6 mt-6 {isPartnerOrManager ? 'lg:grid-cols-5' : ''}">
      <!-- My Tasks -->
      <div class="{isPartnerOrManager ? 'lg:col-span-3' : ''}">
        <div class="rounded-lg border border-gray-200 bg-white">
          <div class="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 class="text-sm font-semibold text-gray-900">My Tasks</h2>
            {#if dashboard.myTasks.length > 0}
              <a href="/tasks?assignee=me" class="text-xs text-blue-600 hover:text-blue-800">
                View all ({dashboard.myTasks.length})
              </a>
            {/if}
          </div>
          <div class="px-5 py-2">
            {#if dashboard.myTasks.length === 0}
              <EmptyState heading="No tasks assigned" body="You're all caught up!" />
            {:else}
              <div class="divide-y divide-gray-100">
                {#each dashboard.myTasks.slice(0, 10) as task (task.id)}
                  <div class="flex items-center gap-3 py-3">
                    <StatusBadge status={task.status} type="task" />
                    <button
                      type="button"
                      onclick={() => goto(`/tasks/${task.id}`)}
                      class="min-w-0 flex-1 truncate text-left text-sm text-gray-900 hover:text-blue-600"
                    >
                      {task.title}
                    </button>
                    <span class="h-2 w-2 shrink-0 rounded-full {PRIORITY_DOT_COLORS[task.priority] ?? 'bg-gray-400'}"></span>
                    {#if task.dueDate}
                      <span
                        class="{isDueDateOverdue(task.dueDate)
                          ? DUE_DATE_OVERDUE_CLASS
                          : isDueDateSoon(task.dueDate)
                            ? DUE_DATE_SOON_CLASS
                            : DUE_DATE_NORMAL_CLASS} shrink-0"
                      >
                        {formatDueDate(task.dueDate)}
                      </span>
                    {/if}
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      </div>

      <!-- Approval Queue (Partner/Manager only) -->
      {#if isPartnerOrManager}
        <div class="lg:col-span-2">
          <div class="rounded-lg border border-gray-200 bg-white">
            <div class="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 class="text-sm font-semibold text-gray-900">Approval Queue</h2>
              {#if dashboard.approvalQueue.length > 0}
                <a href="/tasks?status=PARTNER_APPROVAL" class="text-xs text-blue-600 hover:text-blue-800">
                  View all
                </a>
              {/if}
            </div>
            <div class="px-5 py-2">
              {#if dashboard.approvalQueue.length === 0}
                <EmptyState heading="No pending approvals" body="Nothing needs your attention right now." />
              {:else}
                <div class="divide-y divide-gray-100">
                  {#each dashboard.approvalQueue.slice(0, 10) as task (task.id)}
                    <div class="flex items-center gap-3 py-3">
                      <div class="min-w-0 flex-1">
                        <button
                          type="button"
                          onclick={() => goto(`/tasks/${task.id}`)}
                          class="truncate text-left text-sm text-gray-900 hover:text-blue-600"
                        >
                          {task.title}
                        </button>
                        {#if task.clientName}
                          <p class="mt-0.5 text-xs text-gray-500">{task.clientName}</p>
                        {/if}
                      </div>
                      <StatusBadge status={task.priority} type="priority" />
                      {#if task.dueDate}
                        <span
                          class="{isDueDateOverdue(task.dueDate)
                            ? DUE_DATE_OVERDUE_CLASS
                            : isDueDateSoon(task.dueDate)
                              ? DUE_DATE_SOON_CLASS
                              : DUE_DATE_NORMAL_CLASS} shrink-0"
                        >
                          {formatDueDate(task.dueDate)}
                        </span>
                      {/if}
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        </div>
      {/if}
    </div>

    <!-- Recent Notifications -->
    <div class="mt-6">
      <div class="rounded-lg border border-gray-200 bg-white">
        <div class="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 class="text-sm font-semibold text-gray-900">Recent Notifications</h2>
        </div>
        <div class="px-5 py-2">
          {#if dashboard.recentNotifications.length === 0}
            <EmptyState heading="All caught up" body="No recent notifications." icon={Bell} />
          {:else}
            <div class="divide-y divide-gray-100">
              {#each dashboard.recentNotifications as notification (notification.id)}
                {@const IconComponent = getNotificationIcon(notification.type)}
                {@const route = getNotificationRoute(notification.entityType, notification.entityId)}
                <button
                  type="button"
                  onclick={() => { if (route) goto(route); }}
                  class="flex w-full items-start gap-3 py-3 text-left {route ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default'}"
                >
                  <div class="mt-0.5 shrink-0 text-gray-400">
                    <IconComponent size={16} />
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="text-sm {notification.readAt ? 'text-gray-600' : 'font-medium text-gray-900'}">
                      {notification.title}
                    </p>
                    {#if notification.body}
                      <p class="mt-0.5 line-clamp-1 text-xs text-gray-500">{notification.body}</p>
                    {/if}
                  </div>
                  <span class="shrink-0 text-xs text-gray-400">{formatTimeAgo(notification.createdAt)}</span>
                  {#if !notification.readAt}
                    <div class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500"></div>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}
