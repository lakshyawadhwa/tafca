<script lang="ts">
	import { goto } from '$app/navigation';
	import { ArrowLeft } from 'lucide-svelte';
	import TaskForm from '$lib/components/task/TaskForm.svelte';
	import { api } from '$lib/utils/api';
	import { addToast } from '$lib/stores/toast.svelte';

	let { data } = $props();

	async function handleSubmit(formData: Record<string, any>) {
		const result = await api<any>('/tasks', {
			method: 'POST',
			body: JSON.stringify(formData),
		});
		addToast('Task created successfully', 'success');
		goto(`/tasks/${result.id}`);
	}

	function handleCancel() {
		goto('/tasks');
	}
</script>

<svelte:head>
	<title>Add Task -- CA Practice OS</title>
</svelte:head>

<div>
	<a href="/tasks" class="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
		<ArrowLeft size={16} />
		Back to Tasks
	</a>

	<h1 class="mb-6 text-xl font-semibold text-gray-900">Add Task</h1>

	<TaskForm
		onSubmit={handleSubmit}
		onCancel={handleCancel}
		users={data.users}
		clients={data.clients}
		engagements={data.engagements}
		prefill={data.prefill}
	/>
</div>
