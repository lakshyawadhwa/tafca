<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { toStore } from 'svelte/store';
  import { api } from '../lib/api';
  import CommentCompose from './CommentCompose.svelte';
  import CommentNode from './CommentNode.svelte';

  let { taskId }: { taskId: string } = $props();

  const comments = createQuery(toStore(() => ({
    queryKey: ['task', taskId, 'comments'],
    queryFn: () => api(`/tasks/${taskId}/comments?limit=50`),
  })));

  const list = $derived($comments.data?.data ?? []);
</script>

<div class="bg-white rounded-lg border border-gray-200 p-4">
  <h3 class="text-sm font-medium text-gray-500 mb-4">Comments</h3>

  <!-- Compose new comment -->
  <div class="mb-5">
    <CommentCompose {taskId} />
  </div>

  <!-- Comment list -->
  {#if $comments.isLoading}
    <p class="text-sm text-gray-400">Loading comments...</p>
  {:else if list.length === 0}
    <p class="text-sm text-gray-400">No comments yet.</p>
  {:else}
    <div class="space-y-4">
      {#each list as comment (comment.id)}
        <CommentNode {comment} {taskId} />
      {/each}
    </div>
  {/if}
</div>
