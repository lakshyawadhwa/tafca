<script lang="ts">
  import { goto } from '$app/navigation';
  import { api } from '$lib/utils/api';
  import { clearAuth } from '$lib/stores/auth.svelte';
  import { addToast } from '$lib/stores/toast.svelte';
  import { clickOutside } from '$lib/actions/clickOutside';
  import {
    ChevronDown,
    User,
    Settings,
    LogOut,
  } from 'lucide-svelte';

  interface Props {
    user: {
      id: string;
      email: string;
      fullName: string;
      role: string;
      firmId: string;
      firmName: string;
      avatarUrl: string | null;
    };
  }

  let { user }: Props = $props();

  let open = $state(false);
  let signingOut = $state(false);

  let initials = $derived(() => {
    const parts = user.fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return (parts[0]?.[0] ?? '?').toUpperCase();
  });

  function toggleMenu(): void {
    open = !open;
  }

  function closeMenu(): void {
    open = false;
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && open) {
      closeMenu();
    }
  }

  async function handleSignOut(): Promise<void> {
    if (signingOut) return;
    signingOut = true;
    closeMenu();

    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      // Even if logout API fails, we clear local state
    }

    clearAuth();
    addToast('You have been signed out.', 'info');
    await goto('/login');
    signingOut = false;
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="relative" use:clickOutside={closeMenu}>
  <button
    onclick={toggleMenu}
    class="flex items-center gap-2 rounded-md p-1.5 transition-colors hover:bg-gray-100"
    aria-expanded={open}
    aria-haspopup="true"
    type="button"
  >
    <!-- Avatar -->
    {#if user.avatarUrl}
      <img
        src={user.avatarUrl}
        alt={user.fullName}
        class="h-8 w-8 rounded-full object-cover"
      />
    {:else}
      <div class="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
        {initials()}
      </div>
    {/if}
    <ChevronDown class="h-4 w-4 text-gray-500" />
  </button>

  <!-- Dropdown -->
  {#if open}
    <div
      class="absolute right-0 top-full mt-1 min-w-[200px] rounded-md bg-white py-2 shadow-lg ring-1 ring-black/5"
      role="menu"
    >
      <!-- User info -->
      <div class="border-b border-gray-100 px-4 py-2">
        <p class="text-sm font-medium text-gray-900">{user.fullName}</p>
        <p class="text-xs text-gray-500">{user.email}</p>
      </div>

      <a
        href="/settings"
        onclick={closeMenu}
        class="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100"
        role="menuitem"
      >
        <User class="h-4 w-4" />
        Profile
      </a>

      <a
        href="/settings"
        onclick={closeMenu}
        class="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100"
        role="menuitem"
      >
        <Settings class="h-4 w-4" />
        Settings
      </a>

      <div class="my-1 border-t border-gray-100"></div>

      <button
        onclick={handleSignOut}
        disabled={signingOut}
        class="flex w-full items-center gap-3 px-4 py-2 text-sm text-red-600 transition-colors hover:bg-gray-100 disabled:opacity-50"
        role="menuitem"
        type="button"
      >
        <LogOut class="h-4 w-4" />
        Sign out
      </button>
    </div>
  {/if}
</div>
