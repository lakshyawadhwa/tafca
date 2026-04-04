# Roadmap: CA Practice OS

## Overview

CA Practice OS goes from zero to a working multi-tenant practice management platform in 6 phases. The build starts with infrastructure and auth (the base everything depends on), then layers on the frontend shell and component library so feature pages can be built full-stack from Phase 4 onward. Clients and engagements come next as the first domain entities, followed by the task engine (the core value prop), and finally notifications, team management, dashboard, and admin features to complete the V1.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation & Infrastructure** - Monorepo scaffolding, Prisma schema, multi-tenancy enforcement, and error handling
- [ ] **Phase 2: Authentication & Core Backend Services** - Auth system, user management, and action logging interceptor
- [ ] **Phase 3: Frontend Foundation** - App shell (sidebar, topbar, breadcrumbs), auth pages, and shared component library
- [ ] **Phase 4: Client & Engagement Management** - Full-stack client CRUD with GST numbers, engagement lifecycle with task template instantiation, and their frontend pages
- [ ] **Phase 5: Task Engine** - Full-stack task management with status machine, checklists, dependencies, comments, activity log, and task list/detail pages
- [ ] **Phase 6: Notifications, Team, Dashboard & Admin** - In-app notifications, team workload, leave management, dashboard, audit log, recently deleted, and settings pages

## Phase Details

### Phase 1: Foundation & Infrastructure
**Goal**: A running monorepo where both apps start, the database schema exists with multi-tenant isolation, and every request gets consistent error handling
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06, FOUND-07, FOUND-08, TENANT-01, TENANT-02, TENANT-03, TENANT-04, ERR-01, ERR-02, ERR-03
**Success Criteria** (what must be TRUE):
  1. Developer runs `pnpm dev` and both NestJS API and SvelteKit web app start successfully
  2. `docker compose up` brings up PostgreSQL, Redis, and MinIO; Prisma migration creates all tables
  3. A query through the Prisma client for Firm A never returns data belonging to Firm B
  4. Any API error returns a consistent JSON response with statusCode, message, error, and request_id
  5. `GET /api/health` returns 200 with DB and Redis connectivity status
**Plans**: 3 plans

Plans:
- [x] 01-01: Monorepo scaffolding and Docker infrastructure
- [x] 01-02: Prisma schema and multi-tenancy extension
- [x] 01-03: Error handling, request logging, and health check

### Phase 2: Authentication & Core Backend Services
**Goal**: Users can register firms, log in securely, and all mutations are audit-logged -- the auth and user foundation that every feature depends on
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08, AUTH-09, USER-01, USER-02, USER-03, USER-04, USER-05, AUDIT-01, AUDIT-02, AUDIT-03, AUDIT-04, AUDIT-05
**Success Criteria** (what must be TRUE):
  1. A new user can register a firm with email/password and receive a JWT access token plus HTTP-only refresh cookie
  2. A logged-in user can refresh their access token, and logging in on a 6th device evicts the oldest session
  3. An Admin or Partner can create, list, update, and deactivate users within their firm
  4. Every POST/PATCH/PUT/DELETE request creates an immutable audit log entry without blocking the response
  5. A Partner or Admin can view the audit log filtered by user, entity type, action, and date range
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md -- Auth module: register, login, JWT with session kill-switch, refresh tokens, logout, max 5 sessions, rate limiting, GET /me
- [x] 02-02-PLAN.md -- User management (list, create, update, deactivate) and action logging interceptor with audit log query endpoint

### Phase 3: Frontend Foundation
**Goal**: The SvelteKit app has a complete authenticated shell (login, register, sidebar, topbar, breadcrumbs) and a library of reusable UI components ready for feature pages
**Depends on**: Phase 2
**Requirements**: SHELL-01, SHELL-02, SHELL-03, SHELL-04, SHELL-05, SHELL-06, SHELL-07, SHELL-08, COMP-01, COMP-02, COMP-03, COMP-04, COMP-05, COMP-06, COMP-07, COMP-08, COMP-09
**Success Criteria** (what must be TRUE):
  1. User can log in on the login page and is redirected to the dashboard; unauthenticated users are redirected to login
  2. Authenticated pages show a collapsible sidebar with navigation items and a topbar with user menu and notification bell
  3. The sidebar collapses to icons on mobile viewports and breadcrumbs update based on the current route
  4. All shared components (DataTable, Modal, FormField, StatusBadge, Pickers, DatePicker, Toast, EmptyState, LoadingSkeleton, ConfirmDialog) render correctly and are importable by feature pages
**Plans**: 3 plans
**UI hint**: yes

