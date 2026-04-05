<script lang="ts">
  import { goto } from '$app/navigation';
  import { Bell } from 'lucide-svelte';
  import { api } from '$lib/utils/api';
  import { getNotificationIcon, getNotificationRoute } from '$lib/utils/notifications';
  import { getUnreadCount, setUnreadCount } from '$lib/stores/notifications.svelte';
  import { clickOutside } from '$lib/actions/clickOutside';
  import LoadingSkeleton from '$lib/components/ui/LoadingSkeleton.svelte';

  interface Notification {
    id: string;
    type: string;
    title: string;
    body: string | null;
    entityType: string | null;
    entityId: string | null;
    readAt: string | null;
    createdAt: string;
  }

  let isOpen = $state(false);
  let notifications = $state<Notification[]>([]);
  let loading = $state(false);

  let unreadCount = $derived(getUnreadCount());

  let displayCount = $derived(unreadCount > 99 ? '99+' : String(unreadCount));

  async function fetchUnreadCount(): Promise<void> {
    try {
      const res = await api<{ count: number }>('/notifications/unread-count');
      setUnreadCount(res.count);
    } catch {
      // Non-critical, fail silently
    }
  }

  async function fetchNotifications(): Promise<void> {
    loading = true;
    try {
      const res = await api<{ data: Notification[] }>('/notifications?limit=20');
      notifications = res.data ?? [];
    } catch {
      notifications = [];
    } finally {
      loading = false;
    }
  }

  // Polling with cleanup
  $effect(() => {
    fetchUnreadCount();
    const intervalId = setInterval(fetchUnreadCount, 60_000);
    return () => clearInterval(intervalId);
  });

  async function toggleDropdown(): Promise<void> {
    isOpen = !isOpen;
    if (isOpen) {
      await fetchNotifications();
    }
  }

  function closeDropdown(): void {
    isOpen = false;
  }

  async function markAllRead(): Promise<void> {
    try {
      await api<{ updatedCount: number }>('/notifications/read-all', { method: 'PATCH' });
      setUnreadCount(0);
      notifications = notifications.map((n) => ({
        ...n,
        readAt: n.readAt ?? new Date().toISOString(),
      }));
    } catch {
      // Fail silently
    }
  }

  async function handleNotificationClick(notification: Notification): Promise<void> {
    // Optimistic update
    if (!notification.readAt) {
      notifications = notifications.map((n) =>
        n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n,
      );
      setUnreadCount(Math.max(0, getUnreadCount() - 1));

      // Fire and forget
      api(`/notifications/${notification.id}/read`, { method: 'PATCH' }).catch(() => {});
    }

    const route = getNotificationRoute(notification.entityType, notification.entityId);
    if (route) {
      isOpen = false;
      await goto(route);
    }
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
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });
  }

  let hasUnread = $derived(notifications.some((n) => !n.readAt));

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      isOpen = false;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="relative" use:clickOutside={closeDropdown}>
  <!-- Bell button -->
  <button
    onclick={toggleDropdown}
    class="relative rounded-md p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
    aria-label="Notifications"
    type="button"
  >
    <Bell class="h-4 w-4" />
    {#if unreadCount > 0}
      <span
        class="absolute right-1 top-1 flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-[18px] text-white"
      >
        {displayCount}
      </span>
    {/if}
  </button>

  <!-- Dropdown panel -->
  {#if isOpen}
    <div
      class="absolute right-0 top-full z-50 mt-2 w-[360px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
    >
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h3 class="text-sm font-semibold text-gray-900">Notifications</h3>
        {#if hasUnread}
          <button
            type="button"
            onclick={markAllRead}
            class="text-xs font-semibold text-blue-600 hover:text-blue-800"
          >
            Mark all read
          </button>
        {/if}
      </div>

      <!-- Notification list -->
      <div class="max-h-[320px] overflow-y-auto">
        {#if loading}
          <div class="p-4">
            <LoadingSkeleton variant="text" rows={4} />
          </div>
        {:else if notifications.length === 0}
          <div class="flex flex-col items-center py-8 text-center">
            <Bell class="mb-2 h-8 w-8 text-gray-300" />
            <p class="text-sm text-gray-400">No notifications yet</p>
          </div>
        {:else}
          {#each notifications as notification (notification.id)}
            {@const IconComponent = getNotificationIcon(notification.type)}
            <button
              type="button"
              onclick={() => handleNotificationClick(notification)}
              class="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-100
                {notification.readAt ? 'bg-white' : 'bg-gray-50'}"
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
                <p class="mt-1 text-xs text-gray-400">{formatTimeAgo(notification.createdAt)}</p>
              </div>
              {#if !notification.readAt}
                <div class="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500"></div>
              {/if}
            </button>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>
