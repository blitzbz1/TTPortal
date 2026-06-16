// F063: a venue's approved coaches — count + avatar row. Tapping an avatar opens
// that coach's player profile (where the pinned coach card lives). Hidden when
// there are no approved coaches at this venue. Clones VenueRegularsRow.
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Lucide } from './Icon';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../hooks/useI18n';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing } from '../theme';
import type { VenueCoach } from '../features/coaches';

export function VenueCoachesRow({ coaches }: { coaches: VenueCoach[] | null | undefined }) {
  const { colors } = useTheme();
  const { s } = useI18n();
  const router = useRouter();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const list = Array.isArray(coaches) ? coaches : [];
  if (list.length === 0) return null;

  return (
    <View style={styles.section} testID="venue-coaches">
      <View style={styles.titleRow}>
        <Lucide name="graduation-cap" size={14} color={colors.blue} />
        <Text style={styles.title}>{`${s('venueCoachesTitle')} · ${list.length}`}</Text>
      </View>
      <View style={styles.avatarRow}>
        {list.map((c) => {
          const name = c.full_name || '?';
          return (
            <TouchableOpacity
              key={c.user_id}
              style={styles.coach}
              onPress={() => router.push({ pathname: '/(protected)/player/[userId]', params: { userId: c.user_id } })}
              accessibilityRole="button"
              accessibilityLabel={name}
              testID={`coach-${c.user_id}`}
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
    section: { backgroundColor: colors.bluePale, padding: Spacing.md, gap: 10 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    title: { fontFamily: Fonts.body, fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: colors.blue },
    avatarRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
    coach: { alignItems: 'center', width: 52, gap: 3 },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.blue,
      alignItems: 'center',
      justifyContent: 'center',
    },
    initials: { fontFamily: Fonts.body, fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: colors.textOnPrimary },
    name: { fontFamily: Fonts.body, fontSize: FontSize.xs, color: colors.textMuted, textAlign: 'center' },
  });
}
