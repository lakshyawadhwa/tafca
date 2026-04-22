<script lang="ts">
  import { type Snippet } from 'svelte';
  import { getUser, clearAuth } from '../lib/auth.svelte';
  import { navigate, getPath } from '../lib/router.svelte';
  import { api } from '../lib/api';
  import type { UserRole } from '@ca-practice-os/shared';

  let { children }: { children: Snippet } = $props();

  const user = $derived(getUser());
  const currentPath = $derived(getPath());
  let sidebarCollapsed = $state(false);
  let mobileOpen = $state(false);

  interface NavItem {
    label: string;
    path: string;
    roles?: UserRole[];
  }

  const navItems: NavItem[] = [
    { label: 'Dashboard', path: '/' },
    { label: 'Tasks', path: '/tasks' },
    { label: 'Clients', path: '/clients' },
    { label: 'Engagements', path: '/engagements' },
    { label: 'Team', path: '/team' },
    { label: 'Settings', path: '/settings', roles: ['PARTNER', 'ADMIN'] as UserRole[] },
    { label: 'Audit Log', path: '/audit-log', roles: ['PARTNER', 'ADMIN'] as UserRole[] },
  ];

  const visibleNav = $derived(
    navItems.filter((item) => !item.roles || (user && item.roles.includes(user.role)))
  );

  function isActive(itemPath: string): boolean {
    if (itemPath === '/') return currentPath === '/';
    return currentPath.startsWith(itemPath);
  }

  function handleNav(path: string) {
    navigate(path);
    mobileOpen = false;
  }

  async function handleLogout() {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      // best effort
    }
    clearAuth();
    navigate('/login');
  }
</script>

<div class="flex h-screen bg-gray-50">
  <!-- Mobile overlay -->
  {#if mobileOpen}
    <div class="fixed inset-0 z-30 bg-black/30 md:hidden" onclick={() => (mobileOpen = false)} role="presentation"></div>
  {/if}

  <!-- Sidebar -->
  <aside
    class="fixed md:static z-40 h-full bg-white border-r border-gray-200 flex flex-col transition-all duration-200
           {sidebarCollapsed ? 'w-16' : 'w-56'}
           {mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}"
  >
    <div class="flex items-center justify-between h-14 px-4 border-b border-gray-100">
      {#if !sidebarCollapsed}
        <span class="font-semibold text-gray-900 text-sm truncate">tafCA</span>
      {/if}
      <button onclick={() => (sidebarCollapsed = !sidebarCollapsed)} class="hidden md:block text-gray-400 hover:text-gray-600">
        {sidebarCollapsed ? '\u25B6' : '\u25C0'}
      </button>
    </div>

    <nav class="flex-1 py-2 overflow-y-auto">
      {#each visibleNav as item}
        <button
          onclick={() => handleNav(item.path)}
          class="w-full text-left px-4 py-2 text-sm transition-colors
                 {isActive(item.path) ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}"
        >
          {sidebarCollapsed ? item.label[0] : item.label}
        </button>
      {/each}
    </nav>

    <div class="border-t border-gray-100 p-3">
      <button onclick={handleLogout} class="w-full text-left text-sm text-gray-500 hover:text-red-600 px-1 py-1">
        {sidebarCollapsed ? '\u2190' : 'Sign out'}
      </button>
    </div>
  </aside>

  <!-- Main content area -->
  <div class="flex-1 flex flex-col min-w-0">
    <!-- Topbar -->
    <header class="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-4 shrink-0">
      <button onclick={() => (mobileOpen = true)} class="md:hidden text-gray-500">
        &#9776;
      </button>
      <div class="flex-1"></div>
      <span class="text-sm text-gray-600 truncate">{user?.fullName}</span>
      <span class="text-xs text-gray-400 bg-gray-100 rounded px-2 py-0.5">{user?.role}</span>
    </header>

    <!-- Page content -->
    <main class="flex-1 overflow-y-auto p-6">
      {@render children()}
    </main>
  </div>
</div>
