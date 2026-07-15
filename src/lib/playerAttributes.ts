// F001: self-declared player attributes (skill level + play goals) shown on
// profiles and friend lists, and captured during onboarding. The vocabulary
// mirrors the CHECK constraints in migration 104; the i18n key helpers resolve
// the display labels (keys live in all 8 locales).

export const SKILL_LEVELS = ['new', 'casual', 'club', 'competitive'] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

export const PLAY_GOALS = [
  'casual_rallies',
  'competitive_matches',
  'training_partner',
  'doubles',
] as const;
export type PlayGoal = (typeof PLAY_GOALS)[number];

/** i18n key for a skill level, e.g. `skillLevel_club`. */
export const skillLevelKey = (value: SkillLevel) => `skillLevel_${value}` as const;
/** i18n key for a play goal, e.g. `playGoal_doubles`. */
export const playGoalKey = (value: PlayGoal) => `playGoal_${value}` as const;

export function isSkillLevel(value: unknown): value is SkillLevel {
  return typeof value === 'string' && (SKILL_LEVELS as readonly string[]).includes(value);
}

/** Keep only recognized goals, in canonical order — defends against stale/garbage input. */
export function sanitizePlayGoals(values: readonly string[] | null | undefined): PlayGoal[] {
  if (!values || values.length === 0) return [];
  const set = new Set(values);
  return PLAY_GOALS.filter((goal) => set.has(goal));
}
