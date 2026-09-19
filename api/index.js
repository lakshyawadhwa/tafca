// Vercel serverless entry. Real code lives in apps/api; this file exists only so
// Vercel discovers a function at /api. The rewrite in vercel.json sends every
// /api/* request here. Requires compiled output — scripts/vercel-install.sh builds
// it during the install step, because Vercel bundles api/ BEFORE buildCommand.
//
// Startup errors (missing module, env validation, Prisma engine) are returned in
// the response body instead of crashing the process, so they show up in curl.
let handler;
let startupError;
try {
  handler = require('../apps/api/dist/serverless').handler;
} catch (err) {
  startupError = err;
  console.error('[api/index] failed to load serverless handler', err);
}

module.exports = async (req, res) => {
  if (startupError) {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'startup_failed', message: startupError.message }));
    return;
  }
  try {
    await handler(req, res);
  } catch (err) {
    console.error('[api/index] handler threw', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ error: 'handler_failed', message: err && err.message }));
    }
  }
};
