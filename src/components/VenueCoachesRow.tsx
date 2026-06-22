// F063: a venue's approved coaches — an overlapping avatar stack + count, as a
// unified "People here" row (matches the venue redesign .prow). Tapping an avatar
// opens that coach's player profile. Hidden when there are no approved coaches.
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../hooks/useI18n';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing } from '../theme';
import type { VenueCoach } from '../features/coaches';

const MAX_AVATARS = 5;

export function VenueCoachesRow({ coaches }: { coaches: VenueCoach[] | null | undefined }) {
  const { colors } = useTheme();
  const { s } = useI18n();
  const router = useRouter();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const list = Array.isArray(coaches) ? coaches : [];
  if (list.length === 0) return null;
  const avatars = list.slice(0, MAX_AVATARS);
  const overflow = list.length - avatars.length;

  return (
    <View style={styles.prow} testID="venue-coaches">
      <View style={styles.stack}>
        {avatars.map((c, i) => {
          const name = c.full_name || '?';
          return (
            <TouchableOpacity
              key={c.user_id}
              style={i > 0 ? styles.overlap : undefined}
              onPress={() => router.push({ pathname: '/(protected)/player/[userId]', params: { userId: c.user_id } })}
              accessibilityRole="button"
              accessibilityLabel={name}
              testID={`coach-${c.user_id}`}
            >
              <View style={styles.avatar}>
                <Text style={styles.initials}>{name.charAt(0).toUpperCase()}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
        {overflow > 0 ? (
          <View style={[styles.more, styles.overlap]}>
            <Text style={styles.moreText}>{`+${overflow}`}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.title} numberOfLines={1}>{`${s('venueCoachesTitle')} · ${list.length}`}</Text>
      <View style={styles.tag}><Text style={styles.tagText}>{s('venueCoachesTitle')}</Text></View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  const ring = { borderWidth: 2, borderColor: colors.bgAlt };
  return StyleSheet.create({
    prow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: Spacing.md },
    stack: { flexDirection: 'row', alignItems: 'center' },
    overlap: { marginLeft: -10 },
    avatar: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: colors.blue,
      alignItems: 'center', justifyContent: 'center', ...ring,
    },
    initials: { fontFamily: Fonts.body, fontSize: FontSize.md, fontWeight: FontWeight.bold, color: colors.textOnPrimary },
    more: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bgMuted,
      alignItems: 'center', justifyContent: 'center', ...ring,
    },
    moreText: { fontFamily: Fonts.body, fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: colors.textMuted },
    title: { flex: 1, fontFamily: Fonts.body, fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: colors.text },
    tag: {
      paddingVertical: 4, paddingHorizontal: 9, borderRadius: 8,
      backgroundColor: colors.bluePale, borderWidth: 1, borderColor: colors.blue,
    },
    tagText: { fontFamily: Fonts.body, fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: colors.blue },
  });
}
