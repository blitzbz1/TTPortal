/* ────────────────────────────────────────────────────────
 *  Motion design tokens — centralized animation constants
 *  Based on Material Design 3 motion tokens, tuned for RN
 * ──────────────────────────────────────────────────────── */

import { Easing } from 'react-native-reanimated';

/** Duration tokens (ms) */
export const Duration = {
  instant: 100,
  fast: 200,
  base: 300,
  moderate: 450,
  slow: 600,
  slower: 900,
} as const;

/** Easing curves — use with `withTiming({ easing: ... })` */
export const Easings = {
  /** General on-screen transitions */
  standard: Easing.bezier(0.4, 0.0, 0.2, 1.0),
  /** Elements entering the screen */
  decelerate: Easing.bezier(0.0, 0.0, 0.2, 1.0),
  /** Elements leaving the screen */
  accelerate: Easing.bezier(0.4, 0.0, 1.0, 1.0),
  /** Hero entrances, celebrations */
  emphasizedDecelerate: Easing.bezier(0.05, 0.7, 0.1, 1.0),
  /** Dramatic exits */
  emphasizedAccelerate: Easing.bezier(0.3, 0.0, 0.8, 0.15),
} as const;

/** Spring presets — use with `withSpring({ ...Springs.snappy })` */
export const Springs = {
  /** Subtle movements, list items */
  gentle: { damping: 20, stiffness: 100 },
  /** Playful interactions, toggles */
  bouncy: { damping: 10, stiffness: 150 },
  /** Quick responsive actions, buttons */
  snappy: { damping: 15, stiffness: 200 },
  /** Bottom sheet snap, firm detents */
  stiff: { damping: 50, stiffness: 500 },
  /** Badge reveals, celebrations */
  celebration: { damping: 8, stiffness: 120 },
} as const;
