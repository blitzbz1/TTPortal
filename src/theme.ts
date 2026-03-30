/* ────────────────────────────────────────────────────────
 *  Theme system — semantic color tokens with light / dark
 * ──────────────────────────────────────────────────────── */

/** Semantic color tokens resolved per theme. */
export interface ThemeColors {
  // Backgrounds
  bg: string;
  bgAlt: string;
  bgMuted: string;
  bgMid: string;

  // Text
  text: string;
  textMuted: string;
  textFaint: string;
  textOnPrimary: string;

  // Borders
  border: string;
  borderLight: string;

  // Brand green
  primary: string;
  primaryMid: string;
  primaryLight: string;
  primaryDim: string;
  primaryPale: string;

  // Accent (orange)
  accent: string;
  accentBright: string;

  // Functional
  blue: string;
  bluePale: string;
  purple: string;
  purpleMid: string;
  purplePale: string;
  purpleDim: string;
  red: string;
  redDeep: string;
  redPale: string;
  amber: string;
  amberPale: string;
  amberDeep: string;

  // Overlays
  overlay: string;
  overlayLight: string;
  overlayHeavy: string;

  // Special-purpose
  mapBg: string;
  mapLegendBg: string;
  conditionPro: string;
  authInputBg: string;
  webOuterBg: string;
  cancelledBadgeBg: string;
  redBorder: string;
  greenDeep: string;

  // Utility (constant across themes)
  shadow: string;
  white: string;
  black: string;
}

/* ── Light palette ── */
export const lightColors: ThemeColors = {
  bg: '#fafaf8',
  bgAlt: '#ffffff',
  bgMuted: '#f4f4ef',
  bgMid: '#ecece4',

  text: '#111810',
  textMuted: '#4a4f47',
  textFaint: '#9ca39a',
  textOnPrimary: '#ffffff',

  border: '#e2e4de',
  borderLight: '#eceee8',

  primary: '#14532d',
  primaryMid: '#166534',
  primaryLight: '#22c55e',
  primaryDim: '#dcfce7',
  primaryPale: '#f0fdf4',

  accent: '#c2410c',
  accentBright: '#ea580c',

  blue: '#1e40af',
  bluePale: '#eff6ff',
  purple: '#7c3aed',
  purpleMid: '#a78bfa',
  purplePale: '#f3f0ff',
  purpleDim: '#e9e5ff',
  red: '#ef4444',
  redDeep: '#dc2626',
  redPale: '#fef2f2',
  amber: '#f59e0b',
  amberPale: '#fff7ed',
  amberDeep: '#ffedd5',

  overlay: 'rgba(10, 20, 10, 0.33)',
  overlayLight: 'rgba(10, 20, 10, 0.20)',
  overlayHeavy: 'rgba(0, 0, 0, 0.53)',

  mapBg: '#d4e4d0',
  mapLegendBg: 'rgba(255, 255, 255, 0.93)',
  conditionPro: '#1a5080',
  authInputBg: '#0f3d22',
  webOuterBg: '#e8ebe5',
  cancelledBadgeBg: '#fde8e8',
  redBorder: '#fecaca',
  greenDeep: '#15803d',

  shadow: '#000000',
  white: '#ffffff',
  black: '#000000',
};

/* ── Dark palette ── */
export const darkColors: ThemeColors = {
  bg: '#0f120f',
  bgAlt: '#1a1d1a',
  bgMuted: '#232623',
  bgMid: '#2c302c',

  text: '#e8ece6',
  textMuted: '#a0a89e',
  textFaint: '#8a928a',
  textOnPrimary: '#ffffff',

  border: '#4a524c',
  borderLight: '#424a42',

  primary: '#22c55e',
  primaryMid: '#16a34a',
  primaryLight: '#4ade80',
  primaryDim: '#052e16',
  primaryPale: '#0a1f0f',

  accent: '#ea580c',
  accentBright: '#f97316',

  blue: '#60a5fa',
  bluePale: '#0c1a2e',
  purple: '#a78bfa',
  purpleMid: '#8b5cf6',
  purplePale: '#1a1028',
  purpleDim: '#1e1530',
  red: '#f87171',
  redDeep: '#ef4444',
  redPale: '#2a1010',
  amber: '#fbbf24',
  amberPale: '#2a1e08',
  amberDeep: '#332610',

  overlay: 'rgba(0, 0, 0, 0.55)',
  overlayLight: 'rgba(0, 0, 0, 0.35)',
  overlayHeavy: 'rgba(0, 0, 0, 0.70)',

  mapBg: '#1a231a',
  mapLegendBg: 'rgba(26, 32, 26, 0.93)',
  conditionPro: '#5b9bd5',
  authInputBg: '#0a2818',
  webOuterBg: '#0a0f0a',
  cancelledBadgeBg: '#2a1010',
  redBorder: '#5c2020',
  greenDeep: '#16a34a',

  shadow: '#000000',
  white: '#ffffff',
  black: '#000000',
};

/* ── Typography (theme-independent) ── */
export const Fonts = {
  heading: 'Syne',
  body: 'DM Sans',
} as const;

/* ── Border radii (theme-independent) ── */
export const Radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 100,
} as const;
