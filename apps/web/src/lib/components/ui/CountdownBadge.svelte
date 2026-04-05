<script lang="ts">
  let {
    daysRemaining,
  }: {
    daysRemaining: number;
  } = $props();

  // Complete class strings for TailwindCSS v4
  const COLOR_CLASSES: Record<string, string> = {
    green: 'text-green-700 bg-green-50 border-green-200',
    amber: 'text-amber-700 bg-amber-50 border-amber-200',
    red: 'text-red-700 bg-red-50 border-red-200',
  };

  let colorKey = $derived(daysRemaining < 7 ? 'red' : daysRemaining <= 15 ? 'amber' : 'green');
  let colorClasses = $derived(COLOR_CLASSES[colorKey]);
</script>

<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold {colorClasses}">
  {daysRemaining} days
</span>
