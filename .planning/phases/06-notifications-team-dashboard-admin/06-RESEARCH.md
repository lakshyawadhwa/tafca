# Phase 6: Notifications, Team, Dashboard & Admin - Research

**Researched:** 2026-04-04
**Domain:** Full-stack feature completion -- notification read API, team/workload/leave backend, dashboard aggregation, admin pages (audit log, recently deleted, settings, user management)
**Confidence:** HIGH

## Summary

Phase 6 is the V1 capstone. The backend work creates 4 new NestJS modules (Notification, Team, Dashboard, RecentlyDeleted) plus firm settings endpoints, all following the established FirmScopedService + controller + DTO pattern. The critical insight is that most of the data already exists -- Phase 5's TaskNotificationHelper writes notification records, the ActionLogService provides audit logs, the UserService has full CRUD, and all entity tables have soft-delete fields. Phase 6 is primarily about surfacing this data through new read endpoints and 7 new frontend pages.

The frontend work replaces 3 existing placeholder pages (Dashboard, Team, Settings) and adds 3 new routes (audit-log, recently-deleted, team/leave). The notification bell dropdown replaces the placeholder button in Topbar.svelte. The sidebar needs an admin section with role-based visibility. All frontend pages follow the established pattern: `+page.server.ts` for SSR data loading, `$state`/`$derived` runes, existing UI components (DataTable, Modal, FormField, Tabs, StatusBadge, etc.), and the `api()` utility for client-side mutations.

The one non-trivial backend piece is the Dashboard endpoint, which aggregates data from multiple tables in a single `Promise.all()` call. The workload computation (per-user open/overdue task counts with firm-average-based load status) and the recently-deleted cross-entity query (parallel queries on clients/engagements/tasks, merged in memory) are also unique patterns not seen in prior phases.

**Primary recommendation:** Build backend modules first (notification, team, dashboard, recently-deleted, firm-settings), then build all frontend pages -- the backend is relatively thin since most data infrastructure exists, and the frontend is the bulk of the work.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Notification Backend (NOTIF-01 through NOTIF-04):**
- New `apps/api/src/notification/` module with NotificationService extending FirmScopedService
- Endpoints: `GET /api/notifications` (paginated, auto-set recipientId to current user, returns unreadCount in meta), `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all` (bulk update), `GET /api/notifications/unread-count`
- Polling, not WebSocket/SSE (explicitly out of scope)
- Frontend polls unread-count every 60 seconds
- V1 simplification: set `status = SENT, sentAt = now()` at creation time in TaskNotificationHelper. Only transition needed is SENT -> READ
- No notification grouping in V1

**Notification Bell UX:**
- Dropdown panel (max 300px wide, max 400px tall, scrollable), not full page
- Shows 20 most recent notifications with "View all" link
- Items: icon (based on type), title, body (1 line), relative timestamp, unread dot
- Click: marks read + navigates to entity
- Red dot badge with count (capped at 99+), hidden when 0
- New `NotificationBell.svelte` in `$lib/components/layout/`, replaces placeholder in Topbar.svelte

**Dashboard Layout (PAGE-06):**
- Route: `/` (replace existing placeholder)
- Card-based grid: 3 sections (task summary cards, my tasks + approval queue, recent notifications)
- Task summary cards: Overdue (red), Due Today (amber), Due This Week (blue), In Review (purple, Partner/Manager only)
- My Tasks: top 10 by due date ASC. Approval Queue: PARTNER_APPROVAL/UNDER_REVIEW for reviewer/assigned partner, max 10
- Single `GET /api/dashboard` endpoint, parallel queries via `Promise.all()`

**Team Workload (TEAM-01, PAGE-07):**
- `GET /api/team/workload` endpoint, computed workload per active user
- Load status thresholds: <0.5x avg = UNDERUTILISED, 0.5-1.5x = BALANCED, >1.5x = OVERLOADED
- `WorkloadStatus` type in shared package (computed, not stored)
- DataTable with columns: User, Role, Open Tasks, Overdue, Due This Week, Load Status badge

**Leave Management (TEAM-02, TEAM-03, PAGE-08):**
- Part of `apps/api/src/team/` module (TeamModule with TeamService + LeaveService + TeamController)
- Endpoints: POST/GET/PATCH approve/reject/cancel on `/api/team/leave`
- Half-day: isHalfDay boolean, only when startDate === endDate
- Two tabs: "My Leave" and "Approvals" (Partner/Manager only)
- Leave form as modal
- List view only, no calendar

**Approval Queue (TEAM-04):**
- `GET /api/team/approval-queue` -- tasks in PARTNER_APPROVAL where user is reviewer or assigned partner
- Feeds both dashboard and team page

**Recently Deleted (DEL-01, DEL-02, DEL-03, PAGE-12):**
- `GET /api/recently-deleted` -- query clients, engagements, tasks (parallel queries, merged in memory)
- `POST /api/recently-deleted/:entityType/:entityId/restore` -- PARTNER only
- 30-day window, countdown badge (green >15, yellow 7-15, red <7)
- DataTable with entity type badge, name, deleted by, deleted at, days remaining, restore button

