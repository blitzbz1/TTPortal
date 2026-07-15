const PERF_LOG_ENABLED =
   
  typeof __DEV__ !== 'undefined' ? (__DEV__ as boolean) : false;

const now = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

export function measureSync<T>(label: string, fn: () => T): T {
  if (!PERF_LOG_ENABLED) return fn();
  const t0 = now();
  try {
    return fn();
  } finally {
     
    console.log(`[perf] ${label}: ${(now() - t0).toFixed(1)}ms`);
  }
}

export async function measure<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!PERF_LOG_ENABLED) return fn();
  const t0 = now();
  try {
    return await fn();
  } finally {
     
    console.log(`[perf] ${label}: ${(now() - t0).toFixed(1)}ms`);
  }
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function bench(fn: () => void, iterations: number): { medianMs: number; totalMs: number } {
  const samples: number[] = [];
  const start = now();
  for (let i = 0; i < iterations; i++) {
    const t0 = now();
    fn();
    samples.push(now() - t0);
  }
  return { medianMs: median(samples), totalMs: now() - start };
}
