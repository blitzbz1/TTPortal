/* ────────────────────────────────────────────────────────
 *  Theme system — semantic color tokens with light / dark
 * ──────────────────────────────────────────────────────── */

import type { TextStyle } from 'react-native';

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

  // Gradient stroke (3D beveled edge)
  strokeGradientStart: string;
  strokeGradientEnd: string;
  surfaceGradientStart: string;
  surfaceGradientEnd: string;

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

  strokeGradientStart: '#00000008',
  strokeGradientEnd: '#00000018',
  surfaceGradientStart: '#ffffff',
  surfaceGradientEnd: '#f5f5f0',

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

  strokeGradientStart: '#FFFFFF30',
  strokeGradientEnd: '#00000040',
  surfaceGradientStart: '#2e312e',
  surfaceGradientEnd: '#1a1d1a',

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
  md: 12,
  lg: 16,
  xl: 22,
  full: 100,
} as const;

/* ── Shadow presets (3D depth system) ── */
/* Uses boxShadow arrays: dark drop shadow + bright top highlight */
/* Theme-aware: updateShadowsForTheme() is called by ThemeProvider */

function createLightShadows() {
  return {
    sm: {
      boxShadow: [
        { offsetX: 0, offsetY: 3, blurRadius: 8, color: '#00000035' },
        { offsetX: 0, offsetY: -1, blurRadius: 1, color: '#FFFFFF10' },
      ],
    },
    md: {
      boxShadow: [
        { offsetX: 0, offsetY: 5, blurRadius: 14, color: '#00000040' },
        { offsetX: 0, offsetY: -1, blurRadius: 1, color: '#FFFFFF14' },
      ],
    },
    lg: {
      boxShadow: [
        { offsetX: 0, offsetY: 8, blurRadius: 24, color: '#00000050' },
        { offsetX: 0, offsetY: -1, blurRadius: 2, color: '#FFFFFF18' },
      ],
    },
    bar: {
      boxShadow: [
        { offsetX: 0, offsetY: 3, blurRadius: 10, color: '#00000040' },
        { offsetX: 0, offsetY: -1, blurRadius: 1, color: '#FFFFFF08' },
      ],
    },
  };
}

function createDarkShadows() {
  return {
    sm: {
      boxShadow: [
        { offsetX: 0, offsetY: 2, blurRadius: 6, color: '#000000aa' },
        { offsetX: 0, offsetY: -1, blurRadius: 1, color: '#FFFFFF28' },
      ],
    },
    md: {
      boxShadow: [
        { offsetX: 0, offsetY: 4, blurRadius: 12, color: '#000000bb' },
        { offsetX: 0, offsetY: -1, blurRadius: 2, color: '#FFFFFF30' },
      ],
    },
    lg: {
      boxShadow: [
        { offsetX: 0, offsetY: 6, blurRadius: 20, color: '#000000cc' },
        { offsetX: 0, offsetY: -1, blurRadius: 3, color: '#FFFFFF38' },
      ],
    },
    bar: {
      boxShadow: [
        { offsetX: 0, offsetY: 3, blurRadius: 8, color: '#000000aa' },
        { offsetX: 0, offsetY: -1, blurRadius: 1, color: '#FFFFFF20' },
      ],
    },
  };
}

export type ShadowPresets = ReturnType<typeof createLightShadows>;
export let Shadows: ShadowPresets = createLightShadows();

export function updateShadowsForTheme(isDark: boolean) {
  Shadows = isDark ? createDarkShadows() : createLightShadows();
}

