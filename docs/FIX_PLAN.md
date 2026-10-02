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

### P0-1 Enforce the role permission matrix  — TODO
`PermissionService` implements the matrix and is never called. 32 of 46 mutation
endpoints have no guard. An ARTICLE can delete any client.
Approach: a guard that consults `PermissionService.can()` using route metadata,
plus scope filtering (`assigned`/`own`) applied in the list queries for client and task.
Do NOT hand-patch 32 endpoints.
Affects: `client.*`, `task.*`, `engagement.*`, `compliance.*` controllers/services.

### P0-2 Global email uniqueness on user create — TODO
`user.service.ts:102` checks email with the firm-scoped client; `auth.service.ts:55`
checks globally with `prisma.unscoped`. Result: the same email can exist in two firms
and login (`findFirst` by email, no firm disambiguation) can only ever reach one of them.
Fix: use `prisma.unscoped` in `createUser`, and add a DB unique index on `users.email`
(partial, `WHERE deleted_at IS NULL`). Needs a migration + a cleanup for existing dupes.

### P0-3 Restrict who can create or promote to PARTNER / ADMIN — TODO
Today any user-creating role can mint an ADMIN. Decision taken: restrict creation and
role-change to PARTNER rather than build an approval queue now.
Full partner-approval workflow: see DEFERRED below.

---

## P1 — crashes and correctness

### P1-1 Invalid enum in task filter returns 500 — TODO
`status`/`priority` are `@IsString()` and split into a Prisma `in:`; a bad value throws
`PrismaClientValidationError` → 500. Validate each comma-separated token against the enum
so it fails as a 400 in the DTO. Same treatment for any other comma-list filters.

### P1-2 Uniqueness for statutory identifiers — TODO
Within a firm, these must not duplicate: client **PAN**, **TAN**, **CIN**, **GSTIN**.
Globally: **firm name** (user asked for this explicitly) and firm PAN.
Enforce in the service (clear 409) *and* with a DB unique index so a race cannot slip
through. Partial indexes, `WHERE deleted_at IS NULL`, since these are soft-deleted.
Needs a migration and a pre-check for existing duplicates in prod.

### P1-3 Reactivate a deactivated user — TODO
`PATCH /users/:id/deactivate` exists with no reverse; `isActive` is rejected by the DTO.
Add `PATCH /users/:id/reactivate` with the same `@Roles` as deactivate.

### P1-4 Cross-tenant user PATCH returns 500 — TODO
`user.service.ts:141,189` use `findUniqueOrThrow`; Prisma's `NotFoundError` is not
translated, so the tenant boundary returns 500 instead of 404. Match the pattern used
in client/task/engagement services.

### P1-5 Engagement period validation — TODO
`periodEnd` before `periodStart` is accepted. Add a cross-field check in the DTO.

---

## P2 — behaviour and polish

### P2-1 Leave write-path returns "Unknown User" — TODO
`leave.service.ts` passes `toDto(record, new Map())` on create/approve/reject/cancel
while `list()` builds a real user map. Reported by all five agents.

### P2-2 Whitespace-only values pass validation — TODO
`{"label":"   "}` and `{"body":"    "}` persist as blank rows. Trim before the
empty check on checklist labels, comment bodies and other free-text required fields.

### P2-3 ADMIN cannot restore what it deleted — TODO
`/recently-deleted` list is `@Roles(PARTNER, ADMIN)`, restore is `@Roles(PARTNER)`.

### P2-4 Audit log entityType filter is case-sensitive — TODO
`?entityType=Task` silently returns empty; stored values are lowercase. Normalise server-side.

### P2-5 RoleGuide advertises credentials, which do not exist — TODO
The invite-screen panel promises credential access per role, but `CredentialModule`
is not registered in `app.module.ts`. Drop the line or mark it upcoming. Self-inflicted,
added 2026-10-02.

### P2-6 Minor consistency — TODO
`restore` returns 201 for an update (should be 200); revoking a dead invite is a silent
204 while double-deactivate is a 400; no floor on `dueDate`.

---

## P3 — verification

### P3-1 RBAC regression tests — TODO
One test per resource: log in as JUNIOR_CA, hit list/get/edit/delete on a record that is
not theirs, assert 403 or filtered. This is what would have caught P0-1.

### P3-2 Browser testing per role — TODO
API coverage exists; the UI does not. Must be sequential: the JWT lives in `localStorage`,
shared per origin, so two roles cannot be driven in parallel in one browser.

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
