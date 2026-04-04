# Phase 6: Notifications, Team, Dashboard & Admin - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 6 is the capstone of V1 — it surfaces the data and workflows built in Phases 1-5 through dashboards, notification feeds, team views, and admin pages. No new core entities are created; the work is primarily a Notification module (read/mark-read API over existing notification records), Team/Workload/Leave endpoints, a cross-entity Recently Deleted endpoint, Firm Settings CRUD, and seven frontend pages.

**Backend scope:**
- Notification module: list notifications (paginated, unread count), mark-read, mark-all-read endpoints (NOTIF-01 through NOTIF-04)
- Team/Workload endpoint: computed workload per user — open tasks, overdue count, load status (TEAM-01)
- Leave management: CRUD for leave requests, approval/rejection flow (TEAM-02, TEAM-03)
- Approval queue endpoint: tasks in PARTNER_APPROVAL status for the current user (TEAM-04)
- Recently Deleted endpoint: cross-entity query of soft-deleted records within 30 days, restore endpoint (DEL-01, DEL-02, DEL-03)
- Firm Settings: read + update the firm `settings` JSONB field (PAGE-09)
- Dashboard aggregate endpoint: my overdue/today/this-week task counts + recent notifications (PAGE-06)

**Frontend scope:**
- Dashboard page (PAGE-06): task summary cards, approval queue, recent notifications
- Team workload page (PAGE-07): workload table with load status indicators
- Leave management page (PAGE-08): leave request form + approval list
- Firm settings page (PAGE-09): buffer days, toggles
- User management page (PAGE-10): list users, invite, edit role, deactivate with task reassignment warning
- Audit log page (PAGE-11): filterable, paginated log viewer
- Recently deleted page (PAGE-12): cross-entity list with restore buttons and countdown
- Notification bell/dropdown in topbar: unread badge, notification list, mark-read

</domain>

<decisions>
## Implementation Decisions

### Notification Backend (NOTIF-01 through NOTIF-04)

**Module structure:** New `apps/api/src/notification/` module with `NotificationService` extending `FirmScopedService`, `NotificationController`, and DTOs. This is a read-heavy module — Phase 5's `TaskNotificationHelper` already writes notification records to the `notifications` table. Phase 6 just adds the read/mark-read API.

**Endpoints:**
- `GET /api/notifications` — paginated list for current user. Filters: `recipientId` is auto-set to current user (no cross-user viewing in V1). Query params: `page`, `limit`, `unreadOnly` (boolean). Returns `{ data: NotificationDto[], meta: { total, page, limit, totalPages, unreadCount } }`. The `unreadCount` is always returned regardless of pagination — it's used by the bell badge.
- `PATCH /api/notifications/:id/read` — mark single notification as read. Sets `readAt = now()`, `status = READ`. Returns 200 with updated notification.
- `PATCH /api/notifications/read-all` — mark all unread notifications as read for the current user. Bulk update: `UPDATE notifications SET read_at = now(), status = 'READ' WHERE recipient_id = :userId AND firm_id = :firmId AND read_at IS NULL`. Returns `{ updatedCount: number }`.
- `GET /api/notifications/unread-count` — lightweight endpoint returning `{ count: number }`. Called on app load and periodically by the frontend to update the bell badge.

**Real-time vs polling:** Polling. The Out of Scope section explicitly states "Real-time updates (WebSocket/SSE) — Polling sufficient at MVP scale." The frontend polls `GET /api/notifications/unread-count` every 60 seconds to update the badge. No WebSocket/SSE infrastructure needed.

**Notification status mapping:** The Prisma `Notification` model uses `status` (PENDING, SENT, FAILED, READ) and `readAt`. For in-app notifications, `PENDING` means created but not yet "delivered to client" — since there's no push channel, we treat PENDING as SENT on first list fetch. The mark-read flow sets `status = READ` and `readAt = now()`. The `sentAt` field is set when the notification is first returned in a list response (lazy marking — or just set it to `createdAt` since in-app delivery is instant). **Simplification for V1:** Set `status = SENT` and `sentAt = now()` at creation time in `TaskNotificationHelper.createNotification()`. This avoids the PENDING->SENT transition complexity. The only status transition the API needs is SENT->READ.