/* ── Text shadow presets ── */
export const TextShadows = {
  heading: {
    textShadowColor: '#00000060',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
  label: {
    textShadowColor: '#00000040',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
} as const;

/* ════════════════════════════════════════════════════════════════
 *  Design tokens — merged from gathering's typography system
 *  Provides standardised scales for font sizes, weights, spacing,
 *  semantic colours, badge backgrounds, surface colours, gradients,
 *  and pre-built composite text styles.
 *
 *  3D shadow system (Shadows / TextShadows above) is preserved
 *  intact; the traditional Shadow / DarkShadow presets below are
 *  for components that need the classic RN shadow API instead.
 * ════════════════════════════════════════════════════════════════ */

// ─── Font Size Scale ────────────────────────────────────────────────────────

export const FontSize = {
  /** 10 — Micro badges, notification dots */
  xs: 10,
  /** 11 — Status badges, timestamps, section labels */
  sm: 11,
  /** 12 — Usernames, helpers, error text */
  base: 12,
  /** 13 — Descriptions, info text, action buttons */
  md: 13,
  /** 14 — Display names, form labels, button text */
  lg: 14,
  /** 16 — Card titles, section headings */
  xl: 16,
  /** 18 — Modal / dialog titles */
  xxl: 18,
  /** 20 — Feature amounts */
  xxxl: 20,
  /** 24 — Page headings */
  display: 24,
} as const;

// ─── Font Weights ───────────────────────────────────────────────────────────

export const FontWeight = {
  /** 400 — Body text, descriptions */
  normal: '400' as const,
  /** 500 — Display names, form labels */
  medium: '500' as const,
  /** 600 — Card titles, badges, dialog titles */
  semibold: '600' as const,
  /** 700 — Headings, amounts */
  bold: '700' as const,
  /** 800 — Display headings, hero text */
  extrabold: '800' as const,
};

// ─── Neutral Text Colors (light) ────────────────────────────────────────────

export const TextColor = {
  /** #171C26 — Titles, names, amounts */
  primary: '#171C26',
  /** #3D4451 — Descriptions, labels */
  secondary: '#3D4451',
  /** #6A7181 — Info text, helpers */
  tertiary: '#6A7181',
  /** #8A9099 — Timestamps, placeholders */
  quaternary: '#8A9099',
  /** #FFFFFF — Text on coloured backgrounds */
  inverse: '#FFFFFF',
} as const;

// ─── Semantic Text Colors (light) ───────────────────────────────────────────

export const SemanticColor = {
  /** #308CE8 — Links, interactive indicators */
  link: '#308CE8',
  /** #1E5BA8 — Info banners, role badges */
  info: '#1E5BA8',
  /** #2EB877 — Approve buttons, positive amounts */
  success: '#2EB877',
  /** #1E7A50 — Success messages, confirmed states */
  successMuted: '#1E7A50',
  /** #DC2828 — Validation errors, required asterisks */
  error: '#DC2828',
  /** #B72222 — Error banners, decline buttons */
  errorStrong: '#B72222',
  /** #F59F0A — Star ratings */
  star: '#F59F0A',
  /** #D48D11 — Pending hints, warning status */
  warning: '#D48D11',
  /** #92600E — Warning badge text (WCAG AA on pastel) */
  warningMuted: '#92600E',
  /** #8A4B1A — Draft titles, draft banners */
  draft: '#8A4B1A',
  /** #7A5A12 — Deductions, financial warnings */
  deduction: '#7A5A12',
  /** #A07014 — Overfulfilled progress */
  overfulfilled: '#A07014',
  /** #7C3AED — Contributor role badge */
  contributor: '#7C3AED',
} as const;

// ─── Badge Backgrounds (light) ──────────────────────────────────────────────

export const BadgeBg = {
  success: '#D4F5E4',
  successStrong: '#1E9960',
  error: '#FDE2E4',
  errorStrong: '#DC2828',
  warning: '#FEF3C7',
  warningStrong: '#B47713',
  info: '#DBE8FE',
  infoStrong: '#308CE8',
  muted: '#F0EDEA',
  mutedStrong: '#6A7181',
  draft: '#FFF5EB',
} as const;

// ─── Neutral Text Colors (dark) ─────────────────────────────────────────────

export const DarkTextColor = {
  /** #F5F2F0 — Titles, names, amounts */
  primary: '#F5F2F0',
  /** #C8CCD3 — Descriptions, labels */
  secondary: '#C8CCD3',
  /** #818898 — Info text, helpers */
  tertiary: '#818898',
  /** #6A7181 — Timestamps, placeholders */
  quaternary: '#6A7181',
  /** #171C26 — Text on light badges in dark mode */
  inverse: '#171C26',
} as const;

// ─── Semantic Text Colors (dark) ────────────────────────────────────────────

export const DarkSemanticColor = {
  /** #60A5FA — Links, interactive indicators */
  link: '#60A5FA',
  /** #93C5FD — Info banners, role badges */
  info: '#93C5FD',
  /** #34D399 — Approve buttons, positive amounts */
  success: '#34D399',
  /** #6EE7B7 — Success messages */
  successMuted: '#6EE7B7',
  /** #F87171 — Validation errors */
  error: '#F87171',
  /** #FCA5A5 — Error banners, decline buttons */
  errorStrong: '#FCA5A5',
  /** #FBBF24 — Star ratings */
  star: '#FBBF24',
  /** #FB923C — Pending hints, warning status */
  warning: '#FB923C',
  /** #FB923C — Warning badge text */
  warningMuted: '#FB923C',
  /** #FDBA74 — Draft titles, draft banners */
  draft: '#FDBA74',
  /** #FCD34D — Deductions, financial warnings */
  deduction: '#FCD34D',
  /** #FBBF24 — Overfulfilled progress */
  overfulfilled: '#FBBF24',
  /** #A78BFA — Contributor role badge */
  contributor: '#A78BFA',
} as const;

// ─── Badge Backgrounds (dark) ───────────────────────────────────────────────

export const DarkBadgeBg = {
  success: '#0D3526',
  successStrong: '#1E9960',
  error: '#3D1515',
  errorStrong: '#DC2828',
  warning: '#3D2E0F',
  warningStrong: '#B47713',
  info: '#152A45',
  infoStrong: '#308CE8',
  muted: '#272C35',
  mutedStrong: '#6A7181',
  draft: '#3D2010',
} as const;

// ─── Surface Colors ─────────────────────────────────────────────────────────

export const SurfaceColor = {
  light: {
    background: '#fafaf8',
    backgroundSecondary: '#f4f4ef',
    backgroundTertiary: '#ecece4',
    border: '#e2e4de',
    borderMedium: '#d8dad4',
    overlay: 'rgba(10,20,10,0.5)',
    pressed: '#f4f4ef',
    card: '#ffffff',
  },
  dark: {
    background: '#0f120f',
    backgroundSecondary: '#1a1d1a',
    backgroundTertiary: '#232623',
    border: '#4a524c',
    borderMedium: '#424a42',
    overlay: 'rgba(0,0,0,0.7)',
    pressed: '#232623',
    card: '#1a1d1a',
  },
} as const;

// ─── Brand Colors ───────────────────────────────────────────────────────────

export const BrandColor = {
  /** #14532d — Deep green primary (buttons, active states) */
  primary: '#14532d',
  /** #FFFFFF — White text on primary backgrounds */
  primaryForeground: '#FFFFFF',
  /** #c2410c — Orange accent (highlights, badges) */
  accent: '#c2410c',
  /** #FFFFFF — White text on accent backgrounds */
  accentForeground: '#FFFFFF',
  /** #22c55e — Bright green primary for dark mode */
  primaryDark: '#22c55e',
  /** #ea580c — Bright orange accent for dark mode */
  accentDark: '#ea580c',
} as const;

// ─── Spacing Scale ──────────────────────────────────────────────────────────

export const Spacing = {
  /** 4px — Tight gaps between inline elements */
  xxs: 4,
  /** 8px — Small padding, icon margins */
  xs: 8,
  /** 12px — Badge padding, compact card gaps */
  sm: 12,
  /** 16px — Standard padding, card internal spacing */
  md: 16,
  /** 20px — Section gaps, larger internal padding */
  lg: 20,
  /** 24px — Section headings, generous spacing */
  xl: 24,
  /** 32px — Page-level padding, major section separators */
  xxl: 32,
} as const;

// ─── Component Border Radii ─────────────────────────────────────────────────
// Complements the generic Radius scale above with component-specific values.

export const BorderRadius = {
  /** 99px — Fully rounded pill badges */
  badge: 99,
  /** 16px — Buttons */
  button: 16,
  /** 16px — Form inputs */
  input: 16,
  /** 20px — Cards, dialogs */
  card: 20,
  /** 16px — Centred dialogs */
  dialog: 16,
  /** 24px — Bottom sheet top corners */
  sheet: 24,
} as const;

// ─── Traditional Shadow Presets ─────────────────────────────────────────────
// Classic RN shadow API (shadowColor/shadowOpacity/shadowOffset/shadowRadius).
// Use alongside the 3D boxShadow system (Shadows) for components that need it.

export const Shadow = {
  /** Subtle card shadow — warm-toned, low elevation */
  card: {
    shadowColor: '#997066',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  /** Prominent elevated shadow — warm-toned, high elevation */
  elevated: {
    shadowColor: '#997066',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    elevation: 8,
  },
} as const;

export const DarkShadow = {
  /** Subtle card shadow — black, low elevation */
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  /** Prominent elevated shadow — black, high elevation */
  elevated: {
    shadowColor: '#000000',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    elevation: 8,
  },
} as const;

// ─── Gradient Colors ────────────────────────────────────────────────────────

export const GradientColor = {
  /** Green horizontal gradient (primary actions) */
  primary: {
    colors: ['#14532d', '#166534'] as const,
    start: { x: 0, y: 0 } as const,
    end: { x: 1, y: 0 } as const,
  },
  /** Orange horizontal gradient (accent actions) */
  accent: {
    colors: ['#c2410c', '#ea580c'] as const,
    start: { x: 0, y: 0 } as const,
    end: { x: 1, y: 0 } as const,
  },
  /** Hero vertical gradient (deep green) */
  hero: {
    colors: ['#14532d', '#0f3d22'] as const,
    start: { x: 0, y: 0.5 } as const,
    end: { x: 0, y: 1 } as const,
  },
} as const;

// ─── Composite Text Styles ──────────────────────────────────────────────────
// Pre-built TextStyle objects for the most common patterns.
// Spread into StyleSheet.create(): `...Typography.cardTitle`
// Override colour with theme colours when needed:
//   `{ ...Typography.cardTitle, color: colors.text }`

export const Typography = {
  // ── Card-level styles ────────────────────────────────────

  /** Card title (18/700/Syne) */
  cardTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    fontFamily: Fonts.heading,
    color: TextColor.primary,
  } satisfies TextStyle,

  /** Card subtitle (14/500/DM Sans) */
  cardSubtitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.medium,
    fontFamily: Fonts.body,
    color: TextColor.primary,
  } satisfies TextStyle,

  /** Card description (13/400/DM Sans) */
  cardDescription: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.normal,
    fontFamily: Fonts.body,
    color: TextColor.tertiary,
  } satisfies TextStyle,

  /** Card info — date, location, participants (13/400/DM Sans) */
  cardInfo: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.normal,
    fontFamily: Fonts.body,
    color: TextColor.tertiary,
  } satisfies TextStyle,

  // ── Badge / label styles ─────────────────────────────────

  /** Status badge (12/600/DM Sans) — colour set dynamically */
  badgeText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    fontFamily: Fonts.body,
  } satisfies TextStyle,

  /** Micro badge — "You", type indicators (10/600/DM Sans) */
  microBadge: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    fontFamily: Fonts.body,
  } satisfies TextStyle,

  /** Timestamp / italic meta text (11/400/DM Sans) */
  timestamp: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.normal,
    fontFamily: Fonts.body,
    color: TextColor.tertiary,
    fontStyle: 'italic' as const,
  } satisfies TextStyle,

  // ── Section / heading styles ─────────────────────────────

  /** Modal / dialog title (18/600/Syne) */
  modalTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.semibold,
    fontFamily: Fonts.heading,
    color: TextColor.primary,
  } satisfies TextStyle,

  /** Section heading (13/600/DM Sans, uppercase) */
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    fontFamily: Fonts.body,
    color: TextColor.secondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  } satisfies TextStyle,

  /** Section label (11/600/DM Sans, uppercase) */
  sectionLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    fontFamily: Fonts.body,
    color: TextColor.tertiary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  } satisfies TextStyle,

  // ── Detail row styles ────────────────────────────────────

  /** Detail row label (14/500/DM Sans) */
  detailLabel: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.medium,
    fontFamily: Fonts.body,
    color: TextColor.tertiary,
  } satisfies TextStyle,

  /** Detail row value (14/500/DM Sans) */
  detailValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.medium,
    fontFamily: Fonts.body,
    color: TextColor.primary,
  } satisfies TextStyle,

  // ── Name / participant styles ────────────────────────────

  /** Display name in lists (14/500/DM Sans) */
  displayName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.medium,
    fontFamily: Fonts.body,
    color: TextColor.primary,
  } satisfies TextStyle,

  /** Username / secondary identifier (12/400/DM Sans) */
  username: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.normal,
    fontFamily: Fonts.body,
    color: TextColor.tertiary,
  } satisfies TextStyle,

  /** Avatar initials — compact (10/600/DM Sans) */
  initialsCompact: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    fontFamily: Fonts.body,
    color: TextColor.tertiary,
  } satisfies TextStyle,

  /** Avatar initials — medium (11/600/DM Sans) */
  initialsMedium: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    fontFamily: Fonts.body,
    color: TextColor.secondary,
  } satisfies TextStyle,

  /** Avatar initials — large (14/600/DM Sans) */
  initialsLarge: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    fontFamily: Fonts.body,
    color: TextColor.secondary,
  } satisfies TextStyle,

  // ── Form styles ──────────────────────────────────────────

  /** Form field label (14/500/DM Sans) */
  formLabel: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.medium,
    fontFamily: Fonts.body,
    color: TextColor.secondary,
  } satisfies TextStyle,

  /** Form input value (16/400/DM Sans) */
  formValue: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.normal,
    fontFamily: Fonts.body,
    color: TextColor.primary,
  } satisfies TextStyle,

  /** Form helper text (12/400/DM Sans) */
  formHelper: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.normal,
    fontFamily: Fonts.body,
    color: TextColor.tertiary,
  } satisfies TextStyle,

  /** Form error text (12/400/DM Sans) */
  formError: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.normal,
    fontFamily: Fonts.body,
    color: SemanticColor.error,
  } satisfies TextStyle,

  // ── Button styles ────────────────────────────────────────

  /** Primary button text (14/600/DM Sans) */
  buttonPrimary: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    fontFamily: Fonts.body,
    color: TextColor.inverse,
  } satisfies TextStyle,

  /** Secondary button text (14/600/DM Sans) */
  buttonSecondary: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    fontFamily: Fonts.body,
    color: TextColor.secondary,
  } satisfies TextStyle,

  /** Small action button text (13/600/DM Sans) */
  buttonAction: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    fontFamily: Fonts.body,
  } satisfies TextStyle,

  /** Inline link text (14/500/DM Sans) */
  link: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.medium,
    fontFamily: Fonts.body,
    color: SemanticColor.link,
  } satisfies TextStyle,

  // ── Empty / placeholder styles ───────────────────────────

  /** Empty state message (13/400/DM Sans, italic) */
  empty: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.normal,
    fontFamily: Fonts.body,
    color: TextColor.quaternary,
    fontStyle: 'italic' as const,
  } satisfies TextStyle,

  /** Quantity / secondary count (12/400/DM Sans) */
  quantity: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.normal,
    fontFamily: Fonts.body,
    color: TextColor.tertiary,
  } satisfies TextStyle,

  // ── Financial styles ─────────────────────────────────────

  /** Large amount display (20/700/Syne) */
  amount: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.bold,
    fontFamily: Fonts.heading,
    color: TextColor.primary,
  } satisfies TextStyle,

  /** Card-level amount (16/600/DM Sans) */
  amountCard: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semibold,
    fontFamily: Fonts.body,
    color: TextColor.primary,
  } satisfies TextStyle,

  /** Currency label (11/500/DM Sans) */
  currency: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    fontFamily: Fonts.body,
    color: TextColor.tertiary,
  } satisfies TextStyle,

  // ── Display styles ───────────────────────────────────────

  /** Page display heading (28/800/Syne) */
  display: {
    fontSize: 28,
    fontWeight: FontWeight.extrabold,
    fontFamily: Fonts.heading,
    color: TextColor.primary,
  } satisfies TextStyle,
} as const;
