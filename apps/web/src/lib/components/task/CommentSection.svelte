<script lang="ts">
	import { Button } from '$lib/components/ui';
	import CommentCompose from './CommentCompose.svelte';
	import { api } from '$lib/utils/api';
	import { addToast } from '$lib/stores/toast.svelte';
	import { invalidateAll } from '$app/navigation';

	type UserOption = { id: string; fullName: string; role: string };

	type Comment = {
		id: string;
		body: string;
		mentions: string[];
		authorId: string;
		authorName?: string;
		parentCommentId?: string | null;
		replies?: Comment[];
		createdAt: string;
		updatedAt: string;
	};

	let {
		comments = [],
		taskId,
		currentUserId,
		users = []
	}: {
		comments?: Comment[];
		taskId: string;
		currentUserId: string;
		users?: UserOption[];
	} = $props();

	let replyingTo = $state<string | null>(null);
	let editingId = $state<string | null>(null);
	let editBody = $state('');

	// Build user name map for mention highlights
	let userNameMap = $derived.by(() => {
		const map = new Map<string, string>();
		for (const u of users) {
			map.set(u.id, u.fullName);
		}
		return map;
	});

	// Separate top-level and replies
	let topLevelComments = $derived(
		comments.filter((c) => !c.parentCommentId)
	);

	function getReplies(parentId: string): Comment[] {
		return comments.filter((c) => c.parentCommentId === parentId);
	}

	function formatRelativeTime(dateStr: string): string {
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / (1000 * 60));
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	function highlightMentions(body: string, mentionIds: string[]): string {
		let result = body;
		for (const id of mentionIds) {
			const name = userNameMap.get(id);
			if (name) {
				// Replace @Name with highlighted version
				result = result.replace(
					new RegExp(`@${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g'),
					`<span class="text-blue-600 font-medium">@${name}</span>`
				);
			}
		}
		return result;
	}

	async function postComment(body: string, mentions: string[]) {
		try {
			await api(`/tasks/${taskId}/comments`, {
				method: 'POST',
				body: JSON.stringify({ body, mentions }),
			});
			addToast('Comment posted', 'success');
			await invalidateAll();
		} catch (err: any) {
			addToast(err.message ?? 'Failed to post comment', 'error');
		}
	}

	async function postReply(parentCommentId: string, body: string, mentions: string[]) {
		try {
			await api(`/tasks/${taskId}/comments`, {
				method: 'POST',
				body: JSON.stringify({ body, mentions, parentCommentId }),
			});
			addToast('Reply posted', 'success');
			replyingTo = null;
			await invalidateAll();
		} catch (err: any) {
			addToast(err.message ?? 'Failed to post reply', 'error');
		}
	}

	function startEdit(comment: Comment) {
		editingId = comment.id;
		editBody = comment.body;
	}

	async function saveEdit(commentId: string) {
		const trimmed = editBody.trim();
		if (!trimmed) return;
		try {
			await api(`/tasks/${taskId}/comments/${commentId}`, {
				method: 'PATCH',
				body: JSON.stringify({ body: trimmed }),
			});
			editingId = null;
			await invalidateAll();
		} catch (err: any) {
			addToast(err.message ?? 'Failed to update comment', 'error');
		}
	}

	async function deleteComment(commentId: string) {
		try {
			await api(`/tasks/${taskId}/comments/${commentId}`, {
				method: 'DELETE',
			});
			addToast('Comment deleted', 'success');
			await invalidateAll();
		} catch (err: any) {
			addToast(err.message ?? 'Failed to delete comment', 'error');
		}
	}
</script>

<div>
	<!-- Section heading -->
	<div class="flex items-center gap-2 mb-3">
		<h3 class="text-sm font-semibold text-gray-900">Comments</h3>
		{#if comments.length > 0}
			<span class="text-xs text-gray-500">({comments.length})</span>
		{/if}
	</div>

	<!-- New comment compose -->
	<CommentCompose
		onSubmit={postComment}
		{users}
		placeholder="Write a comment..."
	/>

	<!-- Comment list -->
	<div class="space-y-4 mt-4">
		{#each topLevelComments as comment (comment.id)}
			<div class="py-3 border-b border-gray-100">
				<!-- Comment header -->
				<div class="flex items-center gap-2 mb-1">
					<span class="text-sm font-semibold text-gray-900">{comment.authorName ?? 'Unknown'}</span>
					<span class="text-xs text-gray-500">{formatRelativeTime(comment.createdAt)}</span>
					<div class="flex items-center gap-2 ml-auto">
						<button
							type="button"
							onclick={() => { replyingTo = replyingTo === comment.id ? null : comment.id; }}
							class="text-xs text-gray-400 hover:text-gray-600"
						>
							Reply
						</button>
						{#if comment.authorId === currentUserId}
							<button
								type="button"
								onclick={() => startEdit(comment)}
								class="text-xs text-gray-400 hover:text-gray-600"
							>
								Edit
							</button>
							<button
								type="button"
								onclick={() => deleteComment(comment.id)}
								class="text-xs text-gray-400 hover:text-red-500"
							>
								Delete
							</button>
						{/if}
					</div>
				</div>

				<!-- Comment body -->
				{#if editingId === comment.id}
					<div class="mt-1 space-y-2">
						<textarea
							bind:value={editBody}
							rows={3}
							class="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
						></textarea>
						<div class="flex gap-2">
							<Button size="sm" variant="primary" onclick={() => saveEdit(comment.id)}>Save</Button>
							<Button size="sm" variant="secondary" onclick={() => { editingId = null; }}>Cancel</Button>
						</div>
					</div>
				{:else}
					<p class="text-sm text-gray-700">
						{@html highlightMentions(comment.body, comment.mentions ?? [])}
					</p>
				{/if}

				<!-- Reply compose -->
				{#if replyingTo === comment.id}
					<div class="mt-3 pl-8 border-l-2 border-gray-200">
						<CommentCompose
							onSubmit={(body, mentions) => postReply(comment.id, body, mentions)}
							{users}
							placeholder="Write a reply..."
							compact={true}
							submitLabel="Post Reply"
						/>
					</div>
				{/if}

				<!-- Replies -->
				{#if getReplies(comment.id).length > 0}
					<div class="mt-3 space-y-3 pl-8 border-l-2 border-gray-200">
						{#each getReplies(comment.id) as reply (reply.id)}
							<div class="py-2">
								<div class="flex items-center gap-2 mb-1">
									<span class="text-sm font-semibold text-gray-900">{reply.authorName ?? 'Unknown'}</span>
									<span class="text-xs text-gray-500">{formatRelativeTime(reply.createdAt)}</span>
									{#if reply.authorId === currentUserId}
										<div class="flex items-center gap-2 ml-auto">
											<button
												type="button"
												onclick={() => startEdit(reply)}
												class="text-xs text-gray-400 hover:text-gray-600"
											>
												Edit
											</button>
											<button
												type="button"
												onclick={() => deleteComment(reply.id)}
												class="text-xs text-gray-400 hover:text-red-500"
											>
												Delete
											</button>
										</div>
									{/if}
								</div>
								{#if editingId === reply.id}
									<div class="mt-1 space-y-2">
										<textarea
											bind:value={editBody}
											rows={2}
											class="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
										></textarea>
										<div class="flex gap-2">
											<Button size="sm" variant="primary" onclick={() => saveEdit(reply.id)}>Save</Button>
											<Button size="sm" variant="secondary" onclick={() => { editingId = null; }}>Cancel</Button>
										</div>
									</div>
								{:else}
									<p class="text-sm text-gray-700">
										{@html highlightMentions(reply.body, reply.mentions ?? [])}
									</p>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	</div>

	{#if comments.length === 0}
		<p class="mt-4 text-sm text-gray-400">No comments yet</p>
	{/if}
</div>
