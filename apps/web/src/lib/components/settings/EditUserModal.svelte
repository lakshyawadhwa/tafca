<script lang="ts">
  import Modal from '$lib/components/ui/Modal.svelte';
  import FormField from '$lib/components/ui/FormField.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Select from '$lib/components/ui/Select.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { api } from '$lib/utils/api';
  import { addToast } from '$lib/stores/toast.svelte';

  interface UserData {
    id: string;
    fullName: string;
    phone: string | null;
    role: string;
    email: string;
  }

  let {
    open,
    user,
    onClose,
    onSaved,
  }: {
    open: boolean;
    user: UserData | null;
    onClose: () => void;
    onSaved: () => void;
  } = $props();

  let fullName = $state('');
  let phone = $state('');
  let role = $state('');
  let submitting = $state(false);
  let errors = $state<Record<string, string>>({});

  // Sync form when user prop changes
  $effect(() => {
    if (user) {
      fullName = user.fullName ?? '';
      phone = user.phone ?? '';
      role = user.role ?? '';
    }
  });

  const roleOptions = [
    { value: 'PARTNER', label: 'Partner' },
    { value: 'MANAGER', label: 'Manager' },
    { value: 'JUNIOR_CA', label: 'Junior CA' },
    { value: 'ARTICLE', label: 'Article' },
    { value: 'ADMIN', label: 'Admin' },
  ];

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!fullName.trim()) newErrors.fullName = 'Full name is required';
    if (!role) newErrors.role = 'Role is required';
    errors = newErrors;
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(): Promise<void> {
    if (!validate() || !user) return;
    submitting = true;
    try {
      await api(`/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: phone.trim() || undefined,
          role,
        }),
      });
      addToast('User updated successfully', 'success');
      onSaved();
    } catch (err: any) {
      addToast(err.message ?? 'Failed to update user', 'error');
    } finally {
      submitting = false;
    }
  }

  function handleClose(): void {
    errors = {};
    onClose();
  }
</script>

<Modal {open} title="Edit User" size="md" onClose={handleClose}>
  {#if user}
    <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="flex flex-col gap-4">
      <FormField label="Email">
        <Input value={user.email} disabled placeholder="Email" />
      </FormField>

      <FormField label="Full Name" required error={errors.fullName}>
        <Input bind:value={fullName} placeholder="Full name" error={errors.fullName} />
      </FormField>

      <FormField label="Phone" helpText="Optional">
        <Input bind:value={phone} placeholder="Phone number" />
      </FormField>

      <FormField label="Role" required error={errors.role}>
        <Select
          options={roleOptions}
          value={role}
          onSelect={(v) => { role = v; }}
          placeholder="Select role"
        />
      </FormField>
    </form>
  {/if}

  {#snippet footer()}
    <Button variant="secondary" onclick={handleClose}>Cancel</Button>
    <Button variant="primary" loading={submitting} onclick={handleSubmit}>Save Changes</Button>
  {/snippet}
</Modal>
