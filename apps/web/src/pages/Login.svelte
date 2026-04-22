<script lang="ts">
  import { api, ApiError } from '../lib/api';
  import { setAuth } from '../lib/auth.svelte';
  import { navigate } from '../lib/router.svelte';
  import { addToast } from '../lib/toast.svelte';

  let email = $state('');
  let password = $state('');
  let loading = $state(false);
  let error = $state('');

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = '';
    loading = true;
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setAuth(data.accessToken, data.user);
      addToast('Logged in successfully', 'success');
      navigate('/');
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Login failed';
    } finally {
      loading = false;
    }
  }
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-50 px-4">
  <div class="w-full max-w-sm">
    <h1 class="text-2xl font-bold text-gray-900 text-center mb-8">tafCA</h1>

    <form onsubmit={handleSubmit} class="bg-white rounded-lg shadow p-6 space-y-4">
      <h2 class="text-lg font-semibold text-gray-800">Sign in</h2>

      {#if error}
        <p class="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>
      {/if}

      <div>
        <label for="email" class="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          id="email"
          type="email"
          bind:value={email}
          required
          class="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="you@firm.com"
        />
      </div>

      <div>
        <label for="password" class="block text-sm font-medium text-gray-700 mb-1">Password</label>
        <input
          id="password"
          type="password"
          bind:value={password}
          required
          class="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        class="w-full bg-blue-600 text-white rounded py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Signing in...' : 'Sign in'}
      </button>

      <p class="text-sm text-center text-gray-500">
        Don't have an account?
        <button type="button" onclick={() => navigate('/register')} class="text-blue-600 hover:underline">
          Register
        </button>
      </p>
    </form>
  </div>
</div>
