import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { NotificationBellButton } from '../components/NotificationBellButton';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius, Shadows } from '../theme';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import { getProfile } from '../services/profiles';
import { getCurrentEquipmentForUser } from '../services/equipment';
import type { DominantHand, EquipmentSelection, Grip, PlayingStyle, Profile } from '../types/database';
import { ProfileSkeleton } from '../components/SkeletonLoader';
import { ErrorState } from '../components/ErrorState';
import { useBadgeProgress } from '../features/challenges';



interface ProfileScreenProps {
  hideTabBar?: boolean;
}

type Translate = (key: string, ...args: string[]) => string;

function dominantHandLabel(value: DominantHand, translate: Translate) {
  return value === 'right' ? translate('equipmentHandRight') : translate('equipmentHandLeft');
}

function playingStyleLabel(value: PlayingStyle, translate: Translate) {
  if (value === 'attacker') return translate('equipmentStyleAttacker');
  if (value === 'defender') return translate('equipmentStyleDefender');
  return translate('equipmentStyleAllRounder');
}

function gripLabel(value: Grip, translate: Translate) {
  if (value === 'shakehand') return translate('equipmentGripShakehand');
  if (value === 'penhold') return translate('equipmentGripPenhold');
  return translate('equipmentGripOther');
}

function playingStyleIcon(value: PlayingStyle) {
  if (value === 'attacker') return 'swords';
  if (value === 'defender') return 'shield';
  return null;
}

function gripIcon(value: Grip) {
  if (value === 'shakehand') return 'handshake';
  if (value === 'penhold') return 'pen';
  return 'circle-dot';
}

