// Regression guard: Supabase Realtime is BANNED in this codebase.
// The 2026 postmortem traced a 6.22GB egress incident to a realtime
// subscription; the replacement is fetch-on-focus + pull-to-refresh.
// DB side is guarded too: migration 055's event trigger blocks re-adding
// notifications to the publication, and the pgTAP invariants assert the
// publication stays empty. This test is the client half.
import * as fs from 'fs';
import * as path from 'path';

const SRC = path.resolve(__dirname, '..');

const BANNED = [
  /\.channel\(/,
  /postgres_changes/,
  /\.removeChannel\(/,
  /supabase\.realtime/,
  /RealtimeChannel/,
];

function* walk(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name)) yield full;
  }
}

describe('no Supabase Realtime usage (postmortem regression guard)', () => {
  it('no source file opens a realtime channel or subscription', () => {
    const violations: string[] = [];
    for (const file of walk(SRC)) {
      const content = fs.readFileSync(file, 'utf-8');
      for (const pattern of BANNED) {
        if (pattern.test(content)) {
          violations.push(`${path.relative(SRC, file)}: matches ${pattern}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