**Firm Settings (PAGE-09):**
- `GET /api/firms/settings` + `PATCH /api/firms/settings` (PARTNER/ADMIN only)
- V1 fields: default_internal_deadline_buffer_days, auto_task_generation_enabled (show toggle), require_partner_approval_for
- Do NOT show whatsapp_notifications_enabled or compliance_calendar_auto_populate

**User Management (PAGE-10):**
- Settings page with two tabs: "General" (firm settings) and "Users" (user management)
- Backend 100% done -- frontend only
- DataTable: Name, Email, Role, Status, Last Login, Actions
- Invite User modal, Edit modal, Deactivate with ConfirmDialog + open task warning

**Audit Log (PAGE-11):**
- Separate route `/audit-log` (not a tab on settings)
- Backend 100% done -- frontend only
- DataTable + filter bar: user picker, entity type dropdown, action search, date range
- Collapsible metadata details per row

**Module and Route Structure:**
- New backend modules: notification/, team/, dashboard/, recently-deleted/, firm-settings endpoints
- New frontend routes: (app)/+page, (app)/team/+page, (app)/team/leave/+page, (app)/settings/+page, (app)/audit-log/+page, (app)/recently-deleted/+page
- Sidebar admin section: collapsible "Admin" group for PARTNER/ADMIN with Audit Log and Recently Deleted

### Claude's Discretion

- Exact notification polling interval (60s recommended, 30s-90s acceptable)
- Dashboard card layout grid breakpoints and spacing
- Whether "Approvals" section shows PARTNER_APPROVAL only or also UNDER_REVIEW
- DataTable column widths and responsive truncation for audit log
- Leave request form as modal or inline (modal recommended)
- Notification dropdown positioning details
- Whether to use lucide-svelte icon per notification type or single bell
- Workload table sort defaults
- Audit log metadata display format
- Whether Recently Deleted shows "Permanently Delete" action (skip for V1)
- Dashboard greeting text and time-of-day awareness
- Firm settings auto-save vs explicit save (explicit recommended)

### Deferred Ideas (OUT OF SCOPE)

- Notification grouping/batching
- Real-time notifications (WebSocket/SSE)
- Email notification delivery
- Calendar view for leave
- Leave balance tracking
- Task reassignment on deactivation (auto-reassignment)
- Dashboard widgets customization
- Audit log export
- Notification preferences UI
- Saved filter presets for audit log
- Bulk restore
- Full notifications page (`/notifications`)
- Dashboard time-of-day greeting
- Workload trend charts

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NOTIF-01 | In-app notifications created for all event types (task assigned, status change, comment mention, dependency unblocked) | TaskNotificationHelper already writes to notifications table. Needs status fix (PENDING -> SENT at creation). Notification model has 15 fields with proper indexes |
| NOTIF-02 | User can view notification list with unread count | New NotificationService with paginated list, unreadCount always in meta response |
| NOTIF-03 | User can mark individual notification as read | PATCH endpoint sets readAt + status = READ |
| NOTIF-04 | User can mark all notifications as read | Bulk update with WHERE recipient_id + firm_id + read_at IS NULL |
| TEAM-01 | User can view team workload (open tasks, overdue count, load status per user) | Computed from Task table via groupBy or count queries per user. WorkloadStatus as shared type |
| TEAM-02 | User can create leave requests with type, date range, half-day option | LeaveRecord model ready in Prisma (14 fields). LeaveType and LeaveStatus enums in shared package |
| TEAM-03 | Manager/Partner can approve/reject leave requests | PATCH endpoints with role guard. Approval emits ASSIGNEE_ON_LEAVE notification |
| TEAM-04 | Partner/Manager can view approval queue (tasks in PARTNER_APPROVAL) | Query tasks WHERE status = PARTNER_APPROVAL AND (reviewer_id = user OR engagement partner = user) |
| DEL-01 | Partner/Admin can view recently deleted records across entity types | Parallel queries on clients/engagements/tasks WHERE deletedAt IS NOT NULL AND within 30 days |
| DEL-02 | Partner can restore soft-deleted record within 30 days | Set deletedAt = null, deletedBy = null. Validate 30-day window and unique constraints |
| DEL-03 | Records show days until permanent deletion | Computed: 30 - daysSince(deletedAt). Color-coded badge |
| PAGE-06 | Dashboard (my tasks: overdue/today/this week, approval queue, recent notifications) | Single GET /api/dashboard endpoint with Promise.all() for parallel queries |
| PAGE-07 | Team workload table with load status indicators | DataTable component available, StatusBadge needs workload variant |
| PAGE-08 | Leave request form + approval interface | Two-tab layout using Tabs component, Modal for leave form, inline approve/reject buttons |
| PAGE-09 | Firm settings page (buffer days, toggles) | FirmSettings type in shared package, Firm.settings JSONB field in Prisma |
| PAGE-10 | User management page (list, invite, edit role, deactivate) | Backend 100% done (UserController/UserService). Frontend-only: DataTable, Modal, ConfirmDialog |
| PAGE-11 | Audit log page with filters | Backend 100% done (ActionLogController). Frontend-only: DataTable, FilterBar, DatePicker |
| PAGE-12 | Recently deleted page with restore buttons | New backend endpoint + DataTable frontend with restore action |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Stack**: SvelteKit + TailwindCSS (frontend), NestJS (backend), PostgreSQL + Prisma (DB), Redis
- **Multi-tenancy**: firm_id on every table, enforced via Prisma $extends + FirmScopedService + AsyncLocalStorage
- **Auth**: JWT (15-min access) + HTTP-only cookie refresh (7 days), max 5 concurrent sessions
- **Monorepo**: Turborepo + pnpm workspaces (apps/api, apps/web, packages/shared)
- **RBAC**: 5 roles -- PARTNER, MANAGER, JUNIOR_CA, ARTICLE, ADMIN
- **Soft deletes**: deletedAt IS NULL filter everywhere
- **GSD Workflow**: Must use GSD entry points for changes

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| NestJS | (installed) | Backend framework | All API modules follow Module/Controller/Service pattern |
| Prisma | (installed) | ORM with multi-file schema | Notification, LeaveRecord, UserActionLog, Firm models ready |
| SvelteKit | (installed) | Frontend framework | Svelte 5 runes, SSR via +page.server.ts |
| TailwindCSS v4 | (installed) | Styling | CSS @import approach, complete class strings only |
| lucide-svelte | (installed) | Icons | Already used in Sidebar, Topbar, task pages |
| class-validator | (installed) | DTO validation | All backend DTOs use decorators |
| class-transformer | (installed) | DTO transformation | @Type(() => Number) for query params |
| @ca-practice-os/shared | local | Shared enums/types/constants | All enums and types exported via packages/shared |

