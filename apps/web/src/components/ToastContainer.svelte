<script lang="ts">
  import { getToasts, removeToast } from '../lib/toast.svelte';

  const toasts = $derived(getToasts());

  const variantClasses: Record<string, string> = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-gray-800',
  };
</script>

{#if toasts.length > 0}
  <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
    {#each toasts as toast (toast.id)}
      <div class="{variantClasses[toast.variant]} text-white text-sm px-4 py-2 rounded shadow-lg flex items-center gap-2 max-w-xs">
        <span class="flex-1">{toast.message}</span>
        <button onclick={() => removeToast(toast.id)} class="opacity-70 hover:opacity-100 text-white font-bold">&times;</button>
      </div>
    {/each}
  </div>
{/if}
