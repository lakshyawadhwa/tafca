<script lang="ts">
  import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
  import { toStore } from 'svelte/store';
  import { EntityType, ConstitutionType, ClientStatus, UserRole, REGEX } from '@ca-practice-os/shared';
  import { api, ApiError } from '../lib/api';
  import { navigate } from '../lib/router.svelte';
  import { addToast } from '../lib/toast.svelte';

  let { id }: { id?: string } = $props();

  const isEdit = $derived(!!id);
  const qc = useQueryClient();

  // Core fields
  let displayName = $state('');
  let legalName = $state('');
  let entityType = $state<string>(EntityType.INDIVIDUAL);
  let constitution = $state('');
  let status = $state<string>(ClientStatus.ACTIVE);

  // Regulatory IDs
  let pan = $state('');
  let panError = $state('');
  let tan = $state('');
  let cin = $state('');

  // Contact
  let primaryContactName = $state('');
  let primaryContactEmail = $state('');
  let primaryContactPhone = $state('');

  // Assignees
  let assignedPartnerId = $state('');
  let assignedManagerId = $state('');
  let assignedJuniorId = $state('');
  let assignedArticleId = $state('');

  // Tags
  let tags = $state<string[]>([]);
  let tagInput = $state('');

  // Notes
  let notes = $state('');
  let fieldErrors = $state<Record<string, string>>({});
  let globalError = $state('');

  // Entity type derived flags
  const isIndividual = $derived(entityType === EntityType.INDIVIDUAL);
  const isCorporate = $derived(
    [EntityType.PRIVATE_LIMITED, EntityType.PUBLIC_LIMITED, EntityType.LLP].includes(entityType as EntityType)
  );
  const panRequired = $derived(!isIndividual);

  function validatePan(value: string): string {
    if (!value) return panRequired ? 'PAN is required for this entity type' : '';
    if (!REGEX.PAN.test(value.toUpperCase())) return 'Invalid PAN format (e.g. ABCDE1234F)';
    return '';
  }

  function onPanInput(e: Event) {
    const raw = (e.currentTarget as HTMLInputElement).value.toUpperCase();
    pan = raw;
    panError = '';
  }

  function onPanBlur() {
    panError = validatePan(pan);
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase();
    if (!t || tags.includes(t) || tags.length >= 10) return;
    tags = [...tags, t];
    tagInput = '';
  }

  function removeTag(tag: string) {
    tags = tags.filter((t) => t !== tag);
  }

  function onTagKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    }
    if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      tags = tags.slice(0, -1);
    }
  }

  // Users queries for pickers
  const partners = createQuery({
    queryKey: ['users', 'PARTNER'],
    queryFn: () => api('/users?role=PARTNER&limit=100'),
  });

  const managers = createQuery({
    queryKey: ['users', 'MANAGER'],
    queryFn: () => api('/users?role=MANAGER&limit=100'),
  });

  const juniors = createQuery({
    queryKey: ['users', 'JUNIOR_CA'],
    queryFn: () => api('/users?role=JUNIOR_CA&limit=100'),
  });

  const articles = createQuery({
    queryKey: ['users', 'ARTICLE'],
    queryFn: () => api('/users?role=ARTICLE&limit=100'),
  });

  // Load existing client for edit
  const existing = createQuery(toStore(() => ({
    queryKey: ['client', id],
    queryFn: () => api(`/clients/${id}`),
    enabled: isEdit,
  })));

  $effect(() => {
    if ($existing.data) {
      const c = $existing.data;
      displayName = c.displayName ?? '';
      legalName = c.legalName ?? '';
      entityType = c.entityType ?? EntityType.INDIVIDUAL;
      constitution = c.constitution ?? '';
      status = c.status ?? ClientStatus.ACTIVE;
      pan = c.pan ?? '';
      tan = c.tan ?? '';
      cin = c.cin ?? '';
      primaryContactName = c.primaryContactName ?? '';
      primaryContactEmail = c.primaryContactEmail ?? '';
      primaryContactPhone = c.primaryContactPhone ?? '';
      assignedPartnerId = c.assignedPartner?.id ?? '';
      assignedManagerId = c.assignedManager?.id ?? '';
      assignedJuniorId = c.assignedJunior?.id ?? '';
      assignedArticleId = c.assignedArticle?.id ?? '';
      tags = c.tags ?? [];
      notes = c.notes ?? '';
    }
  });

  const save = createMutation({
    mutationFn: (data: Record<string, any>) => {
      if (isEdit) return api(`/clients/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
      return api('/clients', { method: 'POST', body: JSON.stringify(data) });
    },
    onSuccess: (result: any) => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      if (isEdit) qc.invalidateQueries({ queryKey: ['client', id] });
      addToast(isEdit ? 'Client updated' : 'Client created', 'success');
      navigate(`/clients/${result.id}`);
    },
    onError: (err: any) => {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          fieldErrors = { displayName: 'A client with this name already exists in your firm' };
        } else if (err.status === 400 && Array.isArray(err.body?.errors)) {
          const fe: Record<string, string> = {};
          for (const e of err.body.errors) fe[e.field] = e.message;
          fieldErrors = fe;
        } else {
          globalError = err.message;
        }
      } else {
        globalError = 'Save failed';
      }
    },
  });

  function handleSubmit(e: Event) {
    e.preventDefault();
    fieldErrors = {};
    globalError = '';

    const panErr = validatePan(pan);
    if (panErr) { panError = panErr; return; }

    const data: Record<string, any> = { displayName: displayName.trim(), entityType, status, tags };
    if (legalName.trim()) data.legalName = legalName.trim();
    if (constitution) data.constitution = constitution;
    if (pan) data.pan = pan.toUpperCase();
    if (tan) data.tan = tan.toUpperCase();
    if (cin) data.cin = cin.toUpperCase();
    if (primaryContactName.trim()) data.primaryContactName = primaryContactName.trim();
    if (primaryContactEmail.trim()) data.primaryContactEmail = primaryContactEmail.trim();
    if (primaryContactPhone.trim()) data.primaryContactPhone = primaryContactPhone.trim();
    if (assignedPartnerId) data.assignedPartnerId = assignedPartnerId;
    if (assignedManagerId) data.assignedManagerId = assignedManagerId;
    if (assignedJuniorId) data.assignedJuniorId = assignedJuniorId;
    if (assignedArticleId) data.assignedArticleId = assignedArticleId;
    if (notes.trim()) data.notes = notes.trim();
    $save.mutate(data);
  }
</script>

<div class="max-w-2xl">
  <button onclick={() => navigate(isEdit ? `/clients/${id}` : '/clients')} class="text-sm text-gray-500 hover:text-gray-700 mb-2">&larr; Back</button>
  <h1 class="text-2xl font-bold text-gray-900 mb-6">{isEdit ? 'Edit Client' : 'New Client'}</h1>

  {#if isEdit && $existing.isLoading}
    <p class="text-gray-500 py-8 text-center">Loading...</p>
  {:else}
    <form onsubmit={handleSubmit} class="space-y-6">
      {#if globalError}
        <p class="text-sm text-red-600 bg-red-50 rounded p-2">{globalError}</p>
      {/if}

      <!-- Identity -->
      <div class="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <h3 class="text-sm font-semibold text-gray-700">Identity</h3>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="displayName" class="block text-sm font-medium text-gray-700 mb-1">Display Name *</label>
            <input id="displayName" type="text" bind:value={displayName} required minlength="2" maxlength="200"
              class="w-full rounded border {fieldErrors.displayName ? 'border-red-400' : 'border-gray-300'} px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {#if fieldErrors.displayName}
              <p class="text-xs text-red-500 mt-1">{fieldErrors.displayName}</p>
            {/if}
          </div>
          <div>
            <label for="legalName" class="block text-sm font-medium text-gray-700 mb-1">Legal Name</label>
            <input id="legalName" type="text" bind:value={legalName} maxlength="200"
              class="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div class="grid grid-cols-3 gap-4">
          <div>
            <label for="entityType" class="block text-sm font-medium text-gray-700 mb-1">Entity Type *</label>
            <select id="entityType" bind:value={entityType} onchange={() => { pan = ''; panError = ''; }}
              class="w-full rounded border border-gray-300 px-3 py-2 text-sm">
              {#each Object.values(EntityType) as t}
                <option value={t}>{t.replace(/_/g, ' ')}</option>
              {/each}
            </select>
          </div>
          <div>
            <label for="constitution" class="block text-sm font-medium text-gray-700 mb-1">Constitution</label>
            <select id="constitution" bind:value={constitution} class="w-full rounded border border-gray-300 px-3 py-2 text-sm">
              <option value="">None</option>
              {#each Object.values(ConstitutionType) as t}
                <option value={t}>{t.replace(/_/g, ' ')}</option>
              {/each}
            </select>
          </div>
          <div>
            <label for="status" class="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select id="status" bind:value={status} class="w-full rounded border border-gray-300 px-3 py-2 text-sm">
              {#each Object.values(ClientStatus) as s}
                <option value={s}>{s}</option>
              {/each}
            </select>
          </div>
        </div>
      </div>

      <!-- Regulatory IDs -->
      <div class="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <h3 class="text-sm font-semibold text-gray-700">Regulatory IDs</h3>

        <div class="grid grid-cols-3 gap-4">
          <div>
            <label for="pan" class="block text-sm font-medium text-gray-700 mb-1">
              PAN {panRequired ? '*' : ''}
            </label>
            <input
              id="pan"
              type="text"
              value={pan}
              oninput={onPanInput}
              onblur={onPanBlur}
              maxlength="10"
              placeholder="ABCDE1234F"
              class="w-full rounded border {panError ? 'border-red-400' : 'border-gray-300'} px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {#if panError}
              <p class="text-xs text-red-500 mt-1">{panError}</p>
            {:else if !isIndividual}
              <p class="text-xs text-gray-400 mt-1">Required for this entity type</p>
            {/if}
          </div>

          <div>
            <label for="tan" class="block text-sm font-medium text-gray-700 mb-1">TAN</label>
            <input id="tan" type="text" bind:value={tan} maxlength="10" placeholder="ABCD01234E"
              class="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p class="text-xs text-gray-400 mt-1">For TDS deductors</p>
          </div>

          {#if isCorporate}
            <div>
              <label for="cin" class="block text-sm font-medium text-gray-700 mb-1">CIN</label>
              <input id="cin" type="text" bind:value={cin} maxlength="21"
                class="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <p class="text-xs text-gray-400 mt-1">Company/LLP Identification Number</p>
            </div>
          {/if}
        </div>
      </div>

      <!-- Team Assignment -->
      <div class="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <h3 class="text-sm font-semibold text-gray-700">Team Assignment</h3>
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
          <div>
            <label for="junior" class="block text-sm font-medium text-gray-700 mb-1">Junior CA</label>
            <select id="junior" bind:value={assignedJuniorId} class="w-full rounded border border-gray-300 px-3 py-2 text-sm">
              <option value="">None</option>
              {#if $juniors.data?.data}
                {#each $juniors.data.data as u}
                  <option value={u.id}>{u.fullName}</option>
                {/each}
              {/if}
            </select>
          </div>
          <div>
            <label for="article" class="block text-sm font-medium text-gray-700 mb-1">Article</label>
            <select id="article" bind:value={assignedArticleId} class="w-full rounded border border-gray-300 px-3 py-2 text-sm">
              <option value="">None</option>
              {#if $articles.data?.data}
                {#each $articles.data.data as u}
                  <option value={u.id}>{u.fullName}</option>
                {/each}
              {/if}
            </select>
          </div>
        </div>
      </div>

      <!-- Contact -->
      <div class="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <h3 class="text-sm font-semibold text-gray-700">Primary Contact</h3>
        <div class="grid grid-cols-3 gap-4">
          <div>
            <label for="contactName" class="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input id="contactName" type="text" bind:value={primaryContactName}
              class="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label for="contactEmail" class="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input id="contactEmail" type="email" bind:value={primaryContactEmail}
              class="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label for="contactPhone" class="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input id="contactPhone" type="text" bind:value={primaryContactPhone} placeholder="+91XXXXXXXXXX"
              class="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </div>

      <!-- Tags + Notes -->
      <div class="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <h3 class="text-sm font-semibold text-gray-700">Tags &amp; Notes</h3>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Tags <span class="text-gray-400 font-normal">({tags.length}/10)</span></label>
          <div class="flex flex-wrap gap-1 min-h-[38px] rounded border border-gray-300 px-2 py-1.5 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
            {#each tags as tag}
              <span class="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded">
                {tag}
                <button type="button" onclick={() => removeTag(tag)} class="text-blue-400 hover:text-blue-700 leading-none">&times;</button>
              </span>
            {/each}
            {#if tags.length < 10}
              <input
                type="text"
                bind:value={tagInput}
                onkeydown={onTagKeydown}
                onblur={addTag}
                placeholder={tags.length === 0 ? 'Type and press Enter...' : ''}
                class="flex-1 min-w-[120px] text-sm outline-none bg-transparent"
              />
            {/if}
          </div>
          <p class="text-xs text-gray-400 mt-1">Press Enter or comma to add. Max 10 tags.</p>
        </div>

        <div>
          <label for="notes" class="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea id="notes" bind:value={notes} rows="3" maxlength="5000"
            class="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
        </div>
      </div>

      <div class="flex justify-end gap-2">
        <button type="button" onclick={() => navigate(isEdit ? `/clients/${id}` : '/clients')}
          class="px-4 py-2 text-sm rounded border border-gray-300 hover:bg-gray-50">
          Cancel
        </button>
        <button type="submit" disabled={!displayName.trim() || $save.isPending}
          class="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
          {$save.isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Client'}
        </button>
      </div>
    </form>
  {/if}
</div>
