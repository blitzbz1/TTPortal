import { bench } from '../../lib/perf';

type Entry = { id: number; started_at: string };

function makeEntries(n: number): Entry[] {
  const out: Entry[] = [];
  const base = Date.now();
  for (let i = 0; i < n; i++) {
    const t = base - i * 1000 * 60 * 30;
    out.push({ id: i, started_at: new Date(t).toISOString() });
  }
  // Shuffle to simulate non-sorted input
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Legacy implementation copied verbatim from PlayHistoryScreen for comparison.
function legacyGroupByDay(entries: Entry[]) {
  const groups: { dayLabel: string; dateKey: string; entries: Entry[] }[] = [];
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  for (const entry of entries) {
    const date = new Date(entry.started_at);
    const dateStr = date.toDateString();
    let dayLabel: string;
    if (dateStr === today) {
      dayLabel = `Today — ${date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' })}`;
    } else if (dateStr === yesterday) {
      dayLabel = `Yesterday — ${date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' })}`;
    } else {
      dayLabel = date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' });
    }

    const existing = groups.find((g) => g.dateKey === dateStr);
    if (existing) existing.entries.push(entry);
    else groups.push({ dayLabel, dateKey: dateStr, entries: [entry] });
  }
  return groups;
}

// Optimized: sort once, format date once per group, lookup via Map.
function fastGroupByDay(entries: Entry[]) {
  const sorted = [...entries].sort(
    (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
  );
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const map = new Map<string, { dayLabel: string; dateKey: string; entries: Entry[] }>();
  const order: string[] = [];

  for (const entry of sorted) {
    const date = new Date(entry.started_at);
    const dateStr = date.toDateString();
    let group = map.get(dateStr);
    if (!group) {
      let dayLabel: string;
      if (dateStr === today) {
        dayLabel = `Today — ${date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' })}`;
      } else if (dateStr === yesterday) {
        dayLabel = `Yesterday — ${date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' })}`;
      } else {
        dayLabel = date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' });
      }
      group = { dayLabel, dateKey: dateStr, entries: [] };
      map.set(dateStr, group);
      order.push(dateStr);
    }
    group.entries.push(entry);
  }
  return order.map((k) => map.get(k)!);
}

const entries500 = makeEntries(500);

describe('groupByDay (500 entries)', () => {
  it('benchmarks legacy O(n²) groupByDay', () => {
    const { medianMs } = bench(() => legacyGroupByDay(entries500), 50);
     
    console.log(`[bench] legacyGroupByDay median=${medianMs.toFixed(2)}ms`);
    expect(medianMs).toBeGreaterThan(0);
  });

  it('benchmarks fast Map-based groupByDay', () => {
    const { medianMs } = bench(() => fastGroupByDay(entries500), 50);
     
    console.log(`[bench] fastGroupByDay median=${medianMs.toFixed(2)}ms`);
    expect(medianMs).toBeGreaterThan(0);
  });

  it('fast version is at least as fast as legacy', () => {
    const legacy = bench(() => legacyGroupByDay(entries500), 50);
    const fast = bench(() => fastGroupByDay(entries500), 50);
    const speedup = legacy.medianMs / Math.max(fast.medianMs, 0.01);
     
    console.log(
      `[bench] groupByDay speedup=${speedup.toFixed(2)}x  legacy=${legacy.medianMs.toFixed(2)}ms  fast=${fast.medianMs.toFixed(2)}ms`,
    );
    expect(speedup).toBeGreaterThanOrEqual(0.9);
  });
});
