// F014: a venue's opt-in Regulars — an overlapping avatar stack + count, as a
// unified "People here" row (matches the venue redesign .prow). Tapping an
// avatar opens that player's profile. Hidden when there are no opted-in regulars.
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../hooks/useI18n';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing } from '../theme';
import type { VenueRegulars } from '../features/venueIntel';

const MAX_AVATARS = 5;

export function VenueRegularsRow({ regulars }: { regulars: VenueRegulars | null | undefined }) {
  const { colors } = useTheme();
  const { s } = useI18n();
  const router = useRouter();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!regulars || !regulars.count || regulars.count <= 0) return null;
  const avatars = (Array.isArray(regulars.regulars) ? regulars.regulars : []).slice(0, MAX_AVATARS);
  const overflow = regulars.count - avatars.length;

  return (
    <View style={styles.prow} testID="venue-regulars">
      <View style={styles.stack}>
        {avatars.map((r, i) => {
          const name = r.full_name || '?';
          return (
            <TouchableOpacity
              key={r.user_id}
              style={i > 0 ? styles.overlap : undefined}
              onPress={() => router.push({ pathname: '/(protected)/player/[userId]', params: { userId: r.user_id } })}
              accessibilityRole="button"
              accessibilityLabel={name}
              testID={`regular-${r.user_id}`}
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
      <Text style={styles.title} numberOfLines={1}>{`${s('venueRegularsTitle')} · ${regulars.count}`}</Text>
      <View style={styles.tag}><Text style={styles.tagText}>{s('venueRegularsTitle')}</Text></View>
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
      width: 36, height: 36, borderRadius: 18, backgroundColor: colors.purpleMid,
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
      backgroundColor: colors.purplePale, borderWidth: 1, borderColor: colors.purpleDim,
    },
    tagText: { fontFamily: Fonts.body, fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: colors.purple },
  });
}
