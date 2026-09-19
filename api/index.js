// Vercel serverless entry. Real code lives in apps/api; this file exists only so
// Vercel discovers a function at /api. The rewrite in vercel.json sends every
// /api/* request here. Requires the compiled output, so scripts/vercel-build.sh
// must run first (Vercel runs buildCommand before bundling functions).
module.exports = require('../apps/api/dist/serverless').handler;
