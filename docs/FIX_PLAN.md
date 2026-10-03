# Fix plan — QA report remediation

Source: `docs/QA_REPORT_2026_10_03.md`. Started 2026-10-03.

**Status key:** TODO / IN PROGRESS / DONE / BLOCKED / DEFERRED

This file is the handoff record. Anyone picking this up (human or agent) should
read it top to bottom, then check `git log` for what actually landed.

---

## Working agreements

- Dev stack runs locally: `docker compose up -d postgres redis` then `pnpm dev`
  (API :3000, web :5173). Test firm: `parity@sanitytest.local` / `LocalTest!2026pw`,
  plus `manager@`, `junior-ca@`, `article@`, `admin@tafcatest.local` on the same password.
- The e2e suite TRUNCATEs the dev database. Do not run it against a DB whose data
  you still need. Unit tests only: `pnpm --filter ./apps/api exec jest --roots '<rootDir>/src'`.
- Verify every fix against a running server, not just a passing build.
- One commit per coherent fix, with the root cause in the message.

---

## P0 — security and data integrity

### P0-1 Enforce the role permission matrix — **DONE** (1162ffc)
`PermissionService` implements the matrix and is never called. 32 of 46 mutation
endpoints have no guard. An ARTICLE can delete any client.
Approach: a guard that consults `PermissionService.can()` using route metadata,
plus scope filtering (`assigned`/`own`) applied in the list queries for client and task.
Do NOT hand-patch 32 endpoints.
Affects: `client.*`, `task.*`, `engagement.*`, `compliance.*` controllers/services.

### P0-2 Global email uniqueness on user create — **DONE** (249f50b)
`user.service.ts:102` checks email with the firm-scoped client; `auth.service.ts:55`
checks globally with `prisma.unscoped`. Result: the same email can exist in two firms
and login (`findFirst` by email, no firm disambiguation) can only ever reach one of them.
Fix: use `prisma.unscoped` in `createUser`, and add a DB unique index on `users.email`
(partial, `WHERE deleted_at IS NULL`). Needs a migration + a cleanup for existing dupes.

### P0-3 Restrict who can create or promote to PARTNER / ADMIN — **DONE** (4b5abb1)
Today any user-creating role can mint an ADMIN. Decision taken: restrict creation and
role-change to PARTNER rather than build an approval queue now.
Full partner-approval workflow: see DEFERRED below.

---

## P1 — crashes and correctness

### P1-1 Invalid enum in task filter returns 500 — **DONE** (4b5abb1)
`status`/`priority` are `@IsString()` and split into a Prisma `in:`; a bad value throws
`PrismaClientValidationError` → 500. Validate each comma-separated token against the enum
so it fails as a 400 in the DTO. Same treatment for any other comma-list filters.

### P1-2 Uniqueness for statutory identifiers — **DONE** (249f50b)
Within a firm, these must not duplicate: client **PAN**, **TAN**, **CIN**, **GSTIN**.
Globally: **firm name** (user asked for this explicitly) and firm PAN.
Enforce in the service (clear 409) *and* with a DB unique index so a race cannot slip
through. Partial indexes, `WHERE deleted_at IS NULL`, since these are soft-deleted.
Needs a migration and a pre-check for existing duplicates in prod.

### P1-3 Reactivate a deactivated user — **DONE** (4b5abb1)
`PATCH /users/:id/deactivate` exists with no reverse; `isActive` is rejected by the DTO.
Add `PATCH /users/:id/reactivate` with the same `@Roles` as deactivate.

### P1-4 Cross-tenant user PATCH returns 500 — **DONE** (4b5abb1)
`user.service.ts:141,189` use `findUniqueOrThrow`; Prisma's `NotFoundError` is not
translated, so the tenant boundary returns 500 instead of 404. Match the pattern used
in client/task/engagement services.

### P1-5 Engagement period validation — **DONE** (4b5abb1)
`periodEnd` before `periodStart` is accepted. Add a cross-field check in the DTO.

---

## P2 — behaviour and polish

### P2-1 Leave write-path returns "Unknown User" — **DONE** (9c47f7b)
`leave.service.ts` passes `toDto(record, new Map())` on create/approve/reject/cancel
while `list()` builds a real user map. Reported by all five agents.

### P2-2 Whitespace-only values pass validation — **DONE** (9c47f7b)
`{"label":"   "}` and `{"body":"    "}` persist as blank rows. Trim before the
empty check on checklist labels, comment bodies and other free-text required fields.

### P2-3 ADMIN cannot restore what it deleted — **DONE** (9c47f7b)
`/recently-deleted` list is `@Roles(PARTNER, ADMIN)`, restore is `@Roles(PARTNER)`.

### P2-4 Audit log entityType filter is case-sensitive — **DONE** (9c47f7b)
`?entityType=Task` silently returns empty; stored values are lowercase. Normalise server-side.

### P2-5 RoleGuide advertises credentials, which do not exist — **DONE** (9c47f7b)
The invite-screen panel promises credential access per role, but `CredentialModule`
is not registered in `app.module.ts`. Drop the line or mark it upcoming. Self-inflicted,
added 2026-10-02.

### P2-6 Minor consistency — TODO
Remaining: restore returns 201 (should be 200); revoke-dead-invite 204 vs
double-deactivate 400; no floor on dueDate. Low value, batch them later.
`restore` returns 201 for an update (should be 200); revoking a dead invite is a silent
204 while double-deactivate is a 400; no floor on `dueDate`.

---

## P3 — verification

### P3-1 RBAC regression tests — **DONE** (8845923)
One test per resource: log in as JUNIOR_CA, hit list/get/edit/delete on a record that is
not theirs, assert 403 or filtered. This is what would have caught P0-1.

