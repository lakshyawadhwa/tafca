<script lang="ts">
  import { page } from '$app/stores';
  import {
    isSidebarCollapsed,
    toggleSidebar,
    isMobileOpen,
    setMobileOpen,
  } from '$lib/stores/sidebar.svelte';
  import {
    LayoutDashboard,
    Users,
    Briefcase,
    CheckSquare,
    UserCircle,
    Settings,
    ChevronLeft,
    ChevronRight,
  } from 'lucide-svelte';

  interface NavItem {
    label: string;
    href: string;
    icon: typeof LayoutDashboard;
  }

  const navItems: NavItem[] = [
    { label: 'Dashboard', href: '/', icon: LayoutDashboard },
    { label: 'Clients', href: '/clients', icon: Users },
    { label: 'Engagements', href: '/engagements', icon: Briefcase },
    { label: 'Tasks', href: '/tasks', icon: CheckSquare },
    { label: 'Team', href: '/team', icon: UserCircle },
    { label: 'Settings', href: '/settings', icon: Settings },
  ];

  function isActive(href: string, pathname: string): boolean {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  }

  function handleNavClick(): void {
    // Close mobile sidebar on navigation
    if (isMobileOpen()) {
      setMobileOpen(false);
    }
  }

  function handleBackdropClick(): void {
    setMobileOpen(false);
  }

  function handleToggle(): void {
    toggleSidebar();
  }
</script>

<!-- Mobile backdrop -->
{#if isMobileOpen()}
  <button
    class="fixed inset-0 z-40 bg-black/50 md:hidden"
    onclick={handleBackdropClick}
    aria-label="Close sidebar"
    type="button"
    tabindex="-1"
  ></button>
{/if}

<!-- Sidebar -->
<aside
  class={[
    'fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-gray-200 bg-white transition-all duration-200 ease-in-out',
    isMobileOpen()
      ? 'w-60 translate-x-0'
      : '-translate-x-full',
    'md:translate-x-0',
    isSidebarCollapsed() ? 'md:w-16' : 'md:w-60',
  ].join(' ')}
>
  <!-- Header -->
  <div class="flex h-16 items-center border-b border-gray-200 px-4">
    {#if isSidebarCollapsed() && !isMobileOpen()}
      <span class="mx-auto text-lg font-semibold text-blue-600">CA</span>
    {:else}
      <span class="text-lg font-semibold text-gray-900">CA Practice OS</span>
    {/if}
  </div>

  <!-- Navigation -->
  <nav class="flex-1 overflow-y-auto py-4">
    <ul class="flex flex-col gap-1">
      {#each navItems as item (item.href)}
        {@const active = isActive(item.href, $page.url.pathname)}
        <li>
          <a
            href={item.href}
            onclick={handleNavClick}
            title={isSidebarCollapsed() && !isMobileOpen() ? item.label : undefined}
            class={[
              'flex h-10 items-center gap-3 transition-colors',
              isSidebarCollapsed() && !isMobileOpen()
                ? 'justify-center px-0'
                : 'px-6',
              active
                ? 'border-l-3 border-blue-600 bg-blue-50 text-blue-600'
                : 'border-l-3 border-transparent text-gray-700 hover:bg-gray-100',
            ].join(' ')}
          >
            <item.icon class="h-5 w-5 shrink-0" />
            {#if !isSidebarCollapsed() || isMobileOpen()}
              <span class="text-sm font-medium">{item.label}</span>
            {/if}
          </a>
        </li>
      {/each}
    </ul>
  </nav>

  <!-- Toggle button (desktop only) -->
  <div class="hidden border-t border-gray-200 p-3 md:block">
    <button
      onclick={handleToggle}
      class="flex w-full items-center justify-center rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
      aria-label={isSidebarCollapsed() ? 'Expand sidebar' : 'Collapse sidebar'}
      type="button"
    >
      {#if isSidebarCollapsed()}
        <ChevronRight class="h-5 w-5" />
      {:else}
        <ChevronLeft class="h-5 w-5" />
      {/if}
    </button>
  </div>
</aside>