**Notification grouping:** No grouping in V1. Each notification is a separate row. If a user gets 5 task assignments, they see 5 separate notifications. Grouping (e.g., "3 tasks assigned to you") is a V1.5 optimization if notification volume becomes noisy.

### Notification Bell UX

**Dropdown, not full page.** Clicking the notification bell in the topbar opens a dropdown panel (max 300px wide, max 400px tall, scrollable). Shows the most recent 20 notifications with a "View all" link at the bottom that navigates to `/notifications` (a full page, but this is a stretch goal — for V1, the dropdown is the primary interface).

**Dropdown contents:**
- Header: "Notifications" with "Mark all read" text button on the right
- List of notification items: icon (based on type), title, body (truncated to 1 line), relative timestamp ("2h ago"), unread dot indicator
- Clicking a notification: marks it as read, navigates to the entity (e.g., `/tasks/:entityId` for task notifications)
- Empty state: "No notifications yet"
- Footer: "View all notifications" link (navigates to `/notifications` full page — optional, implement if time allows)

**Unread badge:** A red dot with count on the bell icon. Shows count if > 0, hidden if 0. Count capped at "99+" for display. Updated via polling every 60 seconds + after any mark-read action.

**Frontend component:** New `NotificationBell.svelte` component in `$lib/components/layout/`. It replaces the current placeholder bell button in `Topbar.svelte`. Uses a Svelte 5 `$state` for `isOpen` (dropdown visibility) and `unreadCount`. Fetches unread count on mount and sets up a 60-second interval.

### Dashboard Layout (PAGE-06)

**Route:** `/` (the root app route, already exists as a placeholder in `(app)/+page.svelte`)

**Layout:** Card-based grid layout. Three sections stacked vertically on mobile, arranged in a responsive grid on desktop.

**Section 1: Task Summary Cards (top row, 3-4 cards)**
- "Overdue" — count of my tasks where `dueDate < today` and status not DONE/CANCELLED. Red accent. Click navigates to `/tasks?overdue=true&assignee=me`.
- "Due Today" — count of my tasks due today. Amber accent. Click navigates to `/tasks?dueDate=today&assignee=me`.
- "Due This Week" — count of my tasks due within 7 days. Blue accent. Click navigates to `/tasks?dueDateRange=thisWeek&assignee=me`.
- "In Review" (for Partner/Manager only) — count of tasks in PARTNER_APPROVAL/UNDER_REVIEW status awaiting their action. Purple accent. Click navigates to approval queue section.

**Section 2: My Tasks + Approval Queue (middle, two columns on desktop)**
- Left column: "My Tasks" — a compact list of the user's top 10 tasks ordered by due date ASC, with status badge, priority dot, and due date. "View all" links to `/tasks?assignee=me`.
- Right column (Partner/Manager only): "Approval Queue" — tasks in PARTNER_APPROVAL or UNDER_REVIEW where the current user is the reviewer or assigned partner. Shows task title, client name, due date, priority. Max 10 items with "View all" link.

**Section 3: Recent Notifications (bottom)**
- Latest 5 notifications for the current user. Same item format as the bell dropdown. "View all" links to notifications.

**Data fetching approach:** A single `GET /api/dashboard` endpoint that returns all aggregated data in one response. This avoids multiple round-trips on page load. The endpoint internally runs parallel queries for task counts, task lists, approval queue, and recent notifications.

**Dashboard endpoint response shape:**
```
{
  taskSummary: {
    overdue: number,
    dueToday: number,
    dueThisWeek: number,
    inReview: number  // 0 for non-Partner/Manager roles
  },
  myTasks: TaskSummaryDto[],      // top 10, compact
  approvalQueue: TaskSummaryDto[], // top 10, compact (empty for non-Partner/Manager)
  recentNotifications: NotificationDto[] // latest 5
}
```

### Team Workload (TEAM-01, PAGE-07)

**Endpoint:** `GET /api/team/workload` — returns computed workload for all active users in the firm.

**Computation (per PRD 11.2):**
```
For each active user:
  open_task_count = COUNT(tasks WHERE assignee_id = user AND status NOT IN (DONE, CANCELLED))
  overdue_task_count = COUNT(tasks WHERE assignee_id = user AND status NOT IN (DONE, CANCELLED) AND due_date < today)
  due_this_week_count = COUNT(tasks WHERE assignee_id = user AND status NOT IN (DONE, CANCELLED) AND due_date BETWEEN today AND today+7)
```

