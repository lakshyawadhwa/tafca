# Phase 4: Client & Engagement Management - Research

**Researched:** 2026-04-04
**Domain:** Full-stack NestJS CRUD + SvelteKit frontend pages for client/engagement management
**Confidence:** HIGH

## Summary

Phase 4 is the first full-stack domain feature, building NestJS backend modules (client + engagement) and SvelteKit frontend pages (client list, client detail with tabs, engagement list) on top of the Phase 2 auth system and Phase 3 component library. The codebase has extremely well-established patterns from the auth and user modules -- controller/service/DTO structure, FirmScopedService base class, pagination response shape, DTO validation with class-validator, and a global ActionLogInterceptor that automatically logs all mutations.

The frontend has a complete component library (DataTable, Modal, FormField, StatusBadge, UserPicker, ClientPicker, DatePicker, EmptyState, LoadingSkeleton, ConfirmDialog, Button, Input), a working SSR auth flow via hooks.server.ts, and a Vite proxy to the NestJS API at localhost:3000. Phase 4 needs to create 7 new UI components (Tabs, Select, GroupedSelect, FilterBar, InlineEdit, TagInput, StatusTransitionDropdown) plus 4 domain-specific components (ClientForm, GstNumberModal, EngagementCreateModal, TemplatePreview).

**Primary recommendation:** Follow the existing user module pattern exactly for both backend modules. The engagement template instantiation is the only complex piece requiring a two-pass approach (create tasks, then link dependencies). A critical enum mismatch between Prisma schema and shared package must be fixed before any DTO work begins.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Backend Module Structure:**
- Follow the established pattern from `auth/` and `user/`: each domain gets its own top-level directory under `apps/api/src/` (not nested in a `modules/` folder)
- Structure: `client/` with `client.module.ts`, `client.controller.ts`, `client.service.ts`, `dto/` subfolder; same for `engagement/`
- Both services extend `FirmScopedService` for automatic firm scoping
- GST number CRUD lives on the ClientService (nested resource, not a separate module)
- Register both modules in `app.module.ts` imports array, same as UserModule

**DTO Validation Approach:**
- class-validator decorators matching existing user DTO patterns
- PAN/TAN/CIN/GSTIN validation via `@Matches()` using shared `REGEX` constants
- List/query DTOs use `@Type(() => Number)` + `@IsInt()` + `@Min()/@Max()` for pagination
- Response DTOs are plain classes with a `toResponse()` mapper method on the service
- Engagement create DTO includes optional `auto_create_tasks: boolean` flag

**Client display_name Uniqueness (CLIENT-03):**
- Case-insensitive uniqueness enforced at the service level via `findFirst` check
- Prisma scoped client + `mode: 'insensitive'` handles it
- Throw `ConflictException` on collision

**Client Assignment Role Validation (CLIENT-09):**
- Validate user exists in firm and has correct role
- Batch lookups with Promise.all

**Client Soft Delete (CLIENT-07):**
- Check for active engagements before soft-deleting
- Throw ConflictException if any exist

**Engagement Name Auto-Generation (ENG-02):**
- Format: `"[EngagementType.name] - [Client.displayName] - [periodLabel]"`
- Truncate to 200 chars

**Engagement Partner/Manager Inheritance (ENG-03):**
- Copy from client when null on creation (one-time copy)

**Engagement Status Transitions (ENG-06, ENG-07, ENG-08):**
- `ENGAGEMENT_STATUS_TRANSITIONS` map in `packages/shared/src/constants/`
- ACTIVE -> ON_HOLD, COMPLETED, CANCELLED; ON_HOLD -> ACTIVE, CANCELLED; COMPLETED -> []; CANCELLED -> []
- COMPLETED blocked if open tasks exist
- CANCELLED auto-cancels TO_DO and IN_PROGRESS child tasks
- Status change endpoint: `PATCH /engagements/:id/status`

**Engagement Template Task Instantiation (ENG-04):**
- Two-pass approach: create all tasks first, then link dependencies
- Map `assigneeRole` to actual user ID from client team
- Set dueDate from engagement.periodEnd + item.dueOffsetDays
- Synchronous within engagement creation transaction

