# Phase 4: Client & Engagement Management - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can manage their client base with validated PAN/TAN/CIN/GST data and create engagements that optionally instantiate task chains from templates. This is the first full-stack domain feature — NestJS backend CRUD plus SvelteKit frontend pages — building on the auth system (Phase 2) and component library (Phase 3). Everything here feeds the task engine in Phase 5.

**Backend scope:** Client module (CRUD + GST numbers + validation + soft delete), Engagement module (CRUD + lifecycle transitions + template task instantiation), EngagementType seed data.

**Frontend scope:** Client list page (PAGE-01), Client detail page with tabs (PAGE-02), Engagement list page with create modal (PAGE-03).

</domain>

<decisions>
## Implementation Decisions

### Backend Module Structure

- Follow the established pattern from `auth/` and `user/`: each domain gets its own top-level directory under `apps/api/src/` (not nested in a `modules/` folder)
- Structure: `client/` with `client.module.ts`, `client.controller.ts`, `client.service.ts`, `dto/` subfolder; same for `engagement/`
- Both services extend `FirmScopedService` for automatic firm scoping — `this.prisma` auto-injects firm_id, `this.getFirmId()` / `this.getUserId()` available
- GST number CRUD lives on the ClientService (nested resource, not a separate module) — endpoints are `POST /clients/:id/gst-numbers`, `PATCH /clients/:id/gst-numbers/:gstId`, `DELETE /clients/:id/gst-numbers/:gstId`
- Register both modules in `app.module.ts` imports array, same as UserModule

### DTO Validation Approach

- class-validator decorators matching the existing user DTO patterns (IsString, IsEnum, IsOptional, Matches, etc.)
- PAN/TAN/CIN/GSTIN validation via `@Matches()` using the shared `REGEX` constants from `@ca-practice-os/shared`
- List/query DTOs use `@Type(() => Number)` + `@IsInt()` + `@Min()/@Max()` for pagination params, `@Transform()` for boolean coercion — same as `ListUsersQueryDto`
- Response DTOs are plain interfaces/classes with a `toResponse()` mapper method on the service (same pattern as `toUserResponse()` in UserService)
- Engagement create DTO includes optional `auto_create_tasks: boolean` flag (defaults to false)

### Client display_name Uniqueness (CLIENT-03)

- Case-insensitive uniqueness enforced at the service level via a `findFirst` check before create/update (same pattern as email uniqueness in UserService)
- No DB unique index needed since it's per-firm and case-insensitive — the Prisma scoped client + `mode: 'insensitive'` handles it
- Throw `ConflictException('Client with this display name already exists in your firm')` on collision

### Client Assignment Role Validation (CLIENT-09)

- When `assignedPartnerId` is provided, validate that the user exists in the firm and has role `PARTNER`
- Same for `assignedManagerId` (MANAGER or PARTNER), `assignedJuniorId` (JUNIOR_CA), `assignedArticleId` (ARTICLE)
- Validation done in the service layer via simple Prisma lookups — if role mismatch, throw `BadRequestException('Assigned partner must have PARTNER role')`
- Batch the lookups with Promise.all for efficiency

### Client Soft Delete (CLIENT-07)

- `DELETE /clients/:id` soft-deletes (sets `deleted_at`, `deleted_by`)
- Before soft-deleting, check for active engagements (status ACTIVE or ON_HOLD) — if any exist, throw `ConflictException` with count and message
- Prisma scoped client already filters out `deleted_at IS NOT NULL` on reads, so deleted clients disappear from lists automatically

### Engagement Name Auto-Generation (ENG-02)

- Format: `"[EngagementType.name] - [Client.displayName] - [periodLabel]"` — e.g., "GST Return Filing - Acme Corp - Q1 FY25-26"
- If `periodLabel` is null, omit the last segment: `"[Type] - [Client]"`
- Only auto-generate when `name` is not provided in the DTO
- Truncate to 200 chars (DB limit) if the generated name is too long

### Engagement Partner/Manager Inheritance (ENG-03)

- When `assignedPartnerId` is null on creation, copy from `client.assignedPartnerId`
- Same for `assignedManagerId` — inherit from client if not explicitly set
- This is a one-time copy at creation, not a live link — changing the client's partner later doesn't cascade to existing engagements

### Engagement Status Transitions (ENG-06, ENG-07, ENG-08)

- Define an `ENGAGEMENT_STATUS_TRANSITIONS` map (similar to `TASK_STATUS_TRANSITIONS` in shared package):
  - ACTIVE -> ON_HOLD, COMPLETED, CANCELLED
  - ON_HOLD -> ACTIVE, CANCELLED
  - COMPLETED -> [] (terminal)
  - CANCELLED -> [] (terminal)
