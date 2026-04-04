<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { ArrowLeft, Trash2 } from 'lucide-svelte';
	import {
		Button, InlineEdit, StatusBadge, StatusTransitionDropdown, ConfirmDialog
	} from '$lib/components/ui';
	import ChecklistSection from '$lib/components/task/ChecklistSection.svelte';
	import CommentSection from '$lib/components/task/CommentSection.svelte';
	import SubtaskList from '$lib/components/task/SubtaskList.svelte';
	import TaskMetadataSidebar from '$lib/components/task/TaskMetadataSidebar.svelte';
	import { api } from '$lib/utils/api';
	import { addToast } from '$lib/stores/toast.svelte';
	import { TASK_STATUS_TRANSITIONS } from '@ca-practice-os/shared';
	import { getUser } from '$lib/stores/auth.svelte';

	let { data } = $props();

	let confirmDeleteOpen = $state(false);
	let activityEntries = $state(data.activity);
	let activityPage = $state(data.activityMeta.page);
	let activityLoading = $state(false);

	// Get current user for comment ownership
	let currentUser = $derived(getUser());
	let currentUserId = $derived(currentUser?.id ?? '');

	// Description editing
	let isEditingDescription = $state(false);
	let descriptionDraft = $state(data.task.description ?? '');

	// Show subtask section if not a subtask and has subtasks or can add
	let showSubtasks = $derived(!data.task.parentTaskId);

	async function handleTitleSave(newTitle: string) {
		await api(`/tasks/${data.task.id}`, {
			method: 'PATCH',
			body: JSON.stringify({ title: newTitle }),
		});
		await invalidateAll();
	}

	async function handleStatusChange(newStatus: string) {
		try {
			await api(`/tasks/${data.task.id}/status`, {
				method: 'PATCH',
				body: JSON.stringify({ status: newStatus }),
			});
			addToast('Status updated', 'success');
			await invalidateAll();
		} catch (err: any) {
			const statusCode = (err as any).statusCode;
			if (statusCode === 409) {
				addToast(err.message ?? 'Cannot mark as done: required checklist items are incomplete', 'error');
			} else {
				addToast(err.message ?? 'Failed to update status', 'error');
			}
		}
	}

	async function handleMetadataUpdate(field: string, value: any) {
		try {
			if (field === 'status') {
				await handleStatusChange(value);
				return;
			}

			await api(`/tasks/${data.task.id}`, {
				method: 'PATCH',
				body: JSON.stringify({ [field]: value }),
			});
			addToast('Task updated', 'success');
			await invalidateAll();
		} catch (err: any) {
			addToast(err.message ?? 'Failed to update task', 'error');
		}
	}

	async function saveDescription() {
		const trimmed = descriptionDraft.trim();
		try {
			await api(`/tasks/${data.task.id}`, {
				method: 'PATCH',
				body: JSON.stringify({ description: trimmed || null }),
			});
			isEditingDescription = false;
			await invalidateAll();
		} catch (err: any) {
			addToast(err.message ?? 'Failed to update description', 'error');
		}
	}

	function handleDescriptionKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			isEditingDescription = false;
			descriptionDraft = data.task.description ?? '';
		}
		if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
			event.preventDefault();
			saveDescription();
		}
	}

	async function handleDelete() {
		try {
			await api(`/tasks/${data.task.id}`, { method: 'DELETE' });
			addToast('Task deleted', 'success');
			goto('/tasks');
		} catch (err: any) {
			addToast(err.message ?? 'Failed to delete task', 'error');
		}
	}

	async function loadMoreActivity() {
		if (activityLoading) return;
		activityLoading = true;
		const nextPage = activityPage + 1;
		try {
			const res = await api<any>(`/tasks/${data.task.id}/activity?page=${nextPage}&limit=20`);
			activityEntries = [...activityEntries, ...(res.data ?? [])];
			activityPage = nextPage;
		} catch (err: any) {
			addToast('Failed to load more activity', 'error');
		} finally {
			activityLoading = false;
		}
	}
