<script lang="ts">
  import Breadcrumbs from './Breadcrumbs.svelte';
  import NotificationBell from './NotificationBell.svelte';
  import UserMenu from './UserMenu.svelte';
  import { toggleMobileOpen } from '$lib/stores/sidebar.svelte';
  import { Menu } from 'lucide-svelte';

  interface Props {
    user: NonNullable<App.Locals['user']>;
  }

  let { user }: Props = $props();

  function handleHamburger(): void {
    toggleMobileOpen();
  }
</script>

<header class="fixed right-0 top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
  <div class="flex items-center gap-4">
    <!-- Hamburger (mobile only) -->
    <button
      onclick={handleHamburger}
      class="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 md:hidden"
      aria-label="Toggle menu"
      type="button"
    >
      <Menu class="h-5 w-5" />
    </button>

    <Breadcrumbs />
  </div>

  <div class="flex items-center gap-4">
    <NotificationBell />
    <UserMenu {user} />
  </div>
</header>
