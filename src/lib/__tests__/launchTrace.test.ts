// T003 (Stage M) — unit spec for the launch-trace segment timers used to
// measure the cities cold-mount sub-segments on a real Galaxy A51 (T004).
// Mock the file-system sink so the trace never touches a real device path
// (the existing pattern: launchTrace's only external dep is the legacy FS).
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///mock/',
  writeAsStringAsync: jest.fn(() => Promise.resolve()),
}));

describe('launchTrace segment timers (T003)', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    // emit() uses console.info (survives babel's release console.log strip).
    logSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  // Fresh module per case so the module-level `marks` / once-guard don't leak
  // across tests (mirrors the isolateModules pattern in offline-cache.test).
  function load(): typeof import('../launchTrace') {
    let mod!: typeof import('../launchTrace');
    jest.isolateModules(() => {
      mod = require('../launchTrace');
    });
    return mod;
  }

  function emittedLines(): string[] {
    return logSpy.mock.calls.map((c) => String(c[0]));
  }

  it('traceSegment returns the fn result unchanged', () => {
    const { traceSegment } = load();
    expect(traceSegment('seg-x', () => 42)).toBe(42);
    expect(traceSegment('seg-obj', () => ({ a: 1 }))).toEqual({ a: 1 });
  });

  it('traceSegment records a mark with a finite numeric Δ for the label', () => {
    const { traceSegment } = load();
    traceSegment('seg-x', () => 42);
    const line = emittedLines().find((l) => l.includes('seg-x'));
    expect(line).toBeDefined();
    const m = /\(Δ(\d+)ms\)/.exec(line as string);
    expect(m).not.toBeNull();
    expect(Number.isFinite(Number(m?.[1]))).toBe(true);
  });

  it('traceSegment is transparent to a throwing fn — re-throws the ORIGINAL error', () => {
    const { traceSegment } = load();
    const boom = new Error('boom');
    // The instrumentation must not swallow or replace the domain error
    // (readCities relies on its own try/catch around JSON.parse), and must
    // not crash the caller with a *second*, instrumentation-sourced error.
    expect(() => traceSegment('seg-throws', () => { throw boom; })).toThrow(boom);
  });

  it('traceSegmentOnce always runs fn but records only the first call per label', () => {
    const { traceSegmentOnce } = load();
    const fn = jest.fn(() => 7);
    expect(traceSegmentOnce('cities: JSON.parse', fn)).toBe(7);
    expect(traceSegmentOnce('cities: JSON.parse', fn)).toBe(7);
    expect(fn).toHaveBeenCalledTimes(2); // fn runs every time — no behaviour change
    const recorded = emittedLines().filter(
      (l) => l.includes('[trace]') && l.includes('cities: JSON.parse'),
    );
    expect(recorded).toHaveLength(1); // but only the first (cold) call is timed
  });

  it('the three cities cold-mount labels surface in traceSummary when wrapped', () => {
    const { traceSegmentOnce, traceSegment, traceSummary } = load();
    traceSegmentOnce('cities: JSON.parse', () => null);
    traceSegmentOnce('cities: cleanCityCatalog sort', () => []);
    traceSegment('cities: toLocationCity+mergeWave', () => []);
    logSpy.mockClear();
    traceSummary();
    const summary = emittedLines().join('\n');
    expect(summary).toContain('cities: JSON.parse');
    expect(summary).toContain('cities: cleanCityCatalog sort');
    expect(summary).toContain('cities: toLocationCity+mergeWave');
  });
});
