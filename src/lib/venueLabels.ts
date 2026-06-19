// Venue display labels. Several venue columns are stored as language-specific
// strings baked into the seed data (migration 007 is Romanian), so they must
// never reach the UI raw — an English-language session would otherwise show
// Romanian text ("Condition: buna", "Acces liber") and vice-versa. These pure
// helpers resolve the stored value to a localized label via the existing
// condition*/type*/freeAccess* keys (present in all 8 locales). The map, the
// markers, the list rows and the venue-detail screen all share this single
// source of truth — mirrors the `playerAttributes` key-helper pattern.
import type { VenueCondition } from '../types/database';

/** The i18n resolver from `useI18n` (`s`). */
type Translate = (key: string, ...args: string[]) => string;

/**
 * Stored `venue.condition` → i18n key. Unknown / null / unrecognized values
 * fall back to "Unknown" rather than echoing the raw Romanian token (the old
 * inline map in MapViewScreen leaked the raw value for unrecognized input).
 */
const CONDITION_LABEL_KEYS: Record<VenueCondition, string> = {
  buna: 'conditionGood',
  acceptabila: 'conditionAcceptable',
  deteriorata: 'conditionDegraded',
  profesionala: 'conditionPro',
  necunoscuta: 'conditionUnknown',
};

/** Localized table-condition label, e.g. `buna` → "Good" / "Bună". */
export function conditionLabel(
  condition: VenueCondition | null | undefined,
  s: Translate,
): string {
  const key = (condition && CONDITION_LABEL_KEYS[condition]) || 'conditionUnknown';
  return s(key);
}

/**
 * Localized venue-type label. `type` is a closed enum (parc_exterior |
 * sala_indoor); the short typePark/typeHall keys match the map, markers and
 * list rows (the longer typeParcExterior/typeSalaIndoor variants belong to the
 * add/edit form and are intentionally not used here).
 */
export function venueTypeLabel(type: string | null | undefined, s: Translate): string {
  if (type === 'parc_exterior') return s('typePark');
  if (type === 'sala_indoor') return s('typeHall');
  return type ?? '';
}

// `venue.hours` is free text. Most rows are language-neutral time ranges
// (e.g. "08:00-22:00", "Mo-Su 09:00-21:00") that pass through unchanged. A few
// seed rows stuffed a localized free-access sentinel ("Acces liber") or an
// always-open token ("24/7", "Non-stop") into the field; those — like an empty
// value — resolve to the localized "Free access · 24/7" string so the UI never
// mixes languages.
const FREE_ACCESS_HOURS = new Set(['acces liber', '24/7', 'non-stop', 'nonstop']);

/** Localized opening-hours label: free-access sentinels and empty values become
 *  the translated "Free access · 24/7"; real time ranges pass through verbatim. */
export function venueHoursLabel(hours: string | null | undefined, s: Translate): string {
  const trimmed = hours?.trim();
  if (!trimmed || FREE_ACCESS_HOURS.has(trimmed.toLowerCase())) return s('freeAccess247');
  return trimmed;
}