- Add this to `packages/shared/src/constants/` for reuse on frontend
- COMPLETED blocked if open tasks exist: query `task.count({ where: { engagementId, status: { notIn: [DONE, CANCELLED] } } })` — return blocking count in error
- CANCELLED auto-cancels child tasks: update all tasks with `status IN (TO_DO, IN_PROGRESS)` to CANCELLED, set `cancelledAt`
- Status change endpoint: `PATCH /engagements/:id/status` with body `{ status: EngagementStatus }`

### Engagement Template Task Instantiation (ENG-04)

- When `auto_create_tasks: true` is passed on engagement creation:
  1. Look up the engagement type's `defaultTaskTemplateId`
  2. If template exists and is active, fetch its `TaskTemplateItem[]` ordered by `displayOrder`
  3. For each item, create a Task record linked to the engagement and client
  4. Map `assigneeRole` to the actual user ID from the engagement/client team (e.g., JUNIOR_CA -> client.assignedJuniorId)
  5. Set `dueDate` = engagement.periodEnd + item.dueOffsetDays (if both exist)
  6. Set up task dependencies based on `dependsOnOrder` field — requires a two-pass approach (create all tasks first, then link dependencies)
- If template has no items or `auto_create_tasks` is false, just create the engagement with no tasks
- This runs synchronously within the engagement creation transaction — template chains are small (typically 3-8 tasks), so no need for a queue

### EngagementType Seed Data

- Platform-only templates in V1 (no user-created types) — seed via Prisma seed script
- Seed common CA engagement types: ITR Filing, GST Return, TDS Return, Statutory Audit, Tax Audit, ROC Filing, Company Registration, GST Registration, Bookkeeping (Monthly), etc.
- `firmId: null` on seed data means it's platform-wide; firm-specific types have `firmId` set
- Seed data includes basic task templates with 3-5 items each for common engagement types

### Client Form UX

- Single-page form (not multi-step) — client creation is straightforward enough: basic info, statutory IDs, contact, team assignment
- Form opens in a full-page route (`/clients/new`) not a modal — there are enough fields that a modal would feel cramped
- Sections within the form: Basic Info (name, entity type, constitution, status), Statutory IDs (PAN, TAN, CIN), Contact Info (name, phone, email, address), Team Assignment (partner, manager, junior, article pickers), Notes & Tags
- Inline validation: PAN/TAN/CIN/GSTIN format validated on blur with clear error messages (e.g., "PAN must be 5 letters + 4 digits + 1 letter")
- Client edit uses the same form component, pre-populated with existing data — route: `/clients/[id]/edit`

### GST Number Management

- GST numbers shown in a table on the Client Detail Overview tab
- Add GST number via a modal (small form: GSTIN, state code, trade name, registration type, isPrimary checkbox, dates)
- Edit/delete inline on the table row (edit opens same modal pre-filled, delete shows ConfirmDialog)
- "Set as Primary" action on non-primary rows — automatically unsets the current primary
- GSTIN validated on blur in the modal form using the shared REGEX

### Client Detail Page Layout (PAGE-02)

- Three tabs: **Overview**, **Engagements**, **Tasks**
- Overview tab: Two-column layout — left column has client info displayed as editable fields (click-to-edit pattern using inline inputs), right column has GST numbers table and team assignment cards
- Engagements tab: Embedded DataTable of engagements for this client, with status badges and a "New Engagement" button that opens the engagement create modal pre-filled with this client
- Tasks tab: Embedded DataTable of tasks for this client (all engagements), filterable by status — this is a read-only list linking to task detail pages (Phase 5)
- Header section: Client name, entity type badge, status badge, and action buttons (Edit, Delete with ConfirmDialog)

### Client List Page (PAGE-01)

- Top bar: Search input (searches displayName and PAN), "Add Client" button
- Filters below the search bar in a horizontal row (not sidebar): Status dropdown, Entity Type dropdown, Tag multi-select, Assigned Partner picker
- DataTable with columns: Display Name (link to detail), Entity Type, PAN, Status (StatusBadge), Partner, Open Tasks count, Actions (edit, delete)
- Server-side pagination using the existing DataTable `onPageChange` prop pattern
- Empty state when no clients exist: illustration + "Add your first client" CTA
- Loading skeleton while fetching

### Engagement List Page (PAGE-03)

