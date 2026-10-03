<script lang="ts">
  /**
   * A client's monogram. Sits beside the client name in dense tables so a row
   * can be recognised before it is read — the name is still the identifier,
   * this is only an accelerator.
   */
  import { clientMonogram, clientHueVar } from '../lib/identity';

  let {
    id,
    name,
    size = 20,
  }: { id: string; name: string; size?: number } = $props();

  const mark = $derived(clientMonogram(name));
  const hue = $derived(clientHueVar(id));
</script>

<span
  class="client-mark"
  style="--mark-hue:{hue};--mark-size:{size}px"
  aria-hidden="true"
  title={name}
>{mark}</span>