**EngagementType Seed Data:**
- Platform-only templates in V1 (firmId: null)
- Seed script already exists with 11 engagement types
- Task template seed exists for GST Monthly (7 items)

**Client Form UX:**
- Single-page form (not multi-step), full-page route (`/clients/new`)
- Sections: Basic Info, Statutory IDs, Contact Info, Team Assignment, Notes & Tags
- PAN/TAN/CIN/GSTIN validated on blur

**GST Number Management:**
- Table on Client Detail Overview tab, modal for add/edit
- "Set as Primary" automatically unsets current primary

**Client Detail Page (PAGE-02):**
- Three tabs: Overview, Engagements, Tasks
- Overview: two-column (info + GST/team), inline editable fields
- Engagements tab: embedded DataTable with "New Engagement" button
- Tasks tab: read-only list linking to task detail (Phase 5)

**Client List Page (PAGE-01):**
- Search, horizontal filter bar, DataTable, server-side pagination
- Empty state when no clients exist

**Engagement List Page (PAGE-03):**
- Same structure as client list
- "New Engagement" opens modal (not full page)
- Template preview section in modal

**Engagement Status Transition UX:**
- StatusBadge as dropdown trigger showing valid transitions
- COMPLETED/CANCELLED show ConfirmDialog

**Frontend Data Fetching:**
- SvelteKit `+page.server.ts` load functions for SSR
- Client-side mutations use `api()` utility
- After mutations, use `invalidateAll()` from SvelteKit
- No dedicated stores for clients/engagements

**No Standalone Engagement Detail Page in V1**

### Claude's Discretion
- Exact DTO field names and response shapes (follow existing patterns)
- Prisma query optimization details (select vs include, join strategies)
- Seed data: specific engagement type names, template item titles, default task counts
- Component prop naming and slot patterns
- Exact filter placement and responsive breakpoints
- Whether to use $derived or $effect for template preview reactivity
- Tab implementation approach

### Deferred Ideas (OUT OF SCOPE)
- Client custom field definitions UI
- Engagement custom fields
- Bulk client import (CSV)
- Client merge/dedup
- Engagement cloning
- Standalone engagement detail page
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLIENT-01 | Create client with display name, entity type, PAN/TAN/CIN, contact, team | FirmScopedService pattern from UserService, REGEX constants for validation, UserPicker for team |
| CLIENT-02 | PAN, TAN, CIN validated by regex on create/update | Shared `REGEX.PAN`, `REGEX.TAN`, `REGEX.CIN` constants via `@Matches()` decorator |
| CLIENT-03 | Client display_name unique per firm (case-insensitive) | Prisma `findFirst` with `mode: 'insensitive'` -- same as email check in UserService |
| CLIENT-04 | List clients with pagination, search, filters | ListUsersQueryDto pattern, `Promise.all([findMany, count])`, `{ data, meta }` response |
| CLIENT-05 | Client detail with GST numbers, team, counts | Prisma `include` for relations, `_count` for engagement/task counts |
| CLIENT-06 | Update client fields | UpdateUserDto partial pattern |
| CLIENT-07 | Soft-delete blocked if active engagements | Check engagement count with `status IN (ACTIVE, ON_HOLD)`, ConflictException |
| CLIENT-08 | GST number CRUD with GSTIN validation | Nested resource on ClientService, `REGEX.GSTIN`, isPrimary toggle logic |
| CLIENT-09 | Assignment fields verify user role | Promise.all lookups + role check, BadRequestException on mismatch |
| ENG-01 | Create engagement linked to client and type | Engagement model with clientId + engagementTypeId, verify client exists |
| ENG-02 | Auto-generated name "[Type] - [Client] - [Period]" | Service-level generation when name not provided |
| ENG-03 | Partner/Manager inherited from client when null | One-time copy in create method |
| ENG-04 | Optional task chain instantiation from template | TaskTemplate + TaskTemplateItem models, two-pass creation, role-to-user mapping |
| ENG-05 | List engagements with filters | Same pagination pattern as client list |
| ENG-06 | Engagement status transitions | `ENGAGEMENT_STATUS_TRANSITIONS` map in shared package |
| ENG-07 | COMPLETED blocked if open tasks exist | Query `task.count` with status filter |
| ENG-08 | CANCELLED auto-cancels child tasks | Bulk update tasks, set cancelledAt |
| PAGE-01 | Client list with filters, search, pagination | DataTable server-side mode, +page.server.ts SSR load, filter state in URL params |
| PAGE-02 | Client detail with tabs (Overview, Engagements, Tasks) | New Tabs component, InlineEdit, GstNumberModal, embedded DataTables |
| PAGE-03 | Engagement list with create modal | DataTable, Modal (lg), GroupedSelect, TemplatePreview, ClientPicker |
</phase_requirements>

