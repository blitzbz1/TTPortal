// ── Cold-start launch tracing ────────────────────────────────────────────────
//
// Temporary instrumentation to find where launch time is spent. Each mark logs
// one line to the JS console — visible in the Metro terminal and the Xcode /
// iOS-simulator console:
//
//   [trace] +1234ms (Δ56ms) <label>
//
// `+N` is milliseconds since the FIRST mark (≈ start of app JS); `Δ` is the gap
// since the previous mark — that delta is the time spent on the step between the
// two marks. `traceSummary()` prints the whole ordered timeline at the end.
//
// On the iOS simulator the first mark's absolute time also approximates how long
// native init + bundle load took before any app JS ran (compare with Xcode's
// process-start). Remove the trace() calls once the bottleneck is identified.

import * as FileSystem from 'expo-file-system/legacy';

interface Mark {
  label: string;
  t: number;
}

const marks: Mark[] = [];
const seen = new Set<string>();

function now(): number {
  const perf = (globalThis as { performance?: { now?: () => number } }).performance;
  if (perf && typeof perf.now === 'function') return perf.now();
  return Date.now();
}

// console.log → Metro (only when JS-log forwarding is active). nativeLoggingHook
// → the native log (iOS unified log / Android logcat), capturable via
// `xcrun simctl spawn booted log stream` or `adb logcat` even when Metro
// forwarding is off — so the trace is never lost to a port/host mixup.
function emit(line: string): void {
  // console.INFO, not console.log: babel-preset-expo strips `console.log` in
  // release builds, so a release-APK cold start emitted NOTHING to logcat (the
  // app's own logger.ts uses console.info/warn/error precisely because those
  // survive). info keeps the marks visible in `adb logcat` on a release build,
  // which is the whole point of the cold-start capture (T003/T004).
  console.info(line);
  (globalThis as { nativeLoggingHook?: (msg: string, level: number) => void }).nativeLoggingHook?.(line, 1);
}

// Persist the full timeline to a file in the app container, so it can be read
// directly off the simulator/device (no Metro / os_log dependency). Rewritten
// after every mark; the last write holds the complete launch timeline.
function writeTimelineFile(): void {
  try {
    const dir = FileSystem.documentDirectory;
    if (!dir || marks.length === 0) return;
    const first = marks[0].t;
    const body = marks
      .map((m, i) => {
        const prev = i > 0 ? marks[i - 1].t : m.t;
        return `+${Math.round(m.t - first)}ms\tΔ${Math.round(m.t - prev)}ms\t${m.label}`;
      })
      .join('\n');
    void FileSystem.writeAsStringAsync(`${dir}launch-trace.txt`, `${body}\n`);
  } catch {
    // never throw
  }
}

export function trace(label: string): void {
  try {
    const t = now();
    const first = marks.length > 0 ? marks[0].t : t;
    const prev = marks.length > 0 ? marks[marks.length - 1].t : t;
    marks.push({ label, t });
    emit(`[trace] +${Math.round(t - first)}ms (Δ${Math.round(t - prev)}ms) ${label}`);
    writeTimelineFile();
  } catch {
    // Instrumentation must never throw.
  }
}

/** Like trace(), but only the first call for a given label is recorded (use for
 * marks placed in render bodies that run more than once). */
export function traceOnce(label: string): void {
  if (seen.has(label)) return;
  seen.add(label);
  trace(label);
}

const segmentSeen = new Set<string>();

/**
 * Time a synchronous segment: run `fn`, record a mark whose Δ is the wall-clock
 * cost of `fn`, and return `fn`'s result **unchanged**. (T003 — Stage M: used
 * to time the cities cold-mount sub-segments — JSON.parse, the cleanCityCatalog
 * sort, the activeCities materialize — so a real Galaxy A51 capture can settle
 * which one dominates.)
 *
 * The wrapper is **transparent**: if `fn` throws, the original error propagates
 * unchanged (callers like `readCities` rely on their own try/catch), and the
 * mark-recording in `finally` never adds a second, instrumentation-sourced
 * throw. Instrumentation must never alter control flow or output values.
 */
export function traceSegment<T>(label: string, fn: () => T): T {
  let start: number;
  try {
    start = now();
  } catch {
    return fn(); // a broken clock must not block the work
  }
  try {
    return fn();
  } finally {
    try {
      const t = now();
      const first = marks.length > 0 ? marks[0].t : start;
      marks.push({ label, t });
      emit(`[trace] +${Math.round(t - first)}ms (Δ${Math.round(t - start)}ms) ${label}`);
      writeTimelineFile();
    } catch {
      // Recording must never throw, and must never mask fn's own error.
    }
  }
}

/** Like traceSegment(), but only the FIRST call for a given label is timed —
 * later calls run `fn` directly with zero overhead. Use at hot call sites
 * (e.g. readCities) where only the cold-start invocation is worth measuring. */
export function traceSegmentOnce<T>(label: string, fn: () => T): T {
  if (segmentSeen.has(label)) return fn();
  segmentSeen.add(label);
  return traceSegment(label, fn);
}

/** Print the full ordered timeline with per-step deltas. Call at "launch done". */
export function traceSummary(): void {
  try {
    if (marks.length === 0) return;
    const first = marks[0].t;
    const rows = marks
      .map((m, i) => {
        const prev = i > 0 ? marks[i - 1].t : m.t;
        const at = String(Math.round(m.t - first)).padStart(6);
        const delta = String(Math.round(m.t - prev)).padStart(5);
        return `[trace]  +${at}ms  Δ${delta}ms  ${m.label}`;
      })
      .join('\n');
    const total = Math.round(marks[marks.length - 1].t - first);
    emit(`[trace] ===== LAUNCH TIMELINE =====\n${rows}\n[trace] total (first→last mark): ${total}ms\n[trace] ==========================`);
  } catch {
    // never throw
  }
}