</script>

<svelte:head>
	<title>{data.task.title} -- Tasks -- CA Practice OS</title>
</svelte:head>

<div>
	<!-- Back link -->
	<a href="/tasks" class="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
		<ArrowLeft size={16} />
		Back to Tasks
	</a>

	<!-- Page Header -->
	<div class="flex items-start justify-between mb-6">
		<div class="flex-1 min-w-0">
			<!-- Title -->
			<InlineEdit
				value={data.task.title}
				onSave={handleTitleSave}
				placeholder="Task title"
				inputClass="text-xl font-semibold"
			/>

			<!-- Status + Priority row -->
			<div class="flex items-center gap-3 mt-2">
				<StatusTransitionDropdown
					currentStatus={data.task.status}
					transitions={TASK_STATUS_TRANSITIONS}
					onTransition={handleStatusChange}
					entityType="task"
				/>
				<StatusBadge status={data.task.priority} type="priority" />
			</div>
		</div>

		<!-- Delete button -->
		<button
			type="button"
			onclick={() => { confirmDeleteOpen = true; }}
			class="rounded-md p-2 text-gray-400 hover:text-red-600 hover:bg-gray-100"
			aria-label="Delete task"
		>
			<Trash2 size={18} />
		</button>
	</div>

	<!-- Two-column layout -->
	<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
		<!-- Left column (main content) -->
		<div class="lg:col-span-2 space-y-8">
			<!-- Description section -->
			<div>
				<h3 class="text-sm font-semibold text-gray-900 mb-2">Description</h3>
				{#if isEditingDescription}
					<div>
						<textarea
							bind:value={descriptionDraft}
							onblur={saveDescription}
							onkeydown={handleDescriptionKeydown}
							rows={5}
							maxlength={10000}
							class="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
							placeholder="Describe the task..."
						></textarea>
						<p class="mt-1 text-xs text-gray-400">Press Cmd+Enter to save, Escape to cancel</p>
					</div>
				{:else}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="group cursor-pointer rounded-md px-1 py-1 hover:bg-gray-50 min-h-[40px]"
						onclick={() => {
							descriptionDraft = data.task.description ?? '';
							isEditingDescription = true;
						}}
					>
						{#if data.task.description}
							<p class="text-sm text-gray-700 whitespace-pre-wrap">{data.task.description}</p>
						{:else}
							<p class="text-sm text-gray-400 italic">No description</p>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Subtasks section -->
			{#if showSubtasks}
				<div class="border-t border-gray-200 pt-6">
					<SubtaskList
						subtasks={data.subtasks}
						parentTaskId={data.task.id}
					/>
				</div>
			{/if}

			<!-- Checklist section -->
			<div class="border-t border-gray-200 pt-6">
				<ChecklistSection
					items={data.checklist}
					taskId={data.task.id}
				/>
			</div>

			<!-- Comments section -->
			<div class="border-t border-gray-200 pt-6">
				<CommentSection
					comments={data.comments}
					taskId={data.task.id}
					currentUserId={currentUserId}
					users={data.users}
				/>
			</div>
		</div>

		<!-- Right column (sidebar) -->
		<div class="lg:col-span-1">
			<TaskMetadataSidebar
				task={data.task}
				users={data.users}
				onUpdate={handleMetadataUpdate}
				dependencies={data.dependencies}
				activity={activityEntries}
				activityMeta={data.activityMeta}
				onLoadMoreActivity={loadMoreActivity}
			/>
		</div>
	</div>
</div>

<ConfirmDialog
	open={confirmDeleteOpen}
	title="Delete Task"
	message="Are you sure you want to delete this task? This action cannot be undone."
	confirmLabel="Delete"
	variant="danger"
	onConfirm={handleDelete}
	onCancel={() => { confirmDeleteOpen = false; }}
/>
