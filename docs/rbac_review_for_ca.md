# CA Practice OS — Role & Permissions Review

**Purpose:** For review by a CA firm manager to validate what each role should be able to do.
**Status:** Draft for Review | **Date:** 2026-03-27

---

## How to Review This Document

We've listed every major action in the system and pre-filled what we think each role should be able to do. Please review each row and:
- **Mark ✅** if you agree
- **Mark ❌** if this should be changed, and note what it should be
- **Add any actions we've missed** at the bottom

> **Note:** For V1 MVP, all actions will be **logged** (who did what, when). Strict permission enforcement will follow based on your feedback. This means in V1, users *can* technically perform most actions, but every action is recorded in the audit trail so nothing goes unnoticed.

---

## Roles in the System

| Role | Description | Typical Person |
|---|---|---|
| **PARTNER** | Senior CA / firm owner. Final authority on all matters. | CA with signing authority |
| **MANAGER** | Senior staff managing a portfolio of clients and a team. | Experienced CA or semi-qualified |
| **JUNIOR_CA** | Qualified or semi-qualified CA handling day-to-day work. | Recently qualified CA |
| **ARTICLE** | Articled clerk / trainee under supervision. | CA student on articleship |
| **ADMIN** | Office/practice administrator. Manages settings, not CA work. | Office manager, IT person |

---

## Client Management

| Action | PARTNER | MANAGER | JUNIOR_CA | ARTICLE | ADMIN |
|---|---|---|---|---|---|
| View all clients in the firm | ✅ | ✅ | ❓ Only assigned? | ❓ Only assigned? | ✅ |
| Create a new client | ✅ | ✅ | ❌ | ❌ | ✅ |
| Edit client details | ✅ | ✅ | ❌ | ❌ | ✅ |
| Delete (soft) a client | ✅ | ❌ | ❌ | ❌ | ❌ |
| Assign/change partner on client | ✅ | ❌ | ❌ | ❌ | ❌ |
| Assign/change manager on client | ✅ | ✅ | ❌ | ❌ | ❌ |
| Assign/change junior/article on client | ✅ | ✅ | ❌ | ❌ | ❌ |
| View client GST registrations | ✅ | ✅ | ✅ (assigned) | ✅ (assigned) | ✅ |
| Add/edit GST registrations | ✅ | ✅ | ❌ | ❌ | ✅ |
| Add/manage client tags | ✅ | ✅ | ❌ | ❌ | ✅ |
| View client notes | ✅ | ✅ | ✅ (assigned) | ✅ (assigned) | ✅ |
| Add client notes | ✅ | ✅ | ✅ (assigned) | ❌ | ❌ |

**Questions for reviewer:**
1. Should JUNIOR_CA and ARTICLE see *all* clients, or only clients they are assigned to?
2. Should JUNIOR_CA be able to edit basic client details (phone, email, address) for assigned clients?

---

## Engagement Management

| Action | PARTNER | MANAGER | JUNIOR_CA | ARTICLE | ADMIN |
|---|---|---|---|---|---|
| View all engagements | ✅ | ✅ | ❓ Only assigned? | ❓ Only assigned? | ✅ |
| Create a new engagement | ✅ | ✅ | ❌ | ❌ | ❌ |
| Edit engagement details | ✅ | ✅ | ❌ | ❌ | ❌ |
| Change engagement status to COMPLETED | ✅ | ✅ | ❌ | ❌ | ❌ |
| Change engagement status to CANCELLED | ✅ | ❌ | ❌ | ❌ | ❌ |
| Change engagement status to ON_HOLD | ✅ | ✅ | ❌ | ❌ | ❌ |
| Set/edit engagement fee | ✅ | ❓ | ❌ | ❌ | ❌ |
| Assign team members to engagement | ✅ | ✅ | ❌ | ❌ | ❌ |

**Questions for reviewer:**
1. Can managers see and set fees, or is that partner-only?
2. Should there be approval required before marking an engagement as COMPLETED?

---

## Task Management

| Action | PARTNER | MANAGER | JUNIOR_CA | ARTICLE | ADMIN |
|---|---|---|---|---|---|
| View all tasks in firm | ✅ | ✅ | ❓ | ❓ | ✅ |
| View tasks assigned to them | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create a new task | ✅ | ✅ | ✅ | ❌ | ❌ |
| Edit task details (title, description) | ✅ | ✅ | ✅ (own/assigned) | ❌ | ❌ |
| Change task assignee | ✅ | ✅ | ❌ | ❌ | ❌ |
| Change task reviewer | ✅ | ✅ | ❌ | ❌ | ❌ |
| Change task priority | ✅ | ✅ | ❌ | ❌ | ❌ |
| Change task due date | ✅ | ✅ | ❌ | ❌ | ❌ |
| Move task: TO_DO → IN_PROGRESS | ✅ | ✅ | ✅ (own) | ✅ (own) | ❌ |
| Move task: IN_PROGRESS → UNDER_REVIEW | ✅ | ✅ | ✅ (own) | ✅ (own) | ❌ |
| Move task: UNDER_REVIEW → DONE | ✅ | ✅ (as reviewer) | ❌ | ❌ | ❌ |
| Move task: → PARTNER_APPROVAL | ✅ | ✅ | ❌ | ❌ | ❌ |
| Move task: PARTNER_APPROVAL → DONE | ✅ | ❌ | ❌ | ❌ | ❌ |
| Move task: → CANCELLED | ✅ | ✅ | ❌ | ❌ | ❌ |
| Move task: back to IN_PROGRESS (send back) | ✅ | ✅ (as reviewer) | ❌ | ❌ | ❌ |
| Add task comments | ✅ | ✅ | ✅ | ✅ | ❌ |
| Complete checklist items | ✅ | ✅ | ✅ (assigned) | ✅ (assigned) | ❌ |
| Add/remove task dependencies | ✅ | ✅ | ❌ | ❌ | ❌ |
| Add sub-tasks | ✅ | ✅ | ✅ (own tasks) | ❌ | ❌ |

