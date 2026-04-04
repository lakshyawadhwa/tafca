const STORAGE_KEY = 'sidebar-collapsed';

const sidebarState = $state<{ collapsed: boolean; mobileOpen: boolean }>({
  collapsed: false,
  mobileOpen: false,
});

export function initSidebar(): void {
  if (typeof window === 'undefined') return;

  // Restore persisted collapsed state
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored !== null) {
    sidebarState.collapsed = stored === 'true';
  }

  // Auto-collapse on mobile
  const mql = window.matchMedia('(max-width: 767px)');
  const handleChange = (e: MediaQueryList | MediaQueryListEvent) => {
    if (e.matches) {
      sidebarState.collapsed = true;
      sidebarState.mobileOpen = false;
    }
  };
  handleChange(mql);
  mql.addEventListener('change', handleChange);
}

export function toggleSidebar(): void {
  sidebarState.collapsed = !sidebarState.collapsed;
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, String(sidebarState.collapsed));
  }
}

export function setSidebarCollapsed(value: boolean): void {
  sidebarState.collapsed = value;
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, String(value));
  }
}

export function isSidebarCollapsed(): boolean {
  return sidebarState.collapsed;
}

export function isMobileOpen(): boolean {
  return sidebarState.mobileOpen;
}

export function setMobileOpen(value: boolean): void {
  sidebarState.mobileOpen = value;
}

export function toggleMobileOpen(): void {
  sidebarState.mobileOpen = !sidebarState.mobileOpen;
}
