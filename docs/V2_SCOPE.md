# V2 scope

Captured as decisions are made, so they are not re-derived later. Nothing here
is committed to a timeline.

## Operational visibility

**The need:** know that something has gone wrong, ideally before a CA does, and
know what the infrastructure is costing.

Two separate jobs, often conflated:

1. **Alerting — "something is wrong now."**
   Service down, error rate climbing, database unreachable, latency degrading,
   disk or connection limits approaching. Wants to reach a phone, not a
   dashboard nobody is looking at.
2. **Metrics — "what is normal, and what does it cost."**
   Traffic and load over time, slow endpoints, database size and growth,
   infrastructure spend per environment. Read deliberately, not watched.

**Build vs buy — the deciding factor is who gets woken up.** Alerting is mostly
undifferentiated plumbing and is where hosted tools earn their price; building
it means building notification delivery, deduplication and on-call routing,
none of which is this product. Metrics are cheaper to self-host but also the
part a hosted tool gives away free at this scale.

Worth pricing when the time comes: whatever the host already includes (Vercel
and Neon both expose usage and basic alerts at no cost), against a dedicated
tool. The honest first step is to turn on what is already paid for and find out
what it does not cover, rather than choosing a platform up front.

**Known signals worth watching from day one**, because they are already real
rather than hypothetical:

- Neon free tier is 0.5 GB; the audit log alone can reach that inside a year
  for a twenty-person firm (see `AUDIT_RETENTION.md`)
- Vercel function cold starts after idle — first request is slow
- Upstash free tier is 500K commands/month; sessions and throttling spend it
- Postgres connection count, since serverless functions open many short-lived
  connections through the pooler

## Deferred from V1, still open

- Per-firm permission overrides. The table and the `PermissionService` lookup
  exist and are dormant; the code matrix is the single source of truth today.
  Building this needs a cache invalidation hook — the resolved-scope cache has
  none (see `FIX_PLAN.md`, N-1).
- Partner approval workflow for granting PARTNER/ADMIN. Only a PARTNER can
  grant those roles today, which closes the escalation path; the approval queue
  itself is unbuilt.
- Credential locker. Database model exists, no API, module unregistered.
- A separate test database. The e2e suite truncates whatever it points at.
