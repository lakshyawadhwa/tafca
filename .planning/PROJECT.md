# CA Practice OS

## What This Is

A multi-tenant practice management platform for Chartered Accountant firms in India. Think "JIRA for CAs" — purpose-built task tracking, client management, and engagement lifecycle tools that replace the WhatsApp groups and spreadsheets CA firms currently rely on. Built with SvelteKit (frontend), NestJS (backend), PostgreSQL (Prisma ORM), and Redis.

## Core Value

Every person in the firm knows exactly what to work on, every deadline is visible, and no client falls through the cracks.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Firm registration and multi-tenancy (firm_id scoping on all data)
- [ ] Auth system (JWT + refresh tokens, session management, 5-session limit)
- [ ] User management (CRUD, 5 roles: PARTNER, MANAGER, JUNIOR_CA, ARTICLE, ADMIN)
- [ ] Client management (CRUD, PAN/TAN/CIN validation, GST numbers, custom fields, assignment)
- [ ] Engagement management (CRUD, lifecycle, task template instantiation, status transitions)
- [ ] Task engine (CRUD, status machine with transition enforcement, checklists, dependencies, comments, activity log)
- [ ] Frontend app shell (auth pages, sidebar layout, topbar, breadcrumbs, responsive)
- [ ] Shared UI component library (DataTable, Modal, FormField, StatusBadge, pickers, Toast, etc.)
- [ ] Client list + detail pages (filters, search, tabbed detail with GST numbers)
- [ ] Engagement list + create flow (type selector, template preview, period fields)
- [ ] Task list (table + Kanban views, filters, drag-to-change-status)
- [ ] Task detail (status controls, checklist, dependencies, comments, activity timeline)
- [ ] Dashboard (my tasks, approval queue, upcoming deadlines, recent activity)
- [ ] Team workload view + leave management
- [ ] In-app notification system (bell, dropdown, mark-read)
- [ ] User action logging (immutable audit trail for all mutations)
- [ ] Recently deleted with restore capability
- [ ] Global error handling, request logging, health check

### Out of Scope

- Document management (S3 uploads, versioning, client upload portal) — deferred to V1.1, firms use Google Drive
- Compliance calendar + auto-task generation from statutory deadlines — deferred to V1.1, complex feature
- Credential locker with AES-256-GCM encryption — deferred to V1.1, not blocking daily work
- DSC tracker — deferred to V1.1
- Cron jobs and automation (overdue detection, reminders, recurring tasks) — deferred to V1.1, manual at first
- Email notifications — deferred to V1.1, in-app only for V1
- WhatsApp notifications — deferred, removed from V1 entirely
- Mobile app — web-first
- OAuth/magic link login — email/password sufficient
- RBAC hard enforcement — V1.5, V1 uses action logging for audit

## Context

- **Domain:** Indian CA (Chartered Accountant) practice management. Firms have 5-50 users across defined roles.
- **Target scale:** ~50 firms at MVP, 5-50 users per firm.
- **Indian FY:** April-March, fixed in V1 (not configurable).
- **Existing docs:**
  - PRD: `docs/CA_Practice_OS_Engineering_PRD.md` — complete entity specs, business rules, 33+ tables, 29+ enums
  - Tech spec: `docs/technical_implementation.md` — API contracts, service map, execution plan with 8 epics
  - Scalability roadmap: `docs/scalability_roadmap.md`
  - RBAC review: `docs/rbac_review_for_ca.md`
  - Task types review: `docs/ca_task_types_review.md`
- **Both user personas are first-class:** Partners need visibility (who's doing what, overdue, workload). Juniors need clarity (my tasks, deadlines, checklists).

## Constraints

- **Timeline**: 2-4 weeks to V1 in front of real CA firms — aggressive, requires focused scope
- **Stack**: SvelteKit + TailwindCSS (frontend), NestJS (backend), PostgreSQL + Prisma (DB), Redis (sessions + BullMQ)
- **Multi-tenancy**: firm_id on every table, enforced via Prisma $extends + FirmScopedService + AsyncLocalStorage
- **Auth**: JWT (15-min access) + HTTP-only cookie refresh (7 days), max 5 concurrent sessions
- **Deployment**: AWS/GCP
- **Storage**: S3-compatible (MinIO local, AWS S3 prod) — but document features deferred to V1.1
- **Monorepo**: Turborepo + pnpm workspaces (`apps/api`, `apps/web`, `packages/shared`)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Defer documents, compliance, credentials, DSC, cron to V1.1 | 2-4 week timeline; task tracking + client/engagement is the core value | — Pending |
| Free app in V1, no billing | Reduce scope, validate product-market fit first | — Pending |
| RBAC via action logging only (no hard enforcement) | Ship faster, review access patterns with CA firm managers before building enforcement | — Pending |
| Platform-only templates (no user-created engagement types in V1) | Reduce complexity, seed data covers common CA engagement types | — Pending |
| Indian FY fixed to April-March | All target users are Indian CA firms | — Pending |
| Soft deletes everywhere | CA firms need audit trails, 30-day restore window | — Pending |
| UUIDs for all PKs | Security (no enumeration), multi-tenant safety | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-27 after initialization*
