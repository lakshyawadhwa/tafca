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
    // List what actually made it into the bundle, to debug tracing/includeFiles.
    const fs = require('fs');
    const ls = (d) => { try { return fs.readdirSync(d); } catch (e) { return `ERR ${e.code}`; } };
    const tree = {
      cwd: process.cwd(),
      root: ls(process.cwd()),
      apps: ls(process.cwd() + '/apps'),
      'apps/api': ls(process.cwd() + '/apps/api'),
      'apps/api/dist': ls(process.cwd() + '/apps/api/dist'),
      'packages/shared': ls(process.cwd() + '/packages/shared'),
    };
    res.end(JSON.stringify({ error: 'startup_failed', message: startupError.message, tree }, null, 1));
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
