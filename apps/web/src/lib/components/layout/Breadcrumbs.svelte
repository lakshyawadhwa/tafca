<script lang="ts">
  import { page } from '$app/stores';
  import { generateBreadcrumbs } from '$lib/utils/breadcrumbs';

  let crumbs = $derived(generateBreadcrumbs($page.url.pathname));
</script>

<nav aria-label="Breadcrumb" class="flex items-center text-sm">
  {#each crumbs as crumb, i (i)}
    {#if i > 0}
      <span class="mx-2 text-gray-400">/</span>
    {/if}
    {#if crumb.href}
      <a
        href={crumb.href}
        class="text-gray-500 transition-colors hover:text-blue-600"
      >
        {crumb.label}
      </a>
    {:else}
      <span class="font-medium text-gray-900">{crumb.label}</span>
    {/if}
  {/each}
</nav>