## Standard Stack

### Core (Already in Project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| NestJS | 10.x | Backend framework | Already installed, all patterns established |
| Prisma | 5.x | ORM + schema | Multi-file schema, $extends for firm scoping |
| class-validator | 0.14.x | DTO validation | Already in use for auth/user DTOs |
| class-transformer | 0.5.x | DTO transformation | `@Type()`, `@Transform()` for query params |
| @ca-practice-os/shared | workspace | Shared enums, constants, types | Source-level imports, no build step |
| SvelteKit | 2.x | Frontend framework | SSR load functions, form actions |
| TailwindCSS | 4.x | Styling | @tailwindcss/vite plugin, config-free |
| lucide-svelte | latest | Icons | Used throughout existing components |

### Supporting (No New Dependencies)

No new packages are needed. Phase 4 uses exclusively what is already installed. The component library from Phase 3 provides all UI primitives. Backend uses the same NestJS + Prisma + class-validator stack.

## Architecture Patterns

### Backend Module Structure (from existing codebase)

```
apps/api/src/
  client/
    client.module.ts          # NestModule with imports, controllers, providers, exports
    client.controller.ts      # REST endpoints, ParseUUIDPipe, @Roles decorator
    client.service.ts         # extends FirmScopedService, business logic
    dto/
      create-client.dto.ts    # class-validator decorators
      update-client.dto.ts    # PartialType or manual optional fields
      list-clients-query.dto.ts  # pagination + filter params
      client-response.dto.ts  # response shapes + PaginatedClientsResponse
      create-gst-number.dto.ts
      update-gst-number.dto.ts
  engagement/
    engagement.module.ts
    engagement.controller.ts
    engagement.service.ts
    dto/
      create-engagement.dto.ts
      update-engagement.dto.ts
      list-engagements-query.dto.ts
      engagement-response.dto.ts
      change-engagement-status.dto.ts
  engagement-type/
    engagement-type.module.ts
    engagement-type.controller.ts
    engagement-type.service.ts
```

### Pattern 1: FirmScopedService Base (source: firm-scoped.service.ts)

```typescript
@Injectable()
export class ClientService extends FirmScopedService {
  private readonly logger = new Logger(ClientService.name);

  constructor(prismaService: PrismaService) {
    super(prismaService);
  }

  // this.prisma -> firm-scoped + soft-delete filtered
  // this.unscopedPrisma -> raw client
  // this.getFirmId() -> current firm from AsyncLocalStorage
  // this.getUserId() -> current user from AsyncLocalStorage
}
```

### Pattern 2: Paginated List (source: user.service.ts)

```typescript
async listClients(query: ListClientsQueryDto): Promise<PaginatedClientsResponseDto> {
  const { search, status, entityType, page = 1, limit = 20 } = query;
  const where: Record<string, any> = {};

  if (status) where.status = status;
  if (entityType) where.entityType = entityType;
  if (search) {
    where.OR = [
      { displayName: { contains: search, mode: 'insensitive' } },
      { pan: { contains: search, mode: 'insensitive' } },
    ];
  }

  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    this.prisma.client.findMany({ where, skip, take: limit, orderBy: { displayName: 'asc' }, select: CLIENT_SELECT }),
    this.prisma.client.count({ where }),
  ]);

  return {
    data: data.map(c => this.toClientResponse(c)),
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}
```

### Pattern 3: Controller with Guards (source: user.controller.ts)

