<script lang="ts">
  import { createMutation, useQueryClient } from '@tanstack/svelte-query';
  import { api } from '../lib/api';
  import { addToast } from '../lib/toast.svelte';
  import { track } from '../lib/analytics';
  import MentionPopup from './MentionPopup.svelte';

  interface MentionUser {
    id: string;
    fullName: string;
  }

  let {
    taskId,
    parentCommentId = null,
    replyMode = false,
    editCommentId = null,
    initialEditBody = '',
    initialMentions = [],
    oncancel = undefined,
    onsubmitted = undefined,
  }: {
    taskId: string;
    parentCommentId?: string | null;
    replyMode?: boolean;
    editCommentId?: string | null;
    initialEditBody?: string;
    initialMentions?: string[];
    oncancel?: () => void;
    onsubmitted?: () => void;
  } = $props();

  const qc = useQueryClient();

  let body = $state('');
  let mentions = $state<string[]>([]);

  // Initialize from props when entering edit mode
  $effect(() => {
    if (editCommentId) {
      body = initialEditBody;
      mentions = [...initialMentions];
    }
  });
  let mentionQuery = $state('');
  let showMentionPopup = $state(false);
  let mentionStartIndex = $state(-1);
  let textareaEl = $state<HTMLTextAreaElement | null>(null);

  // Track @-trigger on input
  function handleInput(e: Event) {
    const el = e.target as HTMLTextAreaElement;
    body = el.value;

    const pos = el.selectionStart;
    const textBefore = body.slice(0, pos);
    const atIdx = textBefore.lastIndexOf('@');

    if (atIdx !== -1) {
      const fragment = textBefore.slice(atIdx + 1);
      // Only trigger if fragment has no whitespace (actively typing a name token)
      if (!fragment.includes(' ') && !fragment.includes('\n')) {
        mentionStartIndex = atIdx;
        mentionQuery = fragment;
        showMentionPopup = true;
        return;
      }
    }

    showMentionPopup = false;
    mentionStartIndex = -1;
    mentionQuery = '';
  }

  function handleMentionSelect(user: MentionUser) {
    if (mentionStartIndex === -1) return;

    const cursorPos = textareaEl?.selectionStart ?? body.length;
    const before = body.slice(0, mentionStartIndex);
    const after = body.slice(cursorPos);
    const token = `@[${user.fullName}](${user.id})`;

    body = before + token + ' ' + after;

    if (!mentions.includes(user.id)) {
      mentions = [...mentions, user.id];
    }

    showMentionPopup = false;
    mentionStartIndex = -1;
    mentionQuery = '';

    setTimeout(() => {
      if (textareaEl) {
        const newPos = before.length + token.length + 1;
        textareaEl.focus();
        textareaEl.setSelectionRange(newPos, newPos);
      }
    }, 0);
  }

  const submitMutation = createMutation({
    mutationFn: (payload: { body: string; mentions: string[] }) =>
      api(`/tasks/${taskId}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          body: payload.body,
          mentions: payload.mentions,
          ...(parentCommentId ? { parentCommentId } : {}),
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', taskId, 'comments'] });
      track('comment_submitted', {
        hasMentions: mentions.length > 0,
        isReply: !!parentCommentId,
      });
      body = '';
      mentions = [];
      addToast('Comment added', 'success');
      onsubmitted?.();
    },
    onError: (err: any) => addToast(err.message, 'error'),
  });

  const editMutation = createMutation({
    mutationFn: (payload: { body: string; mentions: string[] }) =>
      api(`/tasks/${taskId}/comments/${editCommentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ body: payload.body, mentions: payload.mentions }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', taskId, 'comments'] });
      addToast('Comment updated', 'success');
      onsubmitted?.();
    },
    onError: (err: any) => addToast(err.message, 'error'),
  });

  function handleSubmit(e: Event) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;

    if (editCommentId) {
      $editMutation.mutate({ body: trimmed, mentions });
    } else {
      $submitMutation.mutate({ body: trimmed, mentions });
    }
  }

  const isPending = $derived($submitMutation.isPending || $editMutation.isPending);

  const placeholder = $derived(
    replyMode
      ? 'Write a reply... Use @ to mention someone'
      : 'Add a comment... Use @ to mention someone'
  );

  const submitLabel = $derived(
    isPending ? 'Saving...' : editCommentId ? 'Save' : replyMode ? 'Reply' : 'Comment'
  );
</script>

<div class="relative">
  {#if showMentionPopup}
    <MentionPopup
      bind:query={mentionQuery}
      onselect={handleMentionSelect}
      onclose={() => { showMentionPopup = false; }}
    />
  {/if}

  <form onsubmit={handleSubmit} class="flex flex-col gap-2">
    <textarea
      bind:this={textareaEl}
      bind:value={body}
      oninput={handleInput}
      {placeholder}
      rows={replyMode ? 2 : 3}
      class="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
    ></textarea>

    <div class="flex items-center justify-end gap-2">
      {#if (replyMode || editCommentId) && oncancel}
        <button
          type="button"
          onclick={oncancel}
          class="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5"
        >
          Cancel
        </button>
      {/if}
      <button
        type="submit"
        disabled={!body.trim() || isPending}
        class="bg-blue-600 text-white text-sm px-4 py-1.5 rounded hover:bg-blue-700 disabled:opacity-40"
      >
        {submitLabel}
      </button>
    </div>
  </form>
</div>
