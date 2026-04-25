<script lang="ts">
  import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
  import { toStore } from 'svelte/store';
  import {
    EngagementCategory,
    RecurrenceType,
  } from '@ca-practice-os/shared';
  import { api, ApiError } from '../lib/api';
  import { navigate } from '../lib/router.svelte';
  import { addToast } from '../lib/toast.svelte';
  import { track } from '../lib/analytics';
  import { useUnsavedGuard } from '../lib/unsaved-guard.svelte';

  // client_id may come from query param
  const searchParams = new URLSearchParams(window.location.search);
  const prefillClientId = searchParams.get('client_id') ?? '';

  const qc = useQueryClient();

  // Form fields
  let clientId = $state(prefillClientId);
  let engagementTypeId = $state('');
  let name = $state('');
  let periodLabel = $state('');
  let periodStart = $state('');
  let periodEnd = $state('');
  let assignedPartnerId = $state('');
  let assignedManagerId = $state('');
  let feeAmount = $state('');
  let notes = $state('');
  let generateTaskChecklist = $state(true);
  let globalError = $state('');
  let isDirty = $state(false);

  // Track if user has manually edited the name
  let nameManuallyEdited = $state(false);

  // Derived: selected type object
  const allTypes = $derived.by(() => {
    const d = $engagementTypes.data;
    if (!d) return [] as any[];
    return Array.isArray(d) ? d : (d.data ?? []);
  });

  const selectedType = $derived(allTypes.find((t: any) => t.id === engagementTypeId) ?? null);
  const isRecurring = $derived(selectedType?.recurrence !== RecurrenceType.ONE_OFF && selectedType !== null);

  // Auto-fill name when type or period changes, unless user edited it manually
  $effect(() => {
    if (!selectedType || nameManuallyEdited) return;
    const clientName = $clientDetail.data?.displayName ?? '';
    const parts = [selectedType.name, clientName].filter(Boolean);
    if (periodLabel) parts.push(periodLabel);
    name = parts.join(' - ').substring(0, 200);
  });

  function markDirty() { isDirty = true; }

  // Session-cached engagement types fetch
  const engagementTypes = createQuery({
    queryKey: ['engagement-types'],
    queryFn: () => api('/engagement-types'),
    staleTime: Infinity, // session cache
  });

  // Client detail (for prefill team + name autofill)
  const clientDetail = createQuery(toStore(() => ({
    queryKey: ['client', clientId],
    queryFn: () => api(`/clients/${clientId}`),
    enabled: !!clientId,
  })));

  // Prefill partner/manager from client when arrived from client detail
  $effect(() => {
    if ($clientDetail.data && prefillClientId) {
      if (!assignedPartnerId) assignedPartnerId = $clientDetail.data.assignedPartner?.id ?? '';
      if (!assignedManagerId) assignedManagerId = $clientDetail.data.assignedManager?.id ?? '';
    }
  });

  // Template items preview
  const templateItems = createQuery(toStore(() => ({
    queryKey: ['engagement-type-template', engagementTypeId],
    queryFn: () => api(`/engagement-types/${engagementTypeId}/template`),
    enabled: !!engagementTypeId && generateTaskChecklist,
    staleTime: Infinity,
  })));

  // Users for team pickers
  const partners = createQuery({
    queryKey: ['users', 'PARTNER'],
    queryFn: () => api('/users?role=PARTNER&limit=100'),
    staleTime: 5 * 60 * 1000,
  });

  const managers = createQuery({
    queryKey: ['users', 'MANAGER'],
    queryFn: () => api('/users?role=MANAGER&limit=100'),
    staleTime: 5 * 60 * 1000,
  });

  // Clients picker (only needed when not prefilled)
  const clients = createQuery({
    queryKey: ['clients-picker'],
    queryFn: () => api('/clients?limit=200'),
    enabled: !prefillClientId,
    staleTime: 5 * 60 * 1000,
  });

  // Group types by category
  const typesByCategory = $derived.by(() => {
    const map = new Map<string, any[]>();
    for (const t of allTypes) {
      const cat = t.category ?? 'OTHER';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(t);
    }
    return map;
  });

  const create = createMutation({
    mutationFn: (data: Record<string, any>) =>
      api('/engagements', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: (result: any) => {
      isDirty = false;
      qc.invalidateQueries({ queryKey: ['engagements'] });
      addToast('Engagement created', 'success');
      track('engagement_create_completed', {
        engagementTypeCode: selectedType?.code ?? selectedType?.name ?? engagementTypeId,
        autoCreateTasks: generateTaskChecklist,
      });
      navigate(`/engagements/${result.id}`);
    },
    onError: (err: any) => {
      if (err instanceof ApiError && err.status >= 500) {
        addToast('Engagement creation failed, please retry', 'error');
      } else {
        globalError = err?.message ?? 'Create failed';
      }
    },
  });

  function handleSubmit(e: Event) {
    e.preventDefault();
    globalError = '';

    const data: Record<string, any> = {
      clientId,
      engagementTypeId,
      autoCreateTasks: generateTaskChecklist,
    };
    if (name.trim()) data.name = name.trim();
    if (periodLabel.trim()) data.periodLabel = periodLabel.trim();
    if (periodStart) data.periodStart = periodStart;
    if (periodEnd) data.periodEnd = periodEnd;
    if (assignedPartnerId) data.assignedPartnerId = assignedPartnerId;
    if (assignedManagerId) data.assignedManagerId = assignedManagerId;
    if (feeAmount !== '' && !isNaN(Number(feeAmount))) data.feeAmount = Number(feeAmount);
    if (notes.trim()) data.notes = notes.trim();

    $create.mutate(data);
  }

  const { guardedNavigate } = useUnsavedGuard(() => isDirty);

  function handleBack() {
    guardedNavigate(prefillClientId ? `/clients/${prefillClientId}` : '/engagements');
  }

  function handleCancel() {
    guardedNavigate(prefillClientId ? `/clients/${prefillClientId}` : '/engagements');
  }

  function formatLabel(s: string) { return s.replace(/_/g, ' '); }

  const templateItemsList = $derived.by(() => {
    const d = $templateItems.data;
    if (!d) return [] as any[];
    // BE may return { items: [] } or a flat array
    return Array.isArray(d) ? d : (d.items ?? []);
  });
</script>

<div class="max-w-2xl">
  <button onclick={handleBack} class="text-sm text-gray-500 hover:text-gray-700 mb-2">&larr; Back</button>
  <h1 class="text-2xl font-bold text-gray-900 mb-6">New Engagement</h1>

  <form onsubmit={handleSubmit} class="space-y-6" onchange={() => markDirty()}>
    {#if globalError}
      <p class="text-sm text-red-600 bg-red-50 rounded p-2">{globalError}</p>
    {/if}

    <!-- Client + Type -->
    <div class="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
      <h3 class="text-sm font-semibold text-gray-700">Engagement Details</h3>

      {#if !prefillClientId}
        <div>
          <label for="clientId" class="block text-sm font-medium text-gray-700 mb-1">Client *</label>
          <select id="clientId" bind:value={clientId} required
            class="w-full rounded border border-gray-300 px-3 py-2 text-sm">
            <option value="">Select client</option>
            {#if $clients.data?.data}
              {#each $clients.data.data as c}
                <option value={c.id}>{c.displayName}</option>
              {/each}
            {/if}
          </select>
        </div>
      {:else}
        <div>
          <span class="block text-sm font-medium text-gray-700 mb-1">Client</span>
          <p class="text-sm text-gray-900 py-2 px-3 bg-gray-50 rounded border border-gray-200">
            {$clientDetail.data?.displayName ?? 'Loading...'}
          </p>
        </div>
      {/if}

      <div>
        <label for="engagementTypeId" class="block text-sm font-medium text-gray-700 mb-1">Type *</label>
        {#if $engagementTypes.isLoading}
          <p class="text-sm text-gray-400">Loading types...</p>
        {:else}
          <select id="engagementTypeId" bind:value={engagementTypeId} required
            class="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            onchange={() => { nameManuallyEdited = false; }}>
            <option value="">Select type</option>
            {#each [...typesByCategory.entries()] as [cat, types]}
              <optgroup label={formatLabel(cat)}>
                {#each types as t}
                  <option value={t.id}>{t.name}</option>
                {/each}
              </optgroup>
            {/each}
          </select>
        {/if}
      </div>

      <div>
        <label for="name" class="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input id="name" type="text" bind:value={name} maxlength="200"
          oninput={() => { nameManuallyEdited = true; }}
          placeholder="Auto-generated from type + client + period"
          class="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <p class="text-xs text-gray-400 mt-1">Editable — auto-fills when type and period are selected.</p>
      </div>
    </div>

    <!-- Period -->
    <div class="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
      <h3 class="text-sm font-semibold text-gray-700">Period</h3>

      <div>
        <label for="periodLabel" class="block text-sm font-medium text-gray-700 mb-1">
          Period Label {isRecurring ? '*' : ''}
        </label>
        <input id="periodLabel" type="text" bind:value={periodLabel}
          required={isRecurring}
          maxlength="50" placeholder="e.g. FY 2024-25 Q3"
          class="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <p class="text-xs text-gray-400 mt-1">
          {isRecurring ? 'Required for recurring engagements.' : 'Optional for one-off engagements.'}
        </p>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label for="periodStart" class="block text-sm font-medium text-gray-700 mb-1">
            Start Date {isRecurring ? '*' : ''}
          </label>
          <input id="periodStart" type="date" bind:value={periodStart}
            required={isRecurring}
            class="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label for="periodEnd" class="block text-sm font-medium text-gray-700 mb-1">
            End Date {isRecurring ? '*' : ''}
          </label>
          <input id="periodEnd" type="date" bind:value={periodEnd}
            required={isRecurring}
            class="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
    </div>

    <!-- Team -->
    <div class="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
      <h3 class="text-sm font-semibold text-gray-700">Team</h3>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label for="partner" class="block text-sm font-medium text-gray-700 mb-1">Partner</label>
          <select id="partner" bind:value={assignedPartnerId} class="w-full rounded border border-gray-300 px-3 py-2 text-sm">
            <option value="">None</option>
            {#if $partners.data?.data}
              {#each $partners.data.data as u}
                <option value={u.id}>{u.fullName}</option>
              {/each}
            {/if}
          </select>
        </div>
        <div>
          <label for="manager" class="block text-sm font-medium text-gray-700 mb-1">Manager</label>
          <select id="manager" bind:value={assignedManagerId} class="w-full rounded border border-gray-300 px-3 py-2 text-sm">
            <option value="">None</option>
            {#if $managers.data?.data}
              {#each $managers.data.data as u}
                <option value={u.id}>{u.fullName}</option>
              {/each}
            {/if}
          </select>
        </div>
      </div>
    </div>

    <!-- Fee + Notes -->
    <div class="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
      <h3 class="text-sm font-semibold text-gray-700">Fee &amp; Notes</h3>
      <div>
        <label for="feeAmount" class="block text-sm font-medium text-gray-700 mb-1">Fee Amount (INR)</label>
        <input id="feeAmount" type="number" bind:value={feeAmount} min="0" step="0.01"
          placeholder="0.00"
          class="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div>
        <label for="notes" class="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea id="notes" bind:value={notes} rows="3" maxlength="5000"
          class="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
      </div>
    </div>

    <!-- Task checklist toggle + preview -->
    <div class="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-semibold text-gray-700">Generate task checklist</h3>
          <p class="text-xs text-gray-400 mt-0.5">Creates tasks from the engagement type template on submit.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={generateTaskChecklist}
          aria-label="Generate task checklist"
          onclick={() => { generateTaskChecklist = !generateTaskChecklist; }}
          class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors {generateTaskChecklist ? 'bg-blue-600' : 'bg-gray-300'}"
        >
          <span class="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform {generateTaskChecklist ? 'translate-x-4.5' : 'translate-x-0.5'}"></span>
        </button>
      </div>

      {#if generateTaskChecklist && engagementTypeId}
        {#if $templateItems.isLoading}
          <p class="text-xs text-gray-400">Loading template...</p>
        {:else if templateItemsList.length > 0}
          <div class="border border-gray-100 rounded bg-gray-50 p-3 space-y-1">
            <p class="text-xs font-medium text-gray-500 mb-2">Template tasks ({templateItemsList.length})</p>
            {#each templateItemsList as item, i}
              <div class="flex items-center gap-2 text-xs text-gray-600">
                <span class="text-gray-400 w-4 text-right shrink-0">{i + 1}.</span>
                <span>{item.title}</span>
                {#if item.isRequired}
                  <span class="text-red-400 font-medium">*</span>
                {/if}
              </div>
            {/each}
          </div>
        {:else if !$templateItems.isLoading}
          <p class="text-xs text-gray-400">No template tasks for this type.</p>
        {/if}
      {/if}
    </div>

    <div class="flex justify-end gap-2">
      <button type="button" onclick={handleCancel}
        class="px-4 py-2 text-sm rounded border border-gray-300 hover:bg-gray-50">
        Cancel
      </button>
      <button type="submit"
        disabled={!clientId || !engagementTypeId || $create.isPending}
        class="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
        {$create.isPending ? 'Creating...' : 'Create Engagement'}
      </button>
    </div>
  </form>
</div>