```typescript
@Controller('clients')
export class ClientController {
  constructor(private readonly clientService: ClientService) {}

  @Get()
  async listClients(@Query() query: ListClientsQueryDto) { ... }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createClient(@Body() dto: CreateClientDto) { ... }

  @Get(':id')
  async getClient(@Param('id', ParseUUIDPipe) id: string) { ... }

  @Patch(':id')
  async updateClient(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateClientDto) { ... }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteClient(@Param('id', ParseUUIDPipe) id: string) { ... }

  // Nested resource: GST numbers
  @Post(':id/gst-numbers')
  @HttpCode(HttpStatus.CREATED)
  async addGstNumber(@Param('id', ParseUUIDPipe) clientId: string, @Body() dto: CreateGstNumberDto) { ... }
}
```

### Pattern 4: SvelteKit SSR Data Loading (source: hooks.server.ts + layout.server.ts)

```typescript
// +page.server.ts
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, url }) => {
  const page = url.searchParams.get('page') || '1';
  const search = url.searchParams.get('search') || '';
  const status = url.searchParams.get('status') || '';

  const params = new URLSearchParams({ page, limit: '20' });
  if (search) params.set('search', search);
  if (status) params.set('status', status);

  const res = await fetch(`/api/clients?${params}`);
  if (!res.ok) throw error(res.status, 'Failed to load clients');
  const data = await res.json();

  return { clients: data.data, meta: data.meta, filters: { search, status } };
};
```

Key: `event.fetch` in +page.server.ts automatically forwards cookies (including access_token), so SSR calls are authenticated.

### Pattern 5: Frontend Data Fetching for Mutations

```typescript
// Client-side mutation pattern
import { api } from '$lib/utils/api';
import { invalidateAll } from '$app/navigation';
import { addToast } from '$lib/stores/toast.svelte';

async function createClient(data: CreateClientPayload) {
  try {
    const result = await api<ClientResponse>('/clients', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    addToast('Client created successfully', 'success');
    await invalidateAll(); // re-run load functions
    goto(`/clients/${result.id}`);
  } catch (err) {
    addToast((err as Error).message, 'error');
  }
}
```

### Anti-Patterns to Avoid
- **Don't skip FirmScopedService:** Every domain service MUST extend it. Never use `this.unscopedPrisma` for domain queries.
- **Don't build custom stores for list data:** Use SvelteKit's `+page.server.ts` load pattern. The page data is reactive via `$page.data`.
- **Don't interpolate Tailwind classes:** Always use complete class strings in Record<string, string> lookups (TailwindCSS v4 purge requirement).
- **Don't use `@Param('id')` without `ParseUUIDPipe`:** All UUID params must be validated.
- **Don't await action log calls:** The ActionLogInterceptor is fire-and-forget by design.
- **Don't bypass form validation on frontend:** PAN/TAN/CIN/GSTIN must validate on blur before submission.

### Frontend File Organization (from UI-SPEC)

