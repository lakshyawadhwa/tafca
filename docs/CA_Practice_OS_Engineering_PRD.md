# CA Practice OS — Engineering PRD
## V1 Feature Specification for Svelte + NestJS

**Status:** Draft | **Version:** 1.0
**Stack:** Svelte (frontend) · NestJS (backend) · PostgreSQL (primary DB) · S3-compatible storage (documents)
**Audience:** Engineering

---

> **North Star:** Every person in the firm knows exactly what to work on. Every deadline is visible. No client falls through the cracks. And none of it is managed over WhatsApp.

---

## Document Conventions

```
Field name        : snake_case
Type              : TypeScript / PostgreSQL types
Required          : whether the field is mandatory
Constraints       : validation rules, length limits, enum values
Default           : default value if any
Notes             : business logic, edge cases
```

`PK` = Primary Key · `FK` = Foreign Key · `UQ` = Unique · `NN` = Not Null · `IDX` = Indexed

---

## Table of Contents

1. [System-Wide Conventions](#1-system-wide-conventions)
2. [Auth & Users](#2-auth--users)
3. [Firm & Team Structure](#3-firm--team-structure)
4. [Client Management](#4-client-management)
5. [Engagement Management](#5-engagement-management)
6. [Task Tracking](#6-task-tracking)
7. [Compliance Calendar](#7-compliance-calendar)
8. [Document Management](#8-document-management)
9. [Credential Locker](#9-credential-locker)
10. [DSC Tracker](#10-dsc-tracker)
11. [Team & Workload Management](#11-team--workload-management)
12. [Notifications](#12-notifications)
13. [Business Logic & Automation Rules](#13-business-logic--automation-rules)
14. [V1 Scope Boundaries](#14-v1-scope-boundaries)
15. [Open Engineering Questions](#15-open-engineering-questions)

---

## 1. System-Wide Conventions

### 1.1 ID Strategy
All entities use UUID v4 as primary key. No auto-increment integers exposed externally.

```
id : uuid, PK, default: gen_random_uuid()
```

### 1.2 Audit Fields
Every table carries these four fields:

```
created_at  : timestamptz, NN, default: now()
updated_at  : timestamptz, NN, default: now()  -- updated via trigger
created_by  : uuid, FK → users.id, NN
updated_by  : uuid, FK → users.id, NN
```

### 1.3 Soft Deletes
No hard deletes on any user-facing entity. All tables carry:

```
deleted_at  : timestamptz, nullable, default: null
deleted_by  : uuid, FK → users.id, nullable
```

A record is considered deleted when `deleted_at IS NOT NULL`. All queries must filter `WHERE deleted_at IS NULL` unless explicitly fetching deleted records.

**Recently Deleted View:**
- Soft-deleted records are surfaced in a "Recently Deleted" view, accessible to PARTNER and ADMIN roles
- Restore capability: PARTNER can restore any soft-deleted record within 30 days
- After 30 days: record is permanently removed (hard delete via daily cron)
- Restored records regain their original state (status, assignments, etc.)

### 1.4 User Action Logging

Every user-initiated action is logged to an immutable `user_action_log` table. This serves as the foundation for RBAC enforcement (V1.5) and audit compliance.

```
user_action_log:
  id            : uuid, PK
  firm_id       : uuid, FK → firms.id, NN, IDX
  user_id       : uuid, FK → users.id, NN, IDX
  action        : varchar(100), NN        -- e.g. 'client.create', 'task.status_change', 'credential.view'
  entity_type   : varchar(50), NN         -- e.g. 'client', 'task', 'document'
  entity_id     : uuid, nullable
  metadata      : jsonb, NN, default: {}  -- action-specific context (old/new values, etc.)
  ip_address    : inet, nullable
  user_agent    : varchar(500), nullable
  occurred_at   : timestamptz, NN, default: now()
```

**Rules:**
- Immutable — no updates or deletes
- Logged for every create, update, delete, view-sensitive-data action
- In V1, this is the primary access control mechanism: all actions are permitted but fully traced
- RBAC hard enforcement will be layered on top in V1.5 after CA manager review (see `rbac_review_for_ca.md`)

### 1.5 Multi-Tenancy
Every table that holds firm data carries:

```
firm_id : uuid, FK → firms.id, NN, IDX
```

All queries must scope by `firm_id`. This is enforced at the NestJS service layer via a `FirmScopedRepository` base class — raw queries that bypass this are not permitted.

### 1.6 Enums
All enums are defined as PostgreSQL `ENUM` types and mirrored in TypeScript. Enum values use `SCREAMING_SNAKE_CASE`.

---

## 2. Auth & Users

### 2.1 Entity: `users`

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | PK, NN | gen_random_uuid() | |
| `firm_id` | uuid | FK → firms.id, NN, IDX | | |
| `email` | varchar(255) | NN, UQ per firm | | Lowercase enforced |
| `phone` | varchar(15) | nullable | | E.164 format, e.g. +919876543210 |
| `full_name` | varchar(100) | NN | | Min 2 chars |
| `role` | enum | NN | | See roles enum below |
| `password_hash` | varchar(255) | NN | | bcrypt, min cost 12 |
| `is_active` | boolean | NN | true | Deactivated users cannot log in but data retained |
| `last_login_at` | timestamptz | nullable | null | |
| `avatar_url` | varchar(500) | nullable | null | S3 URL |
| `whatsapp_number` | varchar(15) | nullable | null | E.164 format — may differ from phone |
| `notification_preferences` | jsonb | NN | `{}` | See notification preferences schema |

**Roles enum:** `PARTNER`, `MANAGER`, `JUNIOR_CA`, `ARTICLE`, `ADMIN`

- `ADMIN` is a firm-level admin role, not a CA role — manages settings, users, billing
- A user can only have one role
- Role changes are logged in `user_role_history`

**notification_preferences JSONB schema:**
```json
{
  "in_app": true,
  "email": true,
  "muted_until": null
}
```

**Validation rules:**
- `email`: valid email format, max 255 chars, unique within the firm
- `phone` / `whatsapp_number`: valid E.164 format or null
- `full_name`: 2–100 chars, no leading/trailing whitespace
- `role`: must be one of the defined enum values
- On deactivation (`is_active = false`): all open tasks assigned to this user must be flagged — system does not auto-reassign but raises a `USER_DEACTIVATED_WITH_OPEN_TASKS` event

### 2.2 Entity: `sessions`

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | PK | | |
| `user_id` | uuid | FK → users.id, NN, IDX | | |
| `token_hash` | varchar(255) | NN, UQ | | SHA-256 of the JWT |
| `expires_at` | timestamptz | NN | | |
| `ip_address` | inet | nullable | | |
| `user_agent` | varchar(500) | nullable | | |

**Rules:**
- JWT expiry: 7 days (refresh token pattern)
- On logout, token is invalidated by deleting the session row
- Max 5 concurrent sessions per user

---

## 3. Firm & Team Structure

### 3.1 Entity: `firms`

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | PK | | |
| `name` | varchar(200) | NN | | Firm legal name |
| `display_name` | varchar(100) | nullable | | Short name shown in UI |
| `icai_registration` | varchar(20) | nullable | | Format: e.g. 012345N |
| `pan` | varchar(10) | nullable | | Format validated: 5 alpha + 4 digits + 1 alpha |
| `gst_number` | varchar(15) | nullable | | Format: 15 char GSTIN |
| `address` | jsonb | nullable | | See address schema |
| `phone` | varchar(15) | nullable | | E.164 |
| `email` | varchar(255) | nullable | | Firm contact email |
| `logo_url` | varchar(500) | nullable | | S3 URL |
| `timezone` | varchar(50) | NN | `Asia/Kolkata` | IANA timezone string |
| `financial_year_start` | smallint | NN | `4` | Fixed to April (standard Indian FY). Not configurable in V1. |
| `subscription_tier` | enum | NN | `FREE` | V1 is free for all firms. Tier enforcement deferred — see scalability_roadmap.md |
| `subscription_expires_at` | timestamptz | nullable | | Not enforced in V1 |
| `max_users` | smallint | NN | `50` | Soft limit, not enforced in V1 |
| `settings` | jsonb | NN | `{}` | Firm-level config overrides |

**address JSONB schema:**
```json
{
  "line1": "string, required",
  "line2": "string, optional",
  "city": "string, required",
  "state": "string, required",
  "pincode": "string, 6 digits",
  "country": "string, default: IN"
}
```

**settings JSONB schema:**
```json
{
  "default_internal_deadline_buffer_days": 3,
  "auto_task_generation_enabled": true,
  "whatsapp_notifications_enabled": false,
  "compliance_calendar_auto_populate": true,
  "require_partner_approval_for": ["STATUTORY_AUDIT", "TAX_AUDIT"]
}
```

---

## 4. Client Management

### 4.1 Entity: `clients`

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | PK | | |
| `firm_id` | uuid | FK → firms.id, NN, IDX | | |
| `display_name` | varchar(200) | NN | | Trading or common name |
| `legal_name` | varchar(300) | nullable | | Full legal name |
| `entity_type` | enum | NN | | See entity types |
| `constitution` | enum | nullable | | See constitution types |
| `pan` | varchar(10) | nullable | | 5 alpha + 4 digits + 1 alpha, uppercase |
| `tan` | varchar(10) | nullable | | Format: 4 alpha + 5 digits + 1 alpha |
| `cin` | varchar(21) | nullable | | MCA CIN format |
| `status` | enum | NN | `ACTIVE` | `ACTIVE`, `INACTIVE`, `PROSPECT` |
| `primary_contact_name` | varchar(100) | nullable | | |
| `primary_contact_phone` | varchar(15) | nullable | | E.164 |
| `primary_contact_email` | varchar(255) | nullable | | |
| `address` | jsonb | nullable | | Same schema as firms.address |
| `notes` | text | nullable | | Internal notes, max 5000 chars |
| `tags` | varchar(50)[] | NN | `[]` | Array of tags for filtering; each tag max 50 chars |
| `custom_fields` | jsonb | NN | `{}` | Firm-defined custom fields — see below |
| `assigned_partner_id` | uuid | FK → users.id, nullable | | Must have role PARTNER |
| `assigned_manager_id` | uuid | FK → users.id, nullable | | Must have role MANAGER |
| `assigned_junior_id` | uuid | FK → users.id, nullable | | JUNIOR_CA or ARTICLE |
| `assigned_article_id` | uuid | FK → users.id, nullable | | ARTICLE role |
| `onboarded_at` | date | nullable | | When client was onboarded |
| `financial_year_end` | smallint | NN | `3` | Month 1–12; default March |

**entity_type enum:** `INDIVIDUAL`, `HUF`, `PARTNERSHIP_FIRM`, `LLP`, `PRIVATE_LIMITED`, `PUBLIC_LIMITED`, `TRUST`, `SOCIETY`, `AOP`, `BOI`, `OTHER`

**constitution enum:** `PROPRIETORSHIP`, `PARTNERSHIP`, `COMPANY`, `LLP`, `TRUST`, `SOCIETY`, `OTHER`

**Validation rules:**
- `pan`: regex `^[A-Z]{5}[0-9]{4}[A-Z]{1}$` if provided
- `tan`: regex `^[A-Z]{4}[0-9]{5}[A-Z]{1}$` if provided
- `cin`: regex `^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$` if provided
- `assigned_partner_id`: must reference a user with `role = PARTNER` in the same firm
- `assigned_manager_id`: must reference a user with `role = MANAGER` in the same firm
- `tags`: max 10 tags per client, each tag max 50 chars
- `display_name`: unique within a firm (case-insensitive), 1–200 chars

**custom_fields JSONB:** Holds key-value pairs defined by the firm's custom field schema. See `client_custom_field_definitions`.

### 4.2 Entity: `client_gst_numbers`

A client can have multiple GST registrations (e.g. different states).

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | PK | | |
| `client_id` | uuid | FK → clients.id, NN, IDX | | |
| `firm_id` | uuid | FK → firms.id, NN, IDX | | Denormalised for query performance |
| `gstin` | varchar(15) | NN | | 15 char format |
| `state_code` | varchar(2) | NN | | First 2 digits of GSTIN |
| `trade_name` | varchar(200) | nullable | | |
| `registration_type` | enum | NN | | `REGULAR`, `COMPOSITION`, `CASUAL`, `SEZ`, `ISD` |
| `is_primary` | boolean | NN | `false` | Only one primary per client |
| `registered_at` | date | nullable | | |
| `cancelled_at` | date | nullable | | |

**Validation rules:**
- `gstin`: regex `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`
- `state_code` must match first 2 chars of `gstin`
- Only one `is_primary = true` per `client_id` — enforced via partial unique index
- `cancelled_at` must be null or after `registered_at`

### 4.3 Entity: `client_custom_field_definitions`

Firms can define their own fields for the client record.

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | PK | | |
| `firm_id` | uuid | FK → firms.id, NN, IDX | | |
| `field_key` | varchar(50) | NN | | snake_case, UQ per firm |
| `label` | varchar(100) | NN | | Display label |
| `field_type` | enum | NN | | See field types |
| `is_required` | boolean | NN | `false` | |
| `options` | varchar(100)[] | nullable | | For DROPDOWN type only |
| `display_order` | smallint | NN | `0` | Sort order in UI |
| `is_active` | boolean | NN | `true` | Inactive fields hidden from UI but data retained |

**field_type enum:** `TEXT`, `NUMBER`, `DATE`, `DROPDOWN`, `BOOLEAN`, `URL`

**Validation rules:**
- `field_key`: regex `^[a-z][a-z0-9_]{0,49}$`, unique per firm
- `label`: 1–100 chars
- `options`: required and non-empty if `field_type = DROPDOWN`; max 50 options, each max 100 chars
- Max 20 custom field definitions per firm in V1

---

## 5. Engagement Management

An engagement is a scoped piece of work for a client. The engagement is the link between a client and their tasks.

### 5.1 Entity: `engagement_types`

Firm-level templates for types of work. Some are seeded globally; firms can add custom ones.

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | PK | | |
| `firm_id` | uuid | FK → firms.id, nullable, IDX | | Null = global seed template |
| `name` | varchar(100) | NN | | E.g. "GST Monthly Compliance" |
| `code` | varchar(50) | NN | | snake_case, UQ per firm, e.g. `gst_monthly` |
| `category` | enum | NN | | See categories |
| `recurrence` | enum | NN | `ONE_OFF` | `ONE_OFF`, `MONTHLY`, `QUARTERLY`, `HALF_YEARLY`, `ANNUALLY` |
| `default_task_template_id` | uuid | FK → task_templates.id, nullable | | Default task chain to spin up |
| `requires_partner_approval` | boolean | NN | `false` | Overrides firm settings if true |
| `is_active` | boolean | NN | `true` | |
| `description` | text | nullable | | Max 1000 chars |

**category enum:** `GST`, `INCOME_TAX`, `TDS`, `ROC_COMPLIANCE`, `AUDIT`, `PAYROLL`, `ADVISORY`, `ACCOUNTING`, `OTHER`

**Seeded global engagement types:**
```
gst_monthly           → GST Monthly Compliance      (MONTHLY)
gst_annual            → GST Annual Return            (ANNUALLY)
tds_quarterly         → TDS Quarterly Return         (QUARTERLY)
itr_individual        → ITR Filing - Individual      (ANNUALLY)
itr_company           → ITR Filing - Company         (ANNUALLY)
statutory_audit       → Statutory Audit              (ANNUALLY)
tax_audit             → Tax Audit                    (ANNUALLY)
roc_annual            → ROC Annual Filing             (ANNUALLY)
advance_tax           → Advance Tax                  (QUARTERLY)
mis_monthly           → MIS Reporting                (MONTHLY)
payroll_monthly       → Payroll Processing           (MONTHLY)
```

### 5.2 Entity: `engagements`

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | PK | | |
| `firm_id` | uuid | FK → firms.id, NN, IDX | | |
| `client_id` | uuid | FK → clients.id, NN, IDX | | |
| `engagement_type_id` | uuid | FK → engagement_types.id, NN | | |
| `name` | varchar(200) | NN | | Auto-generated but editable: "[Type] - [Client] - [Period]" |
| `status` | enum | NN | `ACTIVE` | See status enum |
| `period_label` | varchar(50) | nullable | | E.g. "FY 2024-25", "October 2025" |
| `period_start` | date | nullable | | |
| `period_end` | date | nullable | | |
| `assigned_partner_id` | uuid | FK → users.id, nullable | | Inherits from client if null |
| `assigned_manager_id` | uuid | FK → users.id, nullable | | Inherits from client if null |
| `assigned_team` | uuid[] | NN | `[]` | Array of user IDs |
| `fee_amount` | numeric(12,2) | nullable | | Agreed fee for this engagement |
| `fee_currency` | varchar(3) | NN | `INR` | ISO 4217 |
| `notes` | text | nullable | | Max 5000 chars |
| `custom_fields` | jsonb | NN | `{}` | Engagement-level custom fields |
| `completed_at` | timestamptz | nullable | | Set when status → COMPLETED |

**status enum:** `ACTIVE`, `ON_HOLD`, `COMPLETED`, `CANCELLED`

**Validation rules:**
- `period_end` must be null or >= `period_start`
- `assigned_partner_id` must be a user with role `PARTNER` in same firm
- `assigned_manager_id` must be a user with role `MANAGER` in same firm
- `assigned_team` members must all belong to same firm
- On `status → COMPLETED`: all child tasks must be in `DONE` or `CANCELLED` state — if not, raise validation error with list of blocking tasks
- On `status → CANCELLED`: child tasks in `TO_DO` or `IN_PROGRESS` are auto-moved to `CANCELLED`; tasks in `DONE` are unchanged
- `fee_amount`: must be null or >= 0

### 5.3 Entity: `engagement_custom_field_definitions`

Same pattern as `client_custom_field_definitions` but scoped to engagement type.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `firm_id` | uuid | FK → firms.id, NN | |
| `engagement_type_id` | uuid | FK → engagement_types.id, NN | |
| `field_key` | varchar(50) | NN, UQ per engagement_type | |
| `label` | varchar(100) | NN | |
| `field_type` | enum | NN | Same enum as client custom fields |
| `is_required` | boolean | NN, default false | |
| `options` | varchar(100)[] | nullable | For DROPDOWN only |
| `display_order` | smallint | NN, default 0 | |

---

## 6. Task Tracking

### 6.1 Entity: `tasks`

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | PK | | |
| `firm_id` | uuid | FK → firms.id, NN, IDX | | |
| `engagement_id` | uuid | FK → engagements.id, nullable, IDX | | Null = standalone task not tied to engagement |
| `client_id` | uuid | FK → clients.id, nullable, IDX | | Denormalised from engagement; required if engagement_id is null |
| `parent_task_id` | uuid | FK → tasks.id, nullable, IDX | | For sub-tasks (max depth: 1 in V1) |
| `title` | varchar(300) | NN | | 1–300 chars |
| `description` | text | nullable | | Max 10,000 chars |
| `status` | enum | NN | `TO_DO` | See status enum |
| `priority` | enum | NN | `MEDIUM` | `LOW`, `MEDIUM`, `HIGH`, `URGENT` |
| `assignee_id` | uuid | FK → users.id, nullable, IDX | | |
| `reviewer_id` | uuid | FK → users.id, nullable | | |
| `due_date` | date | nullable | | Statutory or target due date |
| `internal_due_date` | date | nullable | | Computed: due_date minus firm buffer; overridable |
| `statutory_deadline_id` | uuid | FK → statutory_deadlines.id, nullable | | Set if task was auto-generated from compliance calendar |
| `estimated_hours` | numeric(5,2) | nullable | | Must be > 0 if provided |
| `is_recurring` | boolean | NN | `false` | |
| `recurrence_config` | jsonb | nullable | | Required if is_recurring = true |
| `recurrence_parent_id` | uuid | FK → tasks.id, nullable | | Points to the first instance of a recurring task chain |
| `tags` | varchar(50)[] | NN | `[]` | Max 10 tags |
| `custom_fields` | jsonb | NN | `{}` | |
| `completed_at` | timestamptz | nullable | | Set when status → DONE |
| `cancelled_at` | timestamptz | nullable | | Set when status → CANCELLED |

**status enum:** `TO_DO`, `IN_PROGRESS`, `AWAITING_CLIENT`, `UNDER_REVIEW`, `PARTNER_APPROVAL`, `DONE`, `CANCELLED`

**Status transition rules:**

| From | Allowed To |
|---|---|
| `TO_DO` | `IN_PROGRESS`, `CANCELLED` |
| `IN_PROGRESS` | `AWAITING_CLIENT`, `UNDER_REVIEW`, `PARTNER_APPROVAL`, `TO_DO`, `CANCELLED` |
| `AWAITING_CLIENT` | `IN_PROGRESS`, `CANCELLED` |
| `UNDER_REVIEW` | `IN_PROGRESS`, `PARTNER_APPROVAL`, `DONE`, `CANCELLED` |
| `PARTNER_APPROVAL` | `UNDER_REVIEW`, `IN_PROGRESS`, `DONE`, `CANCELLED` |
| `DONE` | *(terminal — no transitions)* |
| `CANCELLED` | *(terminal — no transitions)* |

**recurrence_config JSONB schema:**
```json
{
  "frequency": "MONTHLY | QUARTERLY | HALF_YEARLY | ANNUALLY",
  "day_of_month": 1,
  "month_of_quarter": 1,
  "advance_create_days": 10,
  "auto_assign": true
}
```
- `advance_create_days`: how many days before due date the next instance is created (default: 10)
- `auto_assign`: if true, next instance inherits assignee from current instance

**Validation rules:**
- `title`: 1–300 chars, no leading/trailing whitespace
- `due_date`: must be null or a valid date; no restriction on past dates (historical tasks allowed)
- `internal_due_date`: must be null or <= `due_date`
- `assignee_id` and `reviewer_id` must belong to the same firm
- `assignee_id` cannot equal `reviewer_id`
- `parent_task_id`: cannot reference a task that itself has a parent (max depth 1)
- `client_id`: required if `engagement_id` is null; if `engagement_id` is set, `client_id` is auto-populated from the engagement
- On status → `DONE`: if task has a checklist, all non-optional checklist items must be completed
- On status → `DONE`: if task has open dependencies (tasks that depend on this one), those tasks' status is unaffected — they remain blocked at application logic level
- `estimated_hours`: 0.25–999.99 if provided

### 6.2 Entity: `task_checklists`

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | PK | | |
| `task_id` | uuid | FK → tasks.id, NN, IDX | | |
| `firm_id` | uuid | FK → firms.id, NN, IDX | | |
| `label` | varchar(300) | NN | | 1–300 chars |
| `is_completed` | boolean | NN | `false` | |
| `is_required` | boolean | NN | `true` | If true, blocks task from moving to DONE |
| `completed_at` | timestamptz | nullable | | |
| `completed_by` | uuid | FK → users.id, nullable | | |
| `display_order` | smallint | NN | `0` | |

**Validation rules:**
- Max 30 checklist items per task
- `label`: 1–300 chars
- `completed_by` must be set when `is_completed = true`; must be null when `is_completed = false`

### 6.3 Entity: `task_dependencies`

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `firm_id` | uuid | FK → firms.id, NN | |
| `task_id` | uuid | FK → tasks.id, NN, IDX | The dependent task (blocked until predecessor is done) |
| `depends_on_task_id` | uuid | FK → tasks.id, NN, IDX | The predecessor task |

**Validation rules:**
- `task_id` cannot equal `depends_on_task_id`
- No circular dependencies — graph must remain a DAG (detected at insert time)
- Both tasks must belong to the same firm
- UQ constraint on `(task_id, depends_on_task_id)`

**Business logic:**
- When `depends_on_task_id` moves to `DONE`, emit `DEPENDENCY_UNBLOCKED` event for `task_id`
- The event triggers a notification to `task_id.assignee_id`

### 6.4 Entity: `task_comments`

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | PK | | |
| `task_id` | uuid | FK → tasks.id, NN, IDX | | |
| `firm_id` | uuid | FK → firms.id, NN | | |
| `author_id` | uuid | FK → users.id, NN | | |
| `body` | text | NN | | 1–5000 chars |
| `mentions` | uuid[] | NN | `[]` | Array of user IDs mentioned via @ |
| `parent_comment_id` | uuid | FK → task_comments.id, nullable | | For threaded replies; max 1 level deep |

**Validation rules:**
- `body`: 1–5000 chars
- `mentions`: all user IDs must belong to same firm; max 10 mentions per comment
- On insert with non-empty `mentions`: emit `COMMENT_MENTION` notification for each mentioned user
- Comments are soft-deleted; deleted comments show "[comment deleted]" placeholder if they have replies

### 6.5 Entity: `task_activity_log`

Immutable audit trail — no updates or deletes.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `task_id` | uuid | FK → tasks.id, NN, IDX | |
| `firm_id` | uuid | FK → firms.id, NN | |
| `actor_id` | uuid | FK → users.id, NN | User who performed the action |
| `action` | enum | NN | See actions enum |
| `old_value` | jsonb | nullable | Previous state snapshot |
| `new_value` | jsonb | nullable | New state snapshot |
| `occurred_at` | timestamptz | NN | default: now() |

**action enum:** `CREATED`, `STATUS_CHANGED`, `ASSIGNEE_CHANGED`, `REVIEWER_CHANGED`, `DUE_DATE_CHANGED`, `PRIORITY_CHANGED`, `CHECKLIST_ITEM_COMPLETED`, `CHECKLIST_ITEM_UNCOMPLETED`, `COMMENT_ADDED`, `ATTACHMENT_ADDED`, `ATTACHMENT_REMOVED`, `DEPENDENCY_ADDED`, `DEPENDENCY_REMOVED`, `RECURRING_INSTANCE_CREATED`

### 6.6 Entity: `task_templates`

Reusable task chains attached to engagement types.

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | PK | | |
| `firm_id` | uuid | FK → firms.id, nullable | | Always null in V1 — all templates are platform-defined. Firm-specific templates deferred to V1.5. |
| `engagement_type_id` | uuid | FK → engagement_types.id, NN | | |
| `name` | varchar(200) | NN | | |
| `is_active` | boolean | NN | `true` | |

### 6.7 Entity: `task_template_items`

Individual task definitions within a template.

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | PK | | |
| `template_id` | uuid | FK → task_templates.id, NN, IDX | | |
| `title` | varchar(300) | NN | | |
| `description` | text | nullable | | |
| `assignee_role` | enum | nullable | | Role to auto-assign: `PARTNER`, `MANAGER`, `JUNIOR_CA`, `ARTICLE` |
| `reviewer_role` | enum | nullable | | |
| `due_offset_days` | smallint | nullable | | Days before engagement due date; negative = before |
| `display_order` | smallint | NN | `0` | |
| `depends_on_order` | smallint[] | NN | `[]` | display_order values this item depends on |
| `checklist_items` | jsonb | NN | `[]` | See checklist items schema |
| `is_required` | boolean | NN | `true` | Optional template items can be skipped |

**checklist_items JSONB schema:**
```json
[
  {
    "label": "string, 1-300 chars",
    "is_required": true,
    "display_order": 0
  }
]
```

**Seeded task template — GST Monthly Compliance:**
```
Order 1: Collect sales and purchase data            [ARTICLE, offset: -10]
Order 2: Reconcile GSTR-2B with purchase register   [JUNIOR_CA, offset: -8, depends_on: [1]]
Order 3: Prepare GSTR-1 data                        [JUNIOR_CA, offset: -7, depends_on: [1]]
Order 4: Prepare GSTR-3B computation               [JUNIOR_CA, offset: -5, depends_on: [2,3]]
Order 5: Manager review                             [MANAGER,   offset: -3, depends_on: [4]]
Order 6: Partner approval and filing                [PARTNER,   offset: -1, depends_on: [5]]
Order 7: Save filed acknowledgement                 [JUNIOR_CA, offset: 0,  depends_on: [6]]
```

---

## 7. Compliance Calendar

### 7.1 Entity: `statutory_deadlines`

Global seed data — not firm-specific. Managed by platform admin.

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | PK | | |
| `code` | varchar(50) | NN, UQ | | E.g. `GSTR3B_MONTHLY`, `TDS_26Q_Q1` |
| `name` | varchar(200) | NN | | Human-readable |
| `description` | text | nullable | | |
| `category` | enum | NN | | Same category enum as engagement_types |
| `applicable_to` | enum[] | NN | | Entity types this applies to |
| `recurrence` | enum | NN | | `MONTHLY`, `QUARTERLY`, `HALF_YEARLY`, `ANNUALLY`, `ONE_OFF` |
| `recurrence_day` | smallint | nullable | | Day of month the deadline falls |
| `recurrence_month` | smallint | nullable | | Month for annual deadlines |
| `quarter_month_offset` | smallint | nullable | | For quarterly: month within quarter (1, 2, or 3) |
| `penalty_per_day` | numeric(10,2) | nullable | | ₹ per day after deadline |
| `penalty_flat` | numeric(10,2) | nullable | | One-time flat penalty |
| `penalty_notes` | varchar(500) | nullable | | E.g. "Max penalty ₹10,000" |
| `is_active` | boolean | NN | `true` | |
| `linked_engagement_type_code` | varchar(50) | nullable | | Links to engagement_types.code |

### 7.2 Entity: `statutory_deadline_overrides`

Government extensions and date changes.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `statutory_deadline_id` | uuid | FK → statutory_deadlines.id, NN, IDX | |
| `period_label` | varchar(50) | NN | E.g. "October 2025" |
| `original_date` | date | NN | |
| `extended_date` | date | NN | Must be > original_date |
| `notification_source` | varchar(500) | nullable | Link to official circular |
| `applied_by` | uuid | FK → users.id, NN | Platform admin |

### 7.3 Entity: `client_compliance_assignments`

Which statutory deadlines apply to which clients. Controls auto task generation.

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | PK | | |
| `firm_id` | uuid | FK → firms.id, NN, IDX | | |
| `client_id` | uuid | FK → clients.id, NN, IDX | | |
| `statutory_deadline_id` | uuid | FK → statutory_deadlines.id, NN | | |
| `is_enabled` | boolean | NN | `true` | Disable to exclude client from this compliance |
| `auto_generate_tasks` | boolean | NN | `true` | Whether to auto-create tasks |
| `task_template_id` | uuid | FK → task_templates.id, nullable | | Override default template |
| `internal_buffer_days` | smallint | nullable | | Override firm default buffer |
| `custom_due_date_day` | smallint | nullable | | Override recurrence_day for this client |

**Auto task generation logic:**
1. Daily cron runs at 06:00 IST
2. For each `client_compliance_assignment` where `is_enabled = true` and `auto_generate_tasks = true`:
   a. Compute next due date from `statutory_deadline` recurrence (or override)
   b. Subtract `advance_create_days` from template (or 10 if not set)
   c. If today >= (due_date - advance_create_days) and no task exists for this client + deadline + period: create task chain from template
3. Task chain creation assigns roles to users based on client's `assigned_partner_id`, `assigned_manager_id`, etc.
4. If any role slot is empty on the client, the task is **auto-assigned to the client's assigned manager**. If no manager is assigned, the task is created unassigned and Manager + Partner are notified.

### 7.4 Entity: `compliance_calendar_entries`

Materialised view of deadlines per firm per period. Rebuilt on cron or on demand.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `firm_id` | uuid | FK → firms.id, NN, IDX | |
| `client_id` | uuid | FK → clients.id, NN, IDX | |
| `statutory_deadline_id` | uuid | FK → statutory_deadlines.id, NN | |
| `period_label` | varchar(50) | NN | E.g. "October 2025" |
| `due_date` | date | NN, IDX | Effective date (after any override) |
| `internal_due_date` | date | NN | |
| `status` | enum | NN | `PENDING`, `IN_PROGRESS`, `FILED`, `MISSED`, `NOT_APPLICABLE` |
| `linked_task_id` | uuid | FK → tasks.id, nullable | |

---

## 8. Document Management

### 8.1 Entity: `documents`

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | PK | | |
| `firm_id` | uuid | FK → firms.id, NN, IDX | | |
| `client_id` | uuid | FK → clients.id, nullable, IDX | | |
| `engagement_id` | uuid | FK → engagements.id, nullable, IDX | | |
| `task_id` | uuid | FK → tasks.id, nullable, IDX | | |
| `name` | varchar(300) | NN | | Display name — not the stored filename |
| `description` | text | nullable | | Max 1000 chars |
| `document_type` | enum | NN | `GENERAL` | See document types |
| `storage_key` | varchar(500) | NN | | S3 object key |
| `storage_bucket` | varchar(100) | NN | | S3 bucket name |
| `mime_type` | varchar(100) | NN | | E.g. `application/pdf` |
| `file_size_bytes` | bigint | NN | | |
| `checksum_sha256` | varchar(64) | NN | | SHA-256 of file contents |
| `version` | smallint | NN | `1` | Incremented on new upload |
| `version_of_id` | uuid | FK → documents.id, nullable | | Points to original document. Replacement strategy: always replaces latest version (linear chain). |
| `uploaded_by` | uuid | FK → users.id, NN | | |
| `source` | enum | NN | `TEAM_UPLOAD` | `TEAM_UPLOAD`, `CLIENT_UPLOAD`, `AUTO_GENERATED` |
| `tags` | varchar(50)[] | NN | `[]` | |
| `custom_fields` | jsonb | NN | `{}` | |
| `is_client_visible` | boolean | NN | `false` | Whether client can see this in V1 minimal client upload portal |
| `expires_at` | date | nullable | | For time-bound documents |
| `retention_expires_at` | date | nullable | | Default: created_at + 1 year. System notifies firm before deletion. See scalability_roadmap.md for extended retention tiers. |

**document_type enum:** `GENERAL`, `CLIENT_PROVIDED`, `WORKING_PAPER`, `FILED_RETURN`, `ACKNOWLEDGEMENT`, `ENGAGEMENT_LETTER`, `INVOICE`, `BANK_STATEMENT`, `FORM_26AS`, `AIS`, `SALARY_REGISTER`, `PURCHASE_REGISTER`, `SALES_REGISTER`, `BALANCE_SHEET`, `PROFIT_LOSS`, `AUDIT_REPORT`, `OTHER`

**Allowed MIME types:**
```
application/pdf
application/vnd.ms-excel
application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
application/msword
application/vnd.openxmlformats-officedocument.wordprocessingml.document
image/jpeg
image/png
image/webp
text/csv
application/zip
```

**Validation rules:**
- `file_size_bytes`: max 50MB per file in V1
- `name`: 1–300 chars
- `checksum_sha256`: 64 hex chars; used to detect duplicate uploads
- `version_of_id`: if set, must reference a document with `version_of_id = null` (i.e. the original — no chains)
- Versions are displayed together in the UI, sorted by `version` desc
- At least one of `client_id`, `engagement_id`, or `task_id` must be set

### 8.2 Entity: `document_requests`

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | PK | | |
| `firm_id` | uuid | FK → firms.id, NN, IDX | | |
| `client_id` | uuid | FK → clients.id, NN, IDX | | |
| `engagement_id` | uuid | FK → engagements.id, nullable | | |
| `task_id` | uuid | FK → tasks.id, nullable | | |
| `requested_by` | uuid | FK → users.id, NN | | |
| `title` | varchar(300) | NN | | E.g. "Please provide Form 16 for FY 2024-25" |
| `description` | text | nullable | | Max 2000 chars; instructions to client |
| `status` | enum | NN | `PENDING` | See status enum |
| `due_date` | date | nullable | | When document is needed by |
| `upload_token` | uuid | NN, UQ | gen_random_uuid() | Token embedded in client upload URL; expires |
| `upload_token_expires_at` | timestamptz | NN | now() + 30 days | |
| `reminder_sent_count` | smallint | NN | `0` | Auto-incremented on each reminder |
| `last_reminder_sent_at` | timestamptz | nullable | | |
| `fulfilled_by_document_id` | uuid | FK → documents.id, nullable | | Set when client uploads |
| `fulfilled_at` | timestamptz | nullable | | |

**status enum:** `PENDING`, `REMINDED`, `FULFILLED`, `CANCELLED`

**Validation rules:**
- `title`: 1–300 chars
- `upload_token` is single-use — invalidated once document is uploaded
- `upload_token_expires_at`: can be extended by the requesting user
- On `status → FULFILLED`: linked `task_id.status` remains unchanged — the assignee is notified to review
- Reminders: max 3 auto-reminders before status flags as requiring manual follow-up; auto-reminder at days 3, 7, 14 after creation

### 8.3 Entity: `document_checklist_templates`

Firms can define what documents are expected for a given engagement type.

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | PK | | |
| `firm_id` | uuid | FK → firms.id, nullable | | Null = global seed |
| `engagement_type_id` | uuid | FK → engagement_types.id, NN | | |
| `name` | varchar(200) | NN | | Template name |
| `is_active` | boolean | NN | `true` | |

### 8.4 Entity: `document_checklist_template_items`

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | PK | | |
| `template_id` | uuid | FK → document_checklist_templates.id, NN, IDX | | |
| `label` | varchar(300) | NN | | E.g. "Bank statements for all accounts" |
| `description` | text | nullable | | Max 1000 chars |
| `document_type` | enum | nullable | | Maps to documents.document_type |
| `is_required` | boolean | NN | `true` | |
| `display_order` | smallint | NN | `0` | |
| `custom_fields` | jsonb | NN | `{}` | Firm-defined metadata for this line item |

### 8.5 Entity: `document_checklist_instances`

Actual checklist for a specific engagement, instantiated from a template.

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | PK | | |
| `firm_id` | uuid | FK → firms.id, NN | | |
| `engagement_id` | uuid | FK → engagements.id, NN, UQ, IDX | | One checklist per engagement |
| `template_id` | uuid | FK → document_checklist_templates.id, nullable | | Source template; null if created ad-hoc |

### 8.6 Entity: `document_checklist_instance_items`

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | PK | | |
| `checklist_instance_id` | uuid | FK → document_checklist_instances.id, NN, IDX | | |
| `firm_id` | uuid | FK → firms.id, NN | | |
| `label` | varchar(300) | NN | | Copied from template item; editable per instance |
| `description` | text | nullable | | |
| `document_type` | enum | nullable | | |
| `is_required` | boolean | NN | `true` | |
| `status` | enum | NN | `PENDING` | `PENDING`, `REQUESTED`, `RECEIVED`, `VERIFIED`, `WAIVED` |
| `document_id` | uuid | FK → documents.id, nullable | | Linked when received |
| `document_request_id` | uuid | FK → document_requests.id, nullable | | Linked if a request was sent |
| `waived_reason` | text | nullable | | Required if status = WAIVED; max 500 chars |
| `waived_by` | uuid | FK → users.id, nullable | | |
| `display_order` | smallint | NN | `0` | |
| `notes` | text | nullable | | Max 1000 chars |
| `custom_fields` | jsonb | NN | `{}` | |

**Validation rules:**
- `status → WAIVED`: `waived_reason` required, `waived_by` required
- `status → RECEIVED`: `document_id` should be set (soft constraint — warning, not error, to allow manual tracking)
- Items can be added to a checklist instance even if not in the template (ad-hoc items)
- Items cannot be hard-deleted from an instance; use `status = WAIVED` instead

---

## 9. Credential Locker

### 9.1 Entity: `credential_locker_entries`

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | PK | | |
| `firm_id` | uuid | FK → firms.id, NN, IDX | | |
| `client_id` | uuid | FK → clients.id, NN, IDX | | |
| `portal` | enum | NN | | See portals enum |
| `portal_label` | varchar(100) | nullable | | Custom label if portal = OTHER |
| `username` | varchar(200) | NN | | |
| `password_encrypted` | text | NN | | AES-256-GCM encrypted; key managed via KMS |
| `registered_phone` | varchar(15) | nullable | | E.164 |
| `registered_email` | varchar(255) | nullable | | |
| `notes` | text | nullable | | Max 1000 chars; stored encrypted |
| `last_changed_at` | date | nullable | | When password was last changed |
| `last_accessed_at` | timestamptz | nullable | | Updated on each view |
| `last_accessed_by` | uuid | FK → users.id, nullable | | |

**portals enum:** `GST`, `INCOME_TAX`, `MCA`, `TRACES`, `TDS_CPC`, `EPFO`, `ESIC`, `DGFT`, `CUSTOMS`, `RBI`, `SEBI`, `OTHER`

**Validation rules:**
- `portal_label`: required if `portal = OTHER`, max 100 chars
- `username`: 1–200 chars
- `password_encrypted`: never returned in list endpoints — only in explicit single-fetch with access check
- `registered_phone`: E.164 format if provided

### 9.2 Entity: `credential_access_log`

Immutable — no updates or deletes.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `firm_id` | uuid | FK → firms.id, NN, IDX | |
| `credential_id` | uuid | FK → credential_locker_entries.id, NN, IDX | |
| `accessed_by` | uuid | FK → users.id, NN | |
| `accessed_at` | timestamptz | NN, default: now() | |
| `ip_address` | inet | nullable | |
| `action` | enum | NN | `VIEWED`, `COPIED`, `UPDATED`, `CREATED` |

**Access control rules:**
- `ARTICLE` role: cannot view credentials at all
- `JUNIOR_CA`: can view credentials for clients they are assigned to
- `MANAGER`: can view credentials for all clients in their scope
- `PARTNER` / `ADMIN`: full access
- Every view/copy action is logged to `credential_access_log` regardless of role

---

## 10. DSC Tracker

### 10.1 Entity: `dsc_records`

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | PK | | |
| `firm_id` | uuid | FK → firms.id, NN, IDX | | |
| `holder_type` | enum | NN | | `CLIENT`, `PARTNER` |
| `client_id` | uuid | FK → clients.id, nullable | | Required if holder_type = CLIENT |
| `user_id` | uuid | FK → users.id, nullable | | Required if holder_type = PARTNER |
| `holder_name` | varchar(200) | NN | | Derived but stored for fast display |
| `class` | enum | NN | | `CLASS_2`, `CLASS_3` |
| `type` | enum | NN | | `INDIVIDUAL`, `ORGANISATION`, `DGFT` |
| `issued_by` | varchar(200) | nullable | | CA/Certifying authority |
| `serial_number` | varchar(100) | nullable | | DSC serial number |
| `valid_from` | date | NN | | |
| `valid_until` | date | NN | | Must be > valid_from |
| `status` | enum | NN | `ACTIVE` | `ACTIVE`, `EXPIRED`, `REVOKED`, `RENEWED` |
| `renewed_by_id` | uuid | FK → dsc_records.id, nullable | | Points to the new DSC record on renewal |
| `storage_location` | varchar(300) | nullable | | Physical or logical location of token |
| `notes` | text | nullable | | Max 1000 chars |

**Validation rules:**
- `valid_until` must be > `valid_from`
- `client_id` required if `holder_type = CLIENT`, must be null if `holder_type = PARTNER`
- `user_id` required if `holder_type = PARTNER`, must have role `PARTNER`
- `status` auto-set to `EXPIRED` when `valid_until < today` (via daily cron)

**Alert rules:**
- 30 days before `valid_until`: `DSC_EXPIRY_ALERT_30` notification
- 15 days before: `DSC_EXPIRY_ALERT_15` notification
- 7 days before: `DSC_EXPIRY_ALERT_7` notification
- Recipients: assigned Partner, assigned Manager for the client

---

## 11. Team & Workload Management

### 11.1 Entity: `leave_records`

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | PK | | |
| `firm_id` | uuid | FK → firms.id, NN, IDX | | |
| `user_id` | uuid | FK → users.id, NN, IDX | | |
| `leave_type` | enum | NN | | `CASUAL`, `SICK`, `EXAM`, `TRAINING`, `PUBLIC_HOLIDAY`, `OTHER` |
| `start_date` | date | NN | | |
| `end_date` | date | NN | | Must be >= start_date |
| `is_half_day` | boolean | NN | `false` | Only valid if start_date = end_date |
| `reason` | varchar(500) | nullable | | |
| `status` | enum | NN | `PENDING` | `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED` |
| `approved_by` | uuid | FK → users.id, nullable | | |
| `approved_at` | timestamptz | nullable | | |

**Business logic:**
- On `status → APPROVED`: emit `USER_ON_LEAVE` event for each day in range
- `USER_ON_LEAVE` event triggers: flag all tasks with `assignee_id = user_id` and `due_date` within leave range as `ASSIGNEE_ON_LEAVE`
- Flagged tasks do not change status — they get a visual indicator and surface in the workload view

### 11.2 Workload View (Computed, Not Stored)

The workload view is computed on request from live task data. NestJS service computes:

```
For each user in firm:
  open_task_count     = COUNT(tasks WHERE assignee_id = user AND status NOT IN (DONE, CANCELLED))
  overdue_task_count  = COUNT(tasks WHERE assignee_id = user AND status NOT IN (DONE, CANCELLED) AND due_date < today)
  due_this_week_count = COUNT(tasks WHERE assignee_id = user AND status NOT IN (DONE, CANCELLED) AND due_date BETWEEN today AND today+7)
  load_status         = computed from open_task_count vs firm average:
                          < 0.5x average → UNDERUTILISED
                          0.5x – 1.5x    → BALANCED
                          > 1.5x average → OVERLOADED
```

No caching in V1 — computed on request. Add caching layer in V1.5 if p95 latency exceeds 500ms.

### 11.3 Partner Approval Queue (Computed View)

```
Tasks WHERE:
  status = PARTNER_APPROVAL
  AND firm_id = current_firm
  AND (reviewer_id = current_user OR engagement.assigned_partner_id = current_user)
ORDER BY due_date ASC, priority DESC
```

---

## 12. Notifications

### 12.1 Entity: `notifications`

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | PK | | |
| `firm_id` | uuid | FK → firms.id, NN, IDX | | |
| `recipient_id` | uuid | FK → users.id, NN, IDX | | |
| `type` | enum | NN | | See notification types |
| `title` | varchar(200) | NN | | |
| `body` | text | NN | | |
| `entity_type` | varchar(50) | nullable | | E.g. `task`, `document_request`, `dsc_record` |
| `entity_id` | uuid | nullable | | ID of the related entity |
| `channel` | enum | NN | | `IN_APP`, `EMAIL` (WhatsApp deferred from V1) |
| `status` | enum | NN | `PENDING` | `PENDING`, `SENT`, `FAILED`, `READ` |
| `sent_at` | timestamptz | nullable | | |
| `read_at` | timestamptz | nullable | | |
| `failed_reason` | text | nullable | | |
| `retry_count` | smallint | NN | `0` | |

**notification_type enum:**

| Type | Trigger | Recipients |
|---|---|---|
| `TASK_ASSIGNED` | Task assignee set or changed | New assignee |
| `TASK_OVERDUE` | Daily cron: due_date < today, task not done | Assignee, Manager |
| `TASK_STUCK` | Task in same status for > 2 days | Assignee's manager |
| `TASK_DEPENDENCY_UNBLOCKED` | Predecessor task moves to DONE | Blocked task's assignee |
| `TASK_REVIEW_REQUESTED` | Task moves to UNDER_REVIEW | Reviewer |
| `TASK_APPROVAL_REQUESTED` | Task moves to PARTNER_APPROVAL | Partner |
| `TASK_SENT_BACK` | Task moved back from review/approval | Assignee |
| `COMMENT_MENTION` | User @mentioned in comment | Mentioned user |
| `DOCUMENT_REQUEST_SENT` | Document request created | Client (email) |
| `DOCUMENT_REQUEST_FULFILLED` | Client uploads document | Requesting user |
| `DOCUMENT_REQUEST_OVERDUE` | Due date passed, not fulfilled | Requesting user, Manager |
| `DOCUMENT_REQUEST_REMINDER` | Auto-reminder (day 3, 7, 14) | Client (email) |
| `DOCUMENT_RETENTION_EXPIRY_WARNING` | 30 days before 1-year retention expires | Firm Admin, Partner |
| `DSC_EXPIRY_ALERT_30` | 30 days before DSC expiry | Partner, Manager |
| `DSC_EXPIRY_ALERT_15` | 15 days before DSC expiry | Partner, Manager |
| `DSC_EXPIRY_ALERT_7` | 7 days before DSC expiry | Partner, Manager |
| `COMPLIANCE_DEADLINE_APPROACHING` | Internal due date reached, task incomplete | Assignee, Manager |
| `COMPLIANCE_DEADLINE_MISSED` | Statutory due date passed, not filed | Partner, Manager |
| `USER_DEACTIVATED_WITH_OPEN_TASKS` | User deactivated with open tasks | Manager, Partner |
| `ASSIGNEE_ON_LEAVE` | Task's assignee goes on approved leave | Manager |

**Delivery rules:**
- Each notification type maps to which channels are used by default (see below)
- User's `notification_preferences` can disable email but cannot disable in-app
- Failed notifications are retried up to 3 times with exponential backoff
- WhatsApp delivery deferred from V1 — firms manage WhatsApp communication manually

**Default channel mapping (V1):**

| Notification Type | In-App | Email |
|---|---|---|
| Task assigned / overdue / stuck | ✓ | ✓ |
| Partner approval requested | ✓ | ✓ |
| Document request (to client) | — | ✓ |
| Document fulfilled | ✓ | ✓ |
| DSC expiry alerts | ✓ | ✓ |
| Compliance deadline approaching/missed | ✓ | ✓ |
| Comment mention | ✓ | ✓ |

---

## 13. Business Logic & Automation Rules

### 13.1 Auto Task Generation (Daily Cron)

```
Schedule: 0 6 * * * (06:00 IST daily)
For each firm:
  For each client_compliance_assignment WHERE is_enabled = true AND auto_generate_tasks = true:
    1. Resolve effective_due_date (check statutory_deadline_overrides first)
    2. Compute create_from_date = effective_due_date - advance_create_days
    3. If today >= create_from_date:
       4. Check: does a task already exist for (client_id, statutory_deadline_id, period_label)?
       5. If not: instantiate task chain from task_template
          - Assign PARTNER role → client.assigned_partner_id
          - Assign MANAGER role → client.assigned_manager_id
          - Assign JUNIOR_CA role → client.assigned_junior_id
          - Assign ARTICLE role → client.assigned_article_id
          - If role slot is empty: task created unassigned, Manager notified
       6. Create compliance_calendar_entry with status = IN_PROGRESS
       7. Emit COMPLIANCE_TASK_GENERATED event
```

### 13.2 Recurring Task Instance Creation

```
Trigger: Task status → DONE where is_recurring = true
1. Read recurrence_config from the completed task
2. Compute next_due_date based on frequency
3. Create new task copying: title, description, engagement_id, client_id,
   assignee_id (if auto_assign = true), checklist items from original
4. Set recurrence_parent_id = completed task's recurrence_parent_id ?? completed task's id
5. Emit RECURRING_INSTANCE_CREATED activity log entry
```

### 13.3 Internal Due Date Computation

```
On task CREATE or UPDATE where due_date is set:
  buffer = task.internal_buffer_days
          ?? client_compliance_assignment.internal_buffer_days
          ?? firm.settings.default_internal_deadline_buffer_days
          ?? 3
  internal_due_date = due_date - buffer days
  If internal_due_date < today AND task.status = TO_DO:
    emit COMPLIANCE_DEADLINE_APPROACHING notification immediately
```

### 13.4 Overdue Detection (Daily Cron)

```
Schedule: 0 7 * * * (07:00 IST daily)
SELECT tasks WHERE:
  status NOT IN (DONE, CANCELLED)
  AND due_date < today
  AND overdue_notified_at IS NULL OR overdue_notified_at < today - 1 day
→ Emit TASK_OVERDUE notification for each
→ Update overdue_notified_at = now()

SELECT tasks WHERE:
  status NOT IN (DONE, CANCELLED)
  AND updated_at < now() - interval '2 days'
  AND status = status at (now() - 2 days)  [detect stagnation via activity log]
→ Emit TASK_STUCK notification to assignee's manager
```

### 13.5 DSC Expiry Check (Daily Cron)

```
Schedule: 0 8 * * * (08:00 IST daily)
For each dsc_record WHERE status = ACTIVE:
  days_until_expiry = valid_until - today
  If days_until_expiry IN (30, 15, 7):
    Emit DSC_EXPIRY_ALERT_{days} notification
  If days_until_expiry < 0:
    Set status = EXPIRED
```

### 13.6 Document Request Auto-Reminders

```
Schedule: 0 9 * * * (09:00 IST daily)
For each document_request WHERE status = PENDING:
  days_since_created = today - created_at::date
  If days_since_created IN (3, 7, 14) AND reminder_sent_count < 3:
    Send DOCUMENT_REQUEST_REMINDER to client
    Increment reminder_sent_count
    Set last_reminder_sent_at = now()
  If days_since_created > 14 AND due_date < today:
    Emit DOCUMENT_REQUEST_OVERDUE to requesting user and their manager
```

### 13.7 Document Retention Check (Daily Cron)

```
Schedule: 0 10 * * * (10:00 IST daily)
For each document WHERE retention_expires_at IS NOT NULL:
  days_until_expiry = retention_expires_at - today
  If days_until_expiry = 30:
    Emit DOCUMENT_RETENTION_EXPIRY_WARNING to firm Admin + Partner
  If days_until_expiry <= 0:
    Hard delete file from S3
    Set document record: deleted_at = now(), deleted_by = 'SYSTEM'
```

### 13.8 Recently Deleted Cleanup (Daily Cron)

```
Schedule: 0 11 * * * (11:00 IST daily)
For each record across all soft-delete tables WHERE deleted_at IS NOT NULL:
  days_since_deleted = today - deleted_at::date
  If days_since_deleted > 30:
    Hard delete the record permanently
    If entity has S3 objects: delete from storage
    Log to user_action_log with action = 'system.hard_delete'
```

---

## 14. V1 Scope Boundaries

### MVP Target Scale
- ~50 firms, 5–50 employees per firm
- Free application — no subscription enforcement
- See `scalability_roadmap.md` for growth planning

### In V1

- All modules as specified above
- Web application only (SvelteKit); mobile-responsive but no native app
- PostgreSQL as primary DB; Redis for session store and BullMQ queues
- S3-compatible storage for documents (AWS S3 or self-hosted MinIO)
- Email via SMTP or transactional provider (Postmark or SES)
- In-app notifications + email delivery
- Minimal client document upload portal (token-based, no client login)
- Platform-defined templates only (no firm customisation)
- Standard Indian financial year (April–March) for all firms
- All user actions logged for audit trail (RBAC enforcement follows CA review)
- "Recently deleted" view with restore capability for soft-deleted items
- Document retention: 1 year, with notification before deletion
- Single-region deployment

### Out of V1

| Feature | Target |
|---|---|
| WhatsApp Business API integration | V1.5 |
| Subscription tier enforcement & billing | V1.5 |
| Firm-defined custom templates | V1.5 |
| Extended document retention tiers | V1.5 |
| Mobile native app (iOS/Android) | V1.5 |
| DPDP Act full compliance | V1.5 |
| Client portal (external login with dashboard) | V2 |
| Billing & invoicing module | V2 |
| Time tracking & billable hours | V2 |
| Tally / Zoho Books integration | V2 |
| Multi-region / data residency controls | V2 |
| SSO / SAML for enterprise | V2 |
| AI risk scoring / anomaly detection | V3 |
| Any CA computation or filing logic | Never |

---

## 15. Open Engineering Questions

1. **Encryption key management for credential locker** — AWS KMS vs self-managed? Decision needed before schema is finalised. KMS recommended; adds ~10ms latency per decrypt operation.

2. ~~**WhatsApp provider selection**~~ — **RESOLVED: Deferred from V1.** WhatsApp integration moved to V1.5.

3. **Compliance calendar date seeding** — how often are statutory deadlines updated by the government? Need a lightweight admin interface for platform team to push updates, or a YAML-based migration approach.

4. **Document storage access pattern** — pre-signed S3 URLs with short TTL (15 min) recommended. Confirm max file size limit — 50MB suggested but may need adjustment based on audit working paper sizes.

5. ~~**Workload view performance**~~ — **RESOLVED: Computed on request for MVP.** Scaling path documented in `scalability_roadmap.md`.

6. ~~**Soft delete strategy**~~ — **RESOLVED: "Recently deleted" view with restore capability.** Retention in recently deleted: 30 days before permanent removal.

7. ~~**Financial year scoping**~~ — **RESOLVED: Standard Indian FY (April–March) for all firms.** `firm.financial_year_start` fixed to 4 (April). Not configurable in V1.

8. ~~**Checklist template inheritance**~~ — **RESOLVED: All templates are platform-defined in V1.** No firm modification. Firm-defined templates deferred to V1.5.

9. **Client upload portal (V1)** — Minimal token-based page for document uploads. No client login. Scope: upload form + file validation + confirmation. Design TBD.

10. **Document retention notification** — System must notify firm admin/partner 30 days before the 1-year retention expiry. Notification triggers and escalation path TBD.