### No New Dependencies Required

Phase 6 requires zero new npm packages. Everything needed is already installed:
- Backend: NestJS, Prisma, class-validator, class-transformer, bcrypt
- Frontend: SvelteKit, TailwindCSS, lucide-svelte
- Shared: All enums (NotificationType, NotificationStatus, LeaveType, LeaveStatus, UserRole, TaskStatus) and types (FirmSettings, NotificationPreferences) already defined

## Architecture Patterns

### New Backend Module Structure
```
apps/api/src/
  notification/
    notification.module.ts
    notification.controller.ts
    notification.service.ts
    dto/
      list-notifications-query.dto.ts
      notification-response.dto.ts
  team/
    team.module.ts
    team.controller.ts
    team.service.ts        # workload computation
    leave.service.ts       # leave CRUD + approval
    dto/
      workload-response.dto.ts
      create-leave.dto.ts
      list-leave-query.dto.ts
      leave-response.dto.ts
      approval-queue-response.dto.ts
  dashboard/
    dashboard.module.ts
    dashboard.controller.ts
    dashboard.service.ts   # aggregates from other services
    dto/
      dashboard-response.dto.ts
  recently-deleted/
    recently-deleted.module.ts
    recently-deleted.controller.ts
    recently-deleted.service.ts
    dto/
      recently-deleted-response.dto.ts
      restore.dto.ts
  firm-settings/
    firm-settings.module.ts
    firm-settings.controller.ts
    firm-settings.service.ts
    dto/
      update-firm-settings.dto.ts
      firm-settings-response.dto.ts
```

### New Frontend Route Structure
```
apps/web/src/routes/(app)/
  +page.svelte              # Dashboard (replace placeholder)
  +page.server.ts           # Dashboard SSR
  team/
    +page.svelte            # Team workload (replace placeholder)
    +page.server.ts         # Team workload SSR
    leave/
      +page.svelte          # Leave management
      +page.server.ts       # Leave SSR
  settings/
    +page.svelte            # Settings with General/Users tabs (replace placeholder)
    +page.server.ts         # Settings SSR
  audit-log/
    +page.svelte            # Audit log
    +page.server.ts         # Audit log SSR
  recently-deleted/
    +page.svelte            # Recently deleted
    +page.server.ts         # Recently deleted SSR
```

### New Frontend Components
```
apps/web/src/lib/components/
  layout/
    NotificationBell.svelte   # Bell icon + dropdown panel
  dashboard/
    TaskSummaryCard.svelte    # Clickable stat card (count, label, accent color)
  team/
    WorkloadBadge.svelte      # Colored load status indicator
```

### Pattern 1: FirmScopedService Extension (Backend)
**What:** Every new backend service extends FirmScopedService for automatic tenant isolation
**When to use:** All Phase 6 backend services
**Example:**
```typescript
// Source: apps/api/src/common/base/firm-scoped.service.ts (verified in codebase)
@Injectable()
export class NotificationService extends FirmScopedService {
  constructor(prismaService: PrismaService) {
    super(prismaService);
  }

  async listNotifications(query: ListNotificationsQueryDto) {
    // this.prisma is firm-scoped, auto-filters by firm_id and deletedAt IS NULL
    // this.unscopedPrisma bypasses scoping when needed
    // this.getFirmId() and this.getUserId() from AsyncLocalStorage
  }
}
```

### Pattern 2: Paginated Response (Backend)
**What:** Standard pagination envelope used by ALL list endpoints
**When to use:** Every list endpoint in Phase 6
**Example:**
```typescript
// Source: established pattern across action-log, user, client, task services
return {
  data: items.map(item => this.toDto(item)),
  meta: {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  },
};
```

