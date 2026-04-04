<script lang="ts">
  import type { Snippet } from 'svelte';
  import '../app.css';
  import ToastContainer from '$lib/components/ui/ToastContainer.svelte';
  import { setAuth } from '$lib/stores/auth.svelte';

  interface Props {
    data: {
      user?: App.Locals['user'];
      accessToken?: string | null;
    };
    children: Snippet;
  }

  let { data, children }: Props = $props();

  $effect(() => {
    if (data.accessToken && data.user) {
      setAuth(data.accessToken, data.user);
    }
  });
</script>

{@render children()}
<ToastContainer />
