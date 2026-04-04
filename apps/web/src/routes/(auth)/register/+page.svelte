<script lang="ts">
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import Button from '$lib/components/ui/Button.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import { setAuth } from '$lib/stores/auth.svelte';
  import { addToast } from '$lib/stores/toast.svelte';

  let firmName = $state('');
  let fullName = $state('');
  let email = $state('');
  let password = $state('');
  let confirmPassword = $state('');
  let loading = $state(false);

  let errors = $state<Record<string, string | null>>({
    firmName: null,
    fullName: null,
    email: null,
    password: null,
    confirmPassword: null,
  });

  let touched = $state<Record<string, boolean>>({
    firmName: false,
    fullName: false,
    email: false,
    password: false,
    confirmPassword: false,
  });

  function validateField(field: string): string | null {
    switch (field) {
      case 'firmName':
        if (!firmName.trim()) return 'Firm name is required';
        return null;
      case 'fullName':
        if (!fullName.trim()) return 'Your full name is required';
        return null;
      case 'email':
        if (!email.trim()) return 'Email address is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Please enter a valid email address';
        return null;
      case 'password':
        if (!password) return 'Password is required';
        if (password.length < 8) return 'Password must be at least 8 characters';
        return null;
      case 'confirmPassword':
        if (!confirmPassword) return 'Confirm password is required';
        if (confirmPassword !== password) return 'Passwords do not match';
        return null;
      default:
        return null;
    }
  }

  function handleBlur(field: string) {
    touched[field] = true;
    errors[field] = validateField(field);
  }

  function validateAll(): boolean {
    const fields = ['firmName', 'fullName', 'email', 'password', 'confirmPassword'];
    let valid = true;
    for (const field of fields) {
      touched[field] = true;
      errors[field] = validateField(field);
      if (errors[field]) valid = false;
    }
    return valid;
  }
</script>

<svelte:head>
  <title>Register — CA Practice OS</title>
</svelte:head>

<div>
  <h2 class="text-2xl font-semibold text-gray-900">Create your firm account</h2>
  <p class="mt-1 text-sm text-gray-500">Get your CA practice organized in minutes</p>

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
            addToast('Firm created successfully. Welcome aboard!', 'success');
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
      <label for="firmName" class="mb-1.5 block text-sm font-semibold text-gray-700">
        Firm name
      </label>
      <Input
        type="text"
        id="firmName"
        name="firmName"
        bind:value={firmName}
        placeholder="e.g. Sharma & Associates"
        error={touched.firmName ? errors.firmName : null}
        required
        onblur={() => handleBlur('firmName')}
      />
    </div>

    <div>
      <label for="fullName" class="mb-1.5 block text-sm font-semibold text-gray-700">
        Your full name
      </label>
      <Input
        type="text"
        id="fullName"
        name="fullName"
        bind:value={fullName}
        placeholder="e.g. Rajesh Sharma"
        error={touched.fullName ? errors.fullName : null}
        required
        onblur={() => handleBlur('fullName')}
      />
    </div>

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
        error={touched.email ? errors.email : null}
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
        placeholder="At least 8 characters"
        error={touched.password ? errors.password : null}
        required
        onblur={() => handleBlur('password')}
      />
    </div>

    <div>
      <label for="confirmPassword" class="mb-1.5 block text-sm font-semibold text-gray-700">
        Confirm password
      </label>
      <Input
        type="password"
        id="confirmPassword"
        name="confirmPassword"
        bind:value={confirmPassword}
        placeholder="Re-enter your password"
        error={touched.confirmPassword ? errors.confirmPassword : null}
        required
        onblur={() => handleBlur('confirmPassword')}
      />
    </div>

    <Button type="submit" variant="primary" class="w-full" {loading} disabled={loading}>
      {#snippet children()}
        Create account
      {/snippet}
    </Button>

    <p class="text-center text-sm text-gray-500">
      Already have an account?
      <a href="/login" class="font-semibold text-blue-600 hover:text-blue-700">
        Sign in
      </a>
    </p>
  </form>
</div>
