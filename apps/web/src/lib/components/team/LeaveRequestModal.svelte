<script lang="ts">
  import Modal from '$lib/components/ui/Modal.svelte';
  import FormField from '$lib/components/ui/FormField.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Select from '$lib/components/ui/Select.svelte';
  import DatePicker from '$lib/components/ui/DatePicker.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { api } from '$lib/utils/api';
  import { addToast } from '$lib/stores/toast.svelte';

  let {
    open,
    onClose,
    onCreated,
  }: {
    open: boolean;
    onClose: () => void;
    onCreated: () => void;
  } = $props();

  let leaveType = $state('');
  let startDate = $state<string | null>(null);
  let endDate = $state<string | null>(null);
  let isHalfDay = $state(false);
  let reason = $state('');
  let submitting = $state(false);
  let errors = $state<Record<string, string>>({});

  const leaveTypeOptions = [
    { value: 'CASUAL', label: 'Casual Leave' },
    { value: 'SICK', label: 'Sick Leave' },
    { value: 'EXAM', label: 'Exam Leave' },
    { value: 'TRAINING', label: 'Training Leave' },
    { value: 'PUBLIC_HOLIDAY', label: 'Public Holiday' },
    { value: 'OTHER', label: 'Other' },
  ];

  // Half day only valid for single-day leave
  let isSingleDay = $derived(startDate && endDate && startDate === endDate);
  let halfDayDisabled = $derived(!isSingleDay);

  // Auto-reset half day when dates differ
  $effect(() => {
    if (!isSingleDay && isHalfDay) {
      isHalfDay = false;
    }
  });

  let todayStr = $derived.by(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!leaveType) newErrors.leaveType = 'Leave type is required';
    if (!startDate) newErrors.startDate = 'Start date is required';
    if (!endDate) newErrors.endDate = 'End date is required';
    if (startDate && endDate && endDate < startDate) {
      newErrors.endDate = 'End date must be on or after start date';
    }

    errors = newErrors;
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(): Promise<void> {
    if (!validate()) return;

    submitting = true;
    try {
      await api('/team/leave', {
        method: 'POST',
        body: JSON.stringify({
          leaveType,
          startDate,
          endDate,
          isHalfDay: isSingleDay ? isHalfDay : false,
          reason: reason.trim() || undefined,
        }),
      });
      addToast('Leave request submitted successfully', 'success');
      resetForm();
      onCreated();
    } catch (err: any) {
      addToast(err.message ?? 'Failed to submit leave request', 'error');
    } finally {
      submitting = false;
    }
  }

  function resetForm(): void {
    leaveType = '';
    startDate = null;
    endDate = null;
    isHalfDay = false;
    reason = '';
    errors = {};
  }

  function handleClose(): void {
    resetForm();
    onClose();
  }
</script>

<Modal {open} title="Request Leave" size="md" onClose={handleClose}>
  <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="flex flex-col gap-4">
    <FormField label="Leave Type" required error={errors.leaveType}>
      <Select
        options={leaveTypeOptions}
        value={leaveType}
        onSelect={(v) => { leaveType = v; }}
        placeholder="Select leave type"
      />
    </FormField>

    <div class="grid grid-cols-2 gap-4">
      <FormField label="Start Date" required error={errors.startDate}>
        <DatePicker
          value={startDate}
          onChange={(d) => {
            startDate = d;
            if (!endDate || endDate < d) endDate = d;
          }}
          min={todayStr}
          placeholder="Start date"
        />
      </FormField>
      <FormField label="End Date" required error={errors.endDate}>
        <DatePicker
          value={endDate}
          onChange={(d) => { endDate = d; }}
          min={startDate ?? todayStr}
          placeholder="End date"
        />
      </FormField>
    </div>

    <div class="flex items-center gap-2">
      <input
        type="checkbox"
        id="halfDay"
        bind:checked={isHalfDay}
        disabled={halfDayDisabled}
        class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 disabled:opacity-50"
      />
      <label
        for="halfDay"
        class="text-sm text-gray-700 {halfDayDisabled ? 'opacity-50' : ''}"
        title={halfDayDisabled ? 'Half day is only available for single-day leave' : ''}
      >
        Half Day
      </label>
      {#if halfDayDisabled}
        <span class="text-xs text-gray-400">(single day only)</span>
      {/if}
    </div>

    <FormField label="Reason" helpText="Optional">
      <textarea
        bind:value={reason}
        rows={3}
        placeholder="Reason for leave..."
        class="w-full rounded-md border border-gray-200 px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
      ></textarea>
    </FormField>
  </form>

  {#snippet footer()}
    <Button variant="secondary" onclick={handleClose}>Cancel</Button>
    <Button variant="primary" loading={submitting} onclick={handleSubmit}>Submit Request</Button>
  {/snippet}
</Modal>
