<script lang="ts">
  import { onMount } from 'svelte';
  import './app.css';
  import { QueryClientProvider } from '@tanstack/svelte-query';
  import { queryClient } from './lib/query';
  import { addRoute, getMatch, getPath, replace } from './lib/router.svelte';
  import { isAuthenticated } from './lib/auth.svelte';
  import ToastContainer from './components/ToastContainer.svelte';
  import AppShell from './components/AppShell.svelte';
  import ErrorFallback from './components/ErrorFallback.svelte';

  let boundaryError = $state<Error | null>(null);

  onMount(() => {
    function handleError(e: ErrorEvent) {
      boundaryError = e.error instanceof Error ? e.error : new Error(String(e.error));
    }
    // Note: unhandledrejection is intentionally NOT caught here.
    // svelte-query handles its own promise rejections and they do not bubble
    // to window as unhandledrejection in normal operation.
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  });

  // Pages
  import Login from './pages/Login.svelte';
  import Register from './pages/Register.svelte';
  import AcceptInvite from './pages/AcceptInvite.svelte';
  import Dashboard from './pages/Dashboard.svelte';
  import TaskList from './pages/TaskList.svelte';
  import TaskDetail from './pages/TaskDetail.svelte';
  import TaskCreate from './pages/TaskCreate.svelte';
  import ClientList from './pages/ClientList.svelte';
  import ClientDetail from './pages/ClientDetail.svelte';
  import ClientForm from './pages/ClientForm.svelte';
  import EngagementList from './pages/EngagementList.svelte';
  import EngagementCreate from './pages/EngagementCreate.svelte';
  import EngagementDetail from './pages/EngagementDetail.svelte';
  import Team from './pages/Team.svelte';
  import Leave from './pages/Leave.svelte';
  import Settings from './pages/Settings.svelte';
  import AuditLog from './pages/AuditLog.svelte';
  import RecentlyDeleted from './pages/RecentlyDeleted.svelte';
  import Welcome from './pages/Welcome.svelte';
  import Onboarding from './pages/Onboarding.svelte';
  import NotFound from './pages/NotFound.svelte';

  // --- Route definitions ---
  // Auth
  addRoute('/login', Login);
  addRoute('/register', Register);
  addRoute('/accept-invite', AcceptInvite);
  // App
  addRoute('/welcome', Welcome);
  addRoute('/onboarding', Onboarding);
  addRoute('/', Dashboard);
  addRoute('/tasks', TaskList);
  addRoute('/tasks/new', TaskCreate);
  addRoute('/tasks/:id', TaskDetail);
  addRoute('/clients', ClientList);
  addRoute('/clients/new', ClientForm);
  addRoute('/clients/:id', ClientDetail);
  addRoute('/clients/:id/edit', ClientForm);
  addRoute('/engagements', EngagementList);
  addRoute('/engagements/new', EngagementCreate);
  addRoute('/engagements/:id', EngagementDetail);
  addRoute('/team', Team);
  addRoute('/team/leave', Leave);
  addRoute('/settings', Settings);
  addRoute('/audit-log', AuditLog);
  addRoute('/recently-deleted', RecentlyDeleted);

  const publicPaths = new Set(['/login', '/register', '/accept-invite']);
  const fullScreenPaths = new Set(['/onboarding']);

  const match = $derived(getMatch());
  const path = $derived(getPath());
  const authed = $derived(isAuthenticated());
  const isPublicPage = $derived(publicPaths.has(path));
  const isFullScreen = $derived(fullScreenPaths.has(path));

  // Auth guard
  $effect(() => {
    if (!authed && !isPublicPage) {
      replace('/login');
    }
    if (authed && isPublicPage) {
      replace('/');
    }
  });

  const Component = $derived(match?.component ?? NotFound);
  const params = $derived(match?.params ?? {});
</script>

<QueryClientProvider client={queryClient}>
  {#if boundaryError}
    <ErrorFallback onReset={() => { boundaryError = null; }} />
  {:else if isPublicPage || !authed}
    <Component {...params} />
  {:else if isFullScreen}
    <Component {...params} />
  {:else}
    <AppShell>
      <Component {...params} />
    </AppShell>
  {/if}
  <ToastContainer />
</QueryClientProvider>
