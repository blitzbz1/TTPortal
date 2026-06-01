import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, StatusBar, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, G, Mask, Path, Rect } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';

const BG = '#0D3B33';

// ── Animation timeline ───────────────────────────────────────
// 0ms          pin appears small, opacity ramps in
// 0–PHASE_1    pin pulsates alone (visible breathing)
// PHASE_1      pin grows from PIN_SMALL_SCALE → 1.0; wordmark begins to cascade
// settle+      gentle continuous breathing on the full lockup
// isReady & ≥MIN_DISPLAY  → fade out, runOnJS(onComplete)
const PIN_SMALL_SCALE = 0.5;
const PHASE_1_MS = 1100;
const GROW_DURATION_MS = 720;
const LETTER_BASE_DELAY_MS = PHASE_1_MS + 80;
const LETTER_STAGGER_MS = 60;
const LETTER_DURATION_MS = 420;
const MIN_DISPLAY_MS = PHASE_1_MS + GROW_DURATION_MS + 120; // 1940
const FADE_OUT_MS = 380;

// Single knob that drives the full-size lockup. Pin width is set to this; the
// wordmark fontSize is derived from it (lockup-vertical.svg uses a 98:32
// pin-to-text ratio). Animations run via transform on the wrapper, so this
// number is layout-only — never animated per frame.
const LOCKUP_PIN_WIDTH = 132;
const PIN_ASPECT = 348 / 486; // viewBox of pin-white.svg
const LOCKUP_PIN_HEIGHT = LOCKUP_PIN_WIDTH / PIN_ASPECT;
const WORDMARK_SIZE = Math.round(LOCKUP_PIN_WIDTH * (32 / 98)); // ≈ 43

// Match lockup-vertical.svg's font stack so the wordmark renders identically
// to the static splash and doesn't pop when Syne loads async.
const SYSTEM_FONT = Platform.select({
  ios: undefined,
  android: 'sans-serif',
  default: undefined,
});

// Faithful reproduction of design/pin-white.svg — same viewBox, same paths,
// same mask. The wrapping <Animated.View> handles all scaling, so the artwork
// itself is immutable.
const PIN_VIEWBOX = '0 0 348 486';
const PIN_PATH_BODY =
  'M1575 4760 c-86 -10 -247 -52 -335 -87 -210 -83 -361 -184 -536 -358 -197 -196 -319 -393 -414 -675 -127 -372 -126 -831 2 -1255 87 -289 242 -629 410 -899 105 -168 339 -500 412 -584 13 -15 73 -86 133 -157 132 -157 354 -388 442 -461 49 -40 68 -51 80 -44 18 10 279 265 300 292 12 16 -63 93 -718 745 -402 401 -731 733 -731 739 0 7 10 14 23 17 41 9 302 77 337 87 33 10 630 156 755 185 33 8 134 32 225 54 166 40 320 77 550 132 69 16 141 34 160 39 49 13 512 126 582 141 33 8 60 20 64 29 3 8 12 89 19 180 31 371 -25 679 -180 995 -77 156 -118 219 -225 348 -161 193 -367 344 -595 439 -60 25 -139 52 -175 61 -36 8 -87 21 -115 27 -61 15 -374 22 -470 10z';
const PIN_PATH_FLAG =
  'M3160 2443 c-52 -12 -111 -27 -130 -33 -19 -5 -84 -21 -145 -35 -161 -38 -275 -65 -315 -75 -19 -6 -73 -19 -120 -29 -221 -51 -308 -72 -340 -81 -19 -5 -66 -17 -105 -25 -38 -9 -106 -25 -150 -35 -44 -11 -129 -31 -190 -45 -60 -14 -126 -30 -145 -35 -19 -5 -64 -16 -100 -24 -180 -41 -352 -83 -419 -102 -17 -5 5 -28 530 -550 477 -473 677 -668 689 -672 12 -5 262 295 390 468 103 138 272 399 335 515 79 145 136 262 179 365 26 63 51 124 56 135 5 11 23 65 40 120 18 55 36 111 41 124 6 13 6 27 2 31 -4 3 -51 -4 -103 -17z';

const WORDMARK = 'TTPortal';

interface AnimatedSplashProps {
  isReady: boolean;
  onComplete: () => void;
}

interface LetterProps {
  char: string;
  index: number;
  unify: SharedValue<number>;
}

/**
 * One glyph of the wordmark. Lives inside the lockup wrapper so it inherits
 * the pin's growth scale; its own animation is the staggered fade + lift
 * reveal. `unify` is the shared 0→1 progress of phase 2 — multiplied into
 * opacity so letters can never appear before the pin has begun growing.
 */
