# Deploy — free tier, single Vercel project

Goal: public URL a CA can test, ₹0/month. Web (static) + API (serverless function) on **Vercel**, Postgres on **Neon**, Redis on **Upstash**. All free tiers.

Why not Railway/Render: Railway is paid. Render free sleeps after 15 min → ~50s cold start. Vercel cold start is ~2–4s (Nest bootstrap) and there is no sleep.

## How it fits together

```
browser ──> vercel.app
             ├─ /api/*   -> api/index.js  (Vercel Node function)
             │             └─ apps/api/dist/serverless.js (Nest app, cached per instance)
             │                  ├─ Neon Postgres  (DATABASE_URL, pooled)
             │                  └─ Upstash Redis  (REDIS_URL, sessions + throttle)
             └─ /*       -> apps/web/dist/index.html (SPA)
```

Same origin for web and API → no CORS in prod (APP_URL still set for safety).

Files:
- `api/index.js` — Vercel function entry, re-exports `apps/api/dist/serverless.handler`
- `apps/api/src/serverless.ts` — boots Nest once per instance, hands Express to Vercel
- `apps/api/src/app.factory.ts` — shared bootstrap for `main.ts` (local) and `serverless.ts`
- `scripts/vercel-build.sh` — buildCommand: shared → prisma generate → api → migrate → web
- `vercel.json` — rewrites, function config (`includeFiles` pulls Prisma engine into the bundle)

## 1. Neon (Postgres)

1. https://neon.tech → New project, region **Singapore (ap-southeast-1)** (closest to India).
2. Dashboard → Connection string. Grab **both**:
   - **Pooled** (host has `-pooler`) → runtime. Append `?pgbouncer=true`:
     `postgresql://user:pw@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true`
   - **Direct** (no `-pooler`) → migrations + seed.

Free tier: 0.5 GB, scales to zero after 5 min idle (~1s wake). No 30-day expiry (unlike Render's free PG).

## 2. Upstash (Redis)

1. https://upstash.com → Create database, region **ap-southeast-1**, TLS on.
2. Copy the `rediss://default:xxx@xxx.upstash.io:6379` URL. ioredis handles TLS from the `rediss://` scheme.

Free tier: 500K commands/month. We only use Redis for sessions + throttle counters — a few commands per request. Fine.

## 3. Vercel

1. https://vercel.com → Add New Project → import `lakshyawadhwa/tafca`.
2. **Root Directory: leave as repo root.** Framework: Other. Build/output settings come from `vercel.json` — don't override in the dashboard.
3. Environment Variables (Production + Preview):

   | Name | Value | Used |
   |---|---|---|
   | `DATABASE_URL` | Neon **pooled** URL with `?pgbouncer=true` | runtime |
   | `DIRECT_URL` | Neon **direct** URL | build only (`prisma migrate deploy`) |
   | `REDIS_URL` | Upstash `rediss://…` | runtime |
   | `JWT_SECRET` | `openssl rand -hex 32` | runtime |
   | `JWT_ISSUER` | `ca-practice-os` | runtime |
   | `NODE_ENV` | `production` | runtime |
   | `APP_URL` | `https://<project>.vercel.app` | runtime (CORS). Set after first deploy, then redeploy |

   Skip S3 vars — documents deferred to V1.1.

4. Deploy. Build log should show `[vercel-build] …` steps incl. `prisma migrate deploy`.
5. Check: `https://<project>.vercel.app/api/health` → `{"status":"ok","checks":{"database":{"status":"up"},"redis":{"status":"up"}}}`.

If `DIRECT_URL` is missing the build skips migrations (logged) instead of failing — so preview builds without DB access still succeed.

## 4. Seed platform data (once)

Engagement types, statutory deadlines, task templates, role permissions. Run locally against Neon **direct** URL:

```bash
DATABASE_URL='<neon direct url>' pnpm --filter api db:seed
```

## 5. Smoke test

1. Register firm → login.
2. Create client → engagement → task.
3. Open Compliance Calendar.
4. Reload page — session should survive (Redis).

## Gotchas

- **Cold start**: first request after idle ≈ 2–4s (Nest boot + Neon wake). Warm requests are normal. Hit `/api/health` before a demo.
- **Function timeout**: 30s (`vercel.json`). Nothing should get near that.
- **Migrations run in build**, not at request time. Failed migration = failed deploy = old version stays live. Good.
- **Prisma engine**: `binaryTargets` includes `rhel-openssl-3.0.x` (Vercel's Lambda base). `includeFiles` in `vercel.json` copies the engine + `schema.prisma` into the function bundle. If you see `Query engine library not found` → check that glob still matches the pnpm path after a Prisma upgrade.
- **Vercel Hobby = non-commercial.** Fine for demos. Charging firms → Pro ($20/mo) or move API elsewhere.
- **Local verify** without deploying: `pnpm dlx vercel build` (needs `.vercel/project.json`; `vercel link` creates it).

## Local dev unchanged

`docker compose up -d postgres redis` + `pnpm dev`. `main.ts` still runs a normal long-lived server.
