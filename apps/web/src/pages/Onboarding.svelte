<script lang="ts">
  import { api, ApiError } from '../lib/api';
  import { getUser } from '../lib/auth.svelte';
  import { navigate } from '../lib/router.svelte';
  import { addToast } from '../lib/toast.svelte';
  import { UserRole, EntityType } from '@ca-practice-os/shared';

  const user = $derived(getUser());

  let step = $state(1);
  const totalSteps = 3;

  $effect(() => {
    // Clear error when step changes
    step;
    error = '';
  });

  // Step 1: Firm profile
  let icaiRegistration = $state('');
  let firmPan = $state('');
  let firmPhone = $state('');
  let firmEmail = $state('');

  // Step 2: Invite team member
  let memberName = $state('');
  let memberEmail = $state('');
  let memberRole = $state<string>(UserRole.JUNIOR_CA);
  let memberPassword = $state('');

  // Step 3: Add first client
  let clientName = $state('');
  let clientPan = $state('');
  let clientEntityType = $state<string>(EntityType.PRIVATE_LIMITED);

  let loading = $state(false);
  let error = $state('');
  let profileLoaded = $state(false);

  // Pre-fill firm profile if data exists (returning to onboarding from dashboard)
  $effect(() => {
    if (!profileLoaded) {
      profileLoaded = true;
      api('/firms/settings/profile').then((data: any) => {
        if (data.icaiRegistration) icaiRegistration = data.icaiRegistration;
        if (data.pan) firmPan = data.pan;
        if (data.phone) firmPhone = data.phone;
        if (data.email) firmEmail = data.email;
      }).catch(() => {});
    }
  });

  const roleOptions: { value: string; label: string }[] = [
    { value: UserRole.MANAGER, label: 'Manager' },
    { value: UserRole.JUNIOR_CA, label: 'Junior CA' },
    { value: UserRole.ARTICLE, label: 'Article Clerk' },
  ];

  const entityTypeOptions: { value: string; label: string }[] = [
    { value: EntityType.INDIVIDUAL, label: 'Individual' },
    { value: EntityType.HUF, label: 'HUF' },
    { value: EntityType.PARTNERSHIP_FIRM, label: 'Partnership Firm' },
    { value: EntityType.LLP, label: 'LLP' },
    { value: EntityType.PRIVATE_LIMITED, label: 'Private Limited' },
    { value: EntityType.PUBLIC_LIMITED, label: 'Public Limited' },
    { value: EntityType.TRUST, label: 'Trust' },
    { value: EntityType.SOCIETY, label: 'Society' },
  ];

  async function saveFirmProfile() {
    loading = true;
    error = '';
    try {
      const body: Record<string, string> = {};
      if (icaiRegistration.trim()) body.icaiRegistration = icaiRegistration.trim();
      if (firmPan.trim()) body.pan = firmPan.trim().toUpperCase();
      if (firmPhone.trim()) body.phone = firmPhone.trim();
      if (firmEmail.trim()) body.email = firmEmail.trim();

      if (Object.keys(body).length > 0) {
        await api('/firms/settings/profile', {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      }
      step = 2;
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to save firm profile';
    } finally {
      loading = false;
    }
  }

  async function inviteTeamMember() {
    loading = true;
    error = '';
    try {
      await api('/users', {
        method: 'POST',
        body: JSON.stringify({
          fullName: memberName.trim(),
          email: memberEmail.trim().toLowerCase(),
          role: memberRole,
          password: memberPassword,
        }),
      });
      addToast(`${memberName} invited successfully`, 'success');
      step = 3;
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to invite team member';
    } finally {
      loading = false;
    }
  }

  async function addFirstClient() {
    loading = true;
    error = '';
    try {
      await api('/clients', {
        method: 'POST',
        body: JSON.stringify({
          displayName: clientName.trim(),
          entityType: clientEntityType,
          ...(clientPan.trim() ? { pan: clientPan.trim().toUpperCase() } : {}),
        }),
      });
      addToast(`${clientName} added as a client`, 'success');
      finishOnboarding();
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to add client';
    } finally {
      loading = false;
    }
  }

  function finishOnboarding() {
    addToast("You're all set! Welcome to tafCA.", 'success');
    navigate('/');
  }

  const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5';
</script>

<div class="min-h-screen bg-gray-50 flex flex-col">
  <!-- Top bar -->
  <div class="bg-white border-b border-gray-200 px-6 py-4">
    <div class="max-w-xl mx-auto flex items-center justify-between">
      <span class="font-semibold text-gray-900">tafCA</span>
      <button
        onclick={finishOnboarding}
        class="text-sm text-gray-400 hover:text-gray-600"
      >
        Skip setup
      </button>
    </div>
  </div>

  <div class="flex-1 flex items-start justify-center pt-12 px-4">
    <div class="w-full max-w-xl">
      <!-- Progress -->
      <div class="mb-8">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-medium text-gray-500">Step {step} of {totalSteps}</span>
          <span class="text-xs text-gray-400">{Math.round((step / totalSteps) * 100)}%</span>
        </div>
        <div class="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            class="h-full bg-blue-600 rounded-full transition-all duration-500"
            style="width: {(step / totalSteps) * 100}%"
          ></div>
        </div>
      </div>

      <!-- Step 1: Firm Profile -->
      {#if step === 1}
        <div class="bg-white rounded-xl border border-gray-200 p-8">
          <div class="mb-6">
            <h1 class="text-xl font-bold text-gray-900">Set up your firm</h1>
            <p class="text-sm text-gray-500 mt-1">
              Hi {user?.fullName}! Let's get <strong>{user?.firmName}</strong> ready.
              These details help with compliance filings and client communications.
            </p>
          </div>

          {#if error}
            <p class="text-sm text-red-600 bg-red-50 rounded-lg p-3 mb-4">{error}</p>
          {/if}

          <form onsubmit={(e) => { e.preventDefault(); saveFirmProfile(); }} class="space-y-4">
            <div>
              <label for="icai" class={labelClass}>ICAI Registration Number</label>
              <input
                id="icai"
                type="text"
                bind:value={icaiRegistration}
                class={inputClass}
                placeholder="e.g., 012345N"
              />
            </div>

            <div>
              <label for="firmPan" class={labelClass}>Firm PAN</label>
              <input
                id="firmPan"
                type="text"
                bind:value={firmPan}
                class={inputClass}
                placeholder="e.g., ABCDE1234F"
                maxlength="10"
              />
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label for="firmPhone" class={labelClass}>Phone</label>
                <input
                  id="firmPhone"
                  type="tel"
                  bind:value={firmPhone}
                  class={inputClass}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div>
                <label for="firmEmail" class={labelClass}>Firm email</label>
                <input
                  id="firmEmail"
                  type="email"
                  bind:value={firmEmail}
                  class={inputClass}
                  placeholder="contact@firm.com"
                />
              </div>
            </div>

            <div class="flex items-center justify-between pt-4">
              <span></span>
              <div class="flex gap-3">
                <button
                  type="button"
                  onclick={() => (step = 2)}
                  class="text-sm text-gray-500 hover:text-gray-700 px-4 py-2"
                >
                  Skip
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  class="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Continue'}
                </button>
              </div>
            </div>
          </form>
        </div>

      <!-- Step 2: Invite Team -->
      {:else if step === 2}
        <div class="bg-white rounded-xl border border-gray-200 p-8">
          <div class="mb-6">
            <h1 class="text-xl font-bold text-gray-900">Invite your team</h1>
            <p class="text-sm text-gray-500 mt-1">
              Add a team member so you can assign tasks and collaborate.
              You can always invite more people later from Settings.
            </p>
          </div>

          {#if error}
            <p class="text-sm text-red-600 bg-red-50 rounded-lg p-3 mb-4">{error}</p>
          {/if}

          <form onsubmit={(e) => { e.preventDefault(); inviteTeamMember(); }} class="space-y-4">
            <div>
              <label for="memberName" class={labelClass}>Full name</label>
              <input
                id="memberName"
                type="text"
                bind:value={memberName}
                required
                class={inputClass}
                placeholder="Team member's name"
              />
            </div>

            <div>
              <label for="memberEmail" class={labelClass}>Email</label>
              <input
                id="memberEmail"
                type="email"
                bind:value={memberEmail}
                required
                class={inputClass}
                placeholder="team@firm.com"
              />
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label for="memberRole" class={labelClass}>Role</label>
                <select id="memberRole" bind:value={memberRole} class={inputClass}>
                  {#each roleOptions as opt}
                    <option value={opt.value}>{opt.label}</option>
                  {/each}
                </select>
              </div>
              <div>
                <label for="memberPwd" class={labelClass}>Temporary password</label>
                <input
                  id="memberPwd"
                  type="text"
                  bind:value={memberPassword}
                  required
                  minlength="8"
                  class={inputClass}
                  placeholder="Min 8 characters"
                />
              </div>
            </div>

            <div class="flex items-center justify-between pt-4">
              <button
                type="button"
                onclick={() => (step = 1)}
                class="text-sm text-gray-500 hover:text-gray-700 px-4 py-2"
              >
                Back
              </button>
              <div class="flex gap-3">
                <button
                  type="button"
                  onclick={() => (step = 3)}
                  class="text-sm text-gray-500 hover:text-gray-700 px-4 py-2"
                >
                  Skip
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  class="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Inviting...' : 'Invite & Continue'}
                </button>
              </div>
            </div>
          </form>
        </div>

      <!-- Step 3: Add Client -->
      {:else if step === 3}
        <div class="bg-white rounded-xl border border-gray-200 p-8">
          <div class="mb-6">
            <h1 class="text-xl font-bold text-gray-900">Add your first client</h1>
            <p class="text-sm text-gray-500 mt-1">
              Clients are the heart of your practice. Add one to start tracking
              engagements and deadlines.
            </p>
          </div>

          {#if error}
            <p class="text-sm text-red-600 bg-red-50 rounded-lg p-3 mb-4">{error}</p>
          {/if}

          <form onsubmit={(e) => { e.preventDefault(); addFirstClient(); }} class="space-y-4">
            <div>
              <label for="clientName" class={labelClass}>Client name</label>
              <input
                id="clientName"
                type="text"
                bind:value={clientName}
                required
                class={inputClass}
                placeholder="e.g., Sharma Industries Pvt. Ltd."
              />
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label for="clientEntity" class={labelClass}>Entity type</label>
                <select id="clientEntity" bind:value={clientEntityType} class={inputClass}>
                  {#each entityTypeOptions as opt}
                    <option value={opt.value}>{opt.label}</option>
                  {/each}
                </select>
              </div>
              <div>
                <label for="clientPan" class={labelClass}>PAN (optional)</label>
                <input
                  id="clientPan"
                  type="text"
                  bind:value={clientPan}
                  class={inputClass}
                  placeholder="ABCDE1234F"
                  maxlength="10"
                />
              </div>
            </div>

            <div class="flex items-center justify-between pt-4">
              <button
                type="button"
                onclick={() => (step = 2)}
                class="text-sm text-gray-500 hover:text-gray-700 px-4 py-2"
              >
                Back
              </button>
              <div class="flex gap-3">
                <button
                  type="button"
                  onclick={finishOnboarding}
                  class="text-sm text-gray-500 hover:text-gray-700 px-4 py-2"
                >
                  Skip
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  class="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Adding...' : 'Add Client & Finish'}
                </button>
              </div>
            </div>
          </form>
        </div>
      {/if}

      <!-- Step indicator dots -->
      <div class="flex justify-center gap-2 mt-6">
        {#each Array(totalSteps) as _, i}
          <button
            onclick={() => { if (i + 1 < step) step = i + 1; }}
            class="w-2 h-2 rounded-full transition-colors {i + 1 === step ? 'bg-blue-600' : i + 1 < step ? 'bg-blue-300' : 'bg-gray-300'}"
            aria-label="Step {i + 1}"
          ></button>
        {/each}
      </div>
    </div>
  </div>
</div>
