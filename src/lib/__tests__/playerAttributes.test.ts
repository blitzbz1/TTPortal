import {
  SKILL_LEVELS,
  PLAY_GOALS,
  isSkillLevel,
  sanitizePlayGoals,
  skillLevelKey,
  playGoalKey,
} from '../playerAttributes';

describe('playerAttributes (F001)', () => {
  it('isSkillLevel accepts valid levels and rejects everything else', () => {
    SKILL_LEVELS.forEach((level) => expect(isSkillLevel(level)).toBe(true));
    expect(isSkillLevel('pro')).toBe(false);
    expect(isSkillLevel(null)).toBe(false);
    expect(isSkillLevel(undefined)).toBe(false);
    expect(isSkillLevel(3)).toBe(false);
  });

  it('sanitizePlayGoals keeps only known goals, in canonical order, de-duped', () => {
    expect(sanitizePlayGoals(['doubles', 'bogus', 'casual_rallies'])).toEqual([
      'casual_rallies',
      'doubles',
    ]);
    expect(sanitizePlayGoals(['doubles', 'doubles'])).toEqual(['doubles']);
    expect(sanitizePlayGoals([])).toEqual([]);
    expect(sanitizePlayGoals(null)).toEqual([]);
    expect(sanitizePlayGoals(undefined)).toEqual([]);
  });

  it('key helpers build the i18n keys', () => {
    expect(skillLevelKey('competitive')).toBe('skillLevel_competitive');
    expect(playGoalKey('training_partner')).toBe('playGoal_training_partner');
  });

  it('vocabulary matches the migration 104 CHECK constraints', () => {
    // If these drift, migration 104's CHECK and the client fall out of sync.
    expect([...SKILL_LEVELS]).toEqual(['new', 'casual', 'club', 'competitive']);
    expect([...PLAY_GOALS]).toEqual([
      'casual_rallies',
      'competitive_matches',
      'training_partner',
      'doubles',
    ]);
  });
});
