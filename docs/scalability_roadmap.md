# CA Practice OS — Scalability & Deferred Decisions Roadmap

**Status:** Living Document | **Last Updated:** 2026-03-27
**Current Target:** MVP — ~50 firms, 5–50 employees per firm

---

## 1. Current MVP Scale Assumptions

| Dimension | V1 MVP Target | Notes |
|---|---|---|
| Total firms | ~50 | Invite-only / pilot phase |
| Users per firm | 5–50 | Mix of FREE and early adopter firms |
| Clients per firm | 50–500 (estimated) | Typical small-to-mid CA practice |
| Tasks per firm/month | ~500–5,000 | Based on compliance auto-generation + manual |
| Documents per firm/month | ~200–2,000 | Seasonal spikes during filing periods |
| Concurrent users (system-wide) | ~100–300 | Peak during morning hours IST |

These numbers are estimates. The MVP is designed to be fast and efficient at this scale without premature optimisation.

---

## 2. Auto Task Generation at Scale

### Current Design
Daily cron at 06:00 IST iterates: `for each firm → for each client_compliance_assignment`. At MVP scale (~50 firms × ~200 clients × ~10 assignments), this is ~100,000 evaluations. Each may create a multi-task chain with dependency wiring.

### Why It Works for MVP
At 100K evaluations with simple DB lookups and conditional inserts, this should complete within minutes on a single worker.

### When It Breaks
- **500+ firms** or **1,000+ clients per firm**: The nested loop becomes a bottleneck. Task chain creation is write-heavy (multiple inserts + dependency edges per chain).
- **Filing season spikes** (March–April, September–October): Many assignments trigger simultaneously.

### Scaling Path
- Partition work by firm — process each firm as an independent BullMQ job
- Add a `last_evaluated_at` column to skip recently processed assignments
- Consider a "task generation queue" that spreads creation across the day instead of a single 6 AM burst

---

## 3. Cron Job Scheduling (6 Daily Jobs)

### Current Design
Six cron jobs stacked between 06:00–09:00 IST:
- 06:00 — Auto task generation
- 07:00 — Overdue detection + stuck task detection
- 08:00 — DSC expiry checks
- 09:00 — Document request auto-reminders

### Why It Works for MVP
At ~50 firms, each job completes in seconds to low minutes. No contention.

### When It Breaks
- All jobs hit the same DB, same connection pool, during the same 3-hour window
- Overdue detection scans all open tasks firm-wide — O(total_open_tasks)
- If auto task generation runs long, it could overlap with overdue detection

### Scaling Path
- Move each cron to a dedicated BullMQ queue with configurable concurrency
- Stagger firm processing (firm A at 06:00, firm B at 06:01, etc.)
- Add circuit breakers: if a job exceeds X minutes, log + alert + skip remaining firms
- Consider moving from time-based crons to event-driven where possible (e.g., overdue check on task update, not daily scan)

---

## 4. Workload View Performance

### Current Design
Computed on every request from live task data. No caching.

### Why It Works for MVP
At 50 users per firm × ~50 open tasks per user, the aggregate query is small.

### When It Breaks
- Large firms (100+ users) with thousands of open tasks
- Frequent polling or dashboard auto-refresh

### Scaling Path
- Add Redis-cached workload snapshot per firm, refreshed every 15 minutes
- Invalidate cache on task status changes (event-driven)
- Consider a `materialised_workload_snapshots` table if Redis caching is insufficient

---

## 5. Pricing & Subscription Tiers (TBD)

### Current State
V1 is a free application. No subscription enforcement. The `subscription_tier` field exists in the schema but is not enforced.

### Future Tier Structure (Draft — Needs Product Decision)

| Tier | Max Users | Max Clients | Storage | Price (est.) |
|---|---|---|---|---|
| FREE | 3 | 25 | 1 GB | ₹0 |
| STARTER | 10 | 100 | 10 GB | TBD |
| PROFESSIONAL | 50 | 500 | 50 GB | TBD |
| ENTERPRISE | Unlimited | Unlimited | 200 GB | TBD |

### Questions to Resolve Before Implementation
- Per-user pricing vs flat tier pricing?
- Annual vs monthly billing?
- What happens on downgrade? (Existing data exceeds new tier limits)
- Grace period for expired subscriptions — read-only for 30 days?
- Should the FREE tier be permanent or time-limited trial?

---

## 6. Document Storage & Retention

