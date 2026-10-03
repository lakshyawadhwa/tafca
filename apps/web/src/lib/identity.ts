import { EngagementCategory } from '@ca-practice-os/shared';

/**
 * Visual identity helpers for scanning dense tables quickly.
 *
 * Each dimension gets its own perceptual channel so they never compete:
 *   urgency  -> saturated colour (status pills, overdue dates)
 *   category -> the acronym a CA already uses, plus a faint tint
 *   client   -> a monogram with a stable muted hue
 *
 * Nine engagement categories and an unbounded client list are both well past
 * the six-to-eight hues people can tell apart at a glance, so colour alone was
 * never going to carry either.
 */

const MONOGRAM_HUE_COUNT = 7;

/** Honorifics and articles that carry no identifying information. */
const LEADING_NOISE = /^(m\/s\.?|messrs\.?|the)$/i;

/**
 * Two letters from the first meaningful word, not initials of two words.
 *
 * Indian firm names put the distinguishing word first, so "Sharma Industries"
 * and "Singhal Industries" give SH and SI rather than colliding on SI. The rule
 * is global and depends only on the name, so a client shows the same monogram
 * on every screen — a marker that changed between pages would be worse than a
 * collision.
 */
export function clientMonogram(displayName: string): string {
  const words = displayName
    .trim()
    .split(/[\s,./&-]+/)
    .filter((w) => w.length > 0 && !LEADING_NOISE.test(w));

  const first = words[0] ?? displayName.trim();
  const letters = first.replace(/[^\p{L}\p{N}]/gu, '');

  if (letters.length >= 2) return letters.slice(0, 2).toUpperCase();
  // Single-letter first word: borrow from the next word rather than show one.
  const second = (words[1] ?? '').replace(/[^\p{L}\p{N}]/gu, '');
  return (letters + second.slice(0, 1)).toUpperCase() || '??';
}

/**
 * Stable hue index from the client id, so a client keeps its colour for good —
 * across sessions, devices and both themes. Keyed on id rather than name so
 * renaming a client does not change how it looks.
 */
export function clientHueIndex(clientId: string): number {
  // FNV-1a: tiny, well-distributed, and deterministic across engines.
  let hash = 0x811c9dc5;
  for (let i = 0; i < clientId.length; i++) {
    hash ^= clientId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % MONOGRAM_HUE_COUNT;
}

export function clientHueVar(clientId: string): string {
  return `var(--mono-${clientHueIndex(clientId) + 1})`;
}

/**
 * Short forms CAs already say out loud. Using the firm's own vocabulary costs
 * nothing to learn, which is the whole point — an invented colour key would
 * have to be memorised.
 */
const CATEGORY_LABELS: Record<string, string> = {
  [EngagementCategory.GST]: 'GST',
  [EngagementCategory.INCOME_TAX]: 'ITR',
  [EngagementCategory.TDS]: 'TDS',
  [EngagementCategory.ROC_COMPLIANCE]: 'ROC',
  [EngagementCategory.AUDIT]: 'AUDIT',
  [EngagementCategory.PAYROLL]: 'PAY',
  [EngagementCategory.ADVISORY]: 'ADV',
  [EngagementCategory.ACCOUNTING]: 'ACC',
  [EngagementCategory.OTHER]: 'OTH',
};

export function categoryLabel(category: string | null | undefined): string {
  if (!category) return '';
  return CATEGORY_LABELS[category] ?? category.slice(0, 3).toUpperCase();
}
