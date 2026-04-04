<script lang="ts">
	import { X } from 'lucide-svelte';
	import { Button } from '$lib/components/ui';
	import UserPicker from '$lib/components/ui/UserPicker.svelte';
	import { clickOutside } from '$lib/actions/clickOutside';

	type UserOption = { id: string; fullName: string; role: string };

	let {
		onSubmit,
		placeholder = 'Write a comment...',
		compact = false,
		users = [],
		submitLabel = 'Post Comment'
	}: {
		onSubmit: (body: string, mentions: string[]) => void;
		placeholder?: string;
		compact?: boolean;
		users?: UserOption[];
		submitLabel?: string;
	} = $props();

	let body = $state('');
	let mentions = $state<Array<{ id: string; name: string }>>([]);
	let showMentionPicker = $state(false);

	const MAX_MENTIONS = 10;
	const MAX_LENGTH = 5000;

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === '@' && mentions.length < MAX_MENTIONS) {
			showMentionPicker = true;
		}
	}

	function addMention(userId: string, user: UserOption) {
		if (mentions.length >= MAX_MENTIONS) return;
		if (mentions.some((m) => m.id === userId)) return;

		mentions = [...mentions, { id: userId, name: user.fullName }];
		// Insert @Name into body text
		body = body + `@${user.fullName} `;
		showMentionPicker = false;
	}

	function removeMention(userId: string) {
		mentions = mentions.filter((m) => m.id !== userId);
	}

	function handleSubmit() {
		const trimmed = body.trim();
		if (!trimmed) return;

		onSubmit(trimmed, mentions.map((m) => m.id));
		body = '';
		mentions = [];
	}
</script>

<div class="space-y-2">
	<!-- Textarea -->
	<textarea
		bind:value={body}
		onkeydown={handleKeydown}
		{placeholder}
		maxlength={MAX_LENGTH}
		rows={compact ? 2 : 3}
		class="w-full rounded-md border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 resize-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
	></textarea>

	<!-- Mention picker trigger -->
	{#if showMentionPicker}
		<div class="relative" use:clickOutside={() => { showMentionPicker = false; }}>
			<div class="w-64">
				<UserPicker
					value={null}
					onSelect={(id, user) => addMention(id, user)}
					options={users.filter((u) => !mentions.some((m) => m.id === u.id))}
					placeholder="Search to mention..."
				/>
			</div>
		</div>
	{/if}

	<!-- Mention chips -->
	{#if mentions.length > 0}
		<div class="flex flex-wrap gap-1">
			{#each mentions as mention (mention.id)}
				<span class="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
					@{mention.name}
					<button
						type="button"
						onclick={() => removeMention(mention.id)}
						class="rounded-full text-gray-500 hover:text-gray-700"
						aria-label="Remove mention"
					>
						<X size={10} />
					</button>
				</span>
			{/each}
			{#if mentions.length >= MAX_MENTIONS}
				<span class="text-xs text-gray-400">Max mentions reached</span>
			{/if}
		</div>
	{/if}

	<!-- Actions row -->
	<div class="flex items-center justify-between">
		<button
			type="button"
			onclick={() => { if (mentions.length < MAX_MENTIONS) showMentionPicker = !showMentionPicker; }}
			class="text-xs text-gray-400 hover:text-gray-600"
			disabled={mentions.length >= MAX_MENTIONS}
		>
			@ Mention
		</button>
		<Button
			variant="primary"
			size="sm"
			onclick={handleSubmit}
			disabled={!body.trim()}
		>
			{submitLabel}
		</Button>
	</div>
</div>
