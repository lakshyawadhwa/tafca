<script lang="ts">
  import { goto } from '$app/navigation';

  let {
    count,
    label,
    accentColor,
    href,
  }: {
    count: number;
    label: string;
    accentColor: 'red' | 'amber' | 'blue' | 'purple';
    href: string;
  } = $props();

  // Complete class strings for TailwindCSS v4
  const BORDER_CLASSES: Record<string, string> = {
    red: 'border-l-red-500',
    amber: 'border-l-amber-500',
    blue: 'border-l-blue-500',
    purple: 'border-l-purple-500',
  };

  const TEXT_CLASSES: Record<string, string> = {
    red: 'text-red-600',
    amber: 'text-amber-600',
    blue: 'text-blue-600',
    purple: 'text-purple-600',
  };

  let borderClass = $derived(BORDER_CLASSES[accentColor]);
  let textClass = $derived(TEXT_CLASSES[accentColor]);
</script>

<button
  type="button"
  onclick={() => goto(href)}
  class="cursor-pointer rounded-lg border border-gray-200 border-l-[3px] bg-white p-5 text-left transition-shadow hover:shadow-sm {borderClass}"
>
  <p class="text-2xl font-semibold leading-tight {textClass}">{count}</p>
  <p class="mt-1 text-sm font-normal text-gray-500">{label}</p>
</button>
