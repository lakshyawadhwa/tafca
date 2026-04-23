# V2 Pending Items — Deferred from V1 Frontend Rebuild

Last updated: 2026-04-23

Items intentionally scoped out of V1 rebuild. Each item records reason + target trigger for revisit. Order = rough priority within each bucket, not commitment.

---

## 1. Analytics — real backend

**Status:** V1 ships with `console.info()` only. Event names and payloads are finalized in the tech spec so wiring is trivial later.

**Deferred because:** No vendor decision, no `/api/events` endpoint, no consent policy. Premature to pick.

**Revisit when:**
- 5+ real CA firms onboarded and we need funnel data
- Product asks "how many firms reach task detail vs. drop off at client create"

**Work needed later:**
- Decide: Posthog / Mixpanel / self-host `/api/events`
- Backend: event ingestion endpoint or SDK wiring
- Consent / opt-out affordance in firm settings
- PII audit of every `track()` call site

---

## 2. Role matrix — firm-admin configurable UI

**Status V1:** Role × (resource, action) matrix lives in `packages/shared` as code const + seeded to DB per firm. NO admin UI. Changes require code deploy.

**Deferred because:** 5-role × 7-resource × 6-action matrix UI = 1-2 weeks solo. Not on critical path for first firm demos.

**Revisit when:**
- A firm asks to change a specific permission (log the request, do not build preemptively)
- We have 3+ firms with conflicting permission needs

**Work needed later:**
- `firm_role_permissions` table (firm_id, role, resource, action, allowed)
- Settings page: matrix view with toggles, Partner/Admin only
- `PermissionService` reads from DB first, falls back to shared default
- Audit log entry per permission change

---

## 3. Engagement template edit UI

**Status V1:** Platform ships seeded templates. Task instantiation works. **No UI** for a firm to edit the template for an engagement type.

**Deferred because:** Few users need custom templates at V1. Dev-editable seed file is enough.

**Revisit when:**
- Firm requests a different checklist for a standard engagement type (e.g. "we have a 12-step GSTR-3B process, not 8")

**Work needed later:**
- Template CRUD endpoints (list, create, update, delete)
- Firm-scoped overrides on top of platform defaults
- Permission gate: only `MANAGER` + `PARTNER` + `ADMIN` (configurable via role matrix)
- Template editor page — reorder, add/remove, required flag per item

---

## 4. ICAI verification

**Status V1:** Manual member number entry. No live ICAI lookup.

**Deferred because:** ICAI has no public API; scraping is fragile + probably ToS-risky. Blocker for V1 launch would be weeks.

**Revisit when:** Post-launch, if user interviews flag trust as a signal ("is this CA real").

---

## 5. Documents / file upload module

**Status V1:** No document upload, no document request flow, no S3 integration beyond infra setup.

**Deferred because:** Storage + request + review cycle is its own epic. V1.1 scope.

**Revisit when:** Core task tracking is in daily use and firms ask where to store the PDF.

**Work needed later:**
- S3 client + signed URL flow
- Document request → upload → review state machine
- Link documents to tasks + engagements + clients
- Virus scan hook (ClamAV or cloud equivalent)

---

## 6. WhatsApp notifications

**Status V1:** In-app + email only. Template notification system is channel-agnostic so WhatsApp slots in later.

**Deferred because:** WhatsApp Business API setup is not a 1-week job. Cost + compliance questions unresolved.

**Revisit when:** V1.1+, once email retention data shows we need a higher-engagement channel.

---

## 7. Sentry wiring

**Status V1:** No error reporting beyond `console.error`.

**Deferred because:** Can wire in <1 day post-launch. Want event shape stable first.

**Revisit when:** First real firm goes live. Non-negotiable before second firm.

**Work needed later:**
- `@sentry/browser` + `@sentry/node` SDKs
- DSN via `VITE_SENTRY_DSN` (FE) + `SENTRY_DSN` (BE)
- Wrap `apiFetch` + NestJS exception filter
- 5xx + unhandled promise alerts
- Performance target alerts (see tech spec §3)

---

## 8. Refresh token flow

**Status V1:** 1-day access token in localStorage, no refresh. User re-logs in daily.

**Deferred because:** Simpler = fewer bugs. User interviews did not flag session length as a problem.

**Revisit when:**
- User feedback: "I have to log in every day and it's annoying"
- OR: compliance / security review demands shorter-lived access tokens

**Work needed later:**
- HttpOnly refresh cookie (7d) + silent refresh endpoint
- Access token shortened to 15min
- Concurrent session cap (max 5) already modelled server-side
- FE: `apiFetch` retry-on-401 → refresh → replay

---

## 9. Bulk operations

**Status V1:** Single-item create / edit / delete only. No bulk import clients, no bulk reassign tasks.

**Deferred because:** Not hit in user interviews. Can add per-operation when asked.

**Revisit when:** Firm with 200+ clients asks for CSV import, OR task reassignment during staff transitions gets painful.

---

## 10. Kanban drag-to-reorder within a column

**Status V1:** Kanban drag moves across columns (status change). Drag within column (priority reorder) not implemented.

**Deferred because:** Priority is an enum, not a sort order. "Reorder" has no single storage model. Needs product decision first.

**Revisit when:** User asks to rank tasks within a status.

---

## Conventions

- When a pending item is picked up: move entry to `docs/v2_shipped_items.md` with the PR link. Do not delete.
- New deferrals during V1 build: append here, do not inline in the tech spec.
- Every pending item must answer: **why deferred**, **when to revisit**, **what's needed**.