**Load status thresholds (per PRD):**
- Compute firm average of `open_task_count` across all active users
- `< 0.5x average` -> `UNDERUTILISED`
- `0.5x - 1.5x average` -> `BALANCED`
- `> 1.5x average` -> `OVERLOADED`
- Edge case: if firm average is 0 (no tasks at all), everyone is `BALANCED`

**Load status is NOT an enum in the shared package — it's a computed string.** Add a `WorkloadStatus` type to `packages/shared/src/types/` with values `UNDERUTILISED | BALANCED | OVERLOADED`. This is a display-only concept, not stored in DB.

**Response shape:**
```
{
  data: WorkloadUserDto[],
  firmAverage: number
}
```
Where `WorkloadUserDto` = `{ userId, fullName, role, avatarUrl, openTaskCount, overdueTaskCount, dueThisWeekCount, loadStatus }`.

**Frontend (PAGE-07):** Use the existing `DataTable` component. Columns: User (name + avatar), Role, Open Tasks, Overdue, Due This Week, Load Status (colored badge — green for BALANCED, yellow for UNDERUTILISED, red for OVERLOADED). Sortable by all numeric columns. No pagination needed at MVP scale (max 50 users per firm).

### Leave Management (TEAM-02, TEAM-03, PAGE-08)

**Module:** Part of the new `apps/api/src/team/` module alongside workload. `TeamModule` with `TeamService` (workload), `LeaveService` (leave CRUD), `TeamController`.

**Endpoints:**
- `POST /api/team/leave` — create leave request. Body: `{ leaveType, startDate, endDate, isHalfDay, reason? }`. Validation: `endDate >= startDate`, `isHalfDay` only valid when `startDate === endDate`. Sets `status = PENDING`, `createdBy = currentUser`.
- `GET /api/team/leave` — list leave requests. For PARTNER/MANAGER: all firm leave requests. For others: own leave requests only. Query params: `status`, `userId`, `page`, `limit`. Ordered by `startDate DESC`.
- `PATCH /api/team/leave/:id/approve` — approve a leave request (PARTNER/MANAGER only). Sets `status = APPROVED`, `approvedBy`, `approvedAt`. Emits `ASSIGNEE_ON_LEAVE` notifications for tasks affected by the leave (tasks assigned to the user with `dueDate` within the leave range).
- `PATCH /api/team/leave/:id/reject` — reject (PARTNER/MANAGER only). Body: `{ reason? }`. Sets `status = REJECTED`, `approvedBy`, `approvedAt`.
- `PATCH /api/team/leave/:id/cancel` — cancel own leave request (only if PENDING or APPROVED and start date is in the future). Sets `status = CANCELLED`.

**Half-day handling:** The `isHalfDay` boolean is a simple flag. When `isHalfDay = true`, `startDate` must equal `endDate` (single day). The UI shows a toggle: "Half day" that becomes available only when a single date is selected. No AM/PM distinction in V1 — it's just a flag that the person is partially available that day.

**Approval flow UX:** The leave page has two views (toggled via tabs):
- "My Leave" tab — the user's own leave requests (all users see this). Shows a list with status badges. "Request Leave" button opens a form (inline on the page or modal — use modal for consistency with engagement creation pattern).
- "Approvals" tab (PARTNER/MANAGER only) — pending leave requests from team members. Each row shows: user name, leave type, date range, half-day indicator, reason, Approve/Reject buttons inline.

**Calendar view vs list:** List view only in V1. A calendar heatmap showing team availability is a nice-to-have but not worth the build time. The list with date ranges is sufficient.

### Approval Queue (TEAM-04)

**Endpoint:** `GET /api/team/approval-queue` — tasks in PARTNER_APPROVAL status where the current user is the reviewer or the engagement/client's assigned partner. Per PRD 11.3:
```sql
WHERE status = 'PARTNER_APPROVAL'
  AND firm_id = current_firm
  AND (reviewer_id = current_user OR engagement.assigned_partner_id = current_user)
ORDER BY due_date ASC, priority DESC
```
Paginated. Returns compact task DTOs (id, title, clientName, dueDate, priority, assigneeName).