```
apps/web/src/
  lib/
    components/
      ui/                    # Reusable primitives
        Tabs.svelte          # NEW
        Select.svelte        # NEW
        GroupedSelect.svelte  # NEW
        FilterBar.svelte     # NEW
        InlineEdit.svelte    # NEW
        TagInput.svelte      # NEW
        StatusTransitionDropdown.svelte  # NEW
      client/                # NEW directory
        ClientForm.svelte
        GstNumberModal.svelte
      engagement/            # NEW directory
        EngagementCreateModal.svelte
        TemplatePreview.svelte
    utils/
      validation.ts          # NEW: PAN/TAN/CIN/GSTIN validators using shared REGEX
  routes/(app)/
    clients/
      +page.svelte           # Replaces placeholder
      +page.server.ts        # SSR load
      new/
        +page.svelte         # Client create form
        +page.server.ts      # Load dropdown options
      [id]/
        +page.svelte         # Client detail with tabs
        +page.server.ts      # Load client + relations
        edit/
          +page.svelte       # Client edit form
          +page.server.ts    # Load client for pre-fill
    engagements/
      +page.svelte           # Replaces placeholder
      +page.server.ts        # SSR load
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Firm scoping | Custom WHERE clause for firm_id | `FirmScopedService` + Prisma $extends | Automatic, impossible to forget |
| Soft delete filtering | Manual `deletedAt IS NULL` | Prisma extension already filters | Global consistency |
| Action logging | Custom log calls in controllers | `ActionLogInterceptor` (global) | Fire-and-forget, auto-derives entity type |
| Auth guard | Per-route auth checks | `JwtAuthGuard` (global APP_GUARD) | Applied to all routes, `@Public()` for exceptions |
| Role authorization | Custom role checking | `@Roles()` decorator + `RolesGuard` (global) | Declarative, applied automatically |
| UUID validation | Manual regex check | `ParseUUIDPipe` on `@Param()` | NestJS built-in, returns proper 400 |
| Token refresh | Manual retry logic | `api()` utility handles 401 + refresh | Already implemented with dedup |
| SSR auth | Custom cookie forwarding | `event.fetch` in +page.server.ts | SvelteKit auto-forwards cookies |
| Pagination UI | Custom pagination component | DataTable has built-in pagination | Server-side mode with onPageChange |
| Status badges | Custom colored pills | StatusBadge component with type prop | Already has client, engagement, task color maps |

## Common Pitfalls

### Pitfall 1: Prisma Enum vs Shared Package Enum Mismatch
**What goes wrong:** The Prisma schema (`base.prisma`) and the shared TypeScript package have divergent enum values that will cause runtime errors.
**Why it happens:** Enums were defined independently in two places during schema design.
**Specific mismatches found:**
  - `EngagementCategory`: Prisma has `ROC_COMPLIANCE`, `PAYROLL`; shared TS has `ROC`, `REGISTRATION` (missing `PAYROLL`)
  - `ConstitutionType` (Prisma) vs `Constitution` (shared): Prisma has `OTHER` but no `HUF`; shared has `HUF` but no `OTHER`
  - Prisma uses `ConstitutionType`; shared exports `Constitution` (different name)
  - Prisma uses `RecurrenceType`; shared exports `Recurrence` (different name)
**How to avoid:** Sync the shared enums to match Prisma's generated types BEFORE writing any DTOs or frontend code. Prisma is the source of truth since it generates the DB schema.
**Warning signs:** TypeScript errors when importing shared enums in DTOs, or 400 errors when sending enum values from frontend.

### Pitfall 2: Engagement Template Instantiation Ordering
**What goes wrong:** Task dependencies reference other tasks by ID, but IDs don't exist until tasks are created.
**Why it happens:** `dependsOnOrder` in TaskTemplateItem references other items by `displayOrder`, not by ID.
**How to avoid:** Two-pass approach: (1) Create all tasks, building a `displayOrder -> taskId` map. (2) Create TaskDependency records using the map. Both passes in the same Prisma transaction.
**Warning signs:** Foreign key violations if trying to create dependencies in the first pass.

### Pitfall 3: SSR Fetch Without Error Handling
**What goes wrong:** `+page.server.ts` load functions call `event.fetch('/api/clients?...')` but don't handle non-2xx responses.
**Why it happens:** SvelteKit SSR fetch doesn't throw on 4xx/5xx -- it returns a Response object.
**How to avoid:** Always check `res.ok` and throw SvelteKit's `error()` helper: `if (!res.ok) throw error(res.status, 'Failed to load data')`.
**Warning signs:** Pages rendering with undefined data instead of showing error state.

### Pitfall 4: TailwindCSS v4 Class Purging
**What goes wrong:** Dynamic Tailwind classes like `bg-${color}-500` get purged because v4 can't detect them at build time.
**Why it happens:** TailwindCSS v4 uses a CSS-first approach with no explicit safelist.
**How to avoid:** Store all variant classes as complete strings in `Record<string, string>` objects, same as existing components. Never interpolate partial class names.
**Warning signs:** Missing styles in production build but working in dev.

### Pitfall 5: GST Number isPrimary Race Condition
**What goes wrong:** Two concurrent "Set as Primary" requests can leave multiple GST numbers marked as primary.
**Why it happens:** Read-then-write without a transaction.
**How to avoid:** Wrap the unset-old-primary + set-new-primary in a Prisma transaction. The scoped client already handles firm_id.
**Warning signs:** Multiple primary GST numbers for the same client.

### Pitfall 6: Client Delete Without Engagement Check
**What goes wrong:** Client is soft-deleted but still has active engagements referencing it.
**Why it happens:** Missing pre-delete validation.
**How to avoid:** Before soft-deleting, count engagements with `status IN (ACTIVE, ON_HOLD)`. If count > 0, throw `ConflictException` with the count.
**Warning signs:** Orphaned engagements referencing a deleted client.

### Pitfall 7: Engagement Cancellation Not Cascading
**What goes wrong:** Engagement is cancelled but child tasks remain in TO_DO/IN_PROGRESS.
**Why it happens:** Forgetting to update tasks when engagement status changes to CANCELLED.
**How to avoid:** In the status transition handler, when target is CANCELLED, run `updateMany` on tasks with `engagementId` and `status IN (TO_DO, IN_PROGRESS)` to set them to CANCELLED + set `cancelledAt`.
**Warning signs:** Task counts showing open tasks on a cancelled engagement.

### Pitfall 8: Seed Script Engagement Type Category Mismatch
**What goes wrong:** The seed script uses `ROC_COMPLIANCE` for engagement type category, which matches the Prisma enum but will fail if someone tries to validate against the shared TS enum that uses `ROC`.
**How to avoid:** After fixing the enum mismatch (Pitfall 1), update the seed data categories to match.
**Warning signs:** Seed script errors or frontend dropdown showing unexpected category groupings.

## Code Examples

### DTO with Regex Validation (verified pattern from create-user.dto.ts + REGEX constants)

```typescript
// Source: apps/api/src/user/dto/create-user.dto.ts pattern + packages/shared/src/constants/regex-patterns.ts
import { IsString, IsEnum, IsOptional, Matches, MaxLength, MinLength, IsArray, ArrayMaxSize } from 'class-validator';
import { EntityType, ClientStatus, REGEX, LIMITS } from '@ca-practice-os/shared';

