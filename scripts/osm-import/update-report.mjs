#!/usr/bin/env node
// update-report.mjs — rewrite supabase/seeds/osm/REPORT.md from the *current* seed files
// (post-collapse, incl. manual name edits). Derivation-only sections (Dropped, Name source)
// describe the 47209-point → 44914-table pipeline and are unaffected by collapse, so they are
// lifted verbatim from the existing REPORT.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const OSM = join(HERE, '..', '..', 'supabase', 'seeds', 'osm');

function sp(s){const o=[];let st=0,d=0,q=false;for(let i=0;i<s.length;i++){const c=s[i];if(q){if(c==="'"){if(s[i+1]==="'"){i++;continue;}q=false;}continue;}if(c==="'"){q=true;continue;}if(c==='['||c==='(')d++;else if(c===']'||c===')')d--;else if(c===','&&d===0){o.push(s.slice(st,i));st=i+1;}}o.push(s.slice(st));return o;}
const unq=f=>{const t=f.trim();return t.slice(1,-1).replace(/''/g,"'");};

const files = readdirSync(OSM).filter(f => f.endsWith('.sql') && f !== 'run_all.sql').sort();
const per = [];      // {cc, country, venues, cities, tables}
let totVen = 0, totTbl = 0, totMerged = 0, totSuffixed = 0, totCities = 0;
const samples = {};
for (const f of files) {
  const lines = readFileSync(join(OSM, f), 'utf8').split('\n');
  const m = lines[0].match(/^-- (\w+) — (.+?) — (\d+) venues, (\d+) cities/);
  const cc = m[1], country = m[2], cities = +m[4];
  const h = lines.findIndex(l => l === 'ON CONFLICT (country_code,name) DO NOTHING;');
  const c = lines.findIndex(l => l === 'COMMIT;');
  let inV = false, venues = 0, tables = 0; const samp = [];
  for (let i = h + 1; i < c; i++) {
    const l = lines[i];
    if (l === 'FROM (VALUES') { inV = true; continue; }
    if (l.startsWith(') AS v(')) { inV = false; continue; }
    if (inV) {
      let t = l.trim(); if (t.endsWith(',')) t = t.slice(0, -1);
      const fl = sp(t.slice(1, -1)); const name = unq(fl[0]), cnt = +fl[8];
      venues++; tables += cnt; if (cnt >= 2) totMerged++; if (/ \(\d+\)$/.test(name)) totSuffixed++;
      if (samp.length < 12) samp.push(`  - ${name}  —  ${unq(fl[5])}`);
    }
  }
  per.push({ cc, country, venues, cities, tables }); samples[cc] = samp.join('\n');
  totVen += venues; totTbl += tables; totCities += cities;
}
per.sort((a, b) => b.venues - a.venues);

// lift Dropped + Name source sections verbatim from the existing REPORT
const old = readFileSync(join(OSM, 'REPORT.md'), 'utf8');
const slice = (from, to) => old.slice(old.indexOf(from), old.indexOf(to)).trimEnd();
const droppedBlock = slice('## Dropped', '## Name source');
const nameSrcBlock = slice('## Name source', '## Per country');

const R = [];
R.push('# OSM → TTPortal venue import — REPORT', '');
R.push('Source: tables.json (47209 OSM points) → Overture Maps `2026-05-20.0` + GeoNames.', '');
R.push('## Totals');
R.push('- Input points: **47209**');
R.push(`- **Venues emitted: ${totVen}**  across **${totCities} cities** / **${files.length} countries**`);
R.push(`- Tables represented (co-located same-name tables merged into one venue): ${totTbl}`);
R.push(`- Venues that merged ≥2 co-located tables: ${totMerged}`);
R.push(`- Distant same-name venues kept separate (suffixed ' (2)'…): ${totSuffixed}`, '');
R.push(droppedBlock, '');
R.push(nameSrcBlock, '');
R.push('## Per country (venues / tables / cities)');
R.push('| cc | country | venues | tables | cities |');
R.push('|---|---|---|---|---|');
for (const p of per) R.push(`| ${p.cc} | ${p.country} | ${p.venues} | ${p.tables} | ${p.cities} |`);
R.push('');
R.push('## Samples (top 5 countries)');
for (const p of per.slice(0, 5)) { R.push('', `### ${p.cc} — ${p.country}`, samples[p.cc]); }
writeFileSync(join(OSM, 'REPORT.md'), R.join('\n') + '\n');
console.log(`REPORT.md rewritten: ${totVen} venues / ${totTbl} tables / ${totCities} cities across ${files.length} countries (merged ${totMerged}, suffixed ${totSuffixed})`);