- Similar layout to client list: search, horizontal filter bar, DataTable
- Filters: Client picker, Engagement Type dropdown, Status dropdown, Period filter (FY selector)
- DataTable columns: Name (link to client detail's engagements tab), Client, Type, Status (StatusBadge), Period, Partner, Task Progress (e.g., "3/7 done"), Actions
- "New Engagement" button opens a **modal** (not a full page) — engagement creation is quick: pick client, pick type, set period, toggle auto_create_tasks
- The modal shows a template preview section when `auto_create_tasks` is checked: lists the task template items (title + assignee role) so the user knows what will be created
- Template preview is read-only, fetched when the engagement type is selected

### Engagement Creation Modal UX

- Step 1 (single view, not a wizard): Client picker, Engagement Type dropdown, Period Label (text), Period Start/End (DatePickers), auto_create_tasks checkbox
- When engagement type is selected and `auto_create_tasks` is checked, show a collapsible "Template Preview" section below the form with the list of tasks that will be created
- Fee Amount and Notes fields as optional extras (collapsed by default behind a "More options" toggle)
- Partner/Manager pre-fill from the selected client's team (show as read-only with "inherited from client" hint, but editable)
- Submit creates the engagement and optionally the tasks — show a success toast with "Engagement created with N tasks" or just "Engagement created"

### Engagement Status Transition UX

- On the engagement list page and client detail engagements tab: status is shown as a StatusBadge
- Status change via a dropdown on the engagement row or detail view — shows only valid transitions (from the transition map)
- COMPLETED transition shows a ConfirmDialog: "Complete this engagement? This is permanent." — if blocked by open tasks, show "Cannot complete: N open tasks remain" with a link to view them
- CANCELLED transition shows a ConfirmDialog with warning: "Cancel this engagement? This will also cancel N open tasks."
- No standalone engagement detail page in V1 — engagement details are viewed via the client detail page's Engagements tab. If needed later (V1.1), it's easy to add.

### Error Handling UX for Complex Forms

- Field-level validation errors shown below each field (using the existing FormField error prop)
- PAN/TAN/CIN format: validate on blur, show specific format hint (e.g., "Expected format: ABCDE1234F")
- GSTIN: validate on blur, show "Invalid GSTIN format" with the expected pattern
- Server-side uniqueness errors (display_name conflict): catch the 409 response and show as a toast + highlight the field
- Engagement completion blocked: show the blocking reason in the ConfirmDialog or as a toast error with actionable message

### Frontend Data Fetching Pattern

- Use SvelteKit `+page.server.ts` load functions for initial page data (SSR) — call the API from the server using the cookie-based auth
- Client-side mutations (create, update, delete, status change) use the `api()` utility from `$lib/utils/api.ts`
- After successful mutations, invalidate the page data using `invalidateAll()` from SvelteKit or refetch via the store
- No dedicated client-side stores for clients/engagements — rely on SvelteKit's load function and page data pattern for simplicity

### Claude's Discretion

- Exact DTO field names and response shapes (follow existing patterns)
- Prisma query optimization details (select vs include, join strategies)
- Seed data: specific engagement type names, template item titles, and default task counts
- Component prop naming and slot patterns for client/engagement-specific UI
- Exact filter placement and responsive breakpoints
- Whether to use $derived or $effect for template preview reactivity
- Tab implementation approach (custom vs existing pattern)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- **FirmScopedService** (`common/base/firm-scoped.service.ts`): Abstract base providing `this.prisma` (firm-scoped), `this.unscopedPrisma`, `this.getFirmId()`, `this.getUserId()`
- **Shared REGEX constants**: `REGEX.PAN`, `REGEX.TAN`, `REGEX.CIN`, `REGEX.GSTIN` — ready for DTO validation
- **Shared enums**: `ClientStatus`, `EngagementStatus`, `EntityType`, `Constitution`, `EngagementCategory`, `GstRegistrationType`, `UserRole`, `TaskStatus`, `TaskPriority`
- **Shared LIMITS**: `MAX_TAGS_PER_ENTITY` (10), `MAX_TAG_LENGTH` (50)
- **TASK_STATUS_TRANSITIONS**: Reference pattern for building `ENGAGEMENT_STATUS_TRANSITIONS`
- **UI Components**: DataTable (server-side pagination), Modal, FormField, StatusBadge, UserPicker, ClientPicker, DatePicker, EmptyState, LoadingSkeleton, ConfirmDialog, Button, Input, ToastContainer
- **API utility**: `api<T>(path, options)` in `$lib/utils/api.ts` — handles auth, refresh, error extraction
- **Auth store**: `getAccessToken()`, `getUser()` in `$lib/stores/auth.svelte.ts`
- **Toast store**: `$lib/stores/toast.svelte.ts` for success/error notifications

### Established Backend Patterns
- **Module registration**: Add to `app.module.ts` imports array
- **Guards**: JwtAuthGuard (global), RolesGuard (global), FirmScopeGuard (global) — all applied automatically
- **Role restriction**: `@Roles(UserRole.PARTNER, UserRole.ADMIN)` decorator on controller methods
- **UUID param parsing**: `@Param('id', ParseUUIDPipe)` for route params
- **Pagination**: `{ data: T[], meta: { total, page, limit, totalPages } }` response shape
- **ActionLogInterceptor**: Automatically logs all mutations (POST/PATCH/PUT/DELETE) — no extra work needed
- **Error responses**: `ConflictException`, `BadRequestException`, `NotFoundException` — all auto-formatted by global exception filter

### Established Frontend Patterns
- **Route groups**: `(app)/` for authenticated pages, `(auth)/` for login/register
- **Placeholder pages**: `/clients`, `/engagements`, `/tasks`, `/team`, `/settings` already exist as placeholders — replace with real implementations
- **Layout**: `(app)/+layout.svelte` provides sidebar + topbar shell
- **SSR auth**: `+layout.server.ts` in `(app)` handles auth check
- **Svelte 5 runes**: `$state`, `$derived`, `$props` throughout
- **TailwindCSS v4**: CSS @import approach, all classes as complete strings

### Prisma Models Available
- `Client` (18 fields + audit + relations to gstNumbers, engagements, tasks)
- `ClientGstNumber` (11 fields + audit, indexed on clientId and firmId)
- `ClientCustomFieldDefinition` (deferred — custom field UI is out of V1 scope)
- `Engagement` (17 fields + audit + relations to client, engagementType, tasks)
- `EngagementType` (10 fields + relations to engagements, defaultTaskTemplateId)
- `TaskTemplate` + `TaskTemplateItem` (for auto_create_tasks feature)
- `Task` (referenced for engagement completion blocking + cancellation cascade)

### Integration Points
- Client CRUD: `POST/GET /api/clients`, `GET/PATCH/DELETE /api/clients/:id`
- Client GST: `POST /api/clients/:id/gst-numbers`, `PATCH/DELETE /api/clients/:id/gst-numbers/:gstId`
- Engagement CRUD: `POST/GET /api/engagements`, `GET/PATCH /api/engagements/:id`
- Engagement status: `PATCH /api/engagements/:id/status`
- Engagement types: `GET /api/engagement-types` (for dropdown + template preview)
- Template preview: `GET /api/engagement-types/:id/template` (returns task template items)

</code_context>

<specifics>
## Specific Ideas

### Engagement Status Transitions Constant
Add `ENGAGEMENT_STATUS_TRANSITIONS` to `packages/shared/src/constants/` alongside the existing `task-status-transitions.ts` — both frontend and backend consume it for validation and UI rendering.

### Client List Search
Search queries `displayName` and `pan` fields using Prisma `contains` with `mode: 'insensitive'`. Keep it simple — no full-text search engine for V1.

### Engagement Type Dropdown
The engagement type selector on the create modal should group types by `EngagementCategory` (GST, Income Tax, Audit, etc.) for easier scanning. A flat list of 15+ types would be hard to navigate.

### Period Label Helpers
For common engagement types, suggest a period label based on the recurrence type: "Q1 FY25-26" for quarterly, "FY25-26" for annually, "Mar 2026" for monthly. Show as placeholder text, user can override.

### No Standalone Engagement Detail Page
Engagements are always viewed in the context of a client (Client Detail > Engagements tab). This avoids building a separate page that mostly duplicates client detail content. The engagement row in the table is expandable or links to the client detail with the Engagements tab active.

</specifics>

<deferred>
## Deferred Ideas

- **Client custom field definitions UI** — Backend schema exists (`ClientCustomFieldDefinition`) but custom field management UI is out of V1 scope. The `customFields` JSON column on Client is available but no UI to define/render fields.
- **Engagement custom fields** — Same as above, schema exists but deferred.
- **Bulk client import (CSV)** — Common request for onboarding, but manual entry is fine for V1 with 20-50 clients.
- **Client merge/dedup** — Useful when firms have duplicate entries, but V1.1 territory.
- **Engagement cloning** — "Create similar engagement" shortcut — nice-to-have, not V1.
- **Engagement detail page** — If teams need a standalone engagement view beyond what the client detail tab provides, add in V1.1.

</deferred>