**This also feeds the Dashboard's approval queue section.** The dashboard endpoint calls the same underlying service method with `limit: 10`.

### Recently Deleted (DEL-01, DEL-02, DEL-03, PAGE-12)

**Endpoint:** `GET /api/recently-deleted` — queries across all soft-deletable entity tables. PARTNER/ADMIN only.

**Implementation approach:** Query each entity table separately (clients, engagements, tasks, leave records) for records where `deletedAt IS NOT NULL AND deletedAt > now() - 30 days`. Union the results into a single list sorted by `deletedAt DESC`. Each result includes: `entityType` (Client, Engagement, Task), `entityId`, `name` (display name or title), `deletedAt`, `deletedBy` (user name), `daysUntilPermanentDeletion` (computed: `30 - daysSince(deletedAt)`).

**Why not a single polymorphic query?** Prisma doesn't support cross-table unions natively. Running 3-4 parallel queries and merging in-memory is simple, fast at MVP scale (50 firms, few deleted records), and avoids raw SQL.

**Entity tables to query:** `clients`, `engagements`, `tasks`. Leave records are soft-deletable but unlikely to be restored — include them anyway for completeness. Comments and checklist items are sub-resources that get restored with their parent.

**Restore endpoint:** `POST /api/recently-deleted/:entityType/:entityId/restore` — sets `deletedAt = null`, `deletedBy = null` on the record. PARTNER only (per PRD: "PARTNER can restore any soft-deleted record within 30 days"). Validates the record was deleted within 30 days. For clients: also check if restoring would violate unique constraints (e.g., duplicate display_name if another client was created with the same name after deletion).

**Frontend (PAGE-12):** A single-page list using `DataTable`. Columns: Entity Type (badge), Name (linked), Deleted By, Deleted At, Days Remaining (countdown badge — green if >15, yellow if 7-15, red if <7), Restore button. Filter by entity type. Sorted by deletion date (newest first).

### Firm Settings Page (PAGE-09)

**Route:** `/settings` (already exists as a placeholder)

**Endpoint:** `GET /api/firms/settings` — returns current firm settings. `PATCH /api/firms/settings` — updates firm settings (PARTNER/ADMIN only). These can go on the existing firm module or a new `settings` controller — simplest is to add them to a `FirmSettingsController` in the existing `apps/api/src/` structure, or just add endpoints to whatever module manages firm data.

**V1 settings fields (from `FirmSettings` type):**
- `default_internal_deadline_buffer_days` (number, 1-30, default 3) — how many days before due date to set internal deadline
- `auto_task_generation_enabled` (boolean, default true) — deferred to V1.1 but show the toggle
- `require_partner_approval_for` (string[], engagement type codes) — which engagement types require partner approval before DONE

**Settings fields to NOT show in V1 (deferred features):**
- `whatsapp_notifications_enabled` — WhatsApp is out of scope
- `compliance_calendar_auto_populate` — compliance is out of scope

**Frontend layout:** Simple form with sections:
- "Task Defaults" section: buffer days input (number stepper)
- "Workflow" section: partner approval toggle with engagement type multi-select
- Save button at the bottom. Use toast for success/error feedback.

### User Management Page (PAGE-10)

**Route:** `/settings/users` — nested under settings. Alternatively `/team/users`. Decision: nest under `/settings/users` since it's an admin function, not a daily team view. Add a "Users" tab or link on the settings page, or make settings a tabbed page with "General" and "Users" tabs.

**Better approach:** Make `/settings` a tabbed page with:
- "General" tab — firm settings (buffer days, toggles)
- "Users" tab — user management

This keeps admin functions together and avoids adding another top-level sidebar item.

**Existing backend:** The `UserController` already has `GET /api/users` (list), `POST /api/users` (create), `PATCH /api/users/:id` (update), `PATCH /api/users/:id/deactivate`. All are PARTNER/ADMIN gated. The backend is 100% done — this is frontend-only work.

