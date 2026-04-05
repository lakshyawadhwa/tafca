<script lang="ts">
  import Modal from '$lib/components/ui/Modal.svelte';
  import FormField from '$lib/components/ui/FormField.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Select from '$lib/components/ui/Select.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { api } from '$lib/utils/api';
  import { addToast } from '$lib/stores/toast.svelte';
  import { Eye, EyeOff } from 'lucide-svelte';

  let {
    open,
    onClose,
    onCreated,
  }: {
    open: boolean;
    onClose: () => void;
    onCreated: () => void;
  } = $props();

  let fullName = $state('');
  let email = $state('');
  let role = $state('');
  let password = $state('');
  let showPassword = $state(false);
  let submitting = $state(false);
  let errors = $state<Record<string, string>>({});

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
    if (!email.trim()) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = 'Invalid email format';
    if (!role) newErrors.role = 'Role is required';
    if (!password) newErrors.password = 'Password is required';
    else if (password.length < 8) newErrors.password = 'Password must be at least 8 characters';
    errors = newErrors;
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(): Promise<void> {
    if (!validate()) return;
    submitting = true;
    try {
      await api('/users', {
        method: 'POST',
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          role,
          password,
        }),
      });
      addToast('User invited successfully', 'success');
      resetForm();
      onCreated();
    } catch (err: any) {
      addToast(err.message ?? 'Failed to invite user', 'error');
    } finally {
      submitting = false;
    }
  }

  function resetForm(): void {
    fullName = '';
    email = '';
    role = '';
    password = '';
    showPassword = false;
    errors = {};
  }

  function handleClose(): void {
    resetForm();
    onClose();
  }
</script>

<Modal {open} title="Invite User" size="md" onClose={handleClose}>
  <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="flex flex-col gap-4">
    <FormField label="Full Name" required error={errors.fullName}>
      <Input bind:value={fullName} placeholder="Full name" error={errors.fullName} />
    </FormField>

    <FormField label="Email" required error={errors.email}>
      <Input type="email" bind:value={email} placeholder="email@example.com" error={errors.email} />
    </FormField>

    <FormField label="Role" required error={errors.role}>
      <Select
        options={roleOptions}
        value={role}
        onSelect={(v) => { role = v; }}
        placeholder="Select role"
      />
    </FormField>

    <FormField label="Temporary Password" required error={errors.password} helpText="Minimum 8 characters">
      <div class="relative">
        <Input
          type={showPassword ? 'text' : 'password'}
          bind:value={password}
          placeholder="Temporary password"
          error={errors.password}
        />
        <button
          type="button"
          onclick={() => { showPassword = !showPassword; }}
          class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {#if showPassword}
            <EyeOff size={16} />
          {:else}
            <Eye size={16} />
          {/if}
        </button>
      </div>
    </FormField>
  </form>

  {#snippet footer()}
    <Button variant="secondary" onclick={handleClose}>Cancel</Button>
    <Button variant="primary" loading={submitting} onclick={handleSubmit}>Invite User</Button>
  {/snippet}
</Modal>
