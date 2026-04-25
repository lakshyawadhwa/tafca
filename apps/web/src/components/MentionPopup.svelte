<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { toStore } from 'svelte/store';
  import { api } from '../lib/api';

  interface MentionUser {
    id: string;
    fullName: string;
  }

  let {
    query = $bindable(''),
    onselect,
    onclose,
  }: {
    query?: string;
    onselect: (user: MentionUser) => void;
    onclose: () => void;
  } = $props();

  let activeIndex = $state(0);

  const results = createQuery(toStore(() => ({
    queryKey: ['users', 'mention-search', query],
    queryFn: () =>
      api<{ data: MentionUser[] }>(`/users?search=${encodeURIComponent(query)}&isActive=true`),
    enabled: query.length >= 1,
    staleTime: 10_000,
  })));

  const users = $derived($results.data?.data ?? []);

  // Reset active index when results change
  $effect(() => {
    void users;
    activeIndex = 0;
  });

  function selectUser(user: MentionUser) {
    onselect(user);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, users.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (users[activeIndex]) selectUser(users[activeIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onclose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="absolute z-50 mt-1 w-64 bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden"
  role="listbox"
  aria-label="Mention users"
>
  {#if $results.isLoading}
    <p class="px-3 py-2 text-sm text-gray-400">Searching...</p>
  {:else if users.length === 0}
    <p class="px-3 py-2 text-sm text-gray-400">
      {query.length < 1 ? 'Type to search' : 'No users found'}
    </p>
  {:else}
    {#each users as user, i (user.id)}
      <button
        type="button"
        role="option"
        aria-selected={i === activeIndex}
        class="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center gap-2
               {i === activeIndex ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}"
        onclick={() => selectUser(user)}
      >
        <span class="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600 shrink-0">
          {user.fullName.charAt(0).toUpperCase()}
        </span>
        {user.fullName}
      </button>
    {/each}
  {/if}
</div>
