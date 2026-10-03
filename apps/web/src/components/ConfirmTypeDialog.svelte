<script lang="ts">
  /**
   * Confirmation for an action that is disruptive and easy to fire by accident.
   *
   * The person has to type the exact phrase to proceed. Paste, drop and
   * autofill are blocked so the phrase has to be read and retyped — the point
   * of the gate is that it forces a moment of attention, and pasting it would
   * skip exactly that.
   */
  let {
    open = false,
    title,
    body,
    phrase,
    confirmLabel = 'Confirm',
    busy = false,
    onConfirm,
    onCancel,
  }: {
    open?: boolean;
    title: string;
    body: string;
    phrase: string;
    confirmLabel?: string;
    busy?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  } = $props();

  let typed = $state('');
  let inputEl = $state<HTMLInputElement | null>(null);

  const matches = $derived(typed.trim() === phrase);

  // Reset between openings so a previous answer never carries over.
  $effect(() => {
    if (open) {
      typed = '';
      queueMicrotask(() => inputEl?.focus());
    }
  });

  function block(e: Event) {
    e.preventDefault();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onCancel();
    if (e.key === 'Enter' && matches && !busy) onConfirm();
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="confirm-title"
    onkeydown={onKeydown}
  >
    <div class="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
      <h3 id="confirm-title" class="font-semibold text-gray-900 mb-2">{title}</h3>
      <p class="text-sm text-gray-600 mb-4">{body}</p>

      <label for="confirm-phrase" class="block text-sm text-gray-700 mb-1">
        Type <span class="font-mono font-semibold text-gray-900">{phrase}</span> to continue
      </label>
      <input
        id="confirm-phrase"
        bind:this={inputEl}
        bind:value={typed}
        type="text"
        autocomplete="off"
        autocapitalize="off"
        autocorrect="off"
        spellcheck="false"
        data-1p-ignore
        onpaste={block}
        ondrop={block}
        oncopy={block}
        oncut={block}
        oncontextmenu={block}
        class="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono mb-4"
      />

      <div class="flex justify-end gap-2">
        <button
          type="button"
          onclick={onCancel}
          class="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onclick={onConfirm}
          disabled={!matches || busy}
          class="px-3 py-1.5 text-sm rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </div>
  </div>
{/if}
