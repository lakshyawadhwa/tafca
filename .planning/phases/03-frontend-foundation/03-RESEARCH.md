# Phase 3: Frontend Foundation - Research

**Researched:** 2026-04-03
**Domain:** SvelteKit 2 + Svelte 5 + TailwindCSS v4 frontend architecture, JWT auth flow, component library
**Confidence:** HIGH

## Summary

Phase 3 builds the SvelteKit frontend foundation: auth pages (login/register), an authenticated app shell (sidebar, topbar, breadcrumbs), and a reusable UI component library. The existing scaffold is minimal -- just a root layout, placeholder page, app.css with `@import 'tailwindcss'`, and vite.config.ts with the @tailwindcss/vite plugin. No `src/lib/` directory exists yet.

The backend auth system (Phase 2) is complete and provides: POST `/api/auth/login` (returns `{ accessToken, user }`), POST `/api/auth/register` (returns `{ accessToken, user, firm }`), POST `/api/auth/refresh` (returns `{ accessToken }` -- uses HTTP-only `refresh_token` cookie with path `/api/auth`), POST `/api/auth/logout` (204, requires Bearer token), and GET `/api/auth/me` (returns user profile with firm). Access tokens expire in 15 minutes, refresh tokens in 7 days. The JWT payload contains `{ sub, firmId, role, email, sessionId }`.

**Primary recommendation:** Use SvelteKit route groups `(auth)` and `(app)` to separate public/protected layouts, implement auth guard in `hooks.server.ts` handle hook, store access token in a reactive Svelte 5 store (memory-only, never localStorage), and build all components as custom Svelte 5 with TailwindCSS -- no third-party component library.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Professional blue-gray color scheme (primary blue-600, neutral grays) -- clean, trustworthy feel for CA firms
- Lucide icons -- lightweight, tree-shakeable, consistent style
- Inter font via CDN -- clean sans-serif, excellent readability for data-heavy UIs
- Light mode only for V1 -- ship faster, add dark mode in V1.1
- Fixed left sidebar, 240px expanded / 64px collapsed -- standard SaaS pattern
- Toggle button on desktop, auto-collapse on mobile (<768px)
- Topbar: breadcrumbs left, notification bell + user avatar/menu right
- Navigation items: Dashboard, Clients, Engagements, Tasks, Team, Settings
- Centered card on subtle gradient background for auth pages -- clean, focused, professional
- Post-login redirect to Dashboard (/) -- shows "my tasks" immediately
- Inline field errors + top-level toast for server errors -- clear, non-blocking feedback
- Single-page register: firm name, full name, email, password, confirm password
- Custom Svelte 5 components with TailwindCSS -- full control, no dependency bloat
- Custom DataTable with slot-based columns, built-in sort/pagination/loading
- Reactive validation using Svelte 5 runes ($state + $derived) -- no extra lib
- Custom store-based toasts with auto-dismiss -- lightweight, full control

