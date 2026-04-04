<script lang="ts">
	import { goto } from '$app/navigation';
	import { ArrowLeft } from 'lucide-svelte';
	import ClientForm from '$lib/components/client/ClientForm.svelte';
	import { api } from '$lib/utils/api';
	import { addToast } from '$lib/stores/toast.svelte';

	let { data } = $props();

	async function handleSubmit(formData: Record<string, any>) {
		await api(`/clients/${data.client.id}`, {
			method: 'PATCH',
			body: JSON.stringify(formData),
		});
		addToast('Client updated successfully', 'success');
		goto(`/clients/${data.client.id}`);
	}

	function handleCancel() {
		goto(`/clients/${data.client.id}`);
	}
</script>

<svelte:head>
	<title>Edit {data.client.displayName} -- CA Practice OS</title>
</svelte:head>

<div>
	<a href="/clients/{data.client.id}" class="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
		<ArrowLeft size={16} />
		Back to {data.client.displayName}
	</a>

	<h1 class="mb-6 text-xl font-semibold text-gray-900">Edit Client</h1>

	<ClientForm
		client={data.client}
		onSubmit={handleSubmit}
		onCancel={handleCancel}
		users={data.users}
	/>
</div>