### Pattern 3: SSR Data Loading (Frontend)
**What:** SvelteKit +page.server.ts fetches data server-side, passes to component
**When to use:** All Phase 6 pages
**Example:**
```typescript
// Source: apps/web/src/routes/(app)/tasks/+page.server.ts (verified in codebase)
export const load: PageServerLoad = async ({ url, fetch }) => {
  const page = url.searchParams.get('page') ?? '1';
  const res = await fetch(`/api/endpoint?page=${page}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw error(res.status, body.message ?? 'Failed to load data');
  }
  const result = await res.json();
  return { data: result.data, meta: result.meta };
};
```

### Pattern 4: Client-Side Mutations with api() Utility
**What:** Client-side POST/PATCH/DELETE use the api() wrapper with token refresh
**When to use:** All mutation actions in Phase 6 (mark read, approve leave, restore, update settings)
**Example:**
```typescript
// Source: apps/web/src/lib/utils/api.ts (verified in codebase)
import { api } from '$lib/utils/api';
import { invalidateAll } from '$app/navigation';

async function markRead(notificationId: string) {
  await api(`/notifications/${notificationId}/read`, { method: 'PATCH' });
  await invalidateAll(); // Refresh SSR data
}
```

### Pattern 5: Role-Gated Endpoints (Backend)
**What:** @Roles decorator restricts endpoint access by UserRole
**When to use:** Admin-only endpoints (recently-deleted, firm-settings, audit-log)
**Example:**
```typescript
// Source: apps/api/src/user/user.controller.ts (verified in codebase)
@Get()
@Roles(UserRole.PARTNER, UserRole.ADMIN)
async listActionLogs(...) { ... }
```

### Pattern 6: Fire-and-Forget Writes
**What:** Non-critical writes (notifications, activity logs) use .catch() to never block response
**When to use:** Leave approval notification emission
**Example:**
```typescript
// Source: apps/api/src/task/task-notification.helper.ts (verified in codebase)
// and apps/api/src/action-log/action-log.service.ts
this.unscopedPrisma.notification.create({ data: {...} })
  .catch(err => this.logger.error(`Failed: ${err.message}`));
