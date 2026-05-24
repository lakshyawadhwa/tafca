# Deploy — fastest path to live URL

Goal: get a public URL so a CA can test. **API on Railway, web on Vercel.**

## 1. Railway (API + Postgres + Redis)

1. Push branch to GitHub.
2. https://railway.app → **New Project → Deploy from GitHub repo** → pick this repo.
3. Railway detects `railway.toml` → uses `apps/api/Dockerfile`. Build will start.
4. Add Postgres: **+ New → Database → Postgres**. Railway sets `DATABASE_URL` on the postgres service; you must reference it from the api service.
5. Add Redis: **+ New → Database → Redis**. Same — reference `REDIS_URL` from api service.
6. On the **api service → Variables**, set:

   ```
   DATABASE_URL   = ${{Postgres.DATABASE_URL}}
   REDIS_URL      = ${{Redis.REDIS_URL}}
   JWT_SECRET     = <openssl rand -hex 32>
   JWT_ISSUER     = ca-practice-os
   ENCRYPTION_KEY = <openssl rand -hex 32>   # 64 hex chars
   APP_URL        = https://<your-vercel-domain>.vercel.app
   NODE_ENV       = production
   ```

   (Skip S3 vars — documents deferred to V1.1.)

7. **api service → Settings → Networking → Generate Domain.** Note the URL, e.g. `ca-api-production.up.railway.app`.
8. First deploy runs `prisma migrate deploy` automatically (see Dockerfile CMD). Check logs.
9. Seed platform data (engagement types, deadlines, role perms, task templates) — one-time:

   ```bash
   # local machine, against prod DB:
   railway run --service api pnpm db:seed
   ```

   Or temporarily change Dockerfile CMD to include `pnpm db:seed &&` for first deploy, then revert.

## 2. Vercel (web SPA)

1. Before first deploy: edit `vercel.json` (repo root) — replace `REPLACE_WITH_RAILWAY_API_DOMAIN` with the Railway domain from step 1.7 (host only, no `https://`). Commit + push.
2. https://vercel.com → **Add New → Project** → import same repo.
3. **Root directory:** leave at repo root (`.`). `vercel.json` handles paths.
4. **Framework preset:** Other.
5. Build/install/output commands: leave blank — `vercel.json` overrides.
6. Deploy. Vercel gives a `*.vercel.app` URL.
7. Copy the Vercel URL → set as `APP_URL` on Railway api service (step 1.6) → Railway auto-redeploys.

## 3. Smoke test (5 min)

Open the Vercel URL:

- [ ] `/register` — create firm + first user
- [ ] Land on `/onboarding` — complete or skip all 3 steps
- [ ] Dashboard loads (onboarding checklist visible if not done)
- [ ] Create a client (`/clients/new`)
- [ ] Create an engagement (`/engagements/new`)
- [ ] Open the engagement → create a task
- [ ] Open the task → post a comment, mention yourself

If any step 500s: Railway → api service → Logs.

## 4. Hand to CA friend

Share:

- URL: `https://<your-vercel-domain>.vercel.app/register`
- Tell them: WhatsApp, document uploads, and email notifications are deferred — comments + tasks + clients are the V1 surface.

## Cost

- Railway: ~$5/mo trial credit, then ~$5–10/mo for small workloads
- Vercel: free hobby tier is enough

## Rotating secrets

`JWT_SECRET` rotation invalidates all sessions — fine pre-launch. `ENCRYPTION_KEY` rotation **breaks the credential locker** (encrypted credentials become unreadable). Generate once, keep safe.
