---
phase: 03-frontend-foundation
plan: 02
subsystem: ui
tags: [sveltekit, svelte5, tailwindcss, sidebar, topbar, breadcrumbs, layout, responsive, lucide]

# Dependency graph
requires:
  - phase: 03-frontend-foundation
    plan: 01
    provides: "Auth guard (hooks.server.ts), auth store, API wrapper, toast store, Button/Input components, login/register pages"
provides:
  - "Collapsible sidebar with 6 nav items and localStorage persistence"
  - "Topbar with breadcrumbs, notification bell, and user menu dropdown"
  - "Breadcrumb utility generating route-based breadcrumb trail"
  - "UserMenu with sign-out flow (API call + clearAuth + redirect)"
  - "App shell layout composing Sidebar + Topbar + content area"
  - "Responsive behavior: 240px desktop, 64px tablet, mobile overlay"
  - "Placeholder pages for Dashboard, Clients, Engagements, Tasks, Team, Settings"
affects: [04-client-engagement, 05-task-engine, 06-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns: [sidebar-store-localstorage, breadcrumb-route-mapping, app-route-group-layout, responsive-sidebar-overlay, click-outside-action]

key-files:
  created:
    - apps/web/src/lib/stores/sidebar.svelte.ts
    - apps/web/src/lib/utils/breadcrumbs.ts
    - apps/web/src/lib/components/layout/Sidebar.svelte
    - apps/web/src/lib/components/layout/Topbar.svelte
    - apps/web/src/lib/components/layout/Breadcrumbs.svelte
    - apps/web/src/lib/components/layout/UserMenu.svelte
    - apps/web/src/routes/(app)/+layout.svelte
    - apps/web/src/routes/(app)/+layout.server.ts
    - apps/web/src/routes/(app)/+page.svelte
    - apps/web/src/routes/(app)/clients/+page.svelte
    - apps/web/src/routes/(app)/engagements/+page.svelte
    - apps/web/src/routes/(app)/tasks/+page.svelte
    - apps/web/src/routes/(app)/team/+page.svelte
    - apps/web/src/routes/(app)/settings/+page.svelte
  modified:
    - apps/web/src/routes/+page.svelte (removed — replaced by (app)/+page.svelte)

key-decisions:
  - "Sidebar state uses $state object with exported functions (same pattern as auth store) for cross-module reactivity"
  - "Mobile sidebar uses overlay mode with backdrop — separate mobileOpen state from collapsed state"
  - "(app) route group wraps all authenticated pages, providing sidebar + topbar layout via +layout.svelte"
  - "Removed root +page.svelte — Dashboard now served from (app)/+page.svelte with full app shell"

patterns-established:
  - "Sidebar store pattern: .svelte.ts with $state + localStorage persistence + matchMedia listener for responsive"
  - "Breadcrumb pattern: route-based with ROUTE_LABELS map, UUID detection, always starts with Dashboard"
  - "App shell pattern: (app) route group with +layout.svelte composing Sidebar + Topbar + content area"
  - "UserMenu pattern: clickOutside action + Escape key for dropdown close, api() call for sign-out"

requirements-completed: [SHELL-03, SHELL-04, SHELL-05, SHELL-06]

# Metrics
duration: 4min
completed: 2026-04-04
---

# Phase 3 Plan 2: App Shell & Navigation Summary

**Collapsible sidebar with 6 nav items, topbar with breadcrumbs and user menu, responsive layout with mobile overlay, and placeholder pages for all main routes**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-04T15:24:32Z
- **Completed:** 2026-04-04T15:29:04Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments

- Full app shell with collapsible sidebar (240px expanded / 64px collapsed), topbar with breadcrumbs and user menu
- Sidebar navigation for Dashboard, Clients, Engagements, Tasks, Team, Settings with active state highlighting (blue-50 bg, blue-600 text, left border accent)
- Responsive behavior: desktop (expanded), tablet (collapsed), mobile (hidden with overlay toggle)
- UserMenu dropdown with Profile, Settings, divider, Sign out (red) — sign out calls API, clears auth, redirects to /login
- Breadcrumbs auto-generated from current route with clickable ancestors and non-clickable current page
- Sidebar state persists in localStorage and auto-collapses on mobile via matchMedia listener

## Task Commits

Each task was committed atomically:

1. **Task 1: Sidebar store, breadcrumb utility, and layout components** - `66a9c76` (feat)
2. **Task 2: App shell layout, placeholder pages, and responsive behavior** - `8dada42` (feat)

## Files Created/Modified

- `apps/web/src/lib/stores/sidebar.svelte.ts` - Sidebar collapsed/mobileOpen state with localStorage persistence
- `apps/web/src/lib/utils/breadcrumbs.ts` - Route-to-breadcrumb mapping with ROUTE_LABELS and UUID detection
- `apps/web/src/lib/components/layout/Sidebar.svelte` - Collapsible sidebar with 6 nav items, mobile overlay, toggle button
- `apps/web/src/lib/components/layout/Topbar.svelte` - Top bar with breadcrumbs, notification bell, user menu, mobile hamburger
- `apps/web/src/lib/components/layout/Breadcrumbs.svelte` - Route-derived breadcrumb trail with clickable segments
- `apps/web/src/lib/components/layout/UserMenu.svelte` - User avatar/initials dropdown with sign-out flow
- `apps/web/src/routes/(app)/+layout.server.ts` - Server load returning user + accessToken for authenticated layout
- `apps/web/src/routes/(app)/+layout.svelte` - App shell composing Sidebar + Topbar + content area with responsive margins
- `apps/web/src/routes/(app)/+page.svelte` - Dashboard page with welcome message
- `apps/web/src/routes/(app)/clients/+page.svelte` - Clients placeholder (Phase 4)
- `apps/web/src/routes/(app)/engagements/+page.svelte` - Engagements placeholder (Phase 4)
- `apps/web/src/routes/(app)/tasks/+page.svelte` - Tasks placeholder (Phase 5)
- `apps/web/src/routes/(app)/team/+page.svelte` - Team placeholder (Phase 6)
- `apps/web/src/routes/(app)/settings/+page.svelte` - Settings placeholder (Phase 6)

## Decisions Made

- **Separate mobileOpen from collapsed state:** The sidebar needs two independent booleans — `collapsed` tracks desktop toggle (persisted to localStorage), `mobileOpen` tracks mobile overlay visibility (never persisted). This prevents mobile interactions from corrupting desktop preference.
- **(app) route group for authenticated shell:** Using SvelteKit's route group `(app)` to wrap all authenticated pages with the sidebar + topbar layout. This cleanly separates auth pages (login/register) which use a different layout.
- **Removed root +page.svelte:** The Dashboard now lives at `(app)/+page.svelte` which inherits the app shell layout. The old root `+page.svelte` was a scaffold placeholder — removing it avoids route conflicts.
- **clickOutside action from 03-03:** The UserMenu uses the clickOutside action already created in plan 03-03 (which was executed before 03-02 due to wave independence). This avoids duplication.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

| File | Line | Stub | Reason |
|------|------|------|--------|
| `(app)/clients/+page.svelte` | 11 | "Coming soon" placeholder | Intentional — will be replaced by Phase 4 client management page |
| `(app)/engagements/+page.svelte` | 11 | "Coming soon" placeholder | Intentional — will be replaced by Phase 4 engagement page |
| `(app)/tasks/+page.svelte` | 11 | "Coming soon" placeholder | Intentional — will be replaced by Phase 5 task management page |
| `(app)/team/+page.svelte` | 11 | "Coming soon" placeholder | Intentional — will be replaced by Phase 6 team page |
| `(app)/settings/+page.svelte` | 11 | "Coming soon" placeholder | Intentional — will be replaced by Phase 6 settings page |
| `Topbar.svelte` | 41 | Notification dot commented out | Intentional — no notifications backend yet, HTML structure ready |

All stubs are intentional placeholders per the plan. The plan's goal is the app shell container, not the feature pages. Each placeholder references the specific future phase that will replace it.

## Issues Encountered

None - plan executed cleanly. Build passes with zero errors.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- App shell is complete — all authenticated routes wrapped with sidebar + topbar layout
- Six navigation routes work end-to-end with correct breadcrumbs
- Sidebar collapse/expand persists across page reloads via localStorage
- Responsive breakpoints implemented: desktop (expanded), tablet (collapsed), mobile (overlay)
- Sign-out flow wired through API wrapper with auth store clear and redirect
- Placeholder pages ready for Phases 4-6 to replace with real feature pages
- Layout components (Sidebar, Topbar, Breadcrumbs, UserMenu) are reusable and well-structured

## Self-Check: PASSED

All 14 files verified present. Both commit hashes (66a9c76, 8dada42) confirmed in git log.

---
*Phase: 03-frontend-foundation*
*Completed: 2026-04-04*
