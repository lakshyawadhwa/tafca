# Phase 3: Frontend Foundation - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

The SvelteKit app has a complete authenticated shell (login, register, sidebar, topbar, breadcrumbs) and a library of reusable UI components ready for feature pages. This phase builds the frontend infrastructure that all subsequent feature pages (Phases 4-6) depend on.

</domain>

<decisions>
## Implementation Decisions

### Visual Design & Theming
- Professional blue-gray color scheme (primary blue-600, neutral grays) — clean, trustworthy feel for CA firms
- Lucide icons — lightweight, tree-shakeable, consistent style
- Inter font via CDN — clean sans-serif, excellent readability for data-heavy UIs
- Light mode only for V1 — ship faster, add dark mode in V1.1

### App Shell Layout
- Fixed left sidebar, 240px expanded / 64px collapsed — standard SaaS pattern
- Toggle button on desktop, auto-collapse on mobile (<768px)
- Topbar: breadcrumbs left, notification bell + user avatar/menu right
- Navigation items: Dashboard, Clients, Engagements, Tasks, Team, Settings

### Auth Pages UX
- Centered card on subtle gradient background — clean, focused, professional
- Post-login redirect to Dashboard (/) — shows "my tasks" immediately
- Inline field errors + top-level toast for server errors — clear, non-blocking feedback
- Single-page register: firm name, full name, email, password, confirm password

### Component Library Approach
- Custom Svelte 5 components with TailwindCSS — full control, no dependency bloat
- Custom DataTable with slot-based columns, built-in sort/pagination/loading
- Reactive validation using Svelte 5 runes ($state + $derived) — no extra lib
- Custom store-based toasts with auto-dismiss — lightweight, full control

### Claude's Discretion
- Exact Tailwind color palette values and spacing scale
- Component API design (prop names, slot patterns)
- File organization within src/lib/components/
- Breadcrumb generation strategy (route-based vs manual)
- Toast positioning and animation details

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Shared package enums: UserRole, TaskStatus, TaskPriority, ClientStatus, EngagementStatus, etc.
- Shared constants: LIMITS (session limits, etc.), REGEX_PATTERNS (PAN, TAN, CIN, GSTIN validation)
- Shared types: Address, FirmSettings, NotificationPreferences
- TailwindCSS v4 already configured with @tailwindcss/vite plugin (config-free, CSS @import approach)
- Svelte 5 with runes ($props, $state, $derived) — confirmed in +layout.svelte

### Established Patterns
- SvelteKit app at apps/web/ with standard routes/ structure
- Vite 6 + @sveltejs/kit v2 + Svelte 5
- app.css uses `@import 'tailwindcss'` (TW v4 style)
- Minimal scaffold exists: root layout, placeholder home page

### Integration Points
- Backend auth endpoints: POST /api/auth/register, POST /api/auth/login, POST /api/auth/refresh, POST /api/auth/logout, GET /api/auth/me, POST /api/auth/change-password
- JWT access token (15min) stored in memory, refresh via HTTP-only cookie
- SvelteKit hooks for auth guard (handle hook intercepts requests)
- API proxy or direct fetch to NestJS backend (localhost:3000 in dev)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. All recommended answers accepted across all 4 grey areas.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
