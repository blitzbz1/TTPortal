// F030: read-only chip showing a player's competitive rating (Elo). Mirrors
// SkillChip. Renders nothing when rating is unset (unrated player). Shows a
// "Provisional" hint while the player has fewer than 10 rated matches.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Lucide } from './Icon';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../hooks/useI18n';
import { Fonts, FontSize, FontWeight } from '../theme';

interface Props {
  rating: number | null | undefined;
  provisional?: boolean;
}

export function RatingChip({ rating, provisional }: Props) {
  const { colors } = useTheme();
  const { s } = useI18n();
  if (rating == null) return null; // `== null` so a low rating still renders
  return (
    <View style={[styles.chip, { backgroundColor: colors.amberPale }]} testID={`rating-chip-${Math.round(rating)}`}>
      <Lucide name="trending-up" size={12} color={colors.accent} />
      <Text style={[styles.text, { color: colors.accent }]} numberOfLines={1}>
        {s('ratingChip', String(Math.round(rating)))}{provisional ? ` · ${s('ratingProvisional')}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8 },
  text: { fontFamily: Fonts.body, fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
});

