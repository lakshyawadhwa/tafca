<script lang="ts">
  import { navigate } from '../lib/router.svelte';
</script>

<div class="flex flex-col items-center justify-center py-24">
  <h1 class="text-4xl font-bold text-gray-300">404</h1>
  <p class="mt-2 text-gray-500">Page not found</p>
  <button onclick={() => navigate('/')} class="mt-4 text-sm text-blue-600 hover:underline">
    Go to dashboard
  </button>
</div>
