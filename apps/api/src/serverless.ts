import type { IncomingMessage, ServerResponse } from 'http';
import { createApp } from './app.factory';

type ExpressHandler = (req: IncomingMessage, res: ServerResponse) => void;

// Nest bootstrap is expensive (~1-3s). Cache the promise on the module scope so a
// warm function instance reuses one app across requests. Caching the promise (not
// the result) also dedupes concurrent first-requests during a cold start.
let appPromise: Promise<ExpressHandler> | undefined;

function getHandler(): Promise<ExpressHandler> {
  if (!appPromise) {
    appPromise = createApp().then(async (app) => {
      await app.init();
      return app.getHttpAdapter().getInstance() as ExpressHandler;
    });
  }
  return appPromise;
}

// Vercel Node function entry. Vercel passes the original request URL through the
// rewrite (/api/* -> /api/index), so Nest's global "api" prefix matches unchanged.
export async function handler(req: IncomingMessage, res: ServerResponse) {
  const expressApp = await getHandler();
  expressApp(req, res);
}