**Frontend:**
- User list using `DataTable`. Columns: Name, Email, Role (StatusBadge), Status (Active/Inactive badge), Last Login, Actions (Edit, Deactivate).
- "Invite User" button opens a Modal with form: email, full name, role (Select from UserRole enum), temporary password. On submit, calls `POST /api/users`.
- Edit: clicking Edit opens a Modal pre-filled with user data. Editable fields: full name, phone, role. On submit, calls `PATCH /api/users/:id`.
- Deactivate: clicking Deactivate opens a ConfirmDialog. If the user has open tasks, the dialog shows: "This user has N open tasks that will need reassignment." Calls `PATCH /api/users/:id/deactivate`. The response includes `openTasksCount`.

**Deactivation with task reassignment warning (USER-04):** The deactivation endpoint already returns `openTasksCount`. Before calling the endpoint, we could pre-fetch the count, or just call deactivate and show the count in the success message. Simpler approach: show a confirm dialog saying "Are you sure you want to deactivate [Name]?", call the endpoint, and if successful, show a toast: "User deactivated. N open tasks need reassignment." The task reassignment itself is manual — the partner/manager needs to go reassign those tasks. No automatic reassignment in V1.

### Audit Log Page (PAGE-11)

**Route:** `/settings/audit-log` — or a third tab on the settings page. Since the settings page uses tabs, add "Audit Log" as the third tab. But an audit log is a dense, full-width table that doesn't fit well as a tab alongside a compact form. Better as a separate route: `/audit-log`. Add it to the sidebar under Settings, or as a link from the settings page.

**Decision: Separate route `/audit-log`.** The audit log is dense enough to warrant its own page. Add a link to it from the settings page ("View Audit Log" button/link) and optionally add it to the sidebar navigation.

**Existing backend:** `GET /api/audit-log` already exists with filters (userId, entityType, entityId, action, from, to, page, limit). PARTNER/ADMIN only. Fully functional.

**Frontend:**
- `DataTable` with columns: Timestamp (formatted), User (name), Action, Entity Type, Entity ID (linked if navigable), IP Address.
- Filter bar at the top: User picker, Entity Type dropdown (Client, Engagement, Task, User, etc.), Action text search, Date range (from/to DatePickers).
- Pagination (server-side, matching existing pattern).
- Each row is expandable or has a detail view showing the full `metadata` JSON — or just show metadata as a tooltip/popover on the action column. For V1, show metadata inline as a compact JSON preview if it's not empty.

**Entry display format:** The `action` field is a string like "POST /api/tasks" or a semantic action name. Display as-is in V1. The `metadata` field contains old/new values. Show a collapsible "Details" section per row for non-empty metadata.

### Module and Route Structure

**New backend modules:**
- `apps/api/src/notification/` — NotificationModule (controller, service, DTOs)
- `apps/api/src/team/` — TeamModule (controller, team.service for workload, leave.service for leave CRUD, DTOs)
- `apps/api/src/dashboard/` — DashboardModule (controller, service that aggregates data from other services, DTOs)
- `apps/api/src/recently-deleted/` — RecentlyDeletedModule (controller, service, DTOs)
- Firm settings endpoints — add to existing firm-related module or create `apps/api/src/firm-settings/`

**New frontend routes:**
- `(app)/+page.svelte` — Dashboard (replace placeholder)
- `(app)/+page.server.ts` — Dashboard SSR data loading
- `(app)/team/+page.svelte` — Team workload (replace placeholder)
- `(app)/team/+page.server.ts` — Team workload SSR
- `(app)/team/leave/+page.svelte` — Leave management
- `(app)/team/leave/+page.server.ts` — Leave SSR
- `(app)/settings/+page.svelte` — Settings with General/Users tabs (replace placeholder)
- `(app)/settings/+page.server.ts` — Settings SSR
- `(app)/audit-log/+page.svelte` — Audit log
- `(app)/audit-log/+page.server.ts` — Audit log SSR
- `(app)/recently-deleted/+page.svelte` — Recently deleted
- `(app)/recently-deleted/+page.server.ts` — Recently deleted SSR

**New frontend components:**
- `$lib/components/layout/NotificationBell.svelte` — bell with dropdown
- `$lib/components/dashboard/TaskSummaryCard.svelte` — stat card for dashboard
- `$lib/components/team/WorkloadBadge.svelte` — colored load status indicator

