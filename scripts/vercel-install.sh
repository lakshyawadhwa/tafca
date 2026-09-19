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

# Debug: mirror all output into a marker file that ends up inside the function
# bundle (packages/shared/dist is in includeFiles), readable via the startup
# diagnostic in api/index.js when Vercel's own logs aren't at hand.
MARKER_DIR="packages/shared/dist"
MARKER="$MARKER_DIR/.vercel-install-marker"
mkdir -p "$MARKER_DIR"
exec > >(tee -a "$MARKER") 2>&1
echo "== install start $(date -u +%FT%TZ) cwd=$(pwd) node=$(node -v) pnpm=$(pnpm -v)"
echo "== workspace packages:"; pnpm -r ls --depth -1 2>&1 | head -20

echo "[vercel-install] pnpm install"
# --prod=false: NODE_ENV=production would otherwise skip devDeps (tsc, nest, prisma CLI)
pnpm install --frozen-lockfile --prod=false

echo "[vercel-install] shared"
pnpm --filter @ca-practice-os/shared build

echo "[vercel-install] prisma generate"
pnpm --filter ./apps/api exec prisma generate

echo "[vercel-install] api"
pnpm --filter ./apps/api build
ls apps/api/dist | head -5

if [ -n "${DIRECT_URL:-}" ]; then
  echo "[vercel-install] prisma migrate deploy"
  DATABASE_URL="$DIRECT_URL" pnpm --filter ./apps/api exec prisma migrate deploy
else
  echo "[vercel-install] DIRECT_URL not set — skipping migrations"
fi
echo "== install done $(date -u +%FT%TZ)"
