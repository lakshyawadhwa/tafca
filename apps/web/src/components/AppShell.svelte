<script lang="ts">
  import { type Snippet } from 'svelte';
  import { getUser, clearAuth } from '../lib/auth.svelte';
  import { navigate, getPath } from '../lib/router.svelte';
  import { api } from '../lib/api';
  import { cycleTheme, getThemePreference } from '../lib/theme.svelte';
  import NavIcon from './NavIcon.svelte';
  import type { UserRole } from '@ca-practice-os/shared';

  let { children }: { children: Snippet } = $props();

  const user = $derived(getUser());
  const themePreference = $derived(getThemePreference());
  const themeLabel = $derived(
    themePreference === 'system'
      ? 'Theme: follows your system'
      : `Theme: ${themePreference}`,
  );
  const currentPath = $derived(getPath());
  let sidebarCollapsed = $state(false);
  let mobileOpen = $state(false);

  interface NavItem {
    label: string;
    path: string;
    icon: string;
    roles?: UserRole[];
  }

  const navItems: NavItem[] = [
    { label: 'Dashboard', path: '/', icon: 'dashboard' },
    { label: 'Tasks', path: '/tasks', icon: 'tasks' },
    { label: 'Clients', path: '/clients', icon: 'clients' },
    { label: 'Engagements', path: '/engagements', icon: 'engagements' },
    { label: 'Compliance', path: '/compliance', icon: 'compliance' },
    { label: 'Team', path: '/team', icon: 'team' },
    { label: 'Settings', path: '/settings', icon: 'settings', roles: ['PARTNER', 'ADMIN'] as UserRole[] },
    { label: 'Audit Log', path: '/audit-log', icon: 'audit', roles: ['PARTNER', 'ADMIN'] as UserRole[] },
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
      <button
        onclick={() => (sidebarCollapsed = !sidebarCollapsed)}
        class="rail-toggle hidden md:inline-flex"
        data-collapsed={sidebarCollapsed}
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M14.5 6.5L9 12l5.5 5.5" />
        </svg>
      </button>
    </div>

    <nav class="flex-1 py-2 overflow-y-auto">
      {#each visibleNav as item}
        <button
          onclick={() => handleNav(item.path)}
          class="w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-3
                 {isActive(item.path) ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}"
          title={sidebarCollapsed ? item.label : undefined}
        >
          <NavIcon name={item.icon} />
          {#if !sidebarCollapsed}<span class="truncate">{item.label}</span>{/if}
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
      <button
        type="button"
        onclick={cycleTheme}
        class="theme-toggle"
        title={themeLabel}
        aria-label={themeLabel}
      >
        {#if themePreference === 'dark'}
          <!-- moon -->
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
          </svg>
        {:else if themePreference === 'light'}
          <!-- sun -->
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        {:else}
          <!-- half-filled: following the system -->
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none" />
          </svg>
        {/if}
      </button>
      <span class="text-sm text-gray-600 truncate">{user?.fullName}</span>
      <span class="text-xs text-gray-400 bg-gray-100 rounded px-2 py-0.5">{user?.role}</span>
    </header>

    <!-- Page content -->
    <main class="flex-1 overflow-y-auto p-6">
      {#key currentPath}
        <div class="page-enter">{@render children()}</div>
      {/key}
    </main>
  </div>
</div>
