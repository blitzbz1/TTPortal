// Merge a locale's translated chunk part-files into one src/locales/<code>.json,
// assembled in en.json key order. Deterministic — no model involved.
//   node scripts/i18n/merge-parts.mjs <code>
// Exits 1 if any en key is missing from the merged result (so the caller can
// drive a repair pass). Reports placeholder drift as a warning list too.
import fs from 'fs';
import path from 'path';

const code = process.argv[2];
if (!code) {
  console.error('usage: node scripts/i18n/merge-parts.mjs <code>');
  process.exit(2);
}

const root = process.cwd();
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/locales/en.json'), 'utf8'));
const enKeys = Object.keys(en);
const ph = (v) => (String(v).match(/\{\d+\}/g) ?? []).sort().join(',');

const partsDir = path.join(root, `src/locales/.parts/${code}`);
const merged = {};
let partFiles = [];
if (fs.existsSync(partsDir)) {
  partFiles = fs.readdirSync(partsDir).filter((f) => f.endsWith('.json')).sort();
}
for (const f of partFiles) {
  let obj;
  try {
    obj = JSON.parse(fs.readFileSync(path.join(partsDir, f), 'utf8'));
  } catch (e) {
    console.error(JSON.stringify({ code, error: `bad part ${f}: ${e.message}` }));
    process.exit(1);
  }
  for (const [k, v] of Object.entries(obj)) merged[k] = v;
}

const out = {};
const missing = [];
const phBad = [];
for (const k of enKeys) {
  const v = merged[k];
  if (v != null && String(v).trim()) {
    out[k] = v;
    if (ph(v) !== ph(en[k])) phBad.push(k);
  } else {
    missing.push(k);
  }
}

fs.writeFileSync(path.join(root, `src/locales/${code}.json`), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify({
  code,
  parts: partFiles.length,
  merged: Object.keys(out).length,
  total: enKeys.length,
  missing: missing.length,
  missingSample: missing.slice(0, 30),
  phBad: phBad.length,
  phBadSample: phBad.slice(0, 30),
}, null, 2));
process.exit(missing.length || phBad.length ? 1 : 0);
