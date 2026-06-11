#!/usr/bin/env node
/**
 * receipt-ocr.mjs — Extract structured receipt data from an image as JSON.
 *
 * Uses Groq's free-tier vision model (Llama 4 Scout, OpenAI-compatible API).
 * Zero required dependencies (Node 18+ global fetch). `sharp` is used *if
 * installed* to auto-resize/auto-rotate large photos so they fit Groq's 4 MB
 * base64 limit — otherwise large local images are rejected with a clear hint.
 *
 * Usage:
 *   node scripts/receipt-ocr.mjs <image-path-or-url> [options]
 *
 * Options:
 *   -k, --api-key <key>   Groq API key. Falls back to $GROQ_API_KEY.
 *   -m, --model <id>      Override the model id.
 *   -o, --out <file>      Write JSON to a file instead of stdout.
 *       --raw             Print the model's raw output without re-parsing.
 *   -h, --help            Show this help.
 *
 * Get a free key at https://console.groq.com/keys
 *
 * Examples:
 *   GROQ_API_KEY=gsk_... node scripts/receipt-ocr.mjs ./receipt.jpg
 *   node scripts/receipt-ocr.mjs https://example.com/receipt.png -k gsk_... -o out.json
 *
 * Note: stdout is *only* the JSON result (pipe-friendly); all logs go to stderr.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, basename } from 'node:path';

const API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const BASE64_LIMIT = 4 * 1024 * 1024; // Groq's cap for base64-encoded images.

const MIME_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

// The exact shape we ask the model to return. Kept in the prompt so the schema
// and the instructions never drift apart.
const SCHEMA_HINT = `{
  "merchant": { "name": string|null, "address": string|null, "phone": string|null, "vat_id": string|null },
  "receipt_number": string|null,
  "date": string|null,            // ISO 8601 "YYYY-MM-DD" if determinable
  "time": string|null,            // 24h "HH:MM" if determinable
  "currency": string|null,        // ISO 4217 code inferred from symbol/text, e.g. "EUR", "USD"
  "items": [
    { "description": string, "quantity": number|null, "unit_price": number|null, "total_price": number|null }
  ],
  "subtotal": number|null,
  "tax": number|null,
  "tip": number|null,
  "total": number|null,
  "payment_method": string|null   // e.g. "cash", "visa", "mastercard", "card"
}`;

const SYSTEM_PROMPT =
  'You are a precise receipt-parsing engine. You read a photo or scan of a ' +
  'single receipt and return structured data. Output ONLY one JSON object — ' +
  'no prose, no markdown, no code fences.';

const USER_PROMPT = `Extract the receipt into a JSON object with exactly this schema:

${SCHEMA_HINT}

Rules:
- Output a single valid JSON object and nothing else.
- Use null for any field you cannot read confidently. Never guess or invent values.
- Numbers must be JSON numbers: no currency symbols, no thousands separators, use "." as the decimal point.
- "items" is one entry per purchased line item. Omit non-item lines (subtotal, tax, totals).
- Prefer the printed totals; do not recompute them yourself.`;

function printHelp() {
  process.stderr.write(
    `receipt-ocr — extract receipt data from an image as JSON (via Groq vision)\n\n` +
      `Usage:\n  node scripts/receipt-ocr.mjs <image-path-or-url> [options]\n\n` +
      `Options:\n` +
      `  -k, --api-key <key>   Groq API key (or set GROQ_API_KEY)\n` +
      `  -m, --model <id>      Model id (default: ${DEFAULT_MODEL})\n` +
      `  -o, --out <file>      Write JSON to a file instead of stdout\n` +
      `      --raw             Print the model's raw output without re-parsing\n` +
      `  -h, --help            Show this help\n\n` +
      `Get a free API key: https://console.groq.com/keys\n`,
  );
}

function parseArgs(argv) {
  const opts = { image: null, apiKey: null, model: DEFAULT_MODEL, out: null, raw: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '-h':
      case '--help':
        opts.help = true;
        break;
      case '-k':
      case '--api-key':
        opts.apiKey = argv[++i];
        break;
      case '-m':
      case '--model':
        opts.model = argv[++i];
        break;
      case '-o':
      case '--out':
        opts.out = argv[++i];
        break;
      case '--raw':
        opts.raw = true;
        break;
      default:
        if (a.startsWith('-')) throw new UsageError(`Unknown option: ${a}`);
        if (opts.image) throw new UsageError(`Unexpected extra argument: ${a}`);
        opts.image = a;
    }
  }
  return opts;
}

class UsageError extends Error {}

function isHttpUrl(s) {
  return /^https?:\/\//i.test(s);
}

/**
 * Try to shrink a local image so its base64 payload fits Groq's 4 MB limit.
 * Uses `sharp` only if it's installed; auto-rotates via EXIF and re-encodes as
 * JPEG, stepping the longest edge down until it fits. Returns the original
 * buffer/mime untouched if it already fits or if sharp isn't available.
 */
