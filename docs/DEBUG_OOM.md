# Vite Dev Server OOM Debug Log

## Problem
`pnpm dev` crashes the web (SvelteKit) dev server with "JavaScript heap out of memory" at ~4GB after ~28 seconds. The server STARTS successfully (ready in 506ms) but OOMs during background work.

## Environment
- Node: v22.21.1 (arm64)
- Vite: 6.4.1
- SvelteKit: ^2.0.0
- Svelte: ^5.0.0
- Tailwind: v4.2.2 (@tailwindcss/vite)
- lucide-svelte: 1.0.1
- pnpm: 9.15.9
- macOS (Darwin 24.6.0, arm64)

## What's been tried

### Attempt 1: Increase heap size
- Set `NODE_OPTIONS='--max-old-space-size=4096'` in web/package.json dev script
- **Result**: Still OOMs — 4GB isn't enough

### Attempt 2: Convert lucide-svelte barrel imports to deep imports
- All 42 files converted from `import { X } from 'lucide-svelte'` to `import X from 'lucide-svelte/icons/x'`
- Removed `optimizeDeps.exclude: ['lucide-svelte']` from vite.config.ts
- Cleared .svelte-kit and .vite caches
- **Rationale**: lucide-svelte has 7,240 files (1,800+ icons). Barrel import forces Vite to crawl all of them.
- **Result**: Still OOMs. Deep imports are better practice but NOT the root cause.

## Observations
- Server starts in ~500ms, OOMs ~28s later consistently
- The OOM happens AFTER the "ready" message — something runs in background post-startup
- Stack trace shows CloneObjectIC / AsyncFunctionAwaitResolveClosure / PromiseFulfillReactionJob
- This suggests async processing (not initial bundling) causes the OOM

### Attempt 3: Disable @tailwindcss/vite plugin
- Commented out `tailwindcss()` from vite.config.ts plugins array
- **Result**: Server stays alive past 40s with no OOM. **@tailwindcss/vite is the culprit.**
- No circular deps found (verified with madge)

## Root cause
**@tailwindcss/vite 4.2.2** causes the OOM. Without it, the dev server runs fine.

### Attempt 4: Disable SSR
- Added `export const ssr = false` to root `+layout.ts`
- OOM only triggers during SSR compilation on first page request (confirmed: server idles at 86MB, OOMs on curl)
- App is an internal tool behind auth — no SSR needed
- **Result**: PENDING

### Attempt 3.5: Increase heap to 8192MB (actual increase)
- Discovered Node v22 on arm64 macOS defaults to **4144 MB heap** already
- The `--max-old-space-size=4096` was effectively a no-op — no actual increase
- Bumped to `--max-old-space-size=8192` to actually give more headroom
- **Result**: PENDING

## Next steps to try
1. Switch from `@tailwindcss/vite` to `@tailwindcss/postcss` (PostCSS plugin may have lower memory footprint)
2. Check if newer/older Tailwind v4 version fixes the issue
3. Restrict `@source` directive more aggressively
4. Try `@tailwindcss/vite` with explicit content path limits
5. Check if Node v22 specifically triggers this (try Node v20)
