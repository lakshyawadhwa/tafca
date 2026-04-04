<script lang="ts">
	import { FormField, Input, Button, Select, TagInput } from '$lib/components/ui';
	import UserPicker from '$lib/components/ui/UserPicker.svelte';
	import { validatePAN, validateTAN, validateCIN, validateRequired } from '$lib/utils/validation';
	import { EntityType, ConstitutionType, ClientStatus } from '@ca-practice-os/shared';

	type UserOption = {
		id: string;
		fullName: string;
		role: string;
	};

	type ClientData = {
		id?: string;
		displayName?: string;
		entityType?: string;
		constitution?: string | null;
		status?: string;
		pan?: string | null;
		tan?: string | null;
		cin?: string | null;
		contactPerson?: string | null;
		phone?: string | null;
		email?: string | null;
		address?: string | null;
		notes?: string | null;
		tags?: string[];
		assignedPartnerId?: string | null;
		assignedManagerId?: string | null;
		assignedJuniorCaId?: string | null;
		assignedArticleId?: string | null;
	};

	let {
		client = undefined,
		onSubmit,
		onCancel,
		users = []
	}: {
		client?: ClientData;
		onSubmit: (data: Record<string, any>) => Promise<void>;
		onCancel: () => void;
		users?: UserOption[];
	} = $props();

	let isEdit = $derived(!!client?.id);

	// Form state
	let displayName = $state(client?.displayName ?? '');
	let entityType = $state(client?.entityType ?? '');
	let constitution = $state(client?.constitution ?? '');
	let status = $state(client?.status ?? ClientStatus.ACTIVE);
	let pan = $state(client?.pan ?? '');
	let tan = $state(client?.tan ?? '');
	let cin = $state(client?.cin ?? '');
	let contactPerson = $state(client?.contactPerson ?? '');
	let phone = $state(client?.phone ?? '');
	let email = $state(client?.email ?? '');
	let address = $state(client?.address ?? '');
	let notes = $state(client?.notes ?? '');
	let tags = $state<string[]>(client?.tags ?? []);
	let assignedPartnerId = $state(client?.assignedPartnerId ?? null);
	let assignedManagerId = $state(client?.assignedManagerId ?? null);
	let assignedJuniorCaId = $state(client?.assignedJuniorCaId ?? null);
	let assignedArticleId = $state(client?.assignedArticleId ?? null);

	// Validation errors
	let errors = $state<Record<string, string | null>>({});
	let isSaving = $state(false);

	// Dropdown options
	const entityTypeOptions = Object.values(EntityType).map((v) => ({
		value: v,
		label: v.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())
	}));

	const constitutionOptions = [
		{ value: '', label: 'Select constitution...' },
		...Object.values(ConstitutionType).map((v) => ({
			value: v,
			label: v.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())
		}))
	];

	const statusOptions = Object.values(ClientStatus).map((v) => ({
		value: v,
		label: v.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())
	}));

	function validateField(field: string, value: string) {
		switch (field) {
			case 'displayName':
				errors.displayName = validateRequired(value, 'Display name');
				break;
			case 'entityType':
				errors.entityType = validateRequired(value, 'Entity type');
				break;
			case 'pan':
				errors.pan = validatePAN(value);
				break;
			case 'tan':
				errors.tan = validateTAN(value);
				break;
			case 'cin':
				errors.cin = validateCIN(value);
				break;
		}
	}

	let isValid = $derived(() => {
		return (
			displayName.trim() &&
			entityType &&
			!errors.pan &&
			!errors.tan &&
			!errors.cin
		);
	});

	async function handleSubmit() {
		// Validate required fields
		validateField('displayName', displayName);
		validateField('entityType', entityType);
		validateField('pan', pan);
		validateField('tan', tan);
		validateField('cin', cin);

		if (errors.displayName || errors.entityType || errors.pan || errors.tan || errors.cin) {
			return;
		}

		isSaving = true;
		try {
			const data: Record<string, any> = {
				displayName: displayName.trim(),
				entityType,
				status,
			};
			if (constitution) data.constitution = constitution;
			if (pan) data.pan = pan.toUpperCase();
			if (tan) data.tan = tan.toUpperCase();
			if (cin) data.cin = cin.toUpperCase();
			if (contactPerson) data.contactPerson = contactPerson.trim();
			if (phone) data.phone = phone.trim();
			if (email) data.email = email.trim();
			if (address) data.address = address.trim();
			if (notes) data.notes = notes.trim();
			if (tags.length > 0) data.tags = tags;
			if (assignedPartnerId) data.assignedPartnerId = assignedPartnerId;
			if (assignedManagerId) data.assignedManagerId = assignedManagerId;
			if (assignedJuniorCaId) data.assignedJuniorCaId = assignedJuniorCaId;
			if (assignedArticleId) data.assignedArticleId = assignedArticleId;

			await onSubmit(data);
		} finally {
			isSaving = false;
		}
	}
</script>

<form
	onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}
	class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
