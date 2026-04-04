<script lang="ts">
  interface Props {
    type?: string;
    value?: string;
    placeholder?: string;
    error?: string | null;
    disabled?: boolean;
    id?: string;
    name?: string;
    required?: boolean;
    onblur?: (e: FocusEvent) => void;
    oninput?: (e: Event) => void;
  }

  let {
    type = 'text',
    value = $bindable(''),
    placeholder = '',
    error = null,
    disabled = false,
    id,
    name,
    required = false,
    onblur,
    oninput,
  }: Props = $props();
</script>

<input
  {type}
  bind:value
  {placeholder}
  {disabled}
  {id}
  {name}
  {required}
  {onblur}
  {oninput}
  class="h-10 w-full rounded-md border px-4 text-sm text-gray-900 transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400
    {error
    ? 'border-red-500 focus:border-red-500 focus:ring-red-600'
    : 'border-gray-200 hover:border-gray-300 focus:border-blue-600 focus:ring-blue-600'}"
/>

{#if error}
  <p class="mt-1 text-xs text-red-600">{error}</p>
{/if}
