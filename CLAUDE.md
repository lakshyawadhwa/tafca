<!-- GSD:project-start source:PROJECT.md -->
## Project

**CA Practice OS**

A multi-tenant practice management platform for Chartered Accountant firms in India. Think "JIRA for CAs" — purpose-built task tracking, client management, and engagement lifecycle tools that replace the WhatsApp groups and spreadsheets CA firms currently rely on. Built with SvelteKit (frontend), NestJS (backend), PostgreSQL (Prisma ORM), and Redis.

**Core Value:** Every person in the firm knows exactly what to work on, every deadline is visible, and no client falls through the cracks.

### Constraints

- **Timeline**: 2-4 weeks to V1 in front of real CA firms — aggressive, requires focused scope
- **Stack**: SvelteKit + TailwindCSS (frontend), NestJS (backend), PostgreSQL + Prisma (DB), Redis (sessions + BullMQ)
- **Multi-tenancy**: firm_id on every table, enforced via Prisma $extends + FirmScopedService + AsyncLocalStorage
- **Auth**: JWT (15-min access) + HTTP-only cookie refresh (7 days), max 5 concurrent sessions
- **Deployment**: AWS/GCP
- **Storage**: S3-compatible (MinIO local, AWS S3 prod) — but document features deferred to V1.1
- **Monorepo**: Turborepo + pnpm workspaces (`apps/api`, `apps/web`, `packages/shared`)
<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->
## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