### Claude's Discretion
- Exact Tailwind color palette values and spacing scale
- Component API design (prop names, slot patterns)
- File organization within src/lib/components/
- Breadcrumb generation strategy (route-based vs manual)
- Toast positioning and animation details

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SHELL-01 | Login page with email/password, error states for all auth failures | SvelteKit route groups, form validation with $state/$derived, API client with error mapping |
| SHELL-02 | Register page with firm name + user details | Same auth page pattern, POST /api/auth/register integration |
| SHELL-03 | Authenticated layout with collapsible sidebar | Route group `(app)` with +layout.svelte, sidebar state in $state store |
| SHELL-04 | Topbar with user menu and notification bell | Layout component, user data from +layout.server.ts load |
| SHELL-05 | Breadcrumb trail derived from route | $page.url.pathname parsing with label map, Breadcrumbs layout component |
| SHELL-06 | Responsive: sidebar collapses to icons on mobile | TailwindCSS responsive utilities, matchMedia or Tailwind breakpoints |
| SHELL-07 | Auth guard redirects unauthenticated users to login | hooks.server.ts handle hook, redirect() from @sveltejs/kit |
| SHELL-08 | JWT stored in memory, refresh token handled via SvelteKit hooks | Svelte 5 $state store for access token, hooks.server.ts for refresh flow |
| COMP-01 | DataTable component (sortable, paginated, column config) | Svelte 5 snippets for column slots, $state for sort/page state |
| COMP-02 | Modal component with form support | Svelte 5 $props + children snippet, focus trap, portal pattern |
| COMP-03 | FormField component (input wrapper with label, error, help text) | $props with children snippet, $props.id() for label-input linking |
| COMP-04 | StatusBadge component (colored pills for task/engagement status) | Shared package enums, color map from UI-SPEC |
| COMP-05 | UserPicker and ClientPicker (searchable selectors) | Dropdown with $state search, debounced API fetch |
| COMP-06 | DatePicker with calendar popup | Custom calendar grid with $state, no external date library needed for basic calendar |
| COMP-07 | Toast notifications (success, error, info) | Store-based toast system in .svelte.ts, auto-dismiss with setTimeout |
| COMP-08 | EmptyState and LoadingSkeleton components | Pure presentational, $props for variant configuration |
| COMP-09 | ConfirmDialog for destructive actions | Modal wrapper with confirm/cancel actions, danger variant |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Stack lock:** SvelteKit + TailwindCSS (frontend), NestJS (backend) -- no framework changes
- **Monorepo:** Turborepo + pnpm workspaces (`apps/api`, `apps/web`, `packages/shared`)
- **Auth contract:** JWT (15-min access) + HTTP-only cookie refresh (7 days), max 5 concurrent sessions
- **Shared package:** Source-level imports from `@ca-practice-os/shared` -- enums, DTOs, constants available
- **GSD workflow:** All edits through GSD commands

## Standard Stack

### Core (Already Installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @sveltejs/kit | 2.55.0 | Meta-framework -- routing, SSR, hooks | Already installed, project foundation |
| svelte | 5.55.0 | UI framework -- runes, components, reactivity | Already installed, Svelte 5 runes confirmed |
| tailwindcss | 4.2.2 | Utility CSS -- @theme directive, no config file | Already installed with @tailwindcss/vite plugin |
| vite | 6.x | Build tool, dev server, HMR | Already installed |
| @ca-practice-os/shared | workspace:* | Enums, types, constants shared with backend | Already installed, source-level imports |

### New Dependencies Required

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-svelte | 1.0.1 | Icon library -- tree-shakeable SVG icons | All icons throughout app (sidebar, topbar, buttons, empty states) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| lucide-svelte | heroicons, phosphor-icons | Lucide locked by user decision -- lightweight, consistent |
| Custom components | shadcn-svelte, skeleton UI | Custom locked by user decision -- full control, no bloat |
| No date library | date-fns | Only needed if DatePicker requires advanced formatting; defer to Phase 4+ |

**Installation:**
```bash
cd apps/web && pnpm add lucide-svelte
```

**Version verification:** lucide-svelte@1.0.1 confirmed from npm registry 2026-04-03. All other packages already installed with verified versions.

## Architecture Patterns

### Recommended Project Structure

```
apps/web/src/
  app.css              # TailwindCSS @import + @theme tokens
  app.html             # HTML shell with Inter font CDN link
  app.d.ts             # App.Locals, App.PageData type definitions
  hooks.server.ts      # Auth handle hook (JWT verification, refresh, redirect)
  lib/
    components/
      ui/              # Reusable primitives (DataTable, Modal, Button, etc.)
      layout/          # Shell components (Sidebar, Topbar, Breadcrumbs)
    stores/
      auth.svelte.ts   # Auth state (access token, user profile)
      toast.svelte.ts  # Toast notification queue
      sidebar.svelte.ts # Sidebar collapsed state
    utils/
      api.ts           # Authenticated fetch wrapper
      breadcrumbs.ts   # Route-to-breadcrumb label mapping
  routes/
    (auth)/            # Public route group (no sidebar/topbar)
      login/
        +page.svelte   # Login form
      register/
        +page.svelte   # Register form
      +layout.svelte   # Centered card layout
    (app)/             # Protected route group (sidebar/topbar)
      +layout.server.ts # Load user data from locals
      +layout.svelte    # App shell with sidebar + topbar
      +page.svelte      # Dashboard (redirect target post-login)
      clients/
        +page.svelte    # Placeholder for Phase 4
      engagements/
        +page.svelte    # Placeholder for Phase 4
      tasks/
        +page.svelte    # Placeholder for Phase 5
      team/
        +page.svelte    # Placeholder for Phase 6
      settings/
        +page.svelte    # Placeholder for Phase 6
    +layout.svelte      # Root layout (imports app.css)
    +layout.server.ts   # Root server layout (passes auth state to all pages)
```

