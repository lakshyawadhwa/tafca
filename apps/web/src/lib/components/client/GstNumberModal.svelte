<script lang="ts">
	import { Modal, Button, FormField, Input, Select } from '$lib/components/ui';
	import DatePicker from '$lib/components/ui/DatePicker.svelte';
	import { validateGSTIN } from '$lib/utils/validation';
	import { api } from '$lib/utils/api';
	import { addToast } from '$lib/stores/toast.svelte';
	import { GstRegistrationType } from '@ca-practice-os/shared';

	type GstNumber = {
		id?: string;
		gstin?: string;
		stateCode?: string;
		tradeName?: string;
		registrationType?: string;
		registeredAt?: string | null;
		cancelledAt?: string | null;
		isPrimary?: boolean;
	};

	let {
		open,
		clientId,
		gstNumber = undefined,
		onClose,
		onSaved
	}: {
		open: boolean;
		clientId: string;
		gstNumber?: GstNumber;
		onClose: () => void;
		onSaved: () => void;
	} = $props();

	let isEdit = $derived(!!gstNumber?.id);

	// Form state
	let gstin = $state(gstNumber?.gstin ?? '');
	let stateCode = $state(gstNumber?.stateCode ?? '');
	let tradeName = $state(gstNumber?.tradeName ?? '');
	let registrationType = $state(gstNumber?.registrationType ?? GstRegistrationType.REGULAR);
	let registeredAt = $state<string | null>(gstNumber?.registeredAt ?? null);
	let cancelledAt = $state<string | null>(gstNumber?.cancelledAt ?? null);
	let isPrimary = $state(gstNumber?.isPrimary ?? false);

	let gstinError = $state<string | null>(null);
	let isSaving = $state(false);

	// Reset form when modal opens with different data
	$effect(() => {
		if (open) {
			gstin = gstNumber?.gstin ?? '';
			stateCode = gstNumber?.stateCode ?? '';
			tradeName = gstNumber?.tradeName ?? '';
			registrationType = gstNumber?.registrationType ?? GstRegistrationType.REGULAR;
			registeredAt = gstNumber?.registeredAt ?? null;
			cancelledAt = gstNumber?.cancelledAt ?? null;
			isPrimary = gstNumber?.isPrimary ?? false;
			gstinError = null;
		}
	});

	// Indian state codes
	const STATE_OPTIONS = [
		{ value: '01', label: '01 - Jammu & Kashmir' },
		{ value: '02', label: '02 - Himachal Pradesh' },
		{ value: '03', label: '03 - Punjab' },
		{ value: '04', label: '04 - Chandigarh' },
		{ value: '05', label: '05 - Uttarakhand' },
		{ value: '06', label: '06 - Haryana' },
		{ value: '07', label: '07 - Delhi' },
		{ value: '08', label: '08 - Rajasthan' },
		{ value: '09', label: '09 - Uttar Pradesh' },
		{ value: '10', label: '10 - Bihar' },
		{ value: '11', label: '11 - Sikkim' },
		{ value: '12', label: '12 - Arunachal Pradesh' },
		{ value: '13', label: '13 - Nagaland' },
		{ value: '14', label: '14 - Manipur' },
		{ value: '15', label: '15 - Mizoram' },
		{ value: '16', label: '16 - Tripura' },
		{ value: '17', label: '17 - Meghalaya' },
		{ value: '18', label: '18 - Assam' },
		{ value: '19', label: '19 - West Bengal' },
		{ value: '20', label: '20 - Jharkhand' },
		{ value: '21', label: '21 - Odisha' },
		{ value: '22', label: '22 - Chhattisgarh' },
		{ value: '23', label: '23 - Madhya Pradesh' },
		{ value: '24', label: '24 - Gujarat' },
		{ value: '25', label: '25 - Daman & Diu' },
		{ value: '26', label: '26 - Dadra & Nagar Haveli' },
		{ value: '27', label: '27 - Maharashtra' },
		{ value: '28', label: '28 - Andhra Pradesh (old)' },
		{ value: '29', label: '29 - Karnataka' },
		{ value: '30', label: '30 - Goa' },
		{ value: '31', label: '31 - Lakshadweep' },
		{ value: '32', label: '32 - Kerala' },
		{ value: '33', label: '33 - Tamil Nadu' },
		{ value: '34', label: '34 - Puducherry' },
		{ value: '35', label: '35 - Andaman & Nicobar' },
		{ value: '36', label: '36 - Telangana' },
		{ value: '37', label: '37 - Andhra Pradesh (new)' },
		{ value: '38', label: '38 - Ladakh' },
	];

	const REGISTRATION_TYPE_OPTIONS = Object.values(GstRegistrationType).map((v) => ({
		value: v,
		label: v.charAt(0) + v.slice(1).toLowerCase()
	}));

	async function handleSubmit() {
		gstinError = validateGSTIN(gstin);
		if (gstinError) return;
		if (!stateCode) return;
		if (!registrationType) return;

		isSaving = true;
		try {
			const body: Record<string, any> = {
				gstin: gstin.toUpperCase(),
				stateCode,
				registrationType,
				isPrimary,
			};
			if (tradeName) body.tradeName = tradeName.trim();
			if (registeredAt) body.registeredAt = registeredAt;
			if (cancelledAt) body.cancelledAt = cancelledAt;

			if (isEdit) {
				await api(`/clients/${clientId}/gst-numbers/${gstNumber!.id}`, {
					method: 'PATCH',
					body: JSON.stringify(body),
				});
				addToast('GST number updated successfully', 'success');
			} else {
				await api(`/clients/${clientId}/gst-numbers`, {
					method: 'POST',
					body: JSON.stringify(body),
				});
				addToast('GST number added successfully', 'success');
			}
			onSaved();
		} catch (err: any) {
			addToast(err.message ?? 'Failed to save GST number', 'error');
		} finally {
			isSaving = false;
		}
	}
