// F030/F033: a brand-styled card rendered on-screen and captured to a PNG via
// react-native-view-shot (the only capture dep installed — no expo-sharing/
// file-system). The parent owns the ref + capture/share through RN's Share.
import React, { forwardRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Lucide } from './Icon';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Radius, Shadows, Spacing } from '../theme';

export interface ShareCardStat {
  label: string;
  value: string | number;
}

export interface ShareCardProps {
  title: string;
  headline: string;
  subtitle?: string;
  stats?: ShareCardStat[];
  icon?: string;
}

// forwardRef<View> so the parent can captureRef(cardRef).
export const ShareCard = forwardRef<View, ShareCardProps>(function ShareCard(
  { title, headline, subtitle, stats, icon = 'trophy' },
  ref,
) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  return (
    // collapsable={false} is REQUIRED on Android or view-shot captures blank.
    <View ref={ref} collapsable={false} style={styles.card}>
      <View style={styles.brandRow}>
        <Lucide name="circle-dot" size={16} color={colors.primary} />
        <Text style={styles.brand}>TTPortal</Text>
      </View>
      <View style={styles.headlineWrap}>
        <Lucide name={icon} size={26} color={colors.accent} />
        <Text style={styles.headline}>{headline}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {stats && stats.length > 0 ? (
        <View style={styles.stats}>
          {stats.map((st) => (
            <View key={st.label} style={styles.stat}>
              <Text style={styles.statValue}>{st.value}</Text>
              <Text style={styles.statLabel}>{st.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
});

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      width: 320,
      padding: Spacing.xl,
      borderRadius: Radius.xl,
      backgroundColor: colors.bgAlt,
      borderWidth: 1,
      borderColor: colors.primaryDim,
      gap: Spacing.sm,
      ...Shadows.md,
    },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    brand: { fontFamily: Fonts.body, fontSize: FontSize.md, fontWeight: FontWeight.bold, color: colors.primary },
    headlineWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
    headline: { fontFamily: Fonts.heading, fontSize: 48, fontWeight: FontWeight.bold, color: colors.text },
    title: { fontFamily: Fonts.heading, fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: colors.text },
    subtitle: { fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.textMuted },
    stats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.sm },
    stat: { alignItems: 'center', flex: 1 },
    statValue: { fontFamily: Fonts.heading, fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: colors.text },
    statLabel: { fontFamily: Fonts.body, fontSize: FontSize.sm, color: colors.textFaint },
  });
}
