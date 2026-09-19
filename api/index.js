// Vercel serverless entry. Real code lives in apps/api; this file exists only so
// Vercel discovers a function at /api. The rewrite in vercel.json sends every
// /api/* request here. Requires compiled output — scripts/vercel-install.sh builds
// it during the install step, because Vercel bundles api/ BEFORE buildCommand.
module.exports = require('../apps/api/dist/serverless').handler;
