<script lang="ts">
  import { onMount } from 'svelte';
  import { setAuth } from '../lib/auth.svelte';
  import { navigate } from '../lib/router.svelte';
  import { addToast } from '../lib/toast.svelte';

  async function publicFetch(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    const res = await fetch(`/api${path}`, { ...init, headers });
    const body = res.status === 204 ? null : await res.json();
    if (!res.ok) {
      throw new Error(body?.message ?? `Request failed (${res.status})`);
    }
    return body;
  }

  type Preview = {
    email: string;
    fullName: string;
    role: string;
    firmName: string;
    expiresAt: string;
  };

  let token = $state('');
  let preview = $state<Preview | null>(null);
  let loadError = $state('');
  let loading = $state(true);

  let password = $state('');
  let confirmPassword = $state('');
  let submitting = $state(false);
  let submitError = $state('');

  onMount(async () => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token') ?? '';
    token = t;
    if (!t) {
      loadError = 'No invite token provided.';
      loading = false;
      return;
    }
    try {
      preview = await publicFetch(`/invites/${encodeURIComponent(t)}/preview`);
    } catch (err) {
      loadError = err instanceof Error ? err.message : 'This invite link is invalid or expired.';
    } finally {
      loading = false;
    }
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    submitError = '';
    if (password.length < 8) {
      submitError = 'Password must be at least 8 characters.';
      return;
    }
    if (password !== confirmPassword) {
      submitError = 'Passwords do not match.';
      return;
    }
    submitting = true;
    try {
      const data = await publicFetch(`/invites/${encodeURIComponent(token)}/accept`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      setAuth(data.accessToken, data.user);
      addToast(`Welcome to ${data.user.firmName}`, 'success');
      navigate('/');
    } catch (err) {
      submitError = err instanceof Error ? err.message : 'Could not accept invite.';
    } finally {
      submitting = false;
    }
  }
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-50 px-4">
  <div class="w-full max-w-sm">
    <h1 class="text-2xl font-bold text-gray-900 text-center mb-8">tafCA</h1>

    {#if loading}
      <div class="bg-white rounded-lg shadow p-6 text-sm text-gray-500 text-center">Loading invite…</div>
    {:else if loadError}
      <div class="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 class="text-lg font-semibold text-gray-800">Invite unavailable</h2>
        <p class="text-sm text-red-600 bg-red-50 rounded p-2">{loadError}</p>
        <button
          onclick={() => navigate('/login')}
          class="w-full bg-gray-900 text-white rounded py-2 text-sm font-medium hover:bg-gray-800"
        >
          Go to sign in
        </button>
      </div>
    {:else if preview}
      <form onsubmit={handleSubmit} class="bg-white rounded-lg shadow p-6 space-y-4">
        <div>
          <h2 class="text-lg font-semibold text-gray-800">Join {preview.firmName}</h2>
          <p class="text-xs text-gray-500 mt-1">
            {preview.fullName} · {preview.email} · {preview.role.replace(/_/g, ' ')}
          </p>
        </div>

        {#if submitError}
          <p class="text-sm text-red-600 bg-red-50 rounded p-2">{submitError}</p>
        {/if}

        <div>
          <label for="pw" class="block text-sm font-medium text-gray-700 mb-1">Set password</label>
          <input
            id="pw"
            type="password"
            bind:value={password}
            required
            minlength="8"
            class="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label for="pw2" class="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
          <input
            id="pw2"
            type="password"
            bind:value={confirmPassword}
            required
            minlength="8"
            class="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          class="w-full bg-blue-600 text-white rounded py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? 'Joining…' : 'Create account'}
        </button>
      </form>
    {/if}
  </div>
</div>
