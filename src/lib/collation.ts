// Reusable ICU collators.
//
// `String.prototype.localeCompare(b, locale)` constructs a fresh collator on
// every single call (especially with an explicit locale argument). On Android
// Hermes the ICU collator constructor is one of the most expensive primitives in
// the app, and sorting the ~10k-city catalog (in cleanCityCatalog,
// applyCitiesDelta, mergeExpansionCityWave and getRecommendedCities) issued tens
// of thousands of `localeCompare` calls per "Switch City" open — the dominant
// cost behind the picker freeze.
//
// A reused `Intl.Collator` constructs the collator ONCE and is **ordering
// byte-identical** to the equivalent `localeCompare` call: per ECMA-402,
// `a.localeCompare(b)` matches `new Intl.Collator().compare(a, b)` and
// `a.localeCompare(b, locale)` matches `new Intl.Collator([locale]).compare(a, b)`
// (same default options: usage "sort", sensitivity "variant"). So swapping these
// in is a pure performance change with identical results on every platform — no
// behavioural difference on iOS/web, only Android stops paying the per-call
// constructor cost.
//
// Falls back to `localeCompare` if `Intl.Collator` is unavailable in some runtime.

type Compare = (a: string, b: string) => number;

function makeCompare(locale?: string): Compare {
  try {
    const collator = new Intl.Collator(locale ? [locale] : undefined);
    return (a, b) => collator.compare(a, b);
  } catch {
    return (a, b) => a.localeCompare(b, locale);
  }
}

/** Default-locale collator — equivalent to `a.localeCompare(b)`. */
export const compareDefault: Compare = makeCompare();
/** Romanian collator — equivalent to `a.localeCompare(b, 'ro')`. */
export const compareRo: Compare = makeCompare('ro');
/** English collator — equivalent to `a.localeCompare(b, 'en')`. */
export const compareEn: Compare = makeCompare('en');

const byLocale = new Map<string, Compare>();

/**
 * Cached collator for a dynamic locale — equivalent to
 * `a.localeCompare(b, locale)` but reuses one collator per locale.
 */
export function compareLocale(locale: string): Compare {
  let cmp = byLocale.get(locale);
  if (!cmp) {
    cmp = makeCompare(locale);
    byLocale.set(locale, cmp);
  }
  return cmp;
}
