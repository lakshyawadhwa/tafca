<script lang="ts">
  import { createMutation, useQueryClient } from '@tanstack/svelte-query';
  import { api } from '../lib/api';
  import { addToast } from '../lib/toast.svelte';
  import { getUser } from '../lib/auth.svelte';
  import { can } from '../lib/permissions';
  import CommentCompose from './CommentCompose.svelte';
  import CommentNode from './CommentNode.svelte';

  interface CommentAuthor {
    id: string;
    fullName: string;
  }

  interface CommentMention {
    id: string;
    fullName: string;
  }

  interface Comment {
    id: string;
    body: string;
    authorId: string;
    author: CommentAuthor;
    parentCommentId: string | null;
    mentions: CommentMention[];
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
    replies?: Comment[];
  }

  let {
    comment,
    taskId,
    depth = 0,
  }: {
    comment: Comment;
    taskId: string;
    depth?: number;
  } = $props();

  const qc = useQueryClient();

  let showReplyCompose = $state(false);
  let isEditing = $state(false);
  // edit body buffer — initialized from comment.body when entering edit mode
  let editBody = $state('');
  let editMentions = $state<string[]>([]);

  const isDeleted = $derived(!!comment.deletedAt);
  const hasReplies = $derived((comment.replies ?? []).length > 0);

  const canEdit = $derived(
    !isDeleted &&
    can('comment', 'edit', { ownerId: comment.authorId })
  );
  const canDelete = $derived(
    !isDeleted &&
    can('comment', 'delete', { ownerId: comment.authorId })
  );

  // Regex to render mention chips
  const MENTION_RE = /\[([^\]]+)\]\(([^)]+)\)/g;

  function renderBody(raw: string): string {
    return raw.replace(MENTION_RE, '<span class="text-blue-600 font-medium">@$1</span>');
  }

  function timeAgo(d: string): string {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  const deleteMutation = createMutation({
    mutationFn: () =>
      api(`/tasks/${taskId}/comments/${comment.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', taskId, 'comments'] });
      addToast('Comment deleted', 'success');
    },
    onError: (err: any) => addToast(err.message, 'error'),
  });

  const editMutation = createMutation({
    mutationFn: (payload: { body: string; mentions: string[] }) =>
      api(`/tasks/${taskId}/comments/${comment.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ body: payload.body, mentions: payload.mentions }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', taskId, 'comments'] });
      addToast('Comment updated', 'success');
      isEditing = false;
    },
    onError: (err: any) => addToast(err.message, 'error'),
  });

  function startEdit() {
    editBody = comment.body;
    // Extract existing mention IDs from @[Name](id) tokens in the body
    editMentions = [];
    const re = /\[([^\]]+)\]\(([^)]+)\)/g;
    let m;
    while ((m = re.exec(comment.body)) !== null) {
      editMentions.push(m[2]);
    }
    isEditing = true;
    showReplyCompose = false;
  }

  function cancelEdit() {
    isEditing = false;
  }
</script>

<div class="flex gap-3 {depth > 0 ? 'pl-8 border-l border-gray-100' : ''}">
  <!-- Avatar -->
  <div class="shrink-0 w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600 mt-0.5">
    {#if !isDeleted}
      {comment.author.fullName.charAt(0).toUpperCase()}
    {:else}
      ?
    {/if}
  </div>

  <div class="flex-1 min-w-0">
    {#if isDeleted && !hasReplies}
      <!-- Soft-deleted with no replies: omit (filtered upstream, safety belt) -->
    {:else if isDeleted}
      <!-- Soft-deleted with replies: tombstone -->
      <em class="text-gray-400 text-sm">[comment deleted]</em>
    {:else if isEditing}
      <!-- Edit mode -->
      <CommentCompose
        {taskId}
        parentCommentId={comment.parentCommentId}
        replyMode={true}
        editCommentId={comment.id}
        initialEditBody={editBody}
        initialMentions={editMentions}
        oncancel={cancelEdit}
        onsubmitted={() => { isEditing = false; }}
      />
    {:else}
      <!-- Normal view mode -->
      <div class="flex items-baseline gap-2 mb-0.5">
        <span class="text-sm font-medium text-gray-800">{comment.author.fullName}</span>
        <span class="text-xs text-gray-400">{timeAgo(comment.createdAt)}</span>
        {#if comment.updatedAt > comment.createdAt}
          <span class="text-xs text-gray-300">(edited)</span>
        {/if}
      </div>

      <p class="text-sm text-gray-700 whitespace-pre-wrap break-words">
        {@html renderBody(comment.body)}
      </p>

      <!-- Actions -->
      <div class="flex items-center gap-3 mt-1">
        {#if depth === 0}
          <button
            type="button"
            class="text-xs text-gray-400 hover:text-blue-600"
            onclick={() => { showReplyCompose = !showReplyCompose; }}
          >
            Reply
          </button>
        {/if}
        {#if canEdit}
          <button
            type="button"
            class="text-xs text-gray-400 hover:text-blue-600"
            onclick={startEdit}
          >
            Edit
          </button>
        {/if}
        {#if canDelete}
          <button
            type="button"
            class="text-xs text-gray-400 hover:text-red-600"
            disabled={$deleteMutation.isPending}
            onclick={() => $deleteMutation.mutate()}
          >
            {$deleteMutation.isPending ? 'Deleting...' : 'Delete'}
          </button>
        {/if}
      </div>
    {/if}

    <!-- Replies (depth 0 only — flatten deeper) -->
    {#if depth === 0 && (comment.replies ?? []).length > 0}
      <div class="mt-3 space-y-3">
        {#each comment.replies ?? [] as reply (reply.id)}
          <CommentNode comment={reply} {taskId} depth={1} />
        {/each}
      </div>
    {/if}

    <!-- Reply compose -->
    {#if showReplyCompose && depth === 0}
      <div class="mt-3">
        <CommentCompose
          {taskId}
          parentCommentId={comment.id}
          replyMode={true}
          oncancel={() => { showReplyCompose = false; }}
          onsubmitted={() => { showReplyCompose = false; }}
        />
      </div>
    {/if}
  </div>
</div>
