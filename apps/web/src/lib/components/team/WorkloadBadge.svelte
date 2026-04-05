<script lang="ts">
  import StatusBadge from '$lib/components/ui/StatusBadge.svelte';

  let {
    status,
  }: {
    status: string;
  } = $props();
</script>

<StatusBadge {status} type="workload" />
