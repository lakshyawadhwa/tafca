<script lang="ts">
  import type { Snippet } from 'svelte';
  import { page } from '$app/stores';
  import Sidebar from '$lib/components/layout/Sidebar.svelte';
  import Topbar from '$lib/components/layout/Topbar.svelte';
  import {
    initSidebar,
    isSidebarCollapsed,
  } from '$lib/stores/sidebar.svelte';
  import { setAuth } from '$lib/stores/auth.svelte';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();

  // Restore sidebar state from localStorage on mount
  $effect(() => {
    initSidebar();
  });

  // Hydrate client-side auth store from server data
  $effect(() => {
    const { accessToken, user } = $page.data;
    if (accessToken && user) {
      setAuth(accessToken, user);
    }
  });
</script>

<div class="min-h-screen bg-gray-50">
  <Sidebar />

  <!-- Main area: shifts based on sidebar state -->
  <div
    class={[
      'flex min-h-screen flex-col transition-all duration-200',
      'ml-0',
      isSidebarCollapsed() ? 'md:ml-16' : 'md:ml-60',
    ].join(' ')}
  >
    <Topbar user={$page.data.user!} />

    <!-- Content area below topbar -->
    <main class="flex-1 px-6 pb-6 pt-22">
      {@render children()}
    </main>
  </div>
</div>
