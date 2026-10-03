/**
 * Theme preference.
 *
 * Three states, not two: "system" is the default so the app follows the OS
 * until someone deliberately chooses. The resolved theme is written to
 * <html data-theme> which is what the token stylesheet keys off.
 */
export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'ca_theme';

let preference = $state<ThemePreference>('system');
let systemPrefersDark = $state(false);

export const resolvedTheme = () =>
  preference === 'system' ? (systemPrefersDark ? 'dark' : 'light') : preference;

export const getThemePreference = () => preference;

function apply() {
  document.documentElement.setAttribute('data-theme', resolvedTheme());
}

export function setThemePreference(next: ThemePreference) {
  preference = next;
  try {
    if (next === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Private browsing — the choice just will not persist.
  }
  apply();
}

/** Cycles light -> dark -> system, which keeps the control to a single button. */
export function cycleTheme() {
  const order: ThemePreference[] = ['light', 'dark', 'system'];
  setThemePreference(order[(order.indexOf(preference) + 1) % order.length]);
}

export function initTheme() {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  systemPrefersDark = media.matches;
  media.addEventListener('change', (e) => {
    systemPrefersDark = e.matches;
    if (preference === 'system') apply();
  });

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') preference = stored;
  } catch {
    // Ignore and fall back to following the system.
  }

  apply();
}