Plans:
- [ ] 03-01-PLAN.md -- Auth pages (login, register), SvelteKit auth hooks, design system foundation, stores, API wrapper
- [ ] 03-02-PLAN.md -- App shell layout (sidebar, topbar, breadcrumbs, user menu, responsive behavior, placeholder pages)
- [ ] 03-03-PLAN.md -- Shared UI component library (DataTable, Modal, FormField, StatusBadge, Pickers, DatePicker, EmptyState, LoadingSkeleton, ConfirmDialog)

### Phase 4: Client & Engagement Management
**Goal**: Users can manage their client base with validated PAN/TAN/CIN/GST data and create engagements that optionally instantiate task chains from templates -- the first real domain workflow
**Depends on**: Phase 3
**Requirements**: CLIENT-01, CLIENT-02, CLIENT-03, CLIENT-04, CLIENT-05, CLIENT-06, CLIENT-07, CLIENT-08, CLIENT-09, ENG-01, ENG-02, ENG-03, ENG-04, ENG-05, ENG-06, ENG-07, ENG-08, PAGE-01, PAGE-02, PAGE-03
**Success Criteria** (what must be TRUE):
  1. User can create a client with display name, entity type, PAN/TAN/CIN, contact info, and team assignment -- with format validation rejecting invalid PAN/TAN/CIN/GSTIN
  2. User can list clients with pagination, search by name/PAN, and filter by status, entity type, tag, or assigned partner
  3. User can view a client detail page with tabs showing overview (with editable fields and GST numbers), engagements, and tasks
  4. User can create an engagement linked to a client and type, with auto-generated name, inherited partner/manager, and optional task chain instantiation from template
  5. Completing an engagement is blocked if open tasks exist; cancelling an engagement auto-cancels its open tasks
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 04-01: Client backend (CRUD, GST numbers, validation)
- [ ] 04-02: Engagement backend (CRUD, lifecycle, template instantiation)
- [ ] 04-03: Client and engagement frontend pages

### Phase 5: Task Engine
**Goal**: Users can manage tasks with enforced status transitions, checklists, dependencies, comments, and activity tracking -- the core value proposition of the platform
**Depends on**: Phase 4
**Requirements**: TASK-01, TASK-02, TASK-03, TASK-04, TASK-05, TASK-06, TASK-07, TASK-08, TASK-09, TASK-10, TASK-11, TASK-12, TASK-13, PAGE-04, PAGE-05
**Success Criteria** (what must be TRUE):
  1. User can create tasks (standalone or engagement-bound) and transition their status through the allowed-transitions matrix -- invalid transitions return an error listing what transitions are allowed
  2. Marking a task DONE is blocked when required checklist items are incomplete; completing a predecessor task emits a DEPENDENCY_UNBLOCKED notification
  3. User can view the task list in both table view (sortable, filterable by assignee/client/status/priority/due date/overdue) and Kanban view (drag-to-change-status)
  4. Task detail page shows status controls, editable fields, checklist with toggle, dependencies, threaded comments with @mentions, and activity timeline
  5. Every task mutation is recorded in the activity log with actor, old/new values, and timestamp
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 05-01: Task backend (CRUD, status machine, internal due dates)
- [ ] 05-02: Task sub-resources (checklists, dependencies, comments, activity log)
- [ ] 05-03: Task frontend (list with table/Kanban views, detail page)

### Phase 6: Notifications, Team, Dashboard & Admin
**Goal**: The platform is complete with in-app notifications, team workload visibility, leave management, a dashboard landing page, and admin tools (audit log, recently deleted, settings, user management pages)
**Depends on**: Phase 5
**Requirements**: NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-04, TEAM-01, TEAM-02, TEAM-03, TEAM-04, DEL-01, DEL-02, DEL-03, PAGE-06, PAGE-07, PAGE-08, PAGE-09, PAGE-10, PAGE-11, PAGE-12
**Success Criteria** (what must be TRUE):
  1. User receives in-app notifications for task assignment, status changes, comment mentions, and dependency unblocking -- and can view, mark-read, and mark-all-read
  2. User can view a dashboard showing their overdue/today/this-week tasks, approval queue (Partner/Manager), and recent notifications
  3. User can view team workload (open tasks, overdue count, load status per person) and submit/approve/reject leave requests
  4. Partner/Admin can view recently deleted records across all entity types and restore any record within 30 days
  5. Firm settings, user management, and audit log pages are accessible and functional
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 06-01: Notification backend and team/workload/leave backend
- [ ] 06-02: Recently deleted backend and remaining API endpoints
- [ ] 06-03: Dashboard, team, admin, and settings frontend pages

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Infrastructure | 0/3 | Not started | - |
| 2. Authentication & Core Backend Services | 0/2 | Not started | - |
| 3. Frontend Foundation | 0/3 | Not started | - |
| 4. Client & Engagement Management | 0/3 | Not started | - |
| 5. Task Engine | 0/3 | Not started | - |
| 6. Notifications, Team, Dashboard & Admin | 0/3 | Not started | - |