**Sidebar updates:** Add "Audit Log" and "Recently Deleted" to sidebar. Decision: Add them under a collapsible "Admin" section at the bottom of the sidebar, visible only to PARTNER/ADMIN roles. This keeps the main navigation clean for all users while giving admins easy access.

Updated sidebar structure:
- Dashboard
- Clients
- Engagements
- Tasks
- Team
- Settings
- (Admin section — PARTNER/ADMIN only)
  - Audit Log
  - Recently Deleted

### Claude's Discretion

- Exact notification polling interval (60s is the recommendation, but 30s or 90s are fine)
- Dashboard card layout grid breakpoints and spacing
- Whether the "Approvals" section on dashboard shows PARTNER_APPROVAL tasks only or also UNDER_REVIEW
- Exact DataTable column widths and responsive truncation for audit log
- Whether leave request form is a modal or inline — modal is recommended for consistency
- Exact notification dropdown positioning (absolute vs fixed, width, max-height)
- Whether to use `lucide-svelte` icon per notification type or a single bell icon for all
- Workload table sort defaults
- Audit log metadata display format (JSON viewer vs key-value list vs tooltip)
- Whether Recently Deleted page shows a "Permanently Delete" action for PARTNER (not in requirements, skip for V1)
- Dashboard greeting text and time-of-day awareness ("Good morning, {name}")
- Whether the firm settings form uses auto-save or explicit save button (explicit save is recommended)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- **FirmScopedService** (`common/base/firm-scoped.service.ts`): Abstract base providing `this.prisma` (firm-scoped), `this.unscopedPrisma`, `this.getFirmId()`, `this.getUserId()`
- **TaskNotificationHelper** (`task/task-notification.helper.ts`): Already writes notifications to the `notifications` table for task events (TASK_ASSIGNED, TASK_REVIEW_REQUESTED, TASK_APPROVAL_REQUESTED, TASK_SENT_BACK, TASK_DEPENDENCY_UNBLOCKED, COMMENT_MENTION). Uses `createNotification()` with `channel = IN_APP`, `status = PENDING`. Phase 6 needs to change this to `status = SENT, sentAt = now()` for V1 simplification.
- **ActionLogService** (`action-log/action-log.service.ts`): Fire-and-forget `log()` method + `listActionLogs()` query with filters. `ActionLogController` already exposes `GET /api/audit-log` for PARTNER/ADMIN.
- **UserService** (`user/user.service.ts`): Full CRUD already implemented — `listUsers()`, `createUser()`, `updateUser()`, `deactivateUser()` with open task count. UserController exposes all endpoints.
- **FirmSettings type** (`packages/shared/src/types/firm-settings.type.ts`): `{ default_internal_deadline_buffer_days, auto_task_generation_enabled, whatsapp_notifications_enabled, compliance_calendar_auto_populate, require_partner_approval_for }`.
- **Shared enums**: `NotificationType` (19 values), `NotificationChannel` (IN_APP, EMAIL, WHATSAPP), `NotificationStatus` (PENDING, SENT, FAILED, READ), `LeaveType` (6 values), `LeaveStatus` (4 values), `UserRole` (5 values), `TaskStatus` (7 values).
- **UI Components**: DataTable, Modal, FormField, StatusBadge, StatusTransitionDropdown, UserPicker, ClientPicker, DatePicker, FilterBar, EmptyState, LoadingSkeleton, ConfirmDialog, Button, Input, Tabs, TagInput, Select, GroupedSelect, InlineEdit, MultiSelect, ViewToggle, ToastContainer.
- **Layout components**: Sidebar.svelte (with nav items array), Topbar.svelte (with placeholder bell), Breadcrumbs.svelte, UserMenu.svelte.
- **Notification Preferences type** (`packages/shared/src/types/notification-preferences.type.ts`): `{ in_app, email, whatsapp, muted_until }`.