### P3-2 Browser testing per role — **DONE**
ARTICLE (1f11a38) found the engagement scoping gap and two UI affordances that
led to a 403. MANAGER, JUNIOR_CA and ADMIN passes all clean:

| Role | Nav | Clients | Tasks | Create buttons |
|---|---|---|---|---|
| MANAGER | no Settings/Audit | 10 (all) | 17 (all) | Client, Engagement, Task |
| JUNIOR_CA | no Settings/Audit | 3 (assigned) | 4 (assigned) | Task only |
| ADMIN | full nav | 10 (all) | 17 (all) | all; 4 deactivate controls |

No console errors, no broken pages, scoping matches the matrix in every case.
API coverage exists; the UI does not. Must be sequential: the JWT lives in `localStorage`,
shared per origin, so two roles cannot be driven in parallel in one browser.

---

## New — found while changing the assign policy

### N-1 Permission cache has no invalidation hook — **CLOSED, not applicable**
`PermissionService` caches resolved scopes in memory and `invalidate()` exists
but nothing calls it. Changing `firm_role_permissions` therefore has no effect
until the API restarts — which cost real debugging time when the task:assign
grant appeared to do nothing. This matters more than it looks: the table exists
precisely so a firm can override permissions from a future admin UI, and that
UI will silently appear broken. Call `invalidate(firmId)` wherever those rows
are written, or drop the cache to a short TTL.

**Closed 2026-10-03.** Per-firm permission overrides are out of scope, and
nothing writes `firm_role_permissions` at runtime — the only access in
`apps/api/src` is a single `findUnique` read in PermissionService, registration
does not seed rows, and `invalidate()` has no caller outside a test. So the
cache cannot go stale in normal operation. It only bit during development
because a migration changed rows while the server was already running, and a
real deploy restarts the process anyway. Re-open this the day per-firm
overrides are built.

**Related, still true:** `firm_role_permissions` is now a second source of
truth. Firms seeded earlier hold rows; firms created since run on the code
defaults. They agree today, but editing `role-permissions.ts` later would be
silently ignored by the seeded firms. Cleanest resolution while the feature is
skipped is to delete the seeded rows so the code matrix is authoritative —
deferred because it deletes production data and should be a deliberate call.

---

## Deferred (needs a product decision, not a fix)

- **Partner-approval workflow for privileged roles.** Adding a PARTNER or ADMIN would
  require sign-off from an existing partner. Real feature: pending-user state, approver,
  notification, expiry, an approval queue in the UI. P0-3 closes the security hole now;
  revisit once real firms are using it.
- **Separate test database.** The e2e suite truncates dev. Agreed to defer until the
  first real client.
- **Credential locker.** DB model exists, no API, module unregistered. V1.1 scope.

---

## Progress log

| When | Item | What happened |
|---|---|---|
| 2026-10-03 | — | Plan created from QA report. Nothing fixed yet. |
| 2026-10-03 | P0-1 | DONE. PermissionGuard + @RequirePermission, scope helper, record checks in client/task services. Verified live: ARTICLE create/view/edit/delete unassigned client all 403; list scoping 3 of 11 clients, 10 of 17 tasks. |
| 2026-10-03 | P0-2, P1-2 | DONE. Global email uniqueness, firm name, client PAN/TAN/CIN/GSTIN. Partial unique indexes added and applied to prod; both DBs checked for duplicates first. |
| 2026-10-03 | P0-3, P1-1, P1-3/4/5 | DONE. Only PARTNER grants PARTNER/ADMIN; enum-list validator kills the 500; reactivate endpoint; findUnique+404 on tenant boundary; date-order validator on engagement + leave. |
| 2026-10-03 | P2-1..5 | DONE. Leave name hydration, trim transform, admin restore, audit casing, RoleGuide credentials line removed. |
| 2026-10-03 | P3-1 | DONE. Guard + scope-helper specs. 65 tests, up from 53. |
| 2026-10-03 | P3-2 | PARTIAL. ARTICLE browser pass found engagement list was never scope-filtered, plus two UI affordances leading to 403. Fixed. MANAGER, JUNIOR_CA, ADMIN passes still to run. |

---

## Where this stands

Everything from the QA report is fixed except the items explicitly listed as
remaining below. Nothing is half-applied: each commit was verified against the
running API before moving on.

**Still open**
- P2-6 minor consistency (restore status code, idempotency mismatch, dueDate floor)
- P3-2 browser passes for MANAGER, JUNIOR_CA, ADMIN
- The deferred items below

**Prod state:** both migrations applied to Neon
(`20261003030000_unique_identity_constraints` included). The API changes are
pushed to main and will deploy on the next Vercel build.
| 2026-10-03 | policy | Task assignment opened to every role (user decision); clients/engagements confirmed senior-only. Closed an assign-on-create hole in passing. Migration applied to prod. |
| 2026-10-03 | N-1 | FOUND, not fixed. Permission cache never invalidated — permission changes need an API restart. |
| 2026-10-03 | P3-2 | DONE. MANAGER, JUNIOR_CA and ADMIN browser passes all clean; scoping matches the matrix, no console errors. |
| 2026-10-03 | N-1 | CLOSED as not applicable — nothing writes the permission table at runtime. Flagged the two-sources-of-truth risk for a later decision. |
| 2026-10-03 | UX | Laws-of-UX review fixes landed (65892c8): 900px column clipping, task-detail overdue signal, zero-state colouring, keyboard rows, focus ring, sticky form actions. |
| 2026-10-03 | UX | Type-to-confirm dialog on user deactivation, paste blocked. |
