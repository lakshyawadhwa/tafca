<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();
</script>

<div class="flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100">
  <div class="mx-4 w-full max-w-[420px] rounded-lg bg-white px-8 py-12 shadow-lg">
    <div class="mb-8 text-center">
      <h1 class="text-2xl font-semibold text-gray-900">CA Practice OS</h1>
    </div>
    {@render children()}
  </div>
</div>
