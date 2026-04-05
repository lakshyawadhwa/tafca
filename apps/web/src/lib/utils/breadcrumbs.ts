export interface Breadcrumb {
  label: string;
  href: string | null;
}

const ROUTE_LABELS: Record<string, string> = {
  '/': 'Dashboard',
  '/clients': 'Clients',
  '/engagements': 'Engagements',
  '/tasks': 'Tasks',
  '/team': 'Team',
  '/team/leave': 'Leave',
  '/settings': 'Settings',
  '/audit-log': 'Audit Log',
  '/recently-deleted': 'Recently Deleted',
};

/**
 * Generate breadcrumbs from a pathname.
 * Always starts with Dashboard. Last segment is non-clickable (href = null).
 */
export function generateBreadcrumbs(pathname: string): Breadcrumb[] {
  // Dashboard is the root — if we're at /, return just Dashboard (non-clickable)
  if (pathname === '/') {
    return [{ label: 'Dashboard', href: null }];
  }

  const segments = pathname.split('/').filter(Boolean);
  const crumbs: Breadcrumb[] = [{ label: 'Dashboard', href: '/' }];

  let cumulativePath = '';

  for (let i = 0; i < segments.length; i++) {
    cumulativePath += '/' + segments[i];
    const isLast = i === segments.length - 1;

    const label =
      ROUTE_LABELS[cumulativePath] ??
      formatSegment(segments[i]);

    crumbs.push({
      label,
      href: isLast ? null : cumulativePath,
    });
  }

  return crumbs;
}

/**
 * Format an unknown segment (e.g. UUIDs) to a readable label.
 */
function formatSegment(segment: string): string {
  // UUID pattern — show as "Detail"
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) {
    return 'Detail';
  }

  // Capitalize and replace hyphens with spaces
  return segment
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