### Established Backend Patterns
- **Pagination response**: `{ data: T[], meta: { total, page, limit, totalPages } }` — used everywhere
- **Soft-delete pattern**: `update({ data: { deletedAt: new Date(), deletedBy: this.getUserId() } })` — used in ClientService, TaskService
- **Fire-and-forget writes**: `this.prisma.create(...).catch(err => this.logger.error(...))` — used in ActionLogService. Apply same pattern for non-critical writes.
- **Guards**: JwtAuthGuard, RolesGuard, FirmScopeGuard — applied globally
- **Role-gated endpoints**: `@Roles(UserRole.PARTNER, UserRole.ADMIN)` decorator
- **Computed views**: Workload and approval queue are computed on request, not stored — per PRD.
- **DTO validation**: class-validator decorators on DTOs, ValidationPipe globally

### Established Frontend Patterns
- **Route groups**: `(app)/` prefix for authenticated routes with layout
- **Data fetching**: SvelteKit `+page.server.ts` for SSR, `api()` for client-side mutations, `invalidateAll()` after mutations
- **Svelte 5 runes**: `$state`, `$derived`, `$props` throughout
- **TailwindCSS v4**: CSS @import approach, complete class strings
- **Placeholder pages**: Dashboard, Team, and Settings already have placeholder `+page.svelte` files
- **Tabs pattern**: `Tabs.svelte` component available for multi-tab layouts

### Prisma Models Available
- `Notification` (15 fields, indexed on recipientId+status+createdAt, firmId)
- `LeaveRecord` (14 fields + audit, indexed on firmId and userId)
- `UserActionLog` (11 fields, immutable, indexed on firmId+occurredAt and firmId+entityType+entityId)
- `Firm` (17 fields, `settings` JSONB field with `FirmSettings` type)
- `User` (14 fields, `notificationPreferences` JSONB, relations to sessions and roleHistory)
- `Task` (24+ fields, all filter fields indexed) — queried for dashboard aggregates and workload
- `Client`, `Engagement`, `Task` — all soft-deletable, queried for Recently Deleted

### Integration Points (API Endpoints — New)
- `GET /api/notifications` — list notifications for current user (paginated, unread count in meta)
- `PATCH /api/notifications/:id/read` — mark single notification as read
- `PATCH /api/notifications/read-all` — mark all notifications as read
- `GET /api/notifications/unread-count` — lightweight unread count for bell badge
- `GET /api/dashboard` — aggregated dashboard data (task summary, my tasks, approval queue, recent notifications)
- `GET /api/team/workload` — computed workload for all active users
- `POST /api/team/leave` — create leave request
- `GET /api/team/leave` — list leave requests (own for non-managers, all for managers)
- `PATCH /api/team/leave/:id/approve` — approve leave
- `PATCH /api/team/leave/:id/reject` — reject leave
- `PATCH /api/team/leave/:id/cancel` — cancel own leave
- `GET /api/team/approval-queue` — tasks pending partner approval
- `GET /api/recently-deleted` — cross-entity soft-deleted records within 30 days
- `POST /api/recently-deleted/:entityType/:entityId/restore` — restore a deleted record
- `GET /api/firms/settings` — current firm settings
- `PATCH /api/firms/settings` — update firm settings

### Integration Points (API Endpoints — Existing, Frontend-Only Work)
- `GET /api/users` — list users (already built)
- `POST /api/users` — create user (already built)
- `PATCH /api/users/:id` — update user (already built)
- `PATCH /api/users/:id/deactivate` — deactivate user (already built)
- `GET /api/audit-log` — list audit log with filters (already built)

</code_context>

<specifics>
## Specific Ideas