>
	<!-- BASIC INFORMATION -->
	<div class="text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-200 pb-2 mb-4">
		Basic Information
	</div>
	<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
		<FormField label="Display Name" required error={errors.displayName}>
			<Input
				bind:value={displayName}
				placeholder="Enter client name"
				onblur={() => validateField('displayName', displayName)}
				error={errors.displayName}
			/>
		</FormField>

		<FormField label="Entity Type" required error={errors.entityType}>
			<Select
				options={entityTypeOptions}
				value={entityType}
				onSelect={(val) => { entityType = val; validateField('entityType', val); }}
				placeholder="Select entity type"
			/>
		</FormField>

		<FormField label="Constitution">
			<Select
				options={constitutionOptions}
				value={constitution}
				onSelect={(val) => { constitution = val; }}
				placeholder="Select constitution"
			/>
		</FormField>

		<FormField label="Status">
			<Select
				options={statusOptions}
				value={status}
				onSelect={(val) => { status = val; }}
				placeholder="Select status"
			/>
		</FormField>
	</div>

	<!-- STATUTORY IDS -->
	<div class="mt-8 text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-200 pb-2 mb-4">
		Statutory IDs
	</div>
	<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
		<FormField label="PAN" error={errors.pan} helpText="Format: ABCDE1234F">
			<Input
				bind:value={pan}
				placeholder="ABCDE1234F"
				onblur={() => validateField('pan', pan)}
				error={errors.pan}
			/>
		</FormField>

		<FormField label="TAN" error={errors.tan} helpText="Format: ABCD12345E">
			<Input
				bind:value={tan}
				placeholder="ABCD12345E"
				onblur={() => validateField('tan', tan)}
				error={errors.tan}
			/>
		</FormField>

		<FormField label="CIN" error={errors.cin} helpText="Format: U12345AB1234ABC123456">
			<Input
				bind:value={cin}
				placeholder="U12345AB1234ABC123456"
				onblur={() => validateField('cin', cin)}
				error={errors.cin}
			/>
		</FormField>
	</div>

	<!-- CONTACT INFORMATION -->
	<div class="mt-8 text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-200 pb-2 mb-4">
		Contact Information
	</div>
	<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
		<FormField label="Contact Person">
			<Input bind:value={contactPerson} placeholder="Full name" />
		</FormField>

		<FormField label="Phone">
			<Input bind:value={phone} placeholder="+91 98765 43210" />
		</FormField>

		<FormField label="Email">
			<Input bind:value={email} placeholder="client@example.com" type="email" />
		</FormField>

		<div class="md:col-span-2">
			<FormField label="Address">
				<textarea
					bind:value={address}
					placeholder="Full address"
					rows={3}
					class="w-full rounded-md border border-gray-200 px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 hover:border-gray-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
				></textarea>
			</FormField>
		</div>
	</div>

	<!-- TEAM ASSIGNMENT -->
	<div class="mt-8 text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-200 pb-2 mb-4">
		Team Assignment
	</div>
	<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
		<FormField label="Partner">
			<UserPicker
				value={assignedPartnerId}
				onSelect={(id) => { assignedPartnerId = id; }}
				options={users}
				roleFilter={['PARTNER']}
				placeholder="Select partner"
			/>
		</FormField>

		<FormField label="Manager">
			<UserPicker
				value={assignedManagerId}
				onSelect={(id) => { assignedManagerId = id; }}
				options={users}
				roleFilter={['MANAGER', 'PARTNER']}
				placeholder="Select manager"
			/>
		</FormField>

		<FormField label="Junior CA">
			<UserPicker
				value={assignedJuniorCaId}
				onSelect={(id) => { assignedJuniorCaId = id; }}
				options={users}
				roleFilter={['JUNIOR_CA']}
				placeholder="Select junior CA"
			/>
		</FormField>

		<FormField label="Article">
			<UserPicker
				value={assignedArticleId}
				onSelect={(id) => { assignedArticleId = id; }}
				options={users}
				roleFilter={['ARTICLE']}
				placeholder="Select article"
			/>
		</FormField>
	</div>

	<!-- NOTES & TAGS -->
	<div class="mt-8 text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-200 pb-2 mb-4">
		Notes & Tags
	</div>
	<div class="grid grid-cols-1 gap-4">
		<FormField label="Notes">
			<textarea
				bind:value={notes}
				placeholder="Internal notes about this client..."
				rows={4}
				class="w-full rounded-md border border-gray-200 px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 hover:border-gray-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
			></textarea>
		</FormField>

		<FormField label="Tags">
			<TagInput {tags} onChange={(t) => { tags = t; }} max={10} placeholder="Type a tag and press comma..." />
		</FormField>
	</div>

	<!-- FOOTER -->
	<div class="mt-6 flex justify-end gap-3 border-t border-gray-200 pt-6">
		<Button variant="secondary" onclick={onCancel}>Cancel</Button>
		<Button variant="primary" type="submit" loading={isSaving} disabled={isSaving}>
			{isEdit ? 'Save Client' : 'Create Client'}
		</Button>
	</div>
</form>