### Pattern 1: SvelteKit Route Groups for Auth vs App

**What:** Separate public (auth) and protected (app) routes using parenthesized directory names.
**When to use:** Always -- this is the standard SvelteKit pattern for apps with authentication.

```
routes/
  (auth)/          # No auth required, centered card layout
    login/
    register/
    +layout.svelte # Gradient background, centered card
  (app)/           # Auth required, sidebar + topbar layout
    +layout.svelte # Sidebar + topbar shell
    +page.svelte   # Dashboard
```

Route groups don't affect URL paths. `/login` maps to `(auth)/login/+page.svelte`, `/` maps to `(app)/+page.svelte`.

### Pattern 2: Auth Guard via hooks.server.ts Handle Hook

**What:** Server-side auth check that runs BEFORE any load function or page render.
**When to use:** Every request. This is the ONLY safe place for auth guards in SvelteKit.
**Why not +layout.server.ts:** Layout load functions run in parallel with nested page loads -- data could leak before auth check completes.

```typescript
// src/hooks.server.ts
import { redirect, type Handle } from '@sveltejs/kit';

const PUBLIC_PATHS = ['/login', '/register'];

export const handle: Handle = async ({ event, resolve }) => {
  const { pathname } = event.url;

  // Skip auth for public routes
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return resolve(event);
  }

  // Get access token from cookie or header
  const accessToken = event.cookies.get('access_token');

  if (!accessToken) {
    // Try to refresh
    const refreshResult = await tryRefresh(event);
    if (!refreshResult) {
      throw redirect(303, '/login');
    }
    event.locals.accessToken = refreshResult.accessToken;
    event.locals.user = refreshResult.user;
  } else {
    // Decode JWT (don't verify signature client-side -- backend validates)
    event.locals.accessToken = accessToken;
  }

  return resolve(event);
};
```

**Critical detail:** The access token is stored in an HTTP-only cookie named `access_token` set by the SvelteKit server (NOT the NestJS backend). The NestJS backend returns it in the JSON response body. The SvelteKit hooks.server.ts receives it during login, stores it as a cookie for SSR requests, and passes it to the client via `event.locals` for client-side API calls.

### Pattern 3: Dual-Side Token Management

**What:** Access token lives in two places -- server-side cookie (for SSR) and client-side memory (for browser fetch).
**When to use:** This app with JWT access + HTTP-only refresh cookie.

**Flow:**
1. User submits login form -> SvelteKit form action or client fetch to `/api/auth/login`
2. Backend returns `{ accessToken, user }` + sets `refresh_token` HTTP-only cookie (path `/api/auth`)
3. SvelteKit server stores `accessToken` in a short-lived HTTP-only cookie (for SSR page loads)
4. Client-side auth store receives `accessToken` via page data for browser-initiated API calls
5. On 401, client calls `/api/auth/refresh` (refresh cookie sent automatically), gets new access token
6. On SSR, hooks.server.ts checks cookie, refreshes if expired, sets `event.locals`

### Pattern 4: Svelte 5 Rune-Based Stores

**What:** Use `.svelte.ts` files with `$state` for shared reactive state instead of Svelte 4 stores.
**When to use:** All shared state (auth, toast, sidebar).

```typescript
// src/lib/stores/auth.svelte.ts
import type { UserRole } from '@ca-practice-os/shared';

interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  firmId: string;
  firmName: string;
  avatarUrl: string | null;
}

// Use object pattern for cross-module reactivity
const authState = $state<{
  accessToken: string | null;
  user: AuthUser | null;
}>({
  accessToken: null,
  user: null,
});

export function getAccessToken(): string | null {
  return authState.accessToken;
}

export function setAuth(token: string, user: AuthUser): void {
  authState.accessToken = token;
  authState.user = user;
}

export function clearAuth(): void {
  authState.accessToken = null;
  authState.user = null;
}

export function getUser(): AuthUser | null {
  return authState.user;
}
```

**Key gotcha:** You cannot `export let count = $state(0)` from `.svelte.ts` files -- reassignment won't propagate. Always use the object pattern or getter functions.