### TaskNotificationHelper Status Fix
Change `TaskNotificationHelper.createNotification()` to set `status: NotificationStatus.SENT` and `sentAt: new Date()` at creation time instead of the current `PENDING` default. This means all in-app notifications are immediately "sent" (they're written to the DB, which IS delivery for in-app) and the only transition needed is SENT -> READ when the user clicks. Avoids a confusing PENDING state that never transitions automatically.

### Dashboard API — Single Endpoint, Parallel Queries
The `DashboardService.getDashboard()` method should run all queries in `Promise.all()`:
```
const [taskSummary, myTasks, approvalQueue, recentNotifications] = await Promise.all([
  this.getTaskSummary(userId),
  this.getMyTasks(userId, 10),
  this.getApprovalQueue(userId, 10),
  this.getRecentNotifications(userId, 5),
]);
```
This keeps the dashboard response time bounded by the slowest single query, not the sum of all queries.

### Workload Load Status Color Mapping
Use StatusBadge with custom variants for workload:
- `UNDERUTILISED` -> yellow/amber (not bad, just worth noting)
- `BALANCED` -> green
- `OVERLOADED` -> red

### Leave Request Validation
- `endDate >= startDate` — basic
- `isHalfDay = true` only when `startDate === endDate`
- Cannot create leave for past dates (allow today but not yesterday)
- Cannot have overlapping approved leaves for the same user (check for date range overlap with APPROVED or PENDING records)

### Recently Deleted — Days Countdown Badge
Compute `daysRemaining = 30 - Math.floor((now - deletedAt) / (1000 * 60 * 60 * 24))`. Display as a countdown badge: "27 days" (green), "12 days" (yellow), "3 days" (red). Color thresholds: > 15 = green, 7-15 = yellow, < 7 = red.

### Settings Page — Tabbed Layout
Two tabs on `/settings`:
- "General" — firm settings form (buffer days, approval config)
- "Users" — DataTable of users with invite/edit/deactivate actions

This is cleaner than separate routes and leverages the existing `Tabs.svelte` component. The URL doesn't need to change per tab — use client-side tab state (or `?tab=users` query param for shareability).

### Sidebar Admin Section
The sidebar currently has a flat nav list. For admin links (Audit Log, Recently Deleted), add a collapsible "Admin" section that only renders for PARTNER/ADMIN users. The user's role is available from `$page.data.user.role`. Keep it visually distinct — a divider line above, slightly different label style ("ADMIN" in small caps).

### Notification Type to Icon Mapping
Map `NotificationType` to lucide icons for the notification dropdown:
- `TASK_ASSIGNED` -> UserPlus
- `TASK_REVIEW_REQUESTED` / `TASK_APPROVAL_REQUESTED` -> ClipboardCheck
- `TASK_SENT_BACK` -> RotateCcw
- `TASK_DEPENDENCY_UNBLOCKED` -> Unlock
- `COMMENT_MENTION` -> AtSign
- Default -> Bell

### Notification Click Navigation
Map `entityType + entityId` to route:
- `entityType = 'Task'` -> `/tasks/${entityId}`
- `entityType = 'Client'` -> `/clients/${entityId}`
- `entityType = 'Engagement'` -> `/engagements/${entityId}` (if engagement detail page exists)
- Fallback: no navigation, just mark as read.

</specifics>

<deferred>
## Deferred Ideas

- **Notification grouping/batching** — Group similar notifications (e.g., "3 tasks assigned") to reduce noise. V1 shows each notification individually. Revisit if users complain about notification volume.
- **Real-time notifications via WebSocket/SSE** — Polling at 60s intervals is sufficient for V1. Add WebSocket push if users want instant notifications.
- **Email notification delivery** — All V1 notifications are in-app only. Email delivery via BullMQ + SMTP is a V1.1 feature (already marked out of scope in requirements).
- **Calendar view for leave** — A visual team availability calendar showing who's on leave. V1 uses a simple list. Calendar view is a V1.5 nicety.
- **Leave balance tracking** — Track annual leave allocation and consumed days per user. V1 just tracks requests without balance enforcement.
- **Task reassignment on deactivation** — Automatic bulk reassignment when a user is deactivated. V1 shows the warning; the admin reassigns manually by editing each task.
- **Dashboard widgets customization** — Let users rearrange or hide dashboard sections. V1 has a fixed layout.
- **Audit log export** — CSV/PDF export of audit logs. V1.1 territory.
- **Notification preferences UI** — Let users configure which notification types they want. The `notificationPreferences` JSONB field exists on User, but the settings UI is deferred. V1 delivers all in-app notifications.
- **Saved filter presets for audit log** — Named filters that admins can save and reuse. V1.1.
- **Bulk restore** — Select multiple deleted records and restore them all at once. V1 restores one at a time.
- **Full notifications page** — `/notifications` as a full-page list with filters. V1 uses the bell dropdown as the primary interface. Add the full page if time permits.
- **Dashboard time-of-day greeting** — "Good morning, {name}" with dynamic greeting based on IST time. Nice touch but low priority.
- **Workload trend charts** — Historical workload graphs showing how team capacity changed over time. Requires stored snapshots, not V1.

</deferred>
