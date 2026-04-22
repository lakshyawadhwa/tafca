<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { api } from '../lib/api';
  import { getUser } from '../lib/auth.svelte';
  import { navigate } from '../lib/router.svelte';

  const user = $derived(getUser());

  const dashboard = createQuery({
    queryKey: ['dashboard'],
    queryFn: () => api('/dashboard'),
  });

  function formatDate(d: string | null): string {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  }

  const priorityColors: Record<string, string> = {
    URGENT: 'text-red-700',
    HIGH: 'text-orange-700',
    MEDIUM: 'text-yellow-700',
    LOW: 'text-gray-500',
  };

  let onboardingDismissed = $state(false);

  function dismissOnboarding() {
    onboardingDismissed = true;
    try { localStorage.setItem('ca_onboarding_dismissed', '1'); } catch {}
  }

  // Restore dismissed state
  try {
    if (localStorage.getItem('ca_onboarding_dismissed') === '1') onboardingDismissed = true;
  } catch {}
</script>

<div class="space-y-6">
  <h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
  <p class="text-gray-600">Welcome back, {user?.fullName ?? 'User'}.</p>

  {#if $dashboard.isLoading}
    <p class="text-sm text-gray-500">Loading...</p>
  {:else if $dashboard.data}
    {@const d = $dashboard.data}

    <!-- Onboarding checklist -->
    {#if d.onboarding && !d.onboarding.allDone && !onboardingDismissed}
      {@const ob = d.onboarding}
      {@const done = [ob.firmProfileDone, ob.teamInvited, ob.clientAdded].filter(Boolean).length}
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-5">
        <div class="flex items-start justify-between mb-3">
          <div>
            <h2 class="text-sm font-semibold text-blue-900">Finish setting up your firm</h2>
            <p class="text-xs text-blue-700 mt-0.5">{done} of 3 steps completed</p>
          </div>
          <button onclick={dismissOnboarding} class="text-blue-400 hover:text-blue-600 text-xs">Dismiss</button>
        </div>
        <div class="h-1.5 bg-blue-200 rounded-full mb-4 overflow-hidden">
          <div class="h-full bg-blue-600 rounded-full transition-all" style="width: {(done / 3) * 100}%"></div>
        </div>
        <div class="space-y-2">
          <button
            onclick={() => navigate('/onboarding')}
            class="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-blue-100/60 transition-colors"
          >
            <span class="w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs shrink-0
              {ob.firmProfileDone ? 'bg-blue-600 border-blue-600 text-white' : 'border-blue-300'}">
              {#if ob.firmProfileDone}<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>{/if}
            </span>
            <div>
              <p class="text-sm font-medium {ob.firmProfileDone ? 'text-blue-400 line-through' : 'text-blue-900'}">Set up firm profile</p>
              <p class="text-xs text-blue-600/70">Add ICAI registration, PAN, contact details</p>
            </div>
          </button>

          <button
            onclick={() => navigate('/team')}
            class="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-blue-100/60 transition-colors"
          >
            <span class="w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs shrink-0
              {ob.teamInvited ? 'bg-blue-600 border-blue-600 text-white' : 'border-blue-300'}">
              {#if ob.teamInvited}<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>{/if}
            </span>
            <div>
              <p class="text-sm font-medium {ob.teamInvited ? 'text-blue-400 line-through' : 'text-blue-900'}">Invite a team member</p>
              <p class="text-xs text-blue-600/70">Collaborate with your team on tasks</p>
            </div>
          </button>

          <button
            onclick={() => navigate('/clients/new')}
            class="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-blue-100/60 transition-colors"
          >
            <span class="w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs shrink-0
              {ob.clientAdded ? 'bg-blue-600 border-blue-600 text-white' : 'border-blue-300'}">
              {#if ob.clientAdded}<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>{/if}
            </span>
            <div>
              <p class="text-sm font-medium {ob.clientAdded ? 'text-blue-400 line-through' : 'text-blue-900'}">Add your first client</p>
              <p class="text-xs text-blue-600/70">Start tracking engagements and deadlines</p>
            </div>
          </button>
        </div>
      </div>
    {/if}

    <!-- Summary cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <p class="text-2xl font-bold text-red-600">{d.taskSummary.overdue}</p>
        <p class="text-xs text-gray-500">Overdue</p>
      </div>
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <p class="text-2xl font-bold text-amber-600">{d.taskSummary.dueToday}</p>
        <p class="text-xs text-gray-500">Due Today</p>
      </div>
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <p class="text-2xl font-bold text-blue-600">{d.taskSummary.dueThisWeek}</p>
        <p class="text-xs text-gray-500">Due This Week</p>
      </div>
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <p class="text-2xl font-bold text-purple-600">{d.taskSummary.inReview}</p>
        <p class="text-xs text-gray-500">In Review</p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- My Tasks -->
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <h2 class="text-sm font-semibold text-gray-800 mb-3">My Tasks</h2>
        {#if d.myTasks?.length > 0}
          <div class="space-y-2">
            {#each d.myTasks as task}
              <button
                onclick={() => navigate(`/tasks/${task.id}`)}
                class="w-full text-left flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50 text-sm"
              >
                <div class="min-w-0">
                  <span class="text-gray-900 truncate block">{task.title}</span>
                  {#if task.clientName}
                    <span class="text-xs text-gray-400">{task.clientName}</span>
                  {/if}
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <span class="text-xs {priorityColors[task.priority] ?? ''}">{task.priority}</span>
                  <span class="text-xs text-gray-400">{formatDate(task.dueDate)}</span>
                </div>
              </button>
            {/each}
          </div>
        {:else}
          <div class="py-6 text-center">
            <p class="text-sm text-gray-400 mb-3">No tasks assigned yet</p>
            <button
              onclick={() => navigate('/tasks/new')}
              class="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Create your first task
            </button>
          </div>
        {/if}
      </div>

      <!-- Approval Queue -->
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <h2 class="text-sm font-semibold text-gray-800 mb-3">Approval Queue</h2>
        {#if d.approvalQueue?.length > 0}
          <div class="space-y-2">
            {#each d.approvalQueue as task}
              <button
                onclick={() => navigate(`/tasks/${task.id}`)}
                class="w-full text-left flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50 text-sm"
              >
                <span class="text-gray-900 truncate">{task.title}</span>
                <span class="text-xs text-gray-400">{formatDate(task.dueDate)}</span>
              </button>
            {/each}
          </div>
        {:else}
          <div class="py-6 text-center">
            <p class="text-sm text-gray-400">No items pending approval</p>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
