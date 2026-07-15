// F001: a small read-only chip showing a player's self-declared skill level.
// Renders nothing when the level is unset. Reused on profiles and friend rows.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Lucide } from './Icon';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../hooks/useI18n';
import { Fonts, FontSize, FontWeight } from '../theme';
import { skillLevelKey, type SkillLevel } from '../lib/playerAttributes';

export function SkillChip({ skillLevel }: { skillLevel: SkillLevel | null | undefined }) {
  const { colors } = useTheme();
  const { s } = useI18n();
  if (!skillLevel) return null;
  return (
    <View
      style={[styles.chip, { backgroundColor: colors.primaryPale }]}
      testID={`skill-chip-${skillLevel}`}
    >
      <Lucide name="gauge" size={12} color={colors.primary} />
      <Text style={[styles.text, { color: colors.primary }]} numberOfLines={1}>
        {s(skillLevelKey(skillLevel))}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  text: {
    fontFamily: Fonts.body,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
});
