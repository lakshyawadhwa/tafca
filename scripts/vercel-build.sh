#!/usr/bin/env bash
# Vercel buildCommand. Builds shared -> api -> web, runs Prisma migrations.
# Env needed at build time: DIRECT_URL (Neon direct, non-pooled — migrations
# can't run through pgbouncer). Runtime env is documented in docs/DEPLOY.md.
set -euo pipefail

echo "[vercel-build] shared"
pnpm --filter @ca-practice-os/shared build

echo "[vercel-build] prisma generate"
pnpm --filter api exec prisma generate

echo "[vercel-build] api"
pnpm --filter api build

if [ -n "${DIRECT_URL:-}" ]; then
  echo "[vercel-build] prisma migrate deploy"
  DATABASE_URL="$DIRECT_URL" pnpm --filter api exec prisma migrate deploy
else
  echo "[vercel-build] DIRECT_URL not set — skipping migrations"
fi

echo "[vercel-build] web"
pnpm --filter web build
