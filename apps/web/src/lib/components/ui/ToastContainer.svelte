<script lang="ts">
  import { CheckCircle2, XCircle, Info, X } from 'lucide-svelte';
  import { getToasts, removeToast, type ToastVariant } from '$lib/stores/toast.svelte';

  const variantStyles: Record<ToastVariant, string> = {
    success: 'border-green-200 bg-white',
    error: 'border-red-200 bg-white',
    info: 'border-blue-200 bg-white',
  };

  const iconColors: Record<ToastVariant, string> = {
    success: 'text-green-600',
    error: 'text-red-600',
    info: 'text-blue-600',
  };
</script>

<div class="fixed right-6 top-6 z-50 flex w-[360px] flex-col gap-3">
  {#each getToasts() as toast (toast.id)}
    <div
      class="flex items-start gap-3 rounded-md border p-4 shadow-lg {variantStyles[toast.variant]}"
    >
      <span class="mt-0.5 shrink-0 {iconColors[toast.variant]}">
        {#if toast.variant === 'success'}
          <CheckCircle2 size={20} />
        {:else if toast.variant === 'error'}
          <XCircle size={20} />
        {:else}
          <Info size={20} />
        {/if}
      </span>
      <p class="flex-1 text-sm text-gray-900">{toast.message}</p>
      <button
        onclick={() => removeToast(toast.id)}
        class="shrink-0 cursor-pointer text-gray-400 hover:text-gray-600"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  {/each}
</div>
