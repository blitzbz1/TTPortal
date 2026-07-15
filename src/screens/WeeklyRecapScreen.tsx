// F052: "Your week in TT" — a one-screen weekly recap reachable from the Monday
// recap push (deep-links to /recap) or directly. Renders sessions, hours,
// venues (with a new-venue callout), friends played with, rank (+ delta) and
// the current play streak, ending in a "Share my week" button that captures an
// off-screen <ShareCard> via shareCardImage (the LeaderboardsScreen pattern).
import React, { useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { ShareCard } from '../components/ShareCard';
import { shareCardImage } from '../lib/shareImage';
import { EmptyState } from '../components/EmptyState';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius, Shadows } from '../theme';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import { useWeeklyRecapQuery, lastWeekStartIso } from '../features/recap';

interface WeeklyRecapScreenProps {
  /** Optional ISO week-start (YYYY-MM-DD). Defaults to the week that just ended. */
  weekStart?: string;
}

export function WeeklyRecapScreen({ weekStart }: WeeklyRecapScreenProps) {
  const router = useRouter();
  const { user } = useSession();
  const { s } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const cardRef = useRef<View>(null);

  // Default to the just-ended week (the recap the Monday push points at).
  const week = weekStart ?? lastWeekStartIso();
  const { data: recap, isLoading } = useWeeklyRecapQuery(user?.id, week);

  const hasPlayed = !!recap && (recap.sessions > 0 || recap.hours > 0);

  // Whole-number hours read cleaner; keep one decimal only when fractional.
  const hoursLabel = recap
    ? Number.isInteger(recap.hours)
      ? String(recap.hours)
      : recap.hours.toFixed(1)
    : '0';

  const shareStats = recap
    ? [
        { label: s('recapSessions'), value: recap.sessions },
        { label: s('recapHours'), value: hoursLabel },
        { label: s('recapVenues'), value: recap.venues },
      ]
    : [];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          testID="recap-back"
        >
          <Lucide name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{s('recapTitle')}</Text>
        <View style={{ width: 22 }} />
      </View>

      {isLoading && !recap ? (
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>{s('loading')}</Text>
        </View>
      ) : !hasPlayed ? (
        <EmptyState
          icon="calendar"
          title={s('recapEmptyTitle')}
          description={s('recapEmptyDesc')}
          iconColor={colors.accent}
          iconBg={colors.amberPale}
        />
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.hero}>
            <Lucide name="sparkles" size={20} color={colors.accent} />
            <Text style={styles.heroTitle}>{s('recapHeroTitle')}</Text>
            <Text style={styles.heroSubtitle}>{s('recapHeroSubtitle')}</Text>
          </View>

          <View style={styles.statGrid}>
            <View style={styles.statCard} testID="recap-stat-sessions">
              <Lucide name="circle-dot" size={18} color={colors.primary} />
              <Text style={styles.statValue}>{recap!.sessions}</Text>
              <Text style={styles.statLabel}>{s('recapSessions')}</Text>
            </View>
            <View style={styles.statCard} testID="recap-stat-hours">
              <Lucide name="clock" size={18} color={colors.primaryMid} />
              <Text style={styles.statValue}>{hoursLabel}</Text>
              <Text style={styles.statLabel}>{s('recapHours')}</Text>
            </View>
            <View style={styles.statCard} testID="recap-stat-venues">
              <Lucide name="map-pin" size={18} color={colors.accent} />
              <Text style={styles.statValue}>{recap!.venues}</Text>
              <Text style={styles.statLabel}>{s('recapVenues')}</Text>
            </View>
            <View style={styles.statCard} testID="recap-stat-friends">
              <Lucide name="users" size={18} color={colors.primaryMid} />
              <Text style={styles.statValue}>{recap!.friends_played_with}</Text>
              <Text style={styles.statLabel}>{s('recapFriends')}</Text>
            </View>
          </View>

          {recap!.new_venues > 0 ? (
            <View style={styles.callout} testID="recap-new-venues">
              <Lucide name="sparkles" size={15} color={colors.primary} />
              <Text style={styles.calloutText}>
                {s('recapNewVenues', String(recap!.new_venues))}
              </Text>
            </View>
          ) : null}

          {recap!.rank != null ? (
            <View style={styles.row} testID="recap-rank">
              <View style={[styles.rowIcon, { backgroundColor: colors.amberPale }]}>
                <Lucide name="trophy" size={18} color={colors.accent} />
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.rowLabel}>{s('recapRank')}</Text>
                <Text style={styles.rowValue}>{`#${recap!.rank}`}</Text>
              </View>
              {recap!.rank_delta != null && recap!.rank_delta !== 0 ? (
                <View style={styles.deltaPill} testID="recap-rank-delta">
                  <Lucide
                    name={recap!.rank_delta > 0 ? 'trending-up' : 'trending-down'}
                    size={14}
                    color={recap!.rank_delta > 0 ? colors.greenDeep : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.deltaText,
                      { color: recap!.rank_delta > 0 ? colors.greenDeep : colors.textMuted },
                    ]}
                  >
                    {Math.abs(recap!.rank_delta)}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {recap!.current_streak > 0 ? (
            <View style={styles.row} testID="recap-streak">
              <View style={[styles.rowIcon, { backgroundColor: colors.amberPale }]}>
                <Lucide name="flame" size={18} color={colors.accent} />
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.rowLabel}>{s('recapStreak')}</Text>
                <Text style={styles.rowValue}>
                  {s('streakWeeks', String(recap!.current_streak))}
                </Text>
              </View>
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.shareBtn}
            onPress={() => shareCardImage(cardRef, s('recapShareMessage'))}
            accessibilityRole="button"
            testID="recap-share"
          >
            <Lucide name="share-2" size={16} color={colors.textOnPrimary} />
            <Text style={styles.shareText}>{s('recapShare')}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Off-screen recap card captured for sharing (must lay out → not display:none). */}
      {hasPlayed ? (
        <View style={{ position: 'absolute', top: -10000, left: 0 }} pointerEvents="none">
          <ShareCard
            ref={cardRef}
            icon="sparkles"
            headline={String(recap!.sessions)}
            title={s('recapShareCardTitle')}
            subtitle={s('recapShareCardSubtitle', hoursLabel, String(recap!.venues))}
            stats={shareStats}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.bgAlt,
      height: 52,
      paddingHorizontal: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      ...Shadows.bar,
    },
    headerTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xl,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    loadingText: { fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.textMuted },
    scroll: { flex: 1 },
    scrollContent: { padding: Spacing.md, gap: Spacing.md },
    hero: { alignItems: 'center', gap: 4, paddingVertical: Spacing.md },
    heroTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    heroSubtitle: { fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.textMuted },
    statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    statCard: {
      flexGrow: 1,
      flexBasis: '47%',
      alignItems: 'center',
      gap: 4,
      paddingVertical: Spacing.lg,
      backgroundColor: colors.bgAlt,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statValue: {
      fontFamily: Fonts.heading,
      fontSize: 28,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    statLabel: { fontFamily: Fonts.body, fontSize: FontSize.sm, color: colors.textFaint },
    callout: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      backgroundColor: colors.primaryPale,
      borderRadius: Radius.md,
    },
    calloutText: {
      flex: 1,
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
      color: colors.primary,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      backgroundColor: colors.bgAlt,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    rowIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    rowContent: { flex: 1 },
    rowLabel: { fontFamily: Fonts.body, fontSize: FontSize.sm, color: colors.textMuted },
    rowValue: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    deltaPill: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    deltaText: { fontFamily: Fonts.body, fontSize: FontSize.md, fontWeight: FontWeight.semibold },
    shareBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      marginTop: Spacing.sm,
      paddingVertical: Spacing.md,
      backgroundColor: colors.primary,
      borderRadius: Radius.lg,
      ...Shadows.sm,
    },
    shareText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.bold,
      color: colors.textOnPrimary,
    },
  });
}
