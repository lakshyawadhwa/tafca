/**
 * Minimal client-side router using History API and Svelte 5 runes.
 * Supports static paths, :param segments, and wildcard fallback.
 */

type RouteParams = Record<string, string>;
type RouteMatch = { component: any; params: RouteParams };

interface RouteEntry {
  pattern: RegExp;
  paramNames: string[];
  component: any;
}

let currentPath = $state(window.location.pathname);
let currentMatch = $state<RouteMatch | null>(null);

const routes: RouteEntry[] = [];

/** Compile a path pattern like "/tasks/:id" into a regex + param names */
function compilePath(path: string): { pattern: RegExp; paramNames: string[] } {
  const paramNames: string[] = [];
  const regexStr = path
    .split('/')
    .map((seg) => {
      if (seg.startsWith(':')) {
        paramNames.push(seg.slice(1));
        return '([^/]+)';
      }
      return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return { pattern: new RegExp(`^${regexStr}$`), paramNames };
}

export function addRoute(path: string, component: any) {
  const { pattern, paramNames } = compilePath(path);
  routes.push({ pattern, paramNames, component });
  // Re-resolve so the current path picks up newly registered routes
  update();
}

function resolve(pathname: string): RouteMatch | null {
  for (const route of routes) {
    const match = pathname.match(route.pattern);
    if (match) {
      const params: RouteParams = {};
      route.paramNames.forEach((name, i) => {
        params[name] = match[i + 1];
      });
      return { component: route.component, params };
    }
  }
  return null;
}

function update() {
  currentPath = window.location.pathname;
  currentMatch = resolve(currentPath);
}

export function navigate(to: string) {
  if (to === currentPath) return;
  window.history.pushState(null, '', to);
  update();
}

export function replace(to: string) {
  window.history.replaceState(null, '', to);
  update();
}

export function getPath() {
  return currentPath;
}

export function getMatch() {
  return currentMatch;
}

export function getParams(): RouteParams {
  return currentMatch?.params ?? {};
}

// Listen for back/forward
window.addEventListener('popstate', update);

// Initial resolve
update();