### Pattern 5: Svelte 5 Component with $props and Snippets

**What:** Modern Svelte 5 component pattern using runes instead of `export let` and slots.
**When to use:** All new components.

```svelte
<!-- Button.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    disabled?: boolean;
    type?: 'button' | 'submit';
    onclick?: () => void;
    children: Snippet;
  }

  let {
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    type = 'button',
    onclick,
    children,
  }: Props = $props();

  const sizeClasses = {
    sm: 'h-9 px-3 text-sm',
    md: 'h-11 px-4 text-sm',
    lg: 'h-12 px-6 text-base',
  };

  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50',
    ghost: 'text-gray-600 hover:bg-gray-100',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };
</script>

<button
  {type}
  {disabled}
  class="inline-flex items-center justify-center rounded-md font-semibold
    transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600
    focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none
    {sizeClasses[size]} {variantClasses[variant]}"
  {onclick}
>
  {#if loading}
    <svg class="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24"><!-- spinner --></svg>
  {/if}
  {@render children()}
</button>
```

### Pattern 6: Authenticated API Fetch Wrapper

**What:** A fetch wrapper that attaches the JWT, handles 401 refresh, and provides typed responses.
**When to use:** Every API call from client-side code.

```typescript
// src/lib/utils/api.ts
import { getAccessToken, setAuth, clearAuth } from '$lib/stores/auth.svelte';
import { goto } from '$app/navigation';

const API_BASE = '/api'; // Vite proxy or SvelteKit endpoint

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function refreshToken(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include', // Sends refresh_token cookie
    });
    if (!res.ok) return false;
    const data = await res.json();
    // Update access token in memory
    setAuth(data.accessToken, /* current user */);
    return true;
  } catch {
    return false;
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(options.headers);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  headers.set('Content-Type', 'application/json');

  let res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  // Handle 401 -- try refresh once
  if (res.status === 401) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshToken();
    }
    const refreshed = await refreshPromise;
    isRefreshing = false;
    refreshPromise = null;

    if (refreshed) {
      // Retry original request with new token
      const newToken = getAccessToken();
      headers.set('Authorization', `Bearer ${newToken}`);
      res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
        credentials: 'include',
      });
    } else {
      clearAuth();
      goto('/login');
      throw new Error('Session expired');
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Request failed' }));
    throw error;
  }

  return res.json();
}
```

**Critical design decision -- API routing:** The SvelteKit dev server runs on port 5173 and the NestJS API on port 3000. Two options:

1. **Vite proxy** (recommended for dev): Configure `vite.config.ts` to proxy `/api` requests to `localhost:3000`. Zero code changes for prod where both may be behind same domain.
2. **SvelteKit server routes**: Create `+server.ts` endpoints that proxy to NestJS. More control but more boilerplate.

Use the Vite proxy approach:

```typescript
// vite.config.ts addition
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true,
    },
  },
},
```

### Pattern 7: TailwindCSS v4 @theme for Design Tokens

**What:** Define design tokens in app.css using the @theme directive instead of a config file.
**When to use:** Project uses TailwindCSS v4 with config-free CSS approach.

```css
/* app.css */
@import 'tailwindcss';

@theme {
  --font-sans: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
}
```

The existing Tailwind v4 default palette already includes all the colors from the UI-SPEC (gray-50 through gray-900, blue-600, red-600, green-600, amber-600, purple variants, indigo variants, orange variants). No need to override colors -- just define the custom font family.

### Anti-Patterns to Avoid

- **Auth check in +layout.server.ts only:** Layout loads run in parallel with page loads. A child page's server load could fire before the layout auth check completes. Always use hooks.server.ts for auth guards.
- **Storing JWT in localStorage:** XSS-vulnerable. Access token in memory ($state), refresh token in HTTP-only cookie.
- **export let for props in Svelte 5:** Deprecated. Use `let { prop } = $props()` everywhere.
- **<slot> in Svelte 5:** Deprecated. Use `{@render children()}` with snippets.
- **Svelte 4 stores (writable/readable):** Still work but inconsistent with the Svelte 5 rune system. Use `.svelte.ts` files with `$state` for new code.
- **$effect for derived values:** Use `$derived` for computed values, `$effect` only for side effects (DOM manipulation, timers, API calls).
- **Destructuring $state for use elsewhere:** Breaks reactivity. `const { count } = myState` captures the value at destructure time, not reactively.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Icons | Custom SVGs one by one | lucide-svelte | 1000+ consistent icons, tree-shakeable, maintained |
| CSS utility framework | Custom CSS classes | TailwindCSS v4 | Already installed, design system built on it |
| Form validation library | Full validation framework | $state + $derived | Simple enough for auth forms; CONTEXT locked this choice |
| Date formatting (if needed) | Custom date utilities | Native Intl.DateTimeFormat | Browser-native, no dependency, sufficient for display |
| Focus trap for modals | Custom tab-index management | Consider tiny lib if complex | Focus trapping has many edge cases (nested dialogs, shadow DOM) |
| Click-outside detection | addEventListener boilerplate | Svelte action `use:clickOutside` | Reusable pattern, 10-line Svelte action |

