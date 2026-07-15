// Verify one or more locale JSON files against the English source of truth.
// Single source of truth for the parity rules the i18n tests enforce, so both
// the translation workflow agents and the final inline check use identical logic.
//
//   node scripts/i18n/verify-locale.mjs <code> [code...]
//
// Prints a JSON report per code and exits 1 if ANY locale is not "clean"
// (missing keys, placeholder drift, empty values, or bad badge titles).
import fs from 'fs';
import path from 'path';

const codes = process.argv.slice(2);
if (codes.length === 0) {
  console.error('usage: node scripts/i18n/verify-locale.mjs <code> [code...]');
  process.exit(2);
}

const root = process.cwd();
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/locales/en.json'), 'utf8'));
const enKeys = Object.keys(en);

/** Sorted, comma-joined set of {n} placeholders in a value — matches the test. */
const ph = (v) => (String(v).match(/\{\d+\}/g) ?? []).sort().join(',');
/** Brand tokens that legitimately stay identical to English. */
const BRAND = new Set(['TT PORTAL', 'TT Portal', 'Google', 'Apple', 'OK', 'TTPortal']);

let anyBad = false;
const report = {};

for (const code of codes) {
  const p = path.join(root, `src/locales/${code}.json`);
  if (!fs.existsSync(p)) {
    report[code] = { error: 'file does not exist' };
    anyBad = true;
    continue;
  }
  let t;
  try {
    t = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    report[code] = { error: 'invalid JSON: ' + e.message };
    anyBad = true;
    continue;
  }

  const tk = new Set(Object.keys(t));
  const missing = enKeys.filter((k) => !tk.has(k));
  const phBad = enKeys.filter((k) => tk.has(k) && ph(t[k]) !== ph(en[k]));
  const empty = Object.keys(t).filter((k) => !String(t[k] ?? '').trim());
  const extra = Object.keys(t).filter((k) => !(k in en));
  const badgeBad = enKeys.filter(
    (k) => k.startsWith('badgeChallenge_') && (!tk.has(k) || !String(t[k] ?? '').trim() || t[k] === k),
  );
  // Informational only (not a hard gate): values left identical to English that
  // look like real prose and aren't brand tokens — a signal of lazy translation.
  const untranslated = enKeys.filter(
    (k) => tk.has(k) && t[k] === en[k] && /[A-Za-z]{2,}/.test(String(en[k])) && !BRAND.has(en[k]),
  );

  const clean = !missing.length && !phBad.length && !empty.length && !badgeBad.length;
  if (!clean) anyBad = true;

  report[code] = {
    clean,
    total: enKeys.length,
    have: tk.size,
    missing: missing.length,
    missingSample: missing.slice(0, 30),
    phBad: phBad.length,
    phBadSample: phBad.slice(0, 30),
    empty: empty.length,
    emptySample: empty.slice(0, 30),
    extra: extra.length,
    extraSample: extra.slice(0, 10),
    badgeBad: badgeBad.length,
    badgeBadSample: badgeBad.slice(0, 10),
    untranslated: untranslated.length,
    untranslatedSample: untranslated.slice(0, 15),
  };
}

console.log(JSON.stringify(report, null, 2));
process.exit(anyBad ? 1 : 0);