</script>

<Modal {open} title={isEdit ? 'Edit GST Number' : 'Add GST Number'} size="md" onClose={onClose}>
	<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<div class="sm:col-span-2">
				<FormField label="GSTIN" required error={gstinError}>
					<Input
						bind:value={gstin}
						placeholder="27AAPFU0939F1ZV"
						onblur={() => { gstinError = validateGSTIN(gstin); }}
						error={gstinError}
					/>
				</FormField>
			</div>

			<FormField label="State Code" required>
				<Select
					options={STATE_OPTIONS}
					value={stateCode}
					onSelect={(val) => { stateCode = val; }}
					placeholder="Select state"
				/>
			</FormField>

			<FormField label="Trade Name">
				<Input bind:value={tradeName} placeholder="Trade / brand name" />
			</FormField>

			<FormField label="Registration Type" required>
				<Select
					options={REGISTRATION_TYPE_OPTIONS}
					value={registrationType}
					onSelect={(val) => { registrationType = val; }}
					placeholder="Select type"
				/>
			</FormField>

			<div></div>

			<FormField label="Registration Date">
				<DatePicker value={registeredAt} onChange={(d) => { registeredAt = d; }} placeholder="Select date" />
			</FormField>

			<FormField label="Cancellation Date">
				<DatePicker value={cancelledAt} onChange={(d) => { cancelledAt = d; }} placeholder="Select date" />
			</FormField>

			<div class="sm:col-span-2">
				<label class="flex items-center gap-2 text-sm text-gray-700">
					<input
						type="checkbox"
						bind:checked={isPrimary}
						class="h-4 w-4 rounded border-gray-300 accent-blue-600"
					/>
					This is the primary GST number
				</label>
				{#if isPrimary && !isEdit}
					<p class="mt-1 text-xs text-gray-500">Setting this as primary will unset the current primary GST number.</p>
				{/if}
			</div>
		</div>
	</form>

	{#snippet footer()}
		<Button variant="secondary" onclick={onClose}>Cancel</Button>
		<Button variant="primary" onclick={handleSubmit} loading={isSaving} disabled={isSaving}>
			{isEdit ? 'Save Changes' : 'Add GST Number'}
		</Button>
	{/snippet}
</Modal>
