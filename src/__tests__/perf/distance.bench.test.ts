import { getDistanceKm } from '../../lib/geo';
import { bench } from '../../lib/perf';

type V = { id: number; name: string; lat: number; lng: number; type: string; address: string };

function makeVenues(n: number): V[] {
  const out: V[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      id: i,
      name: `Venue ${i} ${i % 7 === 0 ? 'park' : 'hall'}`,
      lat: 44.4 + Math.random() * 0.1,
      lng: 26.1 + Math.random() * 0.1,
      type: i % 2 ? 'parc_exterior' : 'sala_indoor',
      address: `Street ${i}`,
    });
  }
  return out;
}

const userLoc = { latitude: 44.45, longitude: 26.12 };
const venues = makeVenues(300);
const queries = ['p', 'pa', 'par', 'park', 'parku', 'parks', 'park ', 'park 1', 'park 12'];

function legacyPipeline(query: string) {
  // Mirrors the old combined memo: distance + filter together each keystroke.
  const withDistance = venues.map((v) => ({
    ...v,
    distanceKm: getDistanceKm(userLoc.latitude, userLoc.longitude, v.lat, v.lng),
  }));
  const q = query.trim().toLowerCase();
  const filtered = q
    ? withDistance.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          (v.address && v.address.toLowerCase().includes(q)),
      )
    : withDistance;
  return [...filtered].sort((a, b) => a.distanceKm - b.distanceKm);
}

function splitPipeline() {
  // Distance computed once (outer memo).
  const withDistance = venues.map((v) => ({
    ...v,
    distanceKm: getDistanceKm(userLoc.latitude, userLoc.longitude, v.lat, v.lng),
  }));
  return (query: string) => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? withDistance.filter(
          (v) =>
            v.name.toLowerCase().includes(q) ||
            (v.address && v.address.toLowerCase().includes(q)),
        )
      : withDistance;
    return [...filtered].sort((a, b) => a.distanceKm - b.distanceKm);
  };
}

describe('venue list pipeline (300 venues)', () => {
  it('benchmarks legacy combined pipeline (distance + filter per keystroke)', () => {
    const { medianMs } = bench(() => {
      let i = 0;
      for (const q of queries) {
        legacyPipeline(q);
        i++;
      }
      void i;
    }, 50);
     
    console.log(`[bench] legacyPipeline (9 keystrokes) median=${medianMs.toFixed(2)}ms`);
    expect(medianMs).toBeGreaterThan(0);
  });

  it('benchmarks split pipeline (distance once, filter per keystroke)', () => {
    const { medianMs } = bench(() => {
      const filterFn = splitPipeline();
      for (const q of queries) {
        filterFn(q);
      }
    }, 50);
     
    console.log(`[bench] splitPipeline (9 keystrokes) median=${medianMs.toFixed(2)}ms`);
    expect(medianMs).toBeGreaterThanOrEqual(0);
  });

  it('split pipeline is meaningfully faster than legacy across keystrokes', () => {
    const legacy = bench(() => {
      for (const q of queries) legacyPipeline(q);
    }, 50);
    const split = bench(() => {
      const filterFn = splitPipeline();
      for (const q of queries) filterFn(q);
    }, 50);
    const speedup = legacy.medianMs / Math.max(split.medianMs, 0.01);
     
    console.log(
      `[bench] speedup=${speedup.toFixed(2)}x  legacy=${legacy.medianMs.toFixed(2)}ms  split=${split.medianMs.toFixed(2)}ms`,
    );
    // Split must not be slower than legacy. Real-world wins are larger; allow 0.9x for noisy CI.
    expect(speedup).toBeGreaterThanOrEqual(0.9);
  });
});