export class CreateClientDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  displayName!: string;

  @IsEnum(EntityType)
  entityType!: EntityType;

  @IsOptional()
  @Matches(REGEX.PAN, { message: 'PAN must be 5 letters + 4 digits + 1 letter (e.g., ABCDE1234F)' })
  pan?: string;

  @IsOptional()
  @Matches(REGEX.TAN, { message: 'TAN must be 4 letters + 5 digits + 1 letter (e.g., ABCD12345E)' })
  tan?: string;

  @IsOptional()
  @Matches(REGEX.CIN, { message: 'CIN must be 21 characters (e.g., U12345AB1234ABC123456)' })
  cin?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(LIMITS.MAX_TAGS_PER_ENTITY)
  @IsString({ each: true })
  @MaxLength(LIMITS.MAX_TAG_LENGTH, { each: true })
  tags?: string[];
}
```

### Engagement Status Transitions Constant (to be created)

```typescript
// Source: Pattern from packages/shared/src/constants/task-status-transitions.ts
import { EngagementStatus } from '../enums/engagement-status.enum';

export const ENGAGEMENT_STATUS_TRANSITIONS: Record<EngagementStatus, EngagementStatus[]> = {
  [EngagementStatus.ACTIVE]: [EngagementStatus.ON_HOLD, EngagementStatus.COMPLETED, EngagementStatus.CANCELLED],
  [EngagementStatus.ON_HOLD]: [EngagementStatus.ACTIVE, EngagementStatus.CANCELLED],
  [EngagementStatus.COMPLETED]: [],
  [EngagementStatus.CANCELLED]: [],
};
```

### Template Task Instantiation (core algorithm)

```typescript
// Two-pass approach for task creation from template
async instantiateTasksFromTemplate(
  engagement: { id: string; clientId: string; periodEnd: Date | null },
  client: { assignedPartnerId?: string; assignedManagerId?: string; assignedJuniorId?: string; assignedArticleId?: string },
  templateId: string,
): Promise<number> {
  const template = await this.prisma.taskTemplate.findUnique({
    where: { id: templateId },
    include: { items: { orderBy: { displayOrder: 'asc' } } },
  });

  if (!template?.isActive || !template.items.length) return 0;

  const firmId = this.getFirmId();
  const userId = this.getUserId();

  // Role-to-user mapping
  const roleMap: Record<string, string | undefined> = {
    PARTNER: client.assignedPartnerId ?? undefined,
    MANAGER: client.assignedManagerId ?? undefined,
    JUNIOR_CA: client.assignedJuniorId ?? undefined,
    ARTICLE: client.assignedArticleId ?? undefined,
  };

  // Pass 1: Create all tasks, build order->id map
  const orderToId = new Map<number, string>();
  for (const item of template.items) {
    const task = await this.unscopedPrisma.task.create({
      data: {
        firmId,
        engagementId: engagement.id,
        clientId: engagement.clientId,
        title: item.title,
        description: item.description,
        assigneeId: item.assigneeRole ? roleMap[item.assigneeRole] ?? null : null,
        reviewerId: item.reviewerRole ? roleMap[item.reviewerRole] ?? null : null,
        dueDate: engagement.periodEnd && item.dueOffsetDays
          ? addDays(engagement.periodEnd, item.dueOffsetDays)
          : null,
        status: 'TO_DO',
        priority: 'MEDIUM',
        createdBy: userId,
        updatedBy: userId,
      },
    });
    orderToId.set(item.displayOrder, task.id);
  }

  // Pass 2: Create dependencies
  for (const item of template.items) {
    if (item.dependsOnOrder.length > 0) {
      const taskId = orderToId.get(item.displayOrder)!;
      for (const depOrder of item.dependsOnOrder) {
        const depTaskId = orderToId.get(depOrder);
        if (depTaskId) {
          await this.unscopedPrisma.taskDependency.create({
            data: { firmId, taskId, dependsOnTaskId: depTaskId },
          });
        }
      }
    }
  }

  return template.items.length;
}
```

### SSR Load Function Pattern

```typescript
// Source: SvelteKit docs + existing hooks.server.ts pattern
// apps/web/src/routes/(app)/clients/+page.server.ts
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, url }) => {
  const params = new URLSearchParams();

  // Pass through URL search params as API query params
  const page = url.searchParams.get('page') || '1';
  const search = url.searchParams.get('search') || '';
  const status = url.searchParams.get('status') || '';
  const entityType = url.searchParams.get('entityType') || '';

  params.set('page', page);
  params.set('limit', '20');
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  if (entityType) params.set('entityType', entityType);

  // event.fetch auto-forwards cookies for SSR auth
  const res = await fetch(`/api/clients?${params}`);
  if (!res.ok) {
    throw error(res.status, 'Failed to load clients');
  }

  return {
    ...(await res.json()),
    filters: { search, status, entityType, page: parseInt(page) },
  };
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Svelte stores for page data | SvelteKit load functions + `$page.data` | SvelteKit 2.x | No custom stores needed for list/detail data |
| Svelte 4 `export let` props | Svelte 5 `$props()` rune | Svelte 5.0 | All components use `$props()`, `$state`, `$derived` |
| TailwindCSS v3 config file | TailwindCSS v4 CSS @import | TW v4 | No tailwind.config.js, all config in CSS |
| `createEventDispatcher` | Callback props (`onAction`) | Svelte 5.0 | All events are callback props, no dispatchers |

## Open Questions

1. **EngagementType query scope: global + firm-specific**
   - What we know: Seed data has `firmId: null` (platform types). V1 is platform-only, no user-created types.
   - What's unclear: The EngagementType query for the dropdown must fetch types where `firmId IS NULL OR firmId = currentFirmId`. Since `FirmScopedService.prisma` scopes by firm, we need `unscopedPrisma` for this query.
   - Recommendation: Use `unscopedPrisma.engagementType.findMany({ where: { OR: [{ firmId: null }, { firmId: currentFirmId }], isActive: true, deletedAt: null } })`. Create a dedicated `EngagementTypeService` (not extending FirmScopedService) or use `this.unscopedPrisma` in the engagement service for this specific query.

2. **Breadcrumb labels for dynamic routes**
   - What we know: `breadcrumbs.ts` uses a static ROUTE_LABELS map plus a `formatSegment()` that shows "Detail" for UUIDs.
   - What's unclear: Client detail page should show the client name in breadcrumbs (e.g., "Dashboard > Clients > Acme Corp"), not "Detail".
   - Recommendation: Extend breadcrumbs utility to accept dynamic labels via `+page.server.ts` data, or override from the page component.

3. **Task Template Linking to EngagementType**
   - What we know: `EngagementType.defaultTaskTemplateId` is the FK to the default template. The GST Monthly template is seeded and linked.
   - What's unclear: Not all engagement types have templates seeded yet. Only `gst_monthly` has a task template.
   - Recommendation: The code handles this gracefully -- if `defaultTaskTemplateId` is null or template is inactive, no tasks are created. Additional seed templates are Claude's discretion.

4. **Frontend Engagement Type Grouped Data**
   - What we know: Engagement types should be grouped by `EngagementCategory` in the GroupedSelect.
   - What's unclear: Whether to create a dedicated API endpoint that returns pre-grouped data, or group on the frontend.
   - Recommendation: Fetch flat list from `GET /api/engagement-types`, group by category on the frontend. Simpler API, and the list is small (< 20 items).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Not yet configured |
| Config file | None -- needs Wave 0 setup |
| Quick run command | TBD after framework selection |
| Full suite command | TBD |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLIENT-01 | Create client with validation | unit + integration | TBD | No -- Wave 0 |
| CLIENT-02 | PAN/TAN/CIN regex validation | unit | TBD | No -- Wave 0 |
| CLIENT-03 | display_name uniqueness | integration | TBD | No -- Wave 0 |
| CLIENT-04 | List with pagination + filters | integration | TBD | No -- Wave 0 |
| CLIENT-07 | Soft-delete blocked by engagements | integration | TBD | No -- Wave 0 |
| CLIENT-08 | GST number CRUD + isPrimary | integration | TBD | No -- Wave 0 |
| CLIENT-09 | Role validation on assignments | unit | TBD | No -- Wave 0 |
| ENG-04 | Template task instantiation | integration | TBD | No -- Wave 0 |
| ENG-06 | Status transition validation | unit | TBD | No -- Wave 0 |
| ENG-07 | COMPLETED blocked by open tasks | integration | TBD | No -- Wave 0 |
| ENG-08 | CANCELLED cascades to tasks | integration | TBD | No -- Wave 0 |
| PAGE-01 | Client list renders with data | manual (visual) | N/A | N/A |
| PAGE-02 | Client detail tabs work | manual (visual) | N/A | N/A |
| PAGE-03 | Engagement create modal | manual (visual) | N/A | N/A |

### Wave 0 Gaps
- [ ] Test framework setup (Jest or Vitest for NestJS -- no testing infrastructure exists yet)
- [ ] Test database configuration (separate test DB or in-memory)
- [ ] Shared test fixtures for firm/user creation

*(Note: No test infrastructure exists in the current codebase. The planner should assess whether to include test setup as Wave 0 or defer testing to a hardening phase. Given the aggressive 2-4 week timeline, manual testing via the running app is likely the pragmatic V1 choice.)*

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `apps/api/src/user/` -- exact module pattern for CRUD services
- Codebase analysis: `apps/api/src/auth/` -- controller, service, DTO, guard patterns
- Codebase analysis: `apps/api/src/common/base/firm-scoped.service.ts` -- FirmScopedService API
- Codebase analysis: `packages/shared/src/constants/regex-patterns.ts` -- PAN/TAN/CIN/GSTIN regex
- Codebase analysis: `packages/shared/src/constants/task-status-transitions.ts` -- transition map pattern
- Codebase analysis: `apps/api/prisma/schema/client.prisma` -- Client + ClientGstNumber models
- Codebase analysis: `apps/api/prisma/schema/engagement.prisma` -- Engagement + EngagementType models
- Codebase analysis: `apps/api/prisma/schema/task.prisma` -- TaskTemplate + TaskTemplateItem models
- Codebase analysis: `apps/api/prisma/seed/` -- existing seed data for engagement types + task templates
- Codebase analysis: `apps/web/src/lib/components/ui/` -- all 14 existing UI components, full prop APIs
- Codebase analysis: `apps/web/src/lib/utils/api.ts` -- API utility with auto-refresh
- Codebase analysis: `apps/web/src/hooks.server.ts` -- SSR auth flow
- Codebase analysis: `apps/web/src/routes/(app)/` -- existing app shell and placeholder pages

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions -- all locked decisions from the discuss phase
- UI-SPEC.md -- component inventory, layout contracts, and interaction patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project, no new dependencies
- Architecture: HIGH -- patterns directly copied from existing auth/user modules
- Pitfalls: HIGH -- enum mismatch verified by direct diff of source files
- Frontend patterns: HIGH -- all components read and APIs documented from source

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (stable -- no external dependency changes expected)
