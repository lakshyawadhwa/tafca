#!/usr/bin/env bash
# Vercel installCommand. Does install AND builds the API here, not in buildCommand.
#
# Why: Vercel bundles api/ functions BEFORE running buildCommand, so apps/api/dist
# must already exist by then. installCommand is the only hook that runs earlier.
# buildCommand (vercel.json) only builds the web SPA.
#
# Env needed here: DIRECT_URL (Neon direct, non-pooled — migrations can't run
# through pgbouncer). Runtime env is documented in docs/DEPLOY.md.
set -euo pipefail

echo "[vercel-install] pnpm install"
# --prod=false: NODE_ENV=production would otherwise skip devDeps (tsc, nest, prisma CLI)
pnpm install --frozen-lockfile --prod=false

echo "[vercel-install] shared"
pnpm --filter @ca-practice-os/shared build

echo "[vercel-install] prisma generate"
pnpm --filter api exec prisma generate

echo "[vercel-install] api"
pnpm --filter api build

if [ -n "${DIRECT_URL:-}" ]; then
  echo "[vercel-install] prisma migrate deploy"
  DATABASE_URL="$DIRECT_URL" pnpm --filter api exec prisma migrate deploy
else
  echo "[vercel-install] DIRECT_URL not set — skipping migrations"
fi

# Debug marker: bundled into the function via includeFiles (packages/shared/dist),
# lets us see from a curl what existed at the end of the install step.
{
  echo "install finished: $(date -u +%FT%TZ) pid=$$ cwd=$(pwd)"
  echo "apps/api/dist: $(ls apps/api/dist 2>&1 | head -c 200)"
  echo "prisma: $(ls -d node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client 2>&1)"
} > packages/shared/dist/.vercel-install-marker
