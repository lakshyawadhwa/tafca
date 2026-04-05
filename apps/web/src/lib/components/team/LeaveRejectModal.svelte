<script lang="ts">
  import Modal from '$lib/components/ui/Modal.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  let {
    open,
    leaveName,
    onClose,
    onRejected,
  }: {
    open: boolean;
    leaveName: string;
    onClose: () => void;
    onRejected: (reason: string) => void;
  } = $props();

  let reason = $state('');

  function handleReject(): void {
    onRejected(reason.trim());
    reason = '';
  }

  function handleClose(): void {
    reason = '';
    onClose();
  }
</script>

<Modal {open} title="Reject Leave Request" size="sm" onClose={handleClose}>
  <div class="flex flex-col gap-4">
    <p class="text-sm text-gray-600">
      Are you sure you want to reject {leaveName}'s leave request?
    </p>
    <div>
      <label for="rejectReason" class="mb-1 block text-sm font-semibold text-gray-700">Reason (optional)</label>
      <textarea
        id="rejectReason"
        bind:value={reason}
        rows={3}
        placeholder="Reason for rejection..."
        class="w-full rounded-md border border-gray-200 px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
      ></textarea>
    </div>
  </div>

  {#snippet footer()}
    <Button variant="secondary" onclick={handleClose}>Cancel</Button>
    <Button variant="danger" onclick={handleReject}>Reject</Button>
  {/snippet}
</Modal>
