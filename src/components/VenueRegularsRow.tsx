// F014: a venue's opt-in Regulars — count + avatar row. Tapping an avatar
// opens that player's profile. Hidden when there are no opted-in regulars.
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Lucide } from './Icon';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../hooks/useI18n';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing } from '../theme';
import type { VenueRegulars } from '../features/venueIntel';

export function VenueRegularsRow({ regulars }: { regulars: VenueRegulars | null | undefined }) {
  const { colors } = useTheme();
  const { s } = useI18n();
  const router = useRouter();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!regulars || !regulars.count || regulars.count <= 0) return null;
  const avatars = Array.isArray(regulars.regulars) ? regulars.regulars : [];

  return (
    <View style={styles.section} testID="venue-regulars">
      <View style={styles.titleRow}>
        <Lucide name="users" size={14} color={colors.purple} />
        <Text style={styles.title}>{`${s('venueRegularsTitle')} · ${regulars.count}`}</Text>
      </View>
      <View style={styles.avatarRow}>
        {avatars.map((r) => {
          const name = r.full_name || '?';
          return (
            <TouchableOpacity
              key={r.user_id}
              style={styles.regular}
              onPress={() => router.push({ pathname: '/(protected)/player/[userId]', params: { userId: r.user_id } })}
              accessibilityRole="button"
              accessibilityLabel={name}
              testID={`regular-${r.user_id}`}
            >
              <View style={styles.avatar}>
                <Text style={styles.initials}>{name.charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={styles.name} numberOfLines={1}>{name.split(' ')[0]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    section: { backgroundColor: colors.purplePale, padding: Spacing.md, gap: 10 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    title: { fontFamily: Fonts.body, fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: colors.purple },
    avatarRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
    regular: { alignItems: 'center', width: 52, gap: 3 },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.purpleMid,
      alignItems: 'center',
      justifyContent: 'center',
    },
    initials: { fontFamily: Fonts.body, fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: colors.textOnPrimary },
    name: { fontFamily: Fonts.body, fontSize: FontSize.xs, color: colors.textMuted, textAlign: 'center' },
  });
}
