# Audit log — integrity and retention

## What the log is

`user_action_log` records who did what, to which entity, from which IP, and
when. It is written by `ActionLogInterceptor` on mutating requests and read by
`GET /api/audit-log` (PARTNER, ADMIN, MANAGER).

## Integrity

The log is append-only, enforced by the database rather than by convention:

- `BEFORE UPDATE` raises unconditionally. History is never rewritten.
- `BEFORE DELETE` raises for any row inside the retention window.

This holds against a direct database connection, not just the API. It is not a
property of the current code — there happens to be no write route today, but
that could change by accident; the trigger cannot.

`TRUNCATE` is deliberately unaffected: row-level triggers do not fire for it,
and the e2e suite depends on being able to reset the schema.

Verified by attempting each as the database owner:

| Attempt | Result |
|---|---|
| `UPDATE user_action_log SET action=...` | refused |
| `DELETE FROM user_action_log` (recent rows) | refused, error names the row's date |
| `DELETE` of a row older than 8 years | permitted |
| `INSERT` | permitted — the interceptor keeps working |

## Retention: 8 years

Chosen to match the longest statutory period the product touches, so the trail
always outlives the filing it describes:

- Companies Act 2013 s.128 — books of account, 8 financial years
- CGST Act s.36 — records, 72 months from the annual return due date

Pulling the other way, DPDP 2023 expects personal data to have a purpose-bound
life, and these rows carry names, IP addresses and user agents. Keeping them
forever is the wrong default on both cost and privacy.

**This number is a placeholder until the firm confirms its own policy.** It
lives in exactly two places: the interval in migration
`20261003070000_audit_log_retention`, and `RETENTION_YEARS` in
`apps/api/scripts/purge-audit-log.ts`. Both must change together.

## Growth

Measured, not estimated: **~890 bytes per row**, JSONB metadata dominating.

| Firm | Actions/day | Per year |
|---|---|---|
| 5 people | ~500 | ~160 MB |
| 20 people | ~2,000 | ~650 MB |
| 50 people | ~5,000 | ~1.6 GB |

Neon's free tier is 0.5 GB total, so a single mid-sized firm exhausts it on
audit rows alone within a year. Trimming what goes into `metadata` reduces this
faster than retention does in the first few years.

## Purging

```bash
pnpm --filter api db:purge-audit            # report only
pnpm --filter api db:purge-audit -- --apply # delete expired entries
```

Nothing schedules this. There is no job runner in V1, so it is run by hand or
wired to a scheduler when one exists. Skipping it for years costs disk and
nothing else.

The script cannot breach the policy: the window is enforced by the trigger, so
a wrong cutoff here still cannot delete anything recent.