**Questions for reviewer:**
1. Should JUNIOR_CA be able to create tasks, or only work on assigned tasks?
2. Can an ARTICLE move their own task to AWAITING_CLIENT?
3. Should task cancellation require partner approval?

---

## Document Management

| Action | PARTNER | MANAGER | JUNIOR_CA | ARTICLE | ADMIN |
|---|---|---|---|---|---|
| View all documents for assigned clients | ✅ | ✅ | ✅ | ✅ | ✅ |
| Upload a document | ✅ | ✅ | ✅ | ✅ | ❌ |
| Download a document | ✅ | ✅ | ✅ | ✅ | ✅ |
| Delete (soft) a document | ✅ | ✅ | ❌ | ❌ | ❌ |
| Upload new version of a document | ✅ | ✅ | ✅ | ❌ | ❌ |
| Create a document request (to client) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Cancel a document request | ✅ | ✅ | ❌ | ❌ | ❌ |
| Mark document checklist item as received | ✅ | ✅ | ✅ | ❌ | ❌ |
| Waive document checklist item | ✅ | ✅ | ❌ | ❌ | ❌ |
| Restore a deleted document | ✅ | ❌ | ❌ | ❌ | ❌ |

**Questions for reviewer:**
1. Should articles be able to upload new versions (e.g., corrected working papers)?
2. Can juniors delete documents they themselves uploaded?

---

## Credential Locker

> These rules are already defined in the PRD and are strict from Day 1 due to sensitivity.

| Action | PARTNER | MANAGER | JUNIOR_CA | ARTICLE | ADMIN |
|---|---|---|---|---|---|
| View credentials | ✅ All | ✅ Scoped clients | ✅ Assigned clients | ❌ | ✅ All |
| Add/edit credentials | ✅ | ✅ | ❌ | ❌ | ✅ |
| Copy password | ✅ | ✅ | ✅ (assigned) | ❌ | ✅ |
| Delete credential entry | ✅ | ❌ | ❌ | ❌ | ❌ |

**Every view and copy action is logged in the credential access log, regardless of role.**

---

## DSC Tracker

| Action | PARTNER | MANAGER | JUNIOR_CA | ARTICLE | ADMIN |
|---|---|---|---|---|---|
| View all DSC records | ✅ | ✅ | ✅ (assigned clients) | ❌ | ✅ |
| Add/edit DSC record | ✅ | ✅ | ❌ | ❌ | ✅ |
| Delete DSC record | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## Firm Settings & Administration

| Action | PARTNER | MANAGER | JUNIOR_CA | ARTICLE | ADMIN |
|---|---|---|---|---|---|
| View firm settings | ✅ | ❌ | ❌ | ❌ | ✅ |
| Edit firm settings | ✅ | ❌ | ❌ | ❌ | ✅ |
| Invite/create users | ✅ | ❌ | ❌ | ❌ | ✅ |
| Deactivate users | ✅ | ❌ | ❌ | ❌ | ✅ |
| Change user roles | ✅ | ❌ | ❌ | ❌ | ❌ |
| View audit logs | ✅ | ❓ | ❌ | ❌ | ✅ |
| Manage compliance assignments | ✅ | ✅ | ❌ | ❌ | ❌ |
| Approve/reject leave requests | ✅ | ✅ | ❌ | ❌ | ❌ |
| View workload dashboard | ✅ | ✅ | ❌ | ❌ | ✅ |

**Questions for reviewer:**
1. Should managers be able to view audit logs for their team?
2. Can ADMIN change user roles, or is that partner-only?

---

## Recently Deleted Items

All soft-deleted items (clients, engagements, tasks, documents) will appear in a "Recently Deleted" view:
- **Visible to:** PARTNER, ADMIN
- **Retention period:** 30 days in "recently deleted" before permanent removal
- **Restore capability:** PARTNER only (or ADMIN for non-client entities?)

**Question:** Should managers see recently deleted items for their clients?

---

## V1 MVP Approach

For V1:
1. **All user actions are logged** (who did what, when, from where) — this is non-negotiable
2. Permissions listed above are our **starting proposal** — not locked in
3. After your review, we'll implement the agreed matrix as hard enforcement
4. Until then, the system is permissive but transparent — nothing happens without a trace

**Please review and return with your feedback. Mark up directly on this document or share notes.**
