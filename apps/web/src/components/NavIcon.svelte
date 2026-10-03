<script lang="ts">
  /**
   * Nav icons, drawn inline rather than pulled from a library — eight glyphs do
   * not justify a dependency, and a previous attempt at an icon package here
   * blew up the Vite build.
   *
   * All on a 24-grid with a 1.6 stroke so they share a weight with the type.
   */
  let { name }: { name: string } = $props();
</script>

<svg
  class="nav-icon"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.6"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#if name === 'dashboard'}
    <!-- panes: an overview made of parts -->
    <rect x="3" y="3" width="7.5" height="7.5" rx="1.4" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.4" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.4" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.4" />
  {:else if name === 'tasks'}
    <!-- checklist -->
    <path d="M9 6h11M9 12h11M9 18h11" />
    <path d="M3.5 6l1.3 1.3L7.2 5" />
    <path d="M3.5 12l1.3 1.3L7.2 10.7" />
    <path d="M3.5 18l1.3 1.3L7.2 16.7" />
  {:else if name === 'clients'}
    <!-- two people -->
    <path d="M15.5 20v-1.6a3.4 3.4 0 0 0-3.4-3.4H6.4A3.4 3.4 0 0 0 3 18.4V20" />
    <circle cx="9.2" cy="7.6" r="3.2" />
    <path d="M21 20v-1.6a3.4 3.4 0 0 0-2.6-3.3M15.6 4.6a3.4 3.4 0 0 1 0 6.1" />
  {:else if name === 'engagements'}
    <!-- folder: a body of work for one client -->
    <path d="M3 7.2a1.8 1.8 0 0 1 1.8-1.8h3.9l2 2.4h7.5A1.8 1.8 0 0 1 20 9.6v7.6a1.8 1.8 0 0 1-1.8 1.8H4.8A1.8 1.8 0 0 1 3 17.2z" />
  {:else if name === 'compliance'}
    <!-- calendar: statutory dates are the heartbeat of the job -->
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
    <path d="M10.4 15.2l1.4 1.4 3-3.1" />
  {:else if name === 'team'}
    <!-- people with a workload bar -->
    <circle cx="12" cy="7" r="3.4" />
    <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
  {:else if name === 'settings'}
    <!-- sliders, not a cog: these are preferences, not machinery -->
    <path d="M5 6h14M5 12h14M5 18h14" />
    <circle cx="9" cy="6" r="1.9" />
    <circle cx="15" cy="12" r="1.9" />
    <circle cx="8" cy="18" r="1.9" />
  {:else if name === 'audit'}
    <!-- document with a history mark -->
    <path d="M14 3H6.8A1.8 1.8 0 0 0 5 4.8v14.4A1.8 1.8 0 0 0 6.8 21h10.4a1.8 1.8 0 0 0 1.8-1.8V8z" />
    <path d="M14 3v5h5" />
    <path d="M12 11.6v2.6l1.8 1.1" />
  {/if}
</svg>