```

### Anti-Patterns to Avoid
- **Dynamic Tailwind class interpolation:** TailwindCSS v4 purges dynamically constructed classes. ALWAYS use complete class strings in Record<string, string> lookup objects (per Phase 3 decision)
- **N+1 queries in list endpoints:** Use batch-fetch for related user names (see ActionLogService.listActionLogs pattern -- batch unique userIds into single findMany)
- **Blocking on notification writes:** All notification emission must be fire-and-forget with .catch()
- **Cross-user notification access:** recipientId must be auto-set to current user, never accepted from query params
- **Missing firm scoping on unscoped queries:** When using unscopedPrisma, ALWAYS include explicit firmId in WHERE

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pagination | Custom offset/limit logic | Established meta pattern | Already used in 6+ endpoints, consistent API contract |
| Date computation | Manual date arithmetic | Native Date/timestamp comparison | Prisma handles timezone-aware comparisons with @db.Timestamptz |
| Role checking in sidebar | Custom role logic | `$page.data.user.role` check | Auth store already provides user role from SSR |
| Notification icon mapping | Complex switch statement | Record<NotificationType, Component> lookup | Clean, type-safe, matches StatusBadge color pattern |
| Workload status computation | Complex conditional | Simple threshold function against firm average | 3 if-statements, no library needed |
| Soft-delete restore | Custom undelete logic | `update({ data: { deletedAt: null, deletedBy: null } })` | Same Prisma pattern as soft-delete, just reversed |
| Cross-entity union query | Raw SQL UNION | Parallel Prisma queries + JS array merge | Prisma doesn't support UNION; parallel queries are fast enough at MVP scale |

**Key insight:** Phase 6 builds on 5 phases of established patterns. Every new module follows the exact same structure. The risk isn't technical complexity -- it's accidentally diverging from established conventions.

## Common Pitfalls

### Pitfall 1: Notification Status Mismatch
**What goes wrong:** TaskNotificationHelper currently creates notifications with `status = PENDING` (the Prisma default). The notification list endpoint filters on status, and the bell badge counts unread. If notifications stay PENDING, the SENT -> READ transition breaks.
**Why it happens:** Phase 5 deferred notification delivery, so PENDING was a reasonable default. Phase 6 needs SENT.
**How to avoid:** First task must update TaskNotificationHelper.createNotification() to set `status: NotificationStatus.SENT, sentAt: new Date()` at creation time.
**Warning signs:** Notification list returns empty even though notifications exist in DB.

### Pitfall 2: Scoped vs Unscoped Prisma for Notification Queries
**What goes wrong:** The Notification model has recipientId (user-specific) and firmId (tenant-specific). Using scoped Prisma auto-injects firm_id filter, which is correct. But notification marks-read must also filter by recipientId to prevent users marking other users' notifications.
**Why it happens:** FirmScopedService auto-adds firm_id but NOT recipient_id.
**How to avoid:** Always include `recipientId: this.getUserId()` in notification WHERE clauses. For mark-all-read, include both firmId and recipientId.
**Warning signs:** User can mark another user's notifications as read.

### Pitfall 3: Dashboard Endpoint Performance
**What goes wrong:** Dashboard aggregates data from 4 different query domains (task counts, task list, approval queue, notifications). Sequential queries make the endpoint slow.
**Why it happens:** Default async/await runs queries sequentially.
**How to avoid:** Use `Promise.all()` for parallel execution (per CONTEXT.md decision). Each sub-query should be an independent method in DashboardService.
**Warning signs:** Dashboard load time > 500ms.

### Pitfall 4: Recently Deleted Query Bypasses Soft-Delete Filter
**What goes wrong:** The scoped Prisma client automatically filters `WHERE deleted_at IS NULL`. But recently-deleted specifically needs `WHERE deleted_at IS NOT NULL`. Using scoped Prisma returns empty results.
**Why it happens:** The Prisma $extends extension that adds the soft-delete filter is always active on scoped client.
**How to avoid:** Use `this.unscopedPrisma` for recently-deleted queries, but ALWAYS include explicit `firmId` in WHERE to maintain tenant isolation.
**Warning signs:** Recently deleted list always returns empty.

### Pitfall 5: Sidebar Admin Section Conditional Rendering
**What goes wrong:** Adding admin items to the flat navItems array without role checks makes them visible to all users.
**Why it happens:** Current Sidebar.svelte has a simple navItems array with no role filtering.
**How to avoid:** Either: (a) add a `roles?: UserRole[]` property to NavItem and filter in the template, or (b) render the admin section as a separate block with an `{#if}` check on `$page.data.user.role`. The sidebar needs access to user role from the layout data.
**Warning signs:** JUNIOR_CA or ARTICLE users see Audit Log and Recently Deleted links.

### Pitfall 6: Polling Interval Memory Leak
**What goes wrong:** Setting up a `setInterval` for notification polling in NotificationBell.svelte without cleanup causes memory leaks on component unmount (e.g., navigating away from authenticated routes).
**Why it happens:** Svelte 5 doesn't auto-clear intervals set in $effect.
**How to avoid:** Use `$effect` with a cleanup return function: `$effect(() => { const id = setInterval(...); return () => clearInterval(id); })`.
**Warning signs:** Multiple polling intervals stacking up, excessive API calls.

### Pitfall 7: Leave Date Overlap Validation
**What goes wrong:** User creates two overlapping leave requests (e.g., April 5-10 and April 8-12) and both get approved.
**Why it happens:** No overlap check in leave creation or approval.
**How to avoid:** On leave creation, check for existing PENDING or APPROVED leaves where date ranges overlap. SQL: `WHERE user_id = :userId AND status IN ('PENDING', 'APPROVED') AND start_date <= :endDate AND end_date >= :startDate`.
**Warning signs:** Conflicting leave records in database.

### Pitfall 8: Restore Violates Unique Constraints
**What goes wrong:** Client "Acme Corp" is soft-deleted. Someone creates a new client "Acme Corp" (allowed because original is deleted). Restoring the original fails due to unique constraint on display_name per firm.
**Why it happens:** The unique constraint check includes deleted records (or the scoped client excludes them).
**How to avoid:** Before restore, check if restoring would violate unique constraints. For clients, check display_name uniqueness. Return a clear error: "Cannot restore: a client named 'Acme Corp' already exists."
**Warning signs:** 500 error on restore with Prisma unique constraint violation.

## Code Examples

### Notification Service -- List with Unread Count
```typescript
// Source: established pattern from ActionLogService + CONTEXT.md specification
async listNotifications(userId: string, query: ListNotificationsQueryDto) {
  const { page = 1, limit = 20, unreadOnly } = query;
  const where: any = { recipientId: userId };

  if (unreadOnly) {
    where.readAt = null;
  }

  const skip = (page - 1) * limit;

  const [data, total, unreadCount] = await Promise.all([
    this.prisma.notification.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    this.prisma.notification.count({ where }),
    this.prisma.notification.count({
      where: { recipientId: userId, readAt: null },
    }),
  ]);

  return {
    data: data.map(n => this.toDto(n)),
    meta: { total, page, limit, totalPages: Math.ceil(total / limit), unreadCount },
  };
}
```

### Dashboard Service -- Parallel Aggregation
```typescript
// Source: CONTEXT.md specification + Promise.all pattern from engagement service
async getDashboard(userId: string, userRole: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekFromNow = new Date(today);
  weekFromNow.setDate(weekFromNow.getDate() + 7);

  const activeStatuses = { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] };

  const [overdue, dueToday, dueThisWeek, inReview, myTasks, approvalQueue, recentNotifications] =
    await Promise.all([
      this.prisma.task.count({
        where: { assigneeId: userId, status: activeStatuses, dueDate: { lt: today } },
      }),
      this.prisma.task.count({
        where: { assigneeId: userId, status: activeStatuses, dueDate: today },
      }),
      this.prisma.task.count({
        where: { assigneeId: userId, status: activeStatuses, dueDate: { gte: today, lte: weekFromNow } },
      }),
      // inReview count for Partner/Manager
      this.getInReviewCount(userId, userRole),
      // Top 10 tasks ordered by due date
      this.getMyTasks(userId, 10),
      // Top 10 approval queue items
      this.getApprovalQueue(userId, userRole, 10),
      // Recent 5 notifications
      this.getRecentNotifications(userId, 5),
    ]);

  return { taskSummary: { overdue, dueToday, dueThisWeek, inReview }, myTasks, approvalQueue, recentNotifications };
}
```

### Workload Computation
```typescript
// Source: CONTEXT.md specification + PRD 11.2
async getWorkload() {
  const firmId = this.getFirmId();
  const users = await this.prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, fullName: true, role: true, avatarUrl: true },
  });

  const taskCounts = await this.unscopedPrisma.task.groupBy({
    by: ['assigneeId'],
    where: {
      firmId,
      status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
      deletedAt: null,
    },
    _count: { id: true },
  });

  // Similarly for overdue and dueThisWeek counts...
  // Compute firm average and assign load status
  const totalOpen = userWorkloads.reduce((sum, u) => sum + u.openTaskCount, 0);
  const firmAverage = users.length > 0 ? totalOpen / users.length : 0;

  // Threshold assignment
  for (const u of userWorkloads) {
    if (firmAverage === 0) u.loadStatus = 'BALANCED';
    else if (u.openTaskCount < 0.5 * firmAverage) u.loadStatus = 'UNDERUTILISED';
    else if (u.openTaskCount > 1.5 * firmAverage) u.loadStatus = 'OVERLOADED';
    else u.loadStatus = 'BALANCED';
  }
}
```

### Recently Deleted -- Cross-Entity Query
```typescript
// Source: CONTEXT.md specification
async listRecentlyDeleted() {
  const firmId = this.getFirmId();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const deletedWhere = { firmId, deletedAt: { not: null, gte: thirtyDaysAgo } };

  const [clients, engagements, tasks] = await Promise.all([
    this.unscopedPrisma.client.findMany({
      where: deletedWhere,
      select: { id: true, displayName: true, deletedAt: true, deletedBy: true },
    }),
    this.unscopedPrisma.engagement.findMany({
      where: deletedWhere,
      select: { id: true, name: true, deletedAt: true, deletedBy: true },
    }),
    this.unscopedPrisma.task.findMany({
      where: deletedWhere,
      select: { id: true, title: true, deletedAt: true, deletedBy: true },
    }),
  ]);

  // Merge, tag with entityType, sort by deletedAt DESC, compute daysRemaining
  const all = [
    ...clients.map(c => ({ entityType: 'Client', entityId: c.id, name: c.displayName, ...c })),
    ...engagements.map(e => ({ entityType: 'Engagement', entityId: e.id, name: e.name, ...e })),
    ...tasks.map(t => ({ entityType: 'Task', entityId: t.id, name: t.title, ...t })),
  ].sort((a, b) => (b.deletedAt!.getTime() - a.deletedAt!.getTime()));

  return { data: all.map(item => this.toDeletedDto(item)) };
}
```

### NotificationBell.svelte -- Polling with Cleanup
```svelte
<!-- Source: established pattern from sidebar.svelte + CONTEXT.md -->
<script lang="ts">
  import { Bell } from 'lucide-svelte';
  import { api } from '$lib/utils/api';

  let unreadCount = $state(0);
  let isOpen = $state(false);
  let notifications = $state<any[]>([]);

  $effect(() => {
    fetchUnreadCount();
    const intervalId = setInterval(fetchUnreadCount, 60_000);
    return () => clearInterval(intervalId);
  });

  async function fetchUnreadCount() {
    try {
      const res = await api<{ count: number }>('/notifications/unread-count');
      unreadCount = res.count;
    } catch { /* non-critical */ }
  }
</script>
```

### Sidebar Admin Section
```svelte
<!-- Source: apps/web/src/lib/components/layout/Sidebar.svelte (current structure) -->
<!-- Add after main nav, before toggle button -->
{#if user?.role === 'PARTNER' || user?.role === 'ADMIN'}
  <div class="border-t border-gray-200 pt-2 mt-2">
    <p class="px-6 text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
      {#if !isSidebarCollapsed() || isMobileOpen()}Admin{/if}
    </p>
    <ul class="flex flex-col gap-1">
      <!-- Audit Log, Recently Deleted nav items -->
    </ul>
  </div>
{/if}
```

## Existing Infrastructure Inventory

### Backend -- Already Built (Frontend-Only Work)
| Endpoint | Controller | Service | Status |
|----------|-----------|---------|--------|
| `GET /api/users` | UserController | UserService.listUsers() | Complete |
| `POST /api/users` | UserController | UserService.createUser() | Complete |
| `PATCH /api/users/:id` | UserController | UserService.updateUser() | Complete |
| `PATCH /api/users/:id/deactivate` | UserController | UserService.deactivateUser() | Complete |
| `GET /api/audit-log` | ActionLogController | ActionLogService.listActionLogs() | Complete |

### Backend -- Needs Building
| Endpoint | Module | Priority |
|----------|--------|----------|
| `GET /api/notifications` | notification | Plan 1 |
| `PATCH /api/notifications/:id/read` | notification | Plan 1 |
| `PATCH /api/notifications/read-all` | notification | Plan 1 |
| `GET /api/notifications/unread-count` | notification | Plan 1 |
| `GET /api/team/workload` | team | Plan 1 |
| `POST /api/team/leave` | team | Plan 1 |
| `GET /api/team/leave` | team | Plan 1 |
| `PATCH /api/team/leave/:id/approve` | team | Plan 1 |
| `PATCH /api/team/leave/:id/reject` | team | Plan 1 |
| `PATCH /api/team/leave/:id/cancel` | team | Plan 1 |
| `GET /api/team/approval-queue` | team | Plan 1 |
| `GET /api/dashboard` | dashboard | Plan 2 |
| `GET /api/recently-deleted` | recently-deleted | Plan 2 |
| `POST /api/recently-deleted/:entityType/:entityId/restore` | recently-deleted | Plan 2 |
| `GET /api/firms/settings` | firm-settings | Plan 2 |
| `PATCH /api/firms/settings` | firm-settings | Plan 2 |

### Prisma Models -- Ready
| Model | Fields | Indexes | Notes |
|-------|--------|---------|-------|
| Notification | 15 | recipientId+status+createdAt, firmId | No user relation (recipientId is UUID only) |
| LeaveRecord | 14 + audit fields | firmId, userId | Has soft-delete fields |
| UserActionLog | 11 | firmId+occurredAt, firmId+entityType+entityId | Immutable, no soft-delete |
| Firm | 17 + settings JSONB | -- | settings defaults to {} |
| Task | 24+ | firmId, assigneeId, clientId, engagementId | All fields needed for dashboard queries |

### Shared Package -- Ready
| Item | Location | Values |
|------|----------|--------|
| NotificationType | enums/notification-type.enum.ts | 19 values (V1 uses: TASK_ASSIGNED, TASK_REVIEW_REQUESTED, TASK_APPROVAL_REQUESTED, TASK_SENT_BACK, TASK_DEPENDENCY_UNBLOCKED, COMMENT_MENTION, ASSIGNEE_ON_LEAVE) |
| NotificationStatus | enums/notification-status.enum.ts | PENDING, SENT, FAILED, READ |
| NotificationChannel | enums/notification-channel.enum.ts | IN_APP, EMAIL, WHATSAPP |
| LeaveType | enums/leave-type.enum.ts | CASUAL, SICK, EXAM, TRAINING, PUBLIC_HOLIDAY, OTHER |
| LeaveStatus | enums/leave-status.enum.ts | PENDING, APPROVED, REJECTED, CANCELLED |
| UserRole | enums/user-role.enum.ts | PARTNER, MANAGER, JUNIOR_CA, ARTICLE, ADMIN |
| TaskStatus | enums/task-status.enum.ts | TO_DO, IN_PROGRESS, AWAITING_CLIENT, UNDER_REVIEW, PARTNER_APPROVAL, DONE, CANCELLED |
| FirmSettings | types/firm-settings.type.ts | 5 fields including buffer_days, approval config |

### UI Components -- Ready
| Component | Used For |
|-----------|---------|
| DataTable | Team workload, user management, audit log, recently deleted, leave list |
| Modal | Leave request form, invite user, edit user |
| FormField | Settings form, leave form fields |
| StatusBadge | Leave status, entity type, load status (needs workload variant) |
| Tabs | Settings page (General/Users), Leave page (My Leave/Approvals) |
| FilterBar | Audit log filters |
| DatePicker | Audit log date range, leave date selection |
| EmptyState | Empty notification list, empty approval queue |
| LoadingSkeleton | Dashboard cards loading, table loading |
| ConfirmDialog | User deactivation, record restore |
| UserPicker | Audit log user filter |
| Button | All form actions |
| Select | Entity type filter, role selector |
| Input | Search fields, buffer days |

### Frontend Layout -- Existing Placeholders
| Route | Current State | Phase 6 Action |
|-------|--------------|----------------|
| `(app)/+page.svelte` | Placeholder with welcome text | Replace with dashboard |
| `(app)/team/+page.svelte` | Placeholder with "coming soon" | Replace with workload table |
| `(app)/settings/+page.svelte` | Placeholder with "coming soon" | Replace with tabbed settings |
| Topbar.svelte bell button | Placeholder button (no functionality) | Replace with NotificationBell component |
| Sidebar.svelte | Flat 6-item nav list | Add admin section with role check |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PENDING notification status at creation | SENT status at creation (V1 simplification) | Phase 6 decision | Avoids PENDING->SENT transition complexity, only SENT->READ needed |
| Individual queries for dashboard | Single endpoint with Promise.all() | Phase 6 decision | Reduces dashboard load from 4-7 round trips to 1 |
| Separate routes for settings/users | Tabbed page at /settings | Phase 6 decision | Cleaner UX, fewer sidebar items |
| Flat sidebar nav | Grouped nav with admin section | Phase 6 decision | Role-based visibility, scalable for future admin tools |

## Open Questions

1. **Notification recipientId relation**
   - What we know: The Notification model stores `recipientId` as a UUID but has NO Prisma relation to User (only a Firm relation exists). This means we can't do `include: { recipient: true }` to get user names.
   - What's unclear: Whether to add a relation or batch-fetch user names like ActionLogService does.
   - Recommendation: Follow ActionLogService pattern -- batch-fetch unique recipientIds into a userMap. Adding a Prisma relation would require a schema migration, which is unnecessary for read-only display.

2. **Dashboard dueDate comparison with Prisma Date type**
   - What we know: Task.dueDate is `@db.Date` (date-only, no time). Prisma Date comparisons with JavaScript `new Date()` need care because JS Date includes time.
   - What's unclear: Whether Prisma correctly compares `@db.Date` with a JS Date that has time stripped.
   - Recommendation: For "due today" queries, construct date range: `{ gte: startOfDay, lt: startOfNextDay }` to avoid timezone edge cases. For "overdue", use `{ lt: startOfToday }`.

3. **Sidebar user role access**
   - What we know: The layout server load returns `user` in page data. Sidebar.svelte currently doesn't receive or use user data.
   - What's unclear: Best way to pass user role to Sidebar for admin section.
   - Recommendation: Use `$page.data.user.role` from the page store (already imported in Sidebar via `import { page } from '$app/stores'`). No props needed.

## Environment Availability

Step 2.6: SKIPPED (no new external dependencies). Phase 6 is purely code/config changes using the existing stack (Node.js 22.21.1, pnpm 9.15.9, NestJS, SvelteKit, PostgreSQL, Redis -- all already running from prior phases).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None currently configured |
| Config file | None -- see Wave 0 |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NOTIF-01 | Notification creation with SENT status | integration | Manual API test via curl/Postman | No |
| NOTIF-02 | Notification list with unread count | integration | Manual API test | No |
| NOTIF-03 | Mark single notification as read | integration | Manual API test | No |
| NOTIF-04 | Mark all notifications as read | integration | Manual API test | No |
| TEAM-01 | Workload computation with load status | integration | Manual API test | No |
| TEAM-02 | Leave request creation with validation | integration | Manual API test | No |
| TEAM-03 | Leave approval/rejection | integration | Manual API test | No |
| TEAM-04 | Approval queue filtering | integration | Manual API test | No |
| DEL-01 | Cross-entity recently deleted list | integration | Manual API test | No |
| DEL-02 | Restore within 30 days | integration | Manual API test | No |
| DEL-03 | Days until permanent deletion | unit | Manual verification | No |
| PAGE-06 | Dashboard renders with data | e2e/manual | Manual browser test | No |
| PAGE-07 | Team workload table | e2e/manual | Manual browser test | No |
| PAGE-08 | Leave request + approval | e2e/manual | Manual browser test | No |
| PAGE-09 | Firm settings form | e2e/manual | Manual browser test | No |
| PAGE-10 | User management CRUD | e2e/manual | Manual browser test | No |
| PAGE-11 | Audit log with filters | e2e/manual | Manual browser test | No |
| PAGE-12 | Recently deleted + restore | e2e/manual | Manual browser test | No |

### Sampling Rate
- **Per task commit:** Manual API test of affected endpoints
- **Per wave merge:** Full manual walkthrough of all Phase 6 features
- **Phase gate:** All success criteria verified manually before `/gsd:verify-work`

### Wave 0 Gaps
No test framework exists in the project. All prior phases were validated manually. Maintaining the same approach for Phase 6 for consistency. Test framework setup is a V1.1 concern.

## Sources

### Primary (HIGH confidence)
- **Codebase scan** -- All source files read directly from the repo:
  - `apps/api/src/task/task-notification.helper.ts` -- notification creation pattern
  - `apps/api/src/action-log/action-log.service.ts` -- audit log query pattern with batch user lookup
  - `apps/api/src/user/user.service.ts` + `user.controller.ts` -- complete user CRUD (confirmed backend done)
  - `apps/api/src/action-log/action-log.controller.ts` -- confirmed audit log endpoint done
  - `apps/api/src/common/base/firm-scoped.service.ts` -- FirmScopedService pattern
  - `apps/api/prisma/schema/notification.prisma` -- 15 fields, indexes
  - `apps/api/prisma/schema/team.prisma` -- LeaveRecord 14 fields + audit
  - `apps/api/prisma/schema/audit.prisma` -- UserActionLog 11 fields
  - `apps/api/prisma/schema/firm.prisma` -- Firm with settings JSONB
  - `apps/api/prisma/schema/task.prisma` -- Task 24+ fields for dashboard queries
  - `packages/shared/src/enums/` -- all notification, leave, task, user enums
  - `packages/shared/src/types/firm-settings.type.ts` -- FirmSettings interface
  - `apps/web/src/lib/components/layout/Topbar.svelte` -- placeholder bell button
  - `apps/web/src/lib/components/layout/Sidebar.svelte` -- current nav structure
  - `apps/web/src/routes/(app)/+page.svelte` -- dashboard placeholder
  - `apps/web/src/routes/(app)/tasks/+page.server.ts` -- SSR data loading pattern
  - `apps/web/src/lib/utils/api.ts` -- client-side API wrapper
  - `apps/web/src/lib/stores/auth.svelte.ts` -- auth state with user role

### Secondary (MEDIUM confidence)
- `.planning/phases/06-notifications-team-dashboard-admin/06-CONTEXT.md` -- all implementation decisions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, everything verified in codebase
- Architecture: HIGH -- follows exact same patterns as Phases 1-5, all models/enums exist
- Pitfalls: HIGH -- identified from direct codebase analysis (notification status, scoped vs unscoped, date types)

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (30 days -- stable, no external dependency changes expected)