export function ProfileScreen({ hideTabBar = false }: ProfileScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useSession();
  const { s } = useI18n();
  const { colors, isDark } = useTheme();
  const headerFg = isDark ? colors.text : colors.textOnPrimary;
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentEquipment, setCurrentEquipment] = useState<EquipmentSelection | null>(null);
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [profileError, setProfileError] = useState(false);
  const {
    progressRows,
  } = useBadgeProgress(user?.id);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setProfileError(false);

    try {
      const profileRes = await getProfile(user.id);
      if (profileRes.data) {
        setProfile(profileRes.data as Profile);
      }
      try {
        const equipmentRes = typeof getCurrentEquipmentForUser === 'function'
          ? await getCurrentEquipmentForUser(user.id)
          : { data: null };
        setCurrentEquipment(equipmentRes.data?.[0] ?? null);
      } catch {
        setCurrentEquipment(null);
      }
    } catch {
      setProfileError(true);
    } finally {
      setLoading(false);
      setDataLoaded(true);
    }
  }, [user]);

  useEffect(() => {
    if (!user || dataLoaded) return;
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, dataLoaded]);

  const fullName = user?.user_metadata?.full_name || profile?.full_name || '';
  const nameParts = fullName.trim().split(/\s+/);
  const initials = nameParts.length >= 2
    ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
    : (nameParts[0]?.[0] || '?').toUpperCase();

  const username = profile?.username ? `@${profile.username}` : '';
  const city = profile?.city || '';
  const usernameDisplay = [username, city].filter(Boolean).join(' \u00B7 ');
  const completedChallengeCount = useMemo(
    () => progressRows.reduce((total, row) => total + row.approved_count, 0),
    [progressRows],
  );

  const handleLogout = useCallback(async () => {
    if (Platform.OS === 'web') {
      if (!window.confirm(s('confirmLogout'))) return;
      await signOut();
      router.replace('/sign-in' as any);
    } else {
      Alert.alert(s('logout'), s('confirmLogout'), [
        { text: s('cancel'), style: 'cancel' },
        { text: s('logout'), style: 'destructive', onPress: async () => {
          await signOut();
          router.replace('/sign-in' as any);
        }},
      ]);
    }
  }, [signOut, router, s]);

  if (loading && !dataLoaded) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <Text style={styles.headerTitle}>{s('myProfile')}</Text>
          <View style={{ width: 26 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ProfileSkeleton />
        </View>
      </View>
    );
  }

  if (profileError && !profile) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <Text style={styles.headerTitle}>{s('myProfile')}</Text>
          <View style={{ width: 26 }} />
        </View>
        <ErrorState
          title={s('profileLoadError')}
          description={s('profileLoadErrorDesc')}
          ctaLabel={s('retry')}
          onRetry={loadProfile}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Text style={styles.headerTitle}>{s('myProfile')}</Text>
        <NotificationBellButton color={headerFg} />
      </View>

      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadProfile} colors={[colors.primary]} tintColor={colors.primary} />}
      >
        <View style={styles.profileSummaryCard}>
          <View style={styles.identityHeaderRow}>
            <View style={styles.identityHeaderIcon}>
              <Text style={styles.identityHeaderIconText}>{initials}</Text>
            </View>
            <View style={styles.identityHeaderCopy}>
              <Text style={styles.eyebrow}>{s('profilePlayerIdentity')}</Text>
              <Text style={styles.summaryName}>{fullName || s('user')}</Text>
              {usernameDisplay ? <Text style={styles.summaryHandle}>{usernameDisplay}</Text> : null}
            </View>
            <TouchableOpacity
              testID="profile-challenges-pill"
              style={styles.identityBadgePill}
              onPress={() => router.push({ pathname: '/(tabs)/challenges', params: { tab: 'badges' } } as any)}
              activeOpacity={0.84}
            >
              <Text style={styles.identityBadgePillValue}>{completedChallengeCount}</Text>
              <View style={styles.identityBadgePillLabelRow}>
                <Text style={styles.identityBadgePillLabel}>{s('profileChallengesCompleted')}</Text>
                <Lucide name="chevron-right" size={12} color={colors.primary} />
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.identityDetailGrid}>
            <View style={styles.identityPanel}>
              <View style={styles.equipmentCardHeader}>
                <Text style={styles.panelTitle}>{s('profileEquipmentSetup')}</Text>
                <TouchableOpacity onPress={() => router.push('/(protected)/equipment' as any)} hitSlop={8}>
                  <Text style={styles.equipmentEditText}>{s('edit')}</Text>
                </TouchableOpacity>
              </View>
              {currentEquipment ? (
                <View style={styles.profileEquipmentCard}>
                  <View style={styles.equipmentMetaRow}>
                    <View style={styles.equipmentMetaPill}>
                      <Lucide name="hand" size={13} color={colors.primaryMid} />
                      <Text style={styles.equipmentMetaText}>{dominantHandLabel(currentEquipment.dominant_hand, s)}</Text>
                    </View>
                    <View style={styles.equipmentMetaPill}>
                      {playingStyleIcon(currentEquipment.playing_style) ? (
                        <Lucide name={playingStyleIcon(currentEquipment.playing_style) as string} size={13} color={colors.primaryMid} />
                      ) : (
                        <Text style={styles.equipmentMetaTextIcon}>A+</Text>
                      )}
                      <Text style={styles.equipmentMetaText}>{playingStyleLabel(currentEquipment.playing_style, s)}</Text>
                    </View>
                    <View style={styles.equipmentMetaPill}>
                      <Lucide name={gripIcon(currentEquipment.grip)} size={13} color={colors.primaryMid} />
                      <Text style={styles.equipmentMetaText}>{gripLabel(currentEquipment.grip, s)}</Text>
                    </View>
                  </View>
                  <View style={styles.equipmentBladeRow}>
                    <View style={styles.equipmentBladeIcon}>
                      <Lucide name="scan-line" size={16} color={colors.primary} />
                    </View>
                    <View style={styles.equipmentCopy}>
                      <Text style={styles.equipmentLabel}>{s('equipmentBlade')}</Text>
                      <Text style={styles.equipmentValue} numberOfLines={2}>
                        {currentEquipment.blade_manufacturer} {currentEquipment.blade_model}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.equipmentRubberGrid}>
                    <View style={styles.equipmentRubberTile}>
                      <Text style={styles.equipmentLabel}>{s('equipmentForehand')}</Text>
                      <Text style={styles.equipmentValue} numberOfLines={2}>
                        {currentEquipment.forehand_rubber_manufacturer} {currentEquipment.forehand_rubber_model}
                      </Text>
                    </View>
                    <View style={styles.equipmentRubberTile}>
                      <Text style={styles.equipmentLabel}>{s('equipmentBackhand')}</Text>
                      <Text style={styles.equipmentValue} numberOfLines={2}>
                        {currentEquipment.backhand_rubber_manufacturer} {currentEquipment.backhand_rubber_model}
                      </Text>
                    </View>
                  </View>
                </View>
              ) : (
                <TouchableOpacity style={styles.emptyEquipmentCard} onPress={() => router.push('/(protected)/equipment' as any)}>
                  <Lucide name="circle-dot" size={22} color={colors.textFaint} />
                  <Text style={styles.identityHint}>{s('profileEquipmentEmpty')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Navigation Links */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.navRow} onPress={() => router.push('/(protected)/friends' as any)}>
            <View style={[styles.navIcon, { backgroundColor: colors.primaryPale }]}>
              <Lucide name="users" size={18} color={colors.primaryMid} />
            </View>
            <Text style={styles.navLabel}>{s('friends')}</Text>
            <Lucide name="chevron-right" size={16} color={colors.textFaint} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navRow} onPress={() => router.push('/(protected)/play-history' as any)}>
            <View style={[styles.navIcon, { backgroundColor: colors.purplePale }]}>
              <Lucide name="trophy" size={18} color={colors.purple} />
            </View>
            <Text style={styles.navLabel}>{s('playHistory')}</Text>
            <Lucide name="chevron-right" size={16} color={colors.textFaint} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navRow} onPress={() => router.push('/(protected)/favorites' as any)}>
            <View style={[styles.navIcon, { backgroundColor: colors.redPale }]}>
              <Lucide name="heart" size={18} color={colors.red} />
            </View>
            <Text style={styles.navLabel}>{s('favorites')}</Text>
            <Lucide name="chevron-right" size={16} color={colors.textFaint} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navRow} onPress={() => router.push('/(protected)/leaderboard' as any)}>
            <View style={[styles.navIcon, { backgroundColor: colors.amberPale }]}>
              <Lucide name="bar-chart-3" size={18} color={colors.accent} />
            </View>
            <Text style={styles.navLabel}>{s('leaderboard')}</Text>
            <Lucide name="chevron-right" size={16} color={colors.textFaint} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navRow} onPress={() => router.push('/(protected)/settings' as any)}>
            <View style={[styles.navIcon, { backgroundColor: colors.bgMuted }]}>
              <Lucide name="settings" size={18} color={colors.textMuted} />
            </View>
            <Text style={styles.navLabel}>{s('settings')}</Text>
            <Lucide name="chevron-right" size={16} color={colors.textFaint} />
          </TouchableOpacity>

          {profile?.is_admin && (
            <TouchableOpacity style={styles.navRow} onPress={() => router.push('/(protected)/admin' as any)}>
              <View style={[styles.navIcon, { backgroundColor: colors.primaryPale }]}>
                <Lucide name="shield-check" size={18} color={colors.primaryMid} />
              </View>
              <Text style={styles.navLabel}>{s('moderation')}</Text>
              <View style={styles.adminPill}>
                <Text style={styles.adminPillText}>{s('admin')}</Text>
              </View>
              <Lucide name="chevron-right" size={16} color={colors.textFaint} />
            </TouchableOpacity>
          )}
        </View>

        {/* Logout */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutRow} onPress={handleLogout}>
            <Lucide name="log-out" size={18} color={colors.red} />
            <Text style={styles.logoutText}>{s('logout')}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDark ? colors.bgAlt : colors.primary,
      paddingVertical: 10,
      minHeight: 52,
      paddingHorizontal: Spacing.md,
      ...Shadows.bar,
    },
    headerTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      color: isDark ? colors.text : colors.textOnPrimary,
    },
    scroll: {
      flex: 1,
    },

    /* ── Hero ── */
    profileSummaryCard: {
      marginHorizontal: Spacing.md,
      marginTop: Spacing.md,
      borderRadius: Radius.md,
      backgroundColor: isDark ? colors.bgAlt : colors.bg,
      borderWidth: 1,
      borderColor: colors.borderLight,
      padding: Spacing.md,
      gap: Spacing.md,
      ...Shadows.md,
    },
    identityHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    identityHeaderIcon: {
      width: 44,
      height: 44,
      borderRadius: Radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      ...Shadows.sm,
    },
    identityHeaderIconText: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xl,
      fontWeight: FontWeight.bold,
      color: colors.textOnPrimary,
    },
    identityHeaderCopy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    summaryName: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    summaryHandle: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.textMuted,
    },
    identityBadgePill: {
      minWidth: 64,
      alignItems: 'center',
      borderRadius: Radius.sm,
      backgroundColor: colors.primaryPale,
      borderWidth: 1,
      borderColor: isDark ? colors.primaryMid : colors.borderLight,
      paddingVertical: 7,
      paddingHorizontal: 8,
    },
    identityBadgePillValue: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xl,
      fontWeight: FontWeight.bold,
      color: colors.primary,
      lineHeight: 22,
    },
    identityBadgePillLabel: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.bold,
      color: colors.textMuted,
      textAlign: 'center',
    },
    identityBadgePillLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    identityDetailGrid: {
      gap: Spacing.sm,
    },
    identityPanel: {
      borderRadius: Radius.sm,
      backgroundColor: colors.bgMuted,
      borderWidth: 1,
      borderColor: colors.borderLight,
      padding: Spacing.sm,
      gap: Spacing.xs,
    },
    panelTitle: {
      flex: 1,
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    equipmentCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.xs,
    },
    equipmentEditText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.bold,
      color: colors.primary,
    },
    profileEquipmentCard: {
      gap: Spacing.xs,
      borderRadius: Radius.sm,
      backgroundColor: 'transparent',
    },
    equipmentMetaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    equipmentMetaPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: Radius.sm,
      backgroundColor: colors.bgAlt,
      paddingVertical: 5,
      paddingHorizontal: 7,
    },
    equipmentMetaText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    equipmentMetaTextIcon: {
      fontFamily: Fonts.heading,
      fontSize: 11,
      fontWeight: FontWeight.bold,
      color: colors.primaryMid,
      lineHeight: 13,
    },
    equipmentBladeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      borderRadius: Radius.sm,
      backgroundColor: colors.bgAlt,
      padding: Spacing.xs,
    },
    equipmentBladeIcon: {
      width: 32,
      height: 32,
      borderRadius: Radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryPale,
    },
    equipmentCopy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    equipmentLabel: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.bold,
      color: colors.textFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    equipmentValue: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.bold,
      color: colors.text,
      lineHeight: 15,
    },
    equipmentRubberGrid: {
      flexDirection: 'row',
      gap: Spacing.xs,
    },
    equipmentRubberTile: {
      flex: 1,
      minWidth: 0,
      gap: 3,
      borderRadius: Radius.sm,
      backgroundColor: colors.bgAlt,
      padding: Spacing.xs,
    },
    emptyEquipmentCard: {
      minHeight: 120,
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.bgMuted,
      padding: Spacing.sm,
    },
    identityCard: {
      marginHorizontal: Spacing.md,
      borderRadius: Radius.md,
      backgroundColor: colors.bgAlt,
      borderWidth: 1,
      borderColor: colors.borderLight,
      padding: Spacing.md,
      gap: Spacing.sm,
      ...Shadows.md,
    },
    identityTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    identityIcon: {
      width: 52,
      height: 52,
      borderRadius: Radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      ...Shadows.sm,
    },
    identityCopy: {
      flex: 1,
      gap: 2,
    },
    eyebrow: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.bold,
      color: colors.textFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    identityTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    identityMeta: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.textMuted,
    },
    levelPill: {
      borderRadius: Radius.sm,
      paddingHorizontal: 8,
      paddingVertical: 5,
    },
    levelPillText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.bold,
    },
    progressTrack: {
      height: 9,
      borderRadius: 5,
      backgroundColor: colors.bgMuted,
      overflow: 'hidden',
    },
    progressFill: {
      height: 9,
      borderRadius: 5,
    },
    identityStats: {
      flexDirection: 'row',
      gap: Spacing.xs,
    },
    identityStat: {
      flex: 1,
      borderRadius: Radius.sm,
      backgroundColor: colors.bgMuted,
      padding: Spacing.sm,
      gap: 2,
    },
    identityStatValue: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    identityStatLabel: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.semibold,
      color: colors.textFaint,
    },
    latestBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: Radius.sm,
      backgroundColor: colors.bgMuted,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 9,
    },
    latestBadgeText: {
      flex: 1,
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
      color: colors.text,
    },
    identityHint: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.textMuted,
      lineHeight: 18,
    },
    identityCta: {
      minHeight: 46,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: Radius.sm,
      backgroundColor: colors.primary,
      paddingHorizontal: Spacing.md,
      ...Shadows.sm,
    },
    identityCtaText: {
      flexShrink: 1,
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.bold,
      color: colors.textOnPrimary,
      textAlign: 'center',
    },
    statsRow: {
      flexDirection: 'row',
      gap: Spacing.xs,
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.md,
    },
    statCard: {
      flex: 1,
      borderRadius: Radius.md,
      backgroundColor: colors.bgAlt,
      borderWidth: 1,
      borderColor: colors.borderLight,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.xs,
      alignItems: 'center',
      gap: 3,
    },
    statValue: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    statLabel: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.semibold,
      color: colors.textFaint,
      textAlign: 'center',
    },

    /* ── Sections ── */
    section: {
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.lg,
      gap: 10,
    },
    sectionTitle: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },

    /* ── Nav Links ── */
    navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.sm,
      gap: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    navIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    navLabel: {
      flex: 1,
      fontFamily: Fonts.body,
      fontSize: 15,
      fontWeight: FontWeight.medium,
      color: colors.text,
    },
    adminPill: {
      backgroundColor: colors.primaryPale,
      borderRadius: 8,
      paddingVertical: 2,
      paddingHorizontal: 6,
      marginRight: 4,
    },
    adminPillText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.bold,
      color: colors.primaryMid,
    },

    /* ── Logout ── */
    logoutRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      gap: Spacing.xs,
      backgroundColor: colors.redPale,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.redBorder,
    },
    logoutText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.medium,
      color: colors.red,
    },
  });
}