**Key insight:** The user explicitly locked "custom components with TailwindCSS" -- no third-party component library. But for cross-cutting concerns like icons and focus traps, small purpose-built libraries are appropriate.

## Common Pitfalls

### Pitfall 1: Refresh Token Cookie Path Mismatch
**What goes wrong:** The NestJS backend sets the refresh_token cookie with `path: '/api/auth'`. If SvelteKit tries to read this cookie from a different path, it won't be present.
**Why it happens:** Cookie path scoping. The refresh_token cookie is only sent to requests matching `/api/auth/*`.
**How to avoid:** When calling refresh, always POST to `/api/auth/refresh` (the cookie's path). The Vite proxy forwards this correctly. Don't try to read the refresh_token cookie from hooks.server.ts directly -- it won't be there for page requests.
**Warning signs:** Refresh works in browser console but fails during SSR page loads.

### Pitfall 2: SSR vs Client Token Availability
**What goes wrong:** Access token stored only in client memory isn't available during SSR. First page load after login may fail to fetch data.
**Why it happens:** $state stores only exist in the browser. During SSR, hooks.server.ts doesn't have access to client-side memory.
**How to avoid:** After login, store access token in a short-lived HTTP-only cookie (set by SvelteKit, not NestJS) so hooks.server.ts can read it during SSR. Pass it to client via event.locals -> +layout.server.ts -> page data.
**Warning signs:** Page works after client navigation but fails on hard refresh / direct URL access.

### Pitfall 3: Svelte 5 Cross-Module State Export
**What goes wrong:** `export let token = $state('')` in a .svelte.ts file -- reassignment from another module doesn't trigger reactivity.
**Why it happens:** The exported binding is captured at import time. Reassignment creates a new binding locally.
**How to avoid:** Always export an object (`export const auth = $state({ token: '' })`) or use getter/setter functions.
**Warning signs:** State updates in one component but not in others that import the same store.

### Pitfall 4: Route Group Layout Isolation
**What goes wrong:** Components in `(auth)` try to access user data that's only loaded in `(app)` layout.
**Why it happens:** Route groups have separate +layout.svelte files. Data loaded in one group's layout isn't available in another.
**How to avoid:** Load auth state in the root +layout.server.ts (not inside a route group), making it available everywhere. Route-group-specific layouts handle only visual differences (auth card vs app shell).
**Warning signs:** "Cannot read property of undefined" when accessing user data on login page.

### Pitfall 5: TailwindCSS v4 Purge Missing Dynamic Classes
**What goes wrong:** Dynamically constructed class names like `bg-${color}-600` are purged from the build.
**Why it happens:** TailwindCSS statically scans source for class names. Dynamic interpolation isn't detected.
**How to avoid:** Use complete class strings in lookup objects: `const colors = { primary: 'bg-blue-600', danger: 'bg-red-600' }`. Never construct class names from template literals.
**Warning signs:** Styles work in dev (JIT generates everything) but break in production build.

### Pitfall 6: Backend API Prefix
**What goes wrong:** Frontend calls `/auth/login` instead of `/api/auth/login`.
**Why it happens:** Forgetting that NestJS has `setGlobalPrefix('api')` (established in Phase 1).
**How to avoid:** All API calls must be prefixed with `/api/`. The fetch wrapper should enforce this.
**Warning signs:** 404 responses from the API.

## Code Examples

### Auth Hook Implementation (hooks.server.ts)

```typescript
// Source: SvelteKit docs + project auth architecture
import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';

const PUBLIC_PATHS = ['/login', '/register'];

const authHandle: Handle = async ({ event, resolve }) => {
  const { pathname } = event.url;

  // Public routes -- no auth needed
  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return resolve(event);
  }

  // Check for access token cookie (set by our login action)
  const accessToken = event.cookies.get('access_token');

  if (!accessToken) {
    // Try refresh via backend
    try {
      const refreshRes = await event.fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });

      if (refreshRes.ok) {
        const data = await refreshRes.json();
        event.cookies.set('access_token', data.accessToken, {
          path: '/',
          httpOnly: true,
          secure: false, // true in production
          sameSite: 'lax',
          maxAge: 60 * 14, // 14 minutes (slightly less than 15m JWT expiry)
        });
        event.locals.accessToken = data.accessToken;
      } else {
        throw redirect(303, '/login');
      }
    } catch (e) {
      if (e && typeof e === 'object' && 'status' in e) throw e; // re-throw redirect
      throw redirect(303, '/login');
    }
  } else {
    event.locals.accessToken = accessToken;
  }

  return resolve(event);
};

export const handle = sequence(authHandle);
```

### App.d.ts Type Definitions

```typescript
// src/app.d.ts
import type { UserRole } from '@ca-practice-os/shared';

declare global {
  namespace App {
    interface Locals {
      accessToken: string;
      user?: {
        id: string;
        email: string;
        fullName: string;
        role: UserRole;
        firmId: string;
        firmName: string;
        avatarUrl: string | null;
      };
    }
    interface PageData {
      user?: App.Locals['user'];
      accessToken?: string;
    }
    interface Error {
      message: string;
      statusCode?: number;
    }
  }
}

export {};
```

### Root Layout Server Load

```typescript
// src/routes/+layout.server.ts
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  return {
    user: locals.user ?? null,
    accessToken: locals.accessToken ?? null,
  };
};
```

### Toast Store with Svelte 5 Runes

```typescript
// src/lib/stores/toast.svelte.ts
type ToastVariant = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

const MAX_VISIBLE = 3;

const toasts = $state<Toast[]>([]);

export function addToast(message: string, variant: ToastVariant = 'info'): void {
  const id = crypto.randomUUID();
  toasts.push({ id, message, variant });

  // Trim to max visible
  if (toasts.length > MAX_VISIBLE) {
    toasts.splice(0, toasts.length - MAX_VISIBLE);
  }

  // Auto-dismiss
  const delay = variant === 'error' ? 8000 : 4000;
  setTimeout(() => removeToast(id), delay);
}

export function removeToast(id: string): void {
  const index = toasts.findIndex(t => t.id === id);
  if (index !== -1) toasts.splice(index, 1);
}

export function getToasts(): Toast[] {
  return toasts;
}
```

### Sidebar State Store

```typescript
// src/lib/stores/sidebar.svelte.ts
const STORAGE_KEY = 'sidebar-collapsed';

function getInitial(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

const sidebarState = $state({ collapsed: false });

// Initialize from localStorage (called from client-side layout)
export function initSidebar(): void {
  sidebarState.collapsed = getInitial();
}

export function toggleSidebar(): void {
  sidebarState.collapsed = !sidebarState.collapsed;
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, String(sidebarState.collapsed));
  }
}

export function setSidebarCollapsed(value: boolean): void {
  sidebarState.collapsed = value;
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, String(value));
  }
}

export function isSidebarCollapsed(): boolean {
  return sidebarState.collapsed;
}
```

### Vite Proxy Configuration

```typescript
// vite.config.ts -- add server.proxy for API proxying in dev
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
```

### Inter Font CDN in app.html

```html
<!-- Add to <head> in app.html -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet" />
```

### TailwindCSS v4 @theme Tokens in app.css

```css
@import 'tailwindcss';

@theme {
  --font-sans: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
}
```

No color overrides needed -- Tailwind v4 default palette already includes all colors referenced in the UI-SPEC (gray-*, blue-*, red-*, green-*, amber-*, purple-*, indigo-*, orange-*).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `export let prop` | `let { prop } = $props()` | Svelte 5 (Oct 2024) | All components use runes |
| `<slot>` / `<slot name="x">` | `{@render children()}` / snippets | Svelte 5 (Oct 2024) | DataTable, Modal use snippets |
| `writable()` / `readable()` stores | `.svelte.ts` with `$state` | Svelte 5 (Oct 2024) | Auth, toast, sidebar stores |
| `$:` reactive declarations | `$derived()` / `$effect()` | Svelte 5 (Oct 2024) | Computed values, side effects |
| `tailwind.config.js` | `@theme` in CSS | TailwindCSS v4 (Jan 2025) | Design tokens in app.css |
| `@apply` heavy components | Utility classes in markup | Industry trend | More maintainable, less indirection |

**Deprecated/outdated:**
- `export let` for component props -- use `$props()` rune
- `<slot>` elements -- use `{@render}` with snippets
- `$:` reactive labels -- use `$derived()` or `$effect()`
- Svelte stores (`writable`, `readable`, `derived`) -- use `.svelte.ts` with `$state`
- `onMount`, `onDestroy` lifecycle -- use `$effect()` for mount/cleanup patterns
- `tailwind.config.js` / `tailwind.config.ts` -- use CSS-first `@theme` directive

## Open Questions

1. **Vite proxy vs SvelteKit server endpoints for API**
   - What we know: Vite proxy works great in dev. In production, the API and frontend will likely be behind the same domain or a reverse proxy.
   - What's unclear: Production deployment topology (same domain? separate domains? CloudFront + ALB?).
   - Recommendation: Use Vite proxy for dev. Production will use reverse proxy (nginx/CloudFront) to route `/api` to NestJS. No code change needed since relative URLs work in both cases.

2. **DatePicker complexity**
   - What we know: COMP-06 requires a DatePicker with calendar popup. Building a fully accessible calendar from scratch is non-trivial.
   - What's unclear: How feature-rich does V1 need to be? Range selection? Min/max constraints? Keyboard nav?
   - Recommendation: Build a basic calendar grid with single-date selection for V1. Min/max prop support. Defer range selection and advanced keyboard nav. If it turns out too complex, a tiny library like `@melt-ui/svelte` headless date picker could be considered.

3. **Focus trap implementation for Modal**
   - What we know: UI-SPEC specifies "Focus trap: tab cycles within modal while open". This is an accessibility requirement.
   - What's unclear: Whether to hand-roll or use a tiny utility.
   - Recommendation: Implement a simple `use:focusTrap` Svelte action. It's about 20-30 lines for basic tab cycling. If edge cases emerge (nested modals, iframes), consider `focus-trap` npm package later.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Yes | 22.21.1 | -- |
| pnpm | Package management | Yes | (in monorepo) | -- |
| SvelteKit | Framework | Yes | 2.55.0 | -- |
| Svelte | UI | Yes | 5.55.0 | -- |
| TailwindCSS | Styling | Yes | 4.2.2 | -- |
| Vite | Build | Yes | 6.x | -- |
| lucide-svelte | Icons | No (needs install) | 1.0.1 (latest) | -- |
| NestJS API (dev) | Backend for auth | Yes (Phase 2 complete) | -- | -- |
| PostgreSQL | Backend data | Yes (Docker) | 16 | -- |
| Redis | Sessions | Yes (Docker) | 7 | -- |

**Missing dependencies with no fallback:**
- `lucide-svelte` must be installed (single `pnpm add` command)

**Missing dependencies with fallback:**
- None -- all required infrastructure is in place.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None currently installed |
| Config file | none -- see Wave 0 |
| Quick run command | `pnpm --filter web test` (after setup) |
| Full suite command | `pnpm --filter web test` (after setup) |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHELL-01 | Login page renders, submits, handles errors | integration/e2e | Manual browser test | N/A Wave 0 |
| SHELL-02 | Register page renders, submits, handles errors | integration/e2e | Manual browser test | N/A Wave 0 |
| SHELL-03 | Sidebar renders, collapses, navigates | integration/e2e | Manual browser test | N/A Wave 0 |
| SHELL-04 | Topbar renders user menu, notification bell | integration/e2e | Manual browser test | N/A Wave 0 |
| SHELL-05 | Breadcrumbs update based on route | unit | `vitest run breadcrumbs.test.ts` | N/A Wave 0 |
| SHELL-06 | Responsive sidebar behavior | manual-only | Manual viewport resize | N/A |
| SHELL-07 | Auth guard redirects unauthenticated users | integration | Manual test + server hook test | N/A Wave 0 |
| SHELL-08 | JWT in memory, refresh via hooks | integration | Manual test flow | N/A Wave 0 |
| COMP-01 | DataTable sorts, paginates, configures columns | unit | `vitest run DataTable.test.ts` | N/A Wave 0 |
| COMP-02 | Modal opens, closes, traps focus | unit | `vitest run Modal.test.ts` | N/A Wave 0 |
| COMP-03 | FormField renders label, error, help text | unit | `vitest run FormField.test.ts` | N/A Wave 0 |
| COMP-04 | StatusBadge renders correct colors for each status | unit | `vitest run StatusBadge.test.ts` | N/A Wave 0 |
| COMP-05 | UserPicker/ClientPicker search and select | unit | `vitest run Pickers.test.ts` | N/A Wave 0 |
| COMP-06 | DatePicker calendar popup, date selection | unit | `vitest run DatePicker.test.ts` | N/A Wave 0 |
| COMP-07 | Toast auto-dismiss, stacking, variants | unit | `vitest run Toast.test.ts` | N/A Wave 0 |
| COMP-08 | EmptyState/LoadingSkeleton render variants | unit | `vitest run EmptyState.test.ts` | N/A Wave 0 |
| COMP-09 | ConfirmDialog renders, confirms, cancels | unit | `vitest run ConfirmDialog.test.ts` | N/A Wave 0 |

### Sampling Rate
- **Per task commit:** Manual visual verification in browser (dev server)
- **Per wave merge:** Full visual walkthrough of all auth flows + component rendering
- **Phase gate:** All pages render, auth flow works end-to-end, all components render with correct props

### Wave 0 Gaps
- [ ] No test framework installed -- `vitest` + `@testing-library/svelte` + `jsdom` needed
- [ ] No test config -- `vitest.config.ts` needed in apps/web/
- [ ] No test files exist for any component
- [ ] Recommendation: Given the aggressive timeline and visual-heavy nature of this phase, **prioritize manual visual testing** over automated unit tests. Component unit tests can be backfilled. The auth flow end-to-end is the critical gate.

*(Note: For this phase, visual/interaction testing via dev server is more valuable than unit tests. The components are UI-heavy and best verified visually. Unit tests for utilities like breadcrumb generation and the toast store are worthwhile.)*

## Sources

### Primary (HIGH confidence)
- SvelteKit official docs (svelte.dev/docs/kit/hooks) -- handle hook, sequence, event.locals
- SvelteKit official docs (svelte.dev/docs/kit/types) -- app.d.ts, App.Locals interface
- SvelteKit official docs (svelte.dev/docs/kit/auth) -- auth patterns, security recommendations
- Svelte 5 official docs (svelte.dev/docs/svelte/$state) -- $state, $state.raw, cross-module export pattern
- Svelte 5 official docs (svelte.dev/docs/svelte/$props) -- $props, default values, typing, $props.id()
- Svelte 5 official docs (svelte.dev/docs/svelte/snippet) -- snippets, {@render}, children, typing Snippet<T>
- TailwindCSS v4 official docs (tailwindcss.com/docs/theme) -- @theme directive, namespace tokens, CSS variables
- Codebase inspection -- auth.controller.ts, auth.service.ts, auth.constants.ts, JWT payload interface
- npm registry -- lucide-svelte@1.0.1, verified 2026-04-03

### Secondary (MEDIUM confidence)
- SvelteKit GitHub discussions (#6779, #5173) -- global 401 handling patterns, fetch wrapper idioms
- okupter.com/blog/handling-auth-with-jwt-in-sveltekit -- JWT auth hook pattern
- gebna.gg/blog/protected-routes-svelte-kit -- why hooks.server.ts over +layout.server.ts for auth
- mainmatter.com/blog/2025/03/11/global-state-in-svelte-5 -- runes global state patterns

### Tertiary (LOW confidence)
- None -- all findings verified with official sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages verified from installed node_modules and npm registry
- Architecture: HIGH -- patterns verified against official SvelteKit/Svelte 5 docs and codebase inspection
- Pitfalls: HIGH -- derived from official docs warnings, GitHub issues, and known JWT/cookie patterns
- Auth flow: HIGH -- backend implementation inspected directly (auth.controller.ts, auth.service.ts)

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (stable ecosystem, major versions locked)
