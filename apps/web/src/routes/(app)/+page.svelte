<script lang="ts">
  import { page } from '$app/stores';

  let userName = $derived($page.data.user?.fullName ?? 'User');
</script>

<svelte:head>
  <title>Dashboard — CA Practice OS</title>
</svelte:head>

<div>
  <h1 class="text-xl font-semibold text-gray-900">Dashboard</h1>
  <p class="mt-1 text-sm text-gray-500">Welcome back, {userName}</p>

  <div class="mt-6 rounded-lg bg-white p-6 shadow-sm">
    <p class="text-sm text-gray-600">
      Your dashboard will show overdue tasks, today's tasks, and recent activity.
    </p>
  </div>
</div>
