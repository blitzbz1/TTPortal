// Split en.json into N contiguous key-chunks so each translation agent handles
// a batch small enough to write under the 32K output-token limit. Writes
// src/locales/.parts/_src/chunk-NN.json (each a flat {key: englishValue}).
//   node scripts/i18n/split-en.mjs [numChunks=10]
import fs from 'fs';
import path from 'path';

const N = parseInt(process.argv[2] || '10', 10);
const root = process.cwd();
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/locales/en.json'), 'utf8'));
const keys = Object.keys(en);

const srcDir = path.join(root, 'src/locales/.parts/_src');
fs.mkdirSync(srcDir, { recursive: true });
for (const f of fs.readdirSync(srcDir)) fs.unlinkSync(path.join(srcDir, f));

const per = Math.ceil(keys.length / N);
const chunks = [];
for (let i = 0; i < N; i++) {
  const slice = keys.slice(i * per, (i + 1) * per);
  if (!slice.length) continue;
  const obj = {};
  for (const k of slice) obj[k] = en[k];
  const name = `chunk-${String(i).padStart(2, '0')}.json`;
  fs.writeFileSync(path.join(srcDir, name), JSON.stringify(obj, null, 2));
  chunks.push({ name, count: slice.length });
}
console.log(JSON.stringify({ total: keys.length, numChunks: chunks.length, perChunk: per, chunks: chunks.map((c) => c.name) }, null, 2));