### Current Policy
- Documents retained for **1 year** from upload date
- At 1-year mark: system sends notification to firm admin/partner about upcoming deletion
- Grace period: **30 days** after notification before actual deletion
- Deleted documents are permanently removed from S3 (hard delete from storage, soft-delete record retained for audit)

### Extended Storage (TBD)

| Option | Description | Price |
|---|---|---|
| Standard | 1-year retention, included in plan | Included |
| Extended 3Y | 3-year retention | TBD |
| Extended 7Y | 7-year retention (common for tax records) | TBD |
| Archival | Cold storage, retrieval in 24h | TBD |

### Implementation Notes
- CA practices often need documents for 7+ years (assessment proceedings, audits)
- Indian tax records should be maintained for minimum 6 years from end of relevant AY
- Extended retention is likely a monetisation lever — price per GB/year
- Need to implement: retention policy per document type, not just global timer

---

## 7. DPDP Act Compliance (TBD)

### Context
The Digital Personal Data Protection Act, 2023 (India) is the governing framework. Rules are still being finalised as of early 2026.

### Key Areas to Address

| DPDP Requirement | Current Status | Action Needed |
|---|---|---|
| **Consent for data collection** | Not implemented | Need consent flow during user onboarding and client data entry |
| **Purpose limitation** | Implicit (practice management) | Document data processing purposes; display in privacy policy |
| **Data minimisation** | Mostly aligned | Review: do we collect more PII than necessary? |
| **Right to access** | Not implemented | Build data export feature (user's own data) |
| **Right to erasure** | Soft deletes exist | Need hard-delete path for PII on user request (within statutory limits) |
| **Right to correction** | Edit flows exist | Ensure users can correct their own profile data |
| **Data breach notification** | Not implemented | Need incident response process + notification mechanism |
| **Cross-border transfers** | Single-region deployment | N/A for V1; revisit if multi-region added |
| **Children's data** | N/A | Platform is B2B professional tool |
| **Data Protection Officer** | N/A at MVP scale | Required above threshold (TBD by rules) |

### Credential Locker — Special Consideration
The credential locker stores third-party portal passwords. Under DPDP:
- This is sensitive personal data if credentials belong to individual clients
- Encryption at rest (AES-256-GCM) is necessary but may not be sufficient
- Need explicit consent from the client (or their authorised representative) for storing their portal credentials
- Access logging already exists — good foundation

### Action Items
- [ ] Legal review of DPDP rules once finalised
- [ ] Privacy policy draft for the platform
- [ ] Consent collection flow design
- [ ] Data export/deletion pipeline design
- [ ] Credential locker consent mechanism

---

## 8. Database & Infrastructure Scaling

### Current Architecture
- Single PostgreSQL instance
- Single Redis instance (sessions + BullMQ)
- Single NestJS process
- S3-compatible storage

### Scaling Triggers & Responses

| Trigger | Response |
|---|---|
| DB CPU > 70% sustained | Add read replicas; route workload view + reports to replica |
| Redis memory > 80% | Separate session Redis from queue Redis |
| API p95 > 1s | Horizontal scale NestJS (stateless, behind load balancer) |
| BullMQ job backlog > 1 hour | Increase worker concurrency; separate workers per queue |
| S3 costs growing | Implement lifecycle rules: move documents > 6 months to Infrequent Access tier |
| 500+ firms onboarded | Consider firm-level database sharding or schema-per-tenant |

---

## 9. Features Deferred from V1

| Feature | Target Version | Dependency |
|---|---|---|
| Subscription enforcement & billing | V1.5 | Payment gateway integration |
| WhatsApp Business API integration | V1.5 | Provider selection (Twilio vs Gupshup) |
| Client portal (external login) | V2 | Auth system extension |
| Time tracking & billable hours | V2 | Task system extension |
| Billing & invoicing module | V2 | Client portal + payment |
| Tally / Zoho Books integration | V2 | API integration layer |
| Mobile native app | V1.5 | API stabilisation |
| SSO / SAML | V2 | Enterprise demand |
| AI risk scoring | V3 | Data volume + ML pipeline |
| Multi-region deployment | V2 | Data residency requirements |
| Firm-defined custom templates | V1.5 | Post CA-review of standard templates |
| Extended document retention tiers | V1.5 | Pricing finalisation |
| DPDP full compliance | V1.5 | Rules finalisation + legal review |

---

*This document should be reviewed and updated quarterly, or whenever scale targets change significantly.*
