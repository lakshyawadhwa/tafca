# CA Practice OS — V1 Test Plan & App Assessment

> Generated: 2026-04-06
> Scope: Full-stack manual testing of V1 MVP

---

## Table of Contents

1. [Test Environment Setup](#1-test-environment-setup)
2. [User Flows & Test Cases](#2-user-flows--test-cases)
3. [What Works (Strengths)](#3-what-works-strengths)
4. [What Doesn't Work (Bugs/Gaps)](#4-what-doesnt-work-bugsgaps)
5. [Improvements to Make](#5-improvements-to-make)
6. [What to Lose (Cut/Simplify)](#6-what-to-lose-cutsimplify)
7. [What to Add](#7-what-to-add)

---

## 1. Test Environment Setup

### Prerequisites
```bash
docker compose up -d          # Postgres, Redis, MinIO
pnpm db:migrate               # Run Prisma migrations
pnpm db:seed                  # Seed engagement types + templates
pnpm dev                      # Start API (:3000) + Web (:5173)
```

### Test Accounts to Create
| # | Role | Email | Purpose |
|---|------|-------|---------|
| 1 | PARTNER | partner@testfirm.com | Full access, approvals |
| 2 | MANAGER | manager@testfirm.com | Team management, reviews |
| 3 | JUNIOR_CA | junior@testfirm.com | Task execution, limited access |
| 4 | ARTICLE | article@testfirm.com | Lowest role, assignment only |

---

## 2. User Flows & Test Cases

### FLOW 1: Firm Registration & First Login

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| 1.1 | Register new firm | Go to `/register`, fill firm name + full name + email + password (8+ chars) | Account created, redirected to dashboard | P0 |
| 1.2 | Register — duplicate email | Register with an email that already exists | Error toast: "Email already in use" | P0 |
| 1.3 | Register — weak password | Enter password < 8 chars | Validation error shown | P1 |
| 1.4 | Register — empty fields | Submit with blank fields | HTML5 validation or API error | P1 |
| 1.5 | Login with valid credentials | Go to `/login`, enter registered email + password | Logged in, redirected to dashboard | P0 |
| 1.6 | Login — wrong password | Enter incorrect password | Error toast: "Invalid credentials" | P0 |
| 1.7 | Login — deactivated account | Login as a deactivated user | 403 error: "Account deactivated" | P1 |
| 1.8 | Login — account lockout | Enter wrong password 10 times | Account locked for 30 min, appropriate error | P2 |
| 1.9 | Session persistence | Login, close tab, reopen app | Should auto-refresh token via cookie, stay logged in | P0 |
| 1.10 | Logout | Click "Sign out" in sidebar | Redirected to `/login`, session destroyed | P0 |
| 1.11 | Auth guard — unauthenticated | Visit `/tasks` without logging in | Redirected to `/login` | P0 |
| 1.12 | Auth guard — authenticated on login page | Visit `/login` while logged in | Redirected to `/` (dashboard) | P1 |

---

### FLOW 2: Dashboard

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| 2.1 | Dashboard loads | Login, land on `/` | Shows summary cards: Overdue, Due Today, Due This Week, In Review | P0 |
| 2.2 | Empty dashboard | New firm with no tasks | All counts show 0, "No tasks" empty states | P0 |
| 2.3 | My Tasks section | Create tasks assigned to self | Tasks appear in "My Tasks" list | P0 |
| 2.4 | Task click navigates | Click a task in "My Tasks" | Navigates to `/tasks/{id}` | P1 |
| 2.5 | Approval queue (PARTNER) | Login as PARTNER, tasks in PARTNER_APPROVAL status | Shows items needing approval | P1 |
| 2.6 | Recent notifications | Generate notifications (assign task, mention in comment) | Shows in dashboard notifications section | P1 |
| 2.7 | Dashboard data accuracy | Create 3 overdue tasks, 2 due today | Summary cards show correct counts | P1 |

---

### FLOW 3: Client Management

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| 3.1 | Create client | `/clients/new` → fill display name, entity type, PAN, contact info | Client created, redirected to client detail | P0 |
| 3.2 | Create client — validation | Submit with invalid PAN format (not ABCDE1234F) | Validation error shown | P1 |
| 3.3 | Client list — display | Navigate to `/clients` | Shows all clients with name, entity type, status | P0 |
| 3.4 | Client list — search | Type partial name in search box | Filters list after 300ms debounce | P0 |
| 3.5 | Client list — status filter | Select "Active" from status dropdown | Only active clients shown | P1 |
| 3.6 | Client list — pagination | Create 25+ clients, navigate pages | Pagination works (20 per page) | P1 |
| 3.7 | Client detail | Click a client name | Shows client info, GST numbers, engagements, tasks | P0 |
| 3.8 | Edit client | `/clients/{id}/edit` → change display name | Client updated, changes reflected | P0 |
| 3.9 | Delete client | Delete from client detail page | Soft-deleted, disappears from list | P1 |
| 3.10 | Add GST number | On client detail, add GSTIN | GST number appears in client detail | P1 |
| 3.11 | Multiple GST numbers | Add 2-3 GST numbers to a client | All shown, can mark one as primary | P2 |
| 3.12 | Client — empty state | No clients in firm | Empty state with "Create your first client" CTA | P1 |

---

### FLOW 4: Engagement Lifecycle

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| 4.1 | View engagement types | Check dropdown in create engagement modal | Shows seeded types (GST Monthly, ITR, Audit, etc.) | P0 |
| 4.2 | Create engagement | Select client + type + name, submit | Engagement created, appears in list | P0 |
| 4.3 | Engagement list — display | Navigate to `/engagements` | Shows name, client, type, status, period | P0 |
| 4.4 | Engagement list — search | Search by engagement name or client name | Filtered results | P1 |
| 4.5 | Engagement list — status filter | Filter by ACTIVE, ON_HOLD, COMPLETED | Correct filtering | P1 |
| 4.6 | Engagement status change | Change status from ACTIVE → ON_HOLD | Status updates, valid transitions only | P1 |
| 4.7 | Invalid status transition | Try to change CANCELLED → ACTIVE | Error: invalid transition | P2 |
| 4.8 | Engagement — no client | Try creating engagement without selecting client | Validation error | P1 |

---

### FLOW 5: Task Engine (Core Feature)

#### 5A: Task CRUD

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| 5A.1 | Create task | `/tasks/new` → title, description, priority, due date, assignee | Task created | P0 |
| 5A.2 | Create task — linked to engagement | Select engagement when creating | Task linked, shows engagement context | P0 |
| 5A.3 | Create task — linked to client | Select client (no engagement) | Task linked to client directly | P1 |
| 5A.4 | Task list — table view | Navigate to `/tasks` | Shows tasks in table: title, status, priority, assignee, due date | P0 |
| 5A.5 | Task list — search | Search by task title | Filtered results with debounce | P0 |
| 5A.6 | Task list — filter by status | Select "IN_PROGRESS" | Only matching tasks shown | P0 |
| 5A.7 | Task list — filter by priority | Select "URGENT" | Only urgent tasks shown | P1 |
| 5A.8 | Task list — pagination | 25+ tasks, navigate pages | Correct pagination | P1 |
| 5A.9 | Task detail — display | Click task row → `/tasks/{id}` | Shows title, description, status, priority, assignee, due date, client | P0 |
| 5A.10 | Delete task | Delete from task detail | Soft-deleted, gone from list, toast shown | P1 |
| 5A.11 | Task — empty state | No tasks in firm | Empty state with "Create your first task" | P1 |

#### 5B: Task Status Machine

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| 5B.1 | TO_DO → IN_PROGRESS | Click valid status button | Status changes, activity logged | P0 |
| 5B.2 | IN_PROGRESS → UNDER_REVIEW | Move to review | Status changes | P0 |
| 5B.3 | UNDER_REVIEW → PARTNER_APPROVAL | Submit for partner approval | Status changes | P1 |
| 5B.4 | PARTNER_APPROVAL → DONE | Partner approves | Task completed, completedAt set | P0 |
| 5B.5 | Any → AWAITING_CLIENT | Mark as waiting on client | Status changes | P1 |
| 5B.6 | Invalid transition | Only valid transition buttons shown | Cannot click impossible transitions | P0 |
| 5B.7 | DONE → reopen | Reopen completed task if allowed | Follows TASK_STATUS_TRANSITIONS rules | P2 |
| 5B.8 | Status change — toast | Change any status | Success toast appears | P1 |
| 5B.9 | Status change — list reflects | Change status, go back to list | List shows updated status | P0 |

#### 5C: Task Checklist

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| 5C.1 | View checklist | Open task with checklist items | Items displayed with checkboxes | P0 |
| 5C.2 | Toggle checklist item | Click checkbox | Item toggles completed/incomplete | P0 |
| 5C.3 | Checklist progress | Complete 2 of 5 items | Progress indicator shows "2/5" or similar | P1 |
| 5C.4 | Add checklist item | Use add item input/button | New item appears in list | P1 |
| 5C.5 | Delete checklist item | Remove an item | Item removed from list | P2 |

#### 5D: Task Comments

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| 5D.1 | Add comment | Type in comment box, submit | Comment appears in thread | P0 |
| 5D.2 | Comment — empty | Submit empty comment | Validation prevents submission | P1 |
| 5D.3 | Comment list | Multiple comments | Shown in chronological order with author + time | P0 |
| 5D.4 | Comment with @mention | Type @username in comment body | Mention stored, notification sent to mentioned user | P2 |
| 5D.5 | Delete comment | Delete own comment | Comment removed | P2 |

#### 5E: Task Dependencies

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| 5E.1 | Add dependency | Link task A depends on task B | Dependency shown on task A detail | P1 |
| 5E.2 | Circular dependency | Task A → B → A | Error: circular dependency detected | P1 |
| 5E.3 | Blocked indicator | Task depends on incomplete task | Shows "blocked" indicator | P2 |
| 5E.4 | Remove dependency | Remove a dependency link | Dependency removed | P2 |

#### 5F: Task Activity

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| 5F.1 | Activity on status change | Change task status | Activity entry logged with old → new status | P1 |
| 5F.2 | Activity on assignment | Assign/reassign task | Activity logged | P1 |
| 5F.3 | Activity timeline | Multiple changes made | Timeline shows all changes in order | P1 |

---

### FLOW 6: Team & Workload

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| 6.1 | Team workload view | Navigate to `/team` | Shows all team members with task counts, load status | P0 |
| 6.2 | Workload status | Assign many tasks to one user | Status shows OVERLOADED (or equivalent) | P1 |
| 6.3 | Leave request — create | `/team/leave` → fill dates, type, reason | Leave request created with PENDING status | P0 |
| 6.4 | Leave request — approve | Login as PARTNER/MANAGER, approve pending leave | Status changes to APPROVED | P0 |
| 6.5 | Leave request — reject | Reject with reason | Status changes to REJECTED | P1 |
| 6.6 | Leave request — cancel | Cancel own pending leave | Status changes to CANCELLED | P1 |
| 6.7 | Leave types | Select different leave types | CASUAL, SICK, EXAM, TRAINING all available | P2 |
| 6.8 | Half-day leave | Toggle half-day option | Half-day flag saved correctly | P2 |

---

### FLOW 7: Notifications

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| 7.1 | Notification list | Navigate to notifications area | Shows list with title, body, timestamp | P0 |
| 7.2 | Unread count | Generate notifications for user | Unread count badge visible in sidebar/topbar | P1 |
| 7.3 | Mark single as read | Click/interact with notification | Marked as read, count decrements | P1 |
| 7.4 | Mark all as read | Click "Mark all as read" | All notifications marked read, count = 0 | P1 |
| 7.5 | Task assignment notification | Assign task to another user, login as them | See TASK_ASSIGNED notification | P1 |

---

### FLOW 8: Settings & Admin

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| 8.1 | Settings — PARTNER access | Login as PARTNER, go to `/settings` | Settings page loads with user management | P0 |
| 8.2 | Settings — non-admin blocked | Login as JUNIOR_CA, go to `/settings` | Page shows, but admin features hidden or 403 | P0 |
| 8.3 | Create user (invite) | Fill email, name, role, password → submit | New user created, appears in list | P0 |
| 8.4 | Create user — duplicate email | Use existing email | Error shown | P1 |
| 8.5 | Deactivate user | Click deactivate on a user | User deactivated, can't login anymore | P1 |
| 8.6 | Firm settings — view | Check firm settings section | Shows current settings (deadline buffer, etc.) | P1 |
| 8.7 | Firm settings — update | Change a setting, save | Setting persisted, toast confirmation | P1 |
| 8.8 | Change password | Use change password feature | Password changed, all sessions revoked | P1 |

---

### FLOW 9: Audit Log

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| 9.1 | Audit log — display | Navigate to `/audit-log` as PARTNER | Shows actions with user, entity, action, timestamp | P1 |
| 9.2 | Audit log — filter by user | Select a specific user | Only that user's actions shown | P2 |
| 9.3 | Audit log — filter by entity type | Select "Task" or "Client" | Filtered results | P2 |
| 9.4 | Audit log — non-admin blocked | Login as ARTICLE, try to access | 403 or hidden nav item | P1 |
| 9.5 | Actions logged | Create client, edit task, delete item | All show up in audit log with correct metadata | P1 |

---

### FLOW 10: Recently Deleted & Restore

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| 10.1 | View recently deleted | Navigate to `/recently-deleted` as PARTNER | Shows soft-deleted items (clients, tasks, engagements) | P1 |
| 10.2 | Restore item | Click restore on a deleted client | Client reappears in active list | P1 |
| 10.3 | Cross-entity display | Delete a client, a task, and an engagement | All three types visible in recently deleted | P2 |
| 10.4 | Non-admin blocked | Login as JUNIOR_CA, try to access | 403 or hidden nav item | P1 |

---

### FLOW 11: Cross-Cutting Concerns

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| 11.1 | Multi-tenancy isolation | Register 2 firms, create data in each | Firm A cannot see Firm B's data | P0 |
| 11.2 | Responsive — mobile | Resize browser to mobile width | Sidebar collapses, hamburger menu works, tables scroll | P0 |
| 11.3 | Browser back/forward | Navigate through pages, use browser back | Router handles history correctly | P1 |
| 11.4 | Page refresh | Refresh browser on `/tasks/123` | Page loads correctly (not 404) | P0 |
| 11.5 | Token expiry | Wait 15+ minutes without interaction, then click | Token auto-refreshes via cookie, no disruption | P1 |
| 11.6 | Concurrent sessions | Login from 5 different browsers, try 6th | 6th login evicts oldest session | P2 |
| 11.7 | Error toast on API failure | Trigger a 500 error | Toast shows meaningful error message | P1 |
| 11.8 | Loading states | Navigate to any list page | Loading spinner/text shown before data arrives | P1 |
| 11.9 | Empty states | Visit each list page with no data | Appropriate empty state messages | P1 |

---

## 3. What Works (Strengths)

### Backend 🔥
- **Complete API surface** — 40+ endpoints covering all V1 features, well-structured REST
- **Multi-tenancy is solid** — Prisma `$extends` auto-injects `firm_id`, virtually impossible to leak data between firms
- **Auth is production-grade** — Dual-token flow, session management, rate limiting, account lockout, bcrypt with cost 12
- **Task status machine** — `TASK_STATUS_TRANSITIONS` constant prevents invalid moves at API level
- **Audit trail** — Fire-and-forget interceptor logs all mutations without blocking
- **Soft deletes everywhere** — Nothing is permanently lost, restore capability built in
- **Validation** — class-validator DTOs with Indian-specific patterns (PAN, GSTIN, TAN)
- **Seed data** — Platform engagement types (GST, ITR, ROC) and task templates ready out of box

### Frontend 🛠️
- **Clean architecture** — Custom router, TanStack Query for caching, Svelte 5 runes — modern stack, zero bloat
- **Auth flow** — Token in memory (not localStorage), auto-refresh on 401, auth guards in place
- **Dashboard** — Summary cards + task lists give immediate value to users on login
- **Task detail page** — Status transitions, checklist, comments, activity — the core workflow loop is complete
- **Debounced search** — All list pages have proper 300ms debounced search
- **Toast system** — Success/error feedback on every mutation

### Architecture 👀
- **Shared package** — Enums and types are single source of truth across frontend and backend
- **Status transition constants** — Shared between FE (button rendering) and BE (validation)
- **Monorepo** — Clean turborepo setup, pnpm workspaces, shared package works well

---

## 4. What Doesn't Work (Bugs/Gaps)

### Likely Bugs to Verify
| # | Issue | Risk | Where |
|---|-------|------|-------|
| B1 | **Page refresh on deep routes** — Custom SPA router with Vite may 404 on direct URL access to `/tasks/abc123` | HIGH | `vite.config.ts` — needs historyApiFallback or equivalent |
| B2 | **Auth state lost on refresh** — Token is in-memory only, refresh token relies on HTTP-only cookie working with Vite proxy | HIGH | `api.ts` + `auth.svelte.ts` |
| B3 | **No engagement detail page** — Engagement list exists but clicking a row may have no route | MEDIUM | `App.svelte` — no `/engagements/:id` route |
| B4 | **Sidebar nav items for non-admin roles** — Settings, Audit Log, Recently Deleted might show in nav for all roles | MEDIUM | `AppShell.svelte` |
| B5 | **Task creation without users** — TaskCreate may fail if `/users` endpoint returns 403 for non-admin roles | MEDIUM | `TaskCreate.svelte` uses users query |
| B6 | **No edit task page** — TaskDetail has status/checklist/comments but no inline title/description edit | MEDIUM | Missing feature |
| B7 | **Engagement create modal — missing required fields** — periodStart, periodEnd, assignedPartner may not be in the modal | MEDIUM | `EngagementList.svelte` |
| B8 | **No error boundary** — Unhandled API errors may crash the whole SPA | LOW | No error boundary component |
| B9 | **No loading skeleton** — Just "Loading..." text, no skeleton UI | LOW | All pages |
| B10 | **Change password UI missing** — API exists but no UI for it on Settings page | MEDIUM | Settings.svelte |

### Confirmed Gaps
| # | Gap | Impact |
|---|-----|--------|
| G1 | **Zero automated tests** — No unit, integration, or E2E tests anywhere | HIGH — regressions will ship silently |
| G2 | **No engagement detail page** — Can't view/edit individual engagement | HIGH — broken workflow |
| G3 | **No task edit** — Can change status but can't edit title, description, assignee, due date | HIGH — core UX gap |
| G4 | **No notification bell/panel in UI** — API exists but UI component for viewing notifications is unclear | MEDIUM |
| G5 | **No Kanban board view** — Git history shows it was deleted/removed | MEDIUM — was planned |
| G6 | **No subtask creation** — API supports `parentTaskId` but no UI for creating subtasks | MEDIUM |
| G7 | **No role-based route protection on FE** — Settings page might render for ARTICLE users then fail on API calls | MEDIUM |
| G8 | **No breadcrumbs** — Deep navigation (Client → Engagement → Task) has no breadcrumb trail | LOW |
| G9 | **No keyboard shortcuts** — No Cmd+K search, no keyboard navigation | LOW |
| G10 | **No dark mode** — Only light theme | LOW |

---

## 5. Improvements to Make

### P0 — Must Fix Before Real Users

| # | Improvement | Why | Effort |
|---|-------------|-----|--------|
| I1 | **Add engagement detail page** (`/engagements/:id`) | Can't view or manage individual engagements — broken flow | 2-3 hrs |
| I2 | **Add task edit capability** — inline edit or edit page | Users can't change task details after creation | 2-3 hrs |
| I3 | **Fix deep link/refresh** — Ensure Vite serves index.html for all routes | Users sharing URLs or refreshing will hit 404 | 30 min |
| I4 | **Verify auth persistence on refresh** — Test cookie-based token refresh actually works | Users losing session on every refresh is a dealbreaker | 1-2 hrs |
| I5 | **Role-based nav filtering** — Hide admin-only nav items for non-admin users | Clicking a nav item that returns 403 is confusing | 1 hr |
| I6 | **User list access for task assignment** — Non-admin users need to see team members for assignment | Can't assign tasks without `/users` access | 1 hr |

### P1 — Should Fix for V1

| # | Improvement | Why | Effort |
|---|-------------|-----|--------|
| I7 | **Notification bell in topbar** — Show unread count badge + dropdown | API is built, just needs UI | 2-3 hrs |
| I8 | **Confirm dialogs for destructive actions** — Delete task, deactivate user | Accidental deletes with no undo UX | 1 hr |
| I9 | **Better empty states** — Illustrated/actionable empty states with CTA buttons | First impression matters for new firms | 2 hrs |
| I10 | **Loading skeletons** — Replace "Loading..." with skeleton placeholders | Feels unfinished | 2 hrs |
| I11 | **Error boundary component** — Catch React-style errors without crashing whole app | One bad API response shouldn't kill the app | 1 hr |
| I12 | **Form validation feedback** — Show inline field errors, not just toasts | Users don't know which field has the problem | 2 hrs |
| I13 | **Date pickers** — Replace raw `<input type="date">` with proper date picker | Indian date format (DD/MM/YYYY) matters | 1-2 hrs |

### P2 — Nice to Have

| # | Improvement | Why |
|---|-------------|-----|
| I14 | Kanban board view for tasks | Visual workflow management, common in PM tools |
| I15 | Bulk status change on task list | Efficiency for admins managing many tasks |
| I16 | Client-task-engagement breadcrumbs | Navigation context when deep in the app |
| I17 | Search across all entities (Cmd+K) | Power user feature, common SaaS pattern |
| I18 | Engagement → auto-create tasks from template | Template system exists in DB, just needs wiring |

---

## 6. What to Lose (Cut/Simplify)

| # | What | Why |
|---|------|-----|
| L1 | **Recently Deleted page** — defer to V1.1 | Low-priority admin feature. Soft delete protects data. Real users won't need this day 1. Focus dev time on core flows. |
| L2 | **Task dependencies UI** — defer visualization | The API is solid, but the UI for managing dependencies adds complexity. Most CA firms won't use this initially. Keep API, hide UI. |
| L3 | **Half-day leave toggle** — simplify leave to full days only | Edge case that adds UI complexity. CAs care about "who's available", not half-day accounting. |
| L4 | **Custom fields on clients/engagements** — defer to V1.1 | Schema supports it but building the UI is a rabbit hole. Standard fields cover 90% of CA needs. |
| L5 | **Engagement status transitions (ON_HOLD, CANCELLED)** — simplify to ACTIVE/COMPLETED only | Most small CA firms don't put engagements "on hold". Keep it simple. Can add back when firms ask. |
| L6 | **MinIO/S3 in local dev** — remove from docker-compose | Documents are deferred to V1.1 anyway. One less container to run. |
| L7 | **Tags on tasks/clients** — defer UI | API supports tags but building tag input UI is effort for low value in V1 |

---

## 7. What to Add

### P0 — Critical for V1 Launch

| # | Feature | Why | Effort |
|---|---------|-----|--------|
| A1 | **Onboarding flow** — first-time wizard after registration | New firm registers → empty app is confusing. Guide them: create first client → first engagement → first task | 4-6 hrs |
| A2 | **Task edit page/modal** | Can't update task title, description, due date after creation | 2-3 hrs |
| A3 | **Engagement detail page** | No way to view/manage individual engagement | 2-3 hrs |
| A4 | **Password reset / Forgot password** | Locked out users have zero recovery path | 3-4 hrs (needs email integration) |

### P1 — High Value for V1

| # | Feature | Why | Effort |
|---|---------|-----|--------|
| A5 | **Due date highlighting** — red for overdue, amber for today, bold for this week | Core value prop is "no deadline missed" — visual urgency is essential | 1-2 hrs |
| A6 | **Task filters in URL** — bookmarkable filtered views | "Show me all URGENT tasks" should be a shareable link | 1-2 hrs |
| A7 | **Notification bell** — topbar badge + dropdown with recent notifications | Already built the API, just needs FE wiring | 2-3 hrs |
| A8 | **Engagement → Task auto-creation from templates** | The seed data has templates — use them. "Create GST Monthly" should auto-generate 5-6 tasks | 3-4 hrs |
| A9 | **Client detail → engagement tab** | Viewing a client should show their engagements and tasks at a glance | 2 hrs |
| A10 | **User avatar/initials** — in task assignment, comments, team list | Makes the app feel less like a spreadsheet | 1 hr |

### P2 — Differentiators

| # | Feature | Why |
|---|---------|-----|
| A11 | **Compliance calendar view** — monthly calendar showing all deadlines | Unique to CA workflows, massive time saver |
| A12 | **Client portal** — external link for clients to upload docs | Replaces WhatsApp back-and-forth |
| A13 | **Weekly digest email** — summary of overdue tasks, upcoming deadlines | Keeps the team engaged even when they forget to open the app |
| A14 | **Task time tracking** — estimated vs actual hours | Helps firms bill accurately and track productivity |
| A15 | **Dashboard charts** — engagement completion rate, overdue trends | Visual analytics for partners |

---

## Testing Priority Matrix

```
           HIGH VALUE
              │
    ┌─────────┼─────────┐
    │  P0     │   P1    │
    │ Flows   │ Flows   │
    │ 1,3,5A  │ 2,4,5B  │  HIGH
    │ 5B,11   │ 6,7,8   │  EFFORT
    ├─────────┼─────────┤
    │  Quick  │  P2     │
    │  Wins   │ Flows   │
    │ 5C,5D   │ 9,10    │  LOW
    │         │ 5E,5F   │  EFFORT
    └─────────┼─────────┘
              │
           LOW VALUE
```

**Test in this order:**
1. Flow 1 (Auth) → Flow 11.1 (Multi-tenancy) → Flow 11.4 (Deep links)
2. Flow 3 (Clients) → Flow 4 (Engagements) → Flow 5A (Task CRUD)
3. Flow 5B (Status machine) → Flow 5C (Checklists) → Flow 5D (Comments)
4. Flow 2 (Dashboard) → Flow 8 (Settings) → Flow 6 (Team)
5. Flow 7 (Notifications) → Flow 9 (Audit) → Flow 10 (Recently Deleted)

---

## Quick Smoke Test Script (5 Minutes)

```
1. Open http://localhost:5173
2. Register: "Test CA Firm" / "Partner User" / partner@test.com / password123
3. → Should land on empty dashboard
4. Navigate to Clients → New Client → Create "Reliance Industries" (PRIVATE_LIMITED)
5. Navigate to Engagements → Create "GST Monthly - Reliance" (link to client)
6. Navigate to Tasks → New Task → "File GSTR-1" (URGENT, due today, assign to self)
7. → Go to task detail → change status TO_DO → IN_PROGRESS
8. → Add comment "Started working on this"
9. → Check dashboard → should show 1 Due Today
10. → Logout → Login → Verify data persists
```

If all 10 steps pass, the core app loop works. Everything else is polish.
