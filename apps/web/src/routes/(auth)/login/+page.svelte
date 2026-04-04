<script lang="ts">
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import Button from '$lib/components/ui/Button.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import { setAuth } from '$lib/stores/auth.svelte';
  import { addToast } from '$lib/stores/toast.svelte';

  let email = $state('');
  let password = $state('');
  let loading = $state(false);

  let emailError = $state<string | null>(null);
  let passwordError = $state<string | null>(null);
  let touched = $state({ email: false, password: false });

  function validateEmail(): string | null {
    if (!email.trim()) return 'Email address is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Please enter a valid email address';
    return null;
  }

  function validatePassword(): string | null {
    if (!password) return 'Password is required';
    return null;
  }

  function handleBlur(field: 'email' | 'password') {
    touched[field] = true;
    if (field === 'email') emailError = validateEmail();
    if (field === 'password') passwordError = validatePassword();
  }

  function validateAll(): boolean {
    touched.email = true;
    touched.password = true;
    emailError = validateEmail();
    passwordError = validatePassword();
    return !emailError && !passwordError;
  }
</script>

<svelte:head>
  <title>Sign in — CA Practice OS</title>
</svelte:head>

<div>
  <h2 class="text-2xl font-semibold text-gray-900">Sign in to your account</h2>

  <form
    method="POST"
    class="mt-8 space-y-5"
    use:enhance={({ cancel }) => {
      if (!validateAll()) {
        cancel();
        return;
      }
      loading = true;
      return async ({ result, update }) => {
        loading = false;
        if (result.type === 'success' && result.data) {
          const data = result.data as { accessToken: string; user: App.Locals['user'] };
          if (data.accessToken && data.user) {
            setAuth(data.accessToken, data.user);
            const firstName = data.user.fullName.split(' ')[0];
            addToast(`Welcome back, ${firstName}!`, 'success');
            await goto('/');
            return;
          }
        }
        if (result.type === 'failure' && result.data) {
          const data = result.data as { error?: string };
          if (data.error) {
            addToast(data.error, 'error');
          }
        }
        await update({ reset: false });
      };
    }}
  >
    <div>
      <label for="email" class="mb-1.5 block text-sm font-semibold text-gray-700">
        Email address
      </label>
      <Input
        type="email"
        id="email"
        name="email"
        bind:value={email}
        placeholder="you@example.com"
        error={touched.email ? emailError : null}
        required
        onblur={() => handleBlur('email')}
      />
    </div>

    <div>
      <label for="password" class="mb-1.5 block text-sm font-semibold text-gray-700">
        Password
      </label>
      <Input
        type="password"
        id="password"
        name="password"
        bind:value={password}
        placeholder="Enter your password"
        error={touched.password ? passwordError : null}
        required
        onblur={() => handleBlur('password')}
      />
    </div>

    <Button type="submit" variant="primary" class="w-full" {loading} disabled={loading}>
      {#snippet children()}
        Sign in
      {/snippet}
    </Button>

    <p class="text-center text-sm text-gray-500">
      Don't have an account?
      <a href="/register" class="font-semibold text-blue-600 hover:text-blue-700">
        Register your firm
      </a>
    </p>
  </form>
</div>
