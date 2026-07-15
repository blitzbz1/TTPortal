// F054: TT Wrapped window gating + archetype localization map.
import type { WrappedArchetype } from '../../services/wrapped';

/**
 * The Wrapped story is only reachable inside the Dec 15 – Jan 15 window
 * (inclusive on both ends). Returns true when `date` falls in that window.
 *
 * The window straddles a year boundary, so it's expressed as: month is December
 * and day >= 15, OR month is January and day <= 15.
 */
export function isWrappedWindowOpen(date: Date = new Date()): boolean {
  const month = date.getMonth() + 1; // 1-12
  const day = date.getDate();
  if (month === 12) return day >= 15;
  if (month === 1) return day <= 15;
  return false;
}

/**
 * The calendar year the in-window Wrapped covers. During Dec 15–31 it's the
 * current year; during Jan 1–15 it's the PRIOR year (you're reviewing the year
 * that just ended). Outside the window it falls back to the current year.
 */
export function wrappedYearFor(date: Date = new Date()): number {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return month === 1 ? year - 1 : year;
}

/** i18n key for each rule-based archetype returned by the RPC. */
export const ARCHETYPE_LABEL_KEY: Record<WrappedArchetype, string> = {
  grinder: 'wrappedArchetypeGrinder',
  explorer: 'wrappedArchetypeExplorer',
  social_player: 'wrappedArchetypeSocial',
  park_regular: 'wrappedArchetypeParkRegular',
  casual: 'wrappedArchetypeCasual',
};

/** i18n key for the one-line description under each archetype name. */
export const ARCHETYPE_DESC_KEY: Record<WrappedArchetype, string> = {
  grinder: 'wrappedArchetypeGrinderDesc',
  explorer: 'wrappedArchetypeExplorerDesc',
  social_player: 'wrappedArchetypeSocialDesc',
  park_regular: 'wrappedArchetypeParkRegularDesc',
  casual: 'wrappedArchetypeCasualDesc',
};

/** i18n key for each calendar month name (1-12), used by the "top month" card. */
export const MONTH_LABEL_KEY: Record<number, string> = {
  1: 'monthJan',
  2: 'monthFeb',
  3: 'monthMar',
  4: 'monthApr',
  5: 'monthMay',
  6: 'monthJun',
  7: 'monthJul',
  8: 'monthAug',
  9: 'monthSep',
  10: 'monthOct',
  11: 'monthNov',
  12: 'monthDec',
};
