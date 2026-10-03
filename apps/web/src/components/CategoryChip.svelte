<script lang="ts">
  /**
   * Engagement category as the acronym a CA already uses. The text carries the
   * meaning; the tint only groups it. Nine categories is well past the number
   * of hues anyone can tell apart at a glance, so colour was never the answer.
   */
  import { categoryLabel } from '../lib/identity';

  let { category }: { category: string | null | undefined } = $props();
  const label = $derived(categoryLabel(category));
</script>

{#if label}
  <span class="category-chip">{label}</span>
{/if}
