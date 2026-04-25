<script lang="ts">
  import { navigate } from '../lib/router.svelte';

  let { onReset }: { onReset: () => void } = $props();
</script>

<div class="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
  <h1 class="text-2xl font-bold text-gray-900">Something went wrong</h1>
  <p class="text-sm text-gray-500 max-w-sm">
    An unexpected error occurred. You can try again or return to the dashboard.
  </p>
  <div class="flex gap-3">
    <button
      onclick={() => { onReset(); navigate(window.location.pathname); }}
      class="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
    >
      Try again
    </button>
    <button
      onclick={() => { onReset(); navigate('/'); }}
      class="px-4 py-2 text-sm rounded border border-gray-300 hover:bg-gray-50"
    >
      Go to dashboard
    </button>
  </div>
</div>
