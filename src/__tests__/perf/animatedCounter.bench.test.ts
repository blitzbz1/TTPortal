// Models the AnimatedCounter useAnimatedReaction reaction. The "legacy"
// version fired runOnJS(setDisplay) on every animation frame; the "fast"
// version quantizes the source so the JS callback only fires when the
// displayed string would actually change. Counts setState calls per
// animation cycle as a proxy for JS-thread load.

const FRAMES_PER_ANIMATION = 36; // ~600ms @ 60fps

function legacyReaction(target: number, isDecimal: boolean): number {
  // Fires runOnJS once per frame.
  let calls = 0;
  for (let i = 0; i <= FRAMES_PER_ANIMATION; i++) {
    const t = (i / FRAMES_PER_ANIMATION) * target;
    void (isDecimal ? t.toFixed(1) : Math.round(t).toString());
    calls += 1;
  }
  return calls;
}

function quantizedReaction(target: number, isDecimal: boolean): number {
  // Fires runOnJS only when the quantized value actually changes.
  let last: number | undefined;
  let calls = 0;
  for (let i = 0; i <= FRAMES_PER_ANIMATION; i++) {
    const raw = (i / FRAMES_PER_ANIMATION) * target;
    const q = isDecimal ? Math.round(raw * 10) / 10 : Math.round(raw);
    if (q !== last) {
      last = q;
      void (isDecimal ? q.toFixed(1) : q.toString());
      calls += 1;
    }
  }
  return calls;
}

describe('AnimatedCounter quantization', () => {
  it('legacy reaction fires once per frame', () => {
    const calls = legacyReaction(5, false);
     
    console.log(`[bench] legacyReaction setDisplay calls: ${calls}`);
    expect(calls).toBe(FRAMES_PER_ANIMATION + 1);
  });

  it('quantized integer reaction collapses to ~target+1 unique steps', () => {
    const calls = quantizedReaction(5, false);
     
    console.log(`[bench] quantizedReaction (target=5, integer) setDisplay calls: ${calls}`);
    // 5 + the initial 0 = 6
    expect(calls).toBeLessThanOrEqual(7);
  });

  it('quantized decimal reaction collapses to ~10x target unique steps', () => {
    const calls = quantizedReaction(2.5, true);
     
    console.log(`[bench] quantizedReaction (target=2.5, decimal) setDisplay calls: ${calls}`);
    // 25 + initial 0 = 26
    expect(calls).toBeLessThanOrEqual(27);
  });

  it('quantized version does meaningfully fewer setState calls than legacy', () => {
    const legacy = legacyReaction(5, false);
    const fast = quantizedReaction(5, false);
    const ratio = legacy / fast;
     
    console.log(`[bench] AnimatedCounter setState reduction: ${ratio.toFixed(2)}x`);
    expect(ratio).toBeGreaterThanOrEqual(3);
  });
});