async function fitWithinLimit(buffer, mime) {
  if (base64Size(buffer.length) <= BASE64_LIMIT) return { buffer, mime };

  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    throw new Error(
      `Image is too large: ~${mb(base64Size(buffer.length))} MB base64 (Groq limit is ${mb(BASE64_LIMIT)} MB).\n` +
        `Install sharp to auto-resize:  npm i sharp\n` +
        `…or pass a smaller image, or host it and pass an https:// URL (URLs allow up to 20 MB).`,
    );
  }

  for (const edge of [2400, 2000, 1600, 1280, 1024, 800]) {
    const out = await sharp(buffer)
      .rotate() // honor EXIF orientation so text isn't sideways
      .resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    if (base64Size(out.length) <= BASE64_LIMIT) {
      log(`Resized image to fit (${edge}px max edge, ~${mb(base64Size(out.length))} MB base64).`);
      return { buffer: out, mime: 'image/jpeg' };
    }
  }
  throw new Error('Could not shrink the image below the 4 MB limit even at 800px. Is it really a receipt?');
}

const base64Size = (bytes) => Math.ceil(bytes / 3) * 4;
const mb = (bytes) => (bytes / (1024 * 1024)).toFixed(1);
const log = (msg) => process.stderr.write(`${msg}\n`);

/** Build the `image_url.url` value: a passthrough URL, or a base64 data URL. */
async function buildImageUrl(image) {
  if (isHttpUrl(image)) {
    log(`Using remote image URL (Groq fetches it; up to 20 MB).`);
    return image;
  }
  if (!existsSync(image)) throw new UsageError(`Image not found: ${image}`);

  const ext = extname(image).toLowerCase();
  const mime = MIME_BY_EXT[ext] || 'image/jpeg';
  const raw = await readFile(image);
  log(`Read ${basename(image)} (${mb(raw.length)} MB on disk).`);

  const { buffer, mime: finalMime } = await fitWithinLimit(raw, mime);
  return `data:${finalMime};base64,${buffer.toString('base64')}`;
}

/** Pull a JSON object out of a string even if it's fenced or has stray prose. */
function extractJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    /* fall through to salvage attempt */
  }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  return JSON.parse(candidate); // let a real failure surface to the caller
}

async function callGroq({ apiKey, model, imageUrl, jsonMode = true }) {
  log(`Calling Groq (${model})…`);
  const body = {
    model,
    temperature: 0,
    max_tokens: 4096,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: USER_PROMPT },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      },
    ],
  };
  if (jsonMode) body.response_format = { type: 'json_object' };

  let res;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(`Network error contacting Groq: ${err.message}`);
  }

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    if (res.status === 401) throw new Error('Groq rejected the API key (401). Check the key or get one at https://console.groq.com/keys');
    if (res.status === 429) throw new Error(`Rate limited (429) — free tier is ~1,000 requests/day. Try again later.\n${errBody}`);
    // Some preview models reject JSON-mode with images; retry once without it.
    if (res.status === 400 && jsonMode && /response_format|json/i.test(errBody)) {
      log('Model rejected JSON mode; retrying without it (output is still parsed defensively).');
      return callGroq({ apiKey, model, imageUrl, jsonMode: false });
    }
    throw new Error(`Groq API error ${res.status} ${res.statusText}\n${errBody}`);
  }

  const data = await res.json();
  if (data.usage) {
    const u = data.usage;
    log(`Tokens: ${u.prompt_tokens} in / ${u.completion_tokens} out (${u.total_tokens} total).`);
  }
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`Unexpected response shape from Groq:\n${JSON.stringify(data).slice(0, 500)}`);
  return content;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.image) {
    printHelp();
    process.exit(opts.help ? 0 : 2);
  }

  const apiKey = opts.apiKey || process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new UsageError('No API key. Pass --api-key <key> or set GROQ_API_KEY.\nFree key: https://console.groq.com/keys');
  }

  const imageUrl = await buildImageUrl(opts.image);
  const content = await callGroq({ apiKey, model: opts.model, imageUrl });

  const output = opts.raw ? content : `${JSON.stringify(extractJson(content), null, 2)}\n`;

  if (opts.out) {
    await writeFile(opts.out, output);
    log(`Wrote ${opts.out}.`);
  } else {
    process.stdout.write(output.endsWith('\n') ? output : `${output}\n`);
  }
}

main().catch((err) => {
  if (err instanceof UsageError) {
    log(`Error: ${err.message}`);
    process.exit(2);
  }
  // Surface JSON.parse failures from extractJson with a useful hint.
  if (err instanceof SyntaxError) {
    log(`Could not parse JSON from the model output. Re-run with --raw to inspect.\n${err.message}`);
    process.exit(1);
  }
  log(`Error: ${err.message}`);
  process.exit(1);
});
