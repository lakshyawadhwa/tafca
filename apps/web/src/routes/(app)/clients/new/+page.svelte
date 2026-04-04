<script lang="ts">
	import { goto } from '$app/navigation';
	import { ArrowLeft } from 'lucide-svelte';
	import ClientForm from '$lib/components/client/ClientForm.svelte';
	import { api } from '$lib/utils/api';
	import { addToast } from '$lib/stores/toast.svelte';

	let { data } = $props();

	async function handleSubmit(formData: Record<string, any>) {
		const result = await api<any>('/clients', {
			method: 'POST',
			body: JSON.stringify(formData),
		});
		addToast('Client created successfully', 'success');
		goto(`/clients/${result.id}`);
	}

	function handleCancel() {
		goto('/clients');
	}
</script>

<svelte:head>
	<title>Add Client -- CA Practice OS</title>
</svelte:head>

<div>
	<a href="/clients" class="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
		<ArrowLeft size={16} />
		Back to Clients
	</a>

	<h1 class="mb-6 text-xl font-semibold text-gray-900">Add Client</h1>

	<ClientForm
		onSubmit={handleSubmit}
		onCancel={handleCancel}
		users={data.users}
	/>
</div>