function Letter({ char, index, unify }: LetterProps) {
  const opacity = useSharedValue(0);
  const translate = useSharedValue(14);

  useEffect(() => {
    const delay = LETTER_BASE_DELAY_MS + index * LETTER_STAGGER_MS;
    opacity.value = withDelay(
      delay,
      withTiming(1, { duration: LETTER_DURATION_MS, easing: Easing.out(Easing.quad) }),
    );
    translate.value = withDelay(
      delay,
      withTiming(0, { duration: LETTER_DURATION_MS, easing: Easing.out(Easing.cubic) }),
    );
  }, [index, opacity, translate]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value * unify.value,
    transform: [{ translateY: translate.value }],
  }));

  return (
    <Animated.Text allowFontScaling={false} style={[styles.letter, style]}>
      {char}
    </Animated.Text>
  );
}

/**
 * Renders pin-white.svg verbatim. The drawing is fixed; only the parent
 * <Animated.View> scale changes. width/height are layout numbers, not
 * animated values — react-native-svg won't re-rasterize the path.
 */
function BrandPin() {
  return (
    <Svg
      width={LOCKUP_PIN_WIDTH}
      height={LOCKUP_PIN_HEIGHT}
      viewBox={PIN_VIEWBOX}
    >
      <Defs>
        <Mask id="pinmask">
          <Rect width="100%" height="100%" fill="black" />
          <G transform="translate(0,486) scale(0.1,-0.1)">
            <Path d={PIN_PATH_BODY} fill="white" />
            <Path d={PIN_PATH_FLAG} fill="white" />
          </G>
          <Circle cx={178.54} cy={157.76} r={58.3} fill="black" />
        </Mask>
      </Defs>
      <Rect width="100%" height="100%" fill="#FFFFFF" mask="url(#pinmask)" />
    </Svg>
  );
}

export default function AnimatedSplash({ isReady, onComplete }: AnimatedSplashProps) {
  const fade = useSharedValue(1);
  // Pin scale baseline. Starts small (PHASE_1), then grows to 1.0 in PHASE_2.
  // The starting size is calibrated to match the native splash's pin width
  // (app.json `imageWidth: 92` × pin aspect 0.716 ≈ 66dp), so when the OS-level
  // splash dismisses there's no visual jump — the JS overlay's first frame
  // shows a pin of identical size.
  const pinScale = useSharedValue(PIN_SMALL_SCALE);
  // Continuous breathing — multiplied into the displayed scale so it composes
  // with pinScale without fighting it. More pronounced while the pin is small.
  const pinPulse = useSharedValue(1);
  // 0 → 1 once phase 2 begins. Gates the wordmark and shrinks the wordmark's
  // reserved space so the pin is visually centered during phase 1.
  const unify = useSharedValue(0);
  const [minTimePassed, setMinTimePassed] = useState(false);

  useEffect(() => {
    // Phase 1: pin already on screen from native splash; just start breathing.
    // No fade-in needed — pinOpacity is implicitly 1 from mount.
    pinPulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 700, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );

    // Phase 2: pin grows + wordmark space unfurls
    pinScale.value = withDelay(
      PHASE_1_MS,
      withTiming(1, { duration: GROW_DURATION_MS, easing: Easing.out(Easing.cubic) }),
    );
    unify.value = withDelay(
      PHASE_1_MS,
      withTiming(1, { duration: GROW_DURATION_MS, easing: Easing.out(Easing.cubic) }),
    );

    const timer = setTimeout(() => setMinTimePassed(true), MIN_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [pinScale, pinPulse, unify]);

  useEffect(() => {
    if (isReady && minTimePassed) {
      fade.value = withTiming(0, { duration: FADE_OUT_MS }, () => {
        runOnJS(onComplete)();
      });
    }
  }, [isReady, minTimePassed, fade, onComplete]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const pinStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pinScale.value * pinPulse.value }],
  }));
  // The wordmark slot sits below the pin in the flex column, but during
  // phase 1 we don't want it to push the pin upward off-center. Animating
  // height + marginTop from 0 → final values via `unify` keeps the pin
  // visually centered until the lockup begins forming.
  const wordmarkSlotStyle = useAnimatedStyle(() => ({
    height: WORDMARK_SIZE * 1.25 * unify.value,
    marginTop: Math.round(LOCKUP_PIN_WIDTH * 0.18) * unify.value,
  }));

  return (
    <Animated.View style={[styles.overlay, overlayStyle]} pointerEvents="none">
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['#114A41', '#0D3B33', '#0A2F29']}
        locations={[0, 0.55, 1]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.lockup}>
          <Animated.View style={pinStyle}>
            <BrandPin />
          </Animated.View>
          <Animated.View style={[styles.wordmarkSlot, wordmarkSlotStyle]}>
            <View style={styles.wordmark}>
              {WORDMARK.split('').map((char, i) => (
                <Letter key={`${char}-${i}`} char={char} index={i} unify={unify} />
              ))}
            </View>
          </Animated.View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG,
    zIndex: 999,
  },
  gradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockup: {
    alignItems: 'center',
  },
  wordmarkSlot: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  wordmark: {
    flexDirection: 'row',
  },
  letter: {
    fontFamily: SYSTEM_FONT,
    fontSize: WORDMARK_SIZE,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: '#FFFFFF',
    includeFontPadding: false,
  },
});
