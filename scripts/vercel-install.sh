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
