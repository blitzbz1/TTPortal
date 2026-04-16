import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
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
import type { Profile } from '../types/database';
import { ProfileSkeleton } from '../components/SkeletonLoader';



interface ProfileScreenProps {
  hideTabBar?: boolean;
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
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [profileError, setProfileError] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setProfileError(false);

    try {
      const profileRes = await getProfile(user.id);
      if (profileRes.data) {
        setProfile(profileRes.data as Profile);
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

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <Text style={styles.headerTitle}>{s('myProfile')}</Text>
          <View style={{ width: 26 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {profileError ? (
            <>
              <Lucide name="alert-triangle" size={28} color={colors.textFaint} />
              <Text style={{ fontFamily: Fonts.body, fontSize: 14, color: colors.textFaint, marginTop: 12 }}>{s('profileLoadError')}</Text>
              <TouchableOpacity onPress={loadProfile} style={{ marginTop: 12 }}>
                <Text style={{ fontFamily: Fonts.body, fontSize: 13, fontWeight: '600', color: colors.primaryMid }}>{s('retry')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <ProfileSkeleton />
          )}
        </View>
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

      <ScrollView style={styles.scroll}>
        {/* Profile Hero — centered avatar, name, stats */}
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.name}>{fullName || s('user')}</Text>
          {usernameDisplay ? <Text style={styles.username}>{usernameDisplay}</Text> : null}
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
          <TouchableOpacity style={styles.navRow} onPress={() => router.push('/(protected)/equipment' as any)}>
            <View style={[styles.navIcon, { backgroundColor: colors.primaryPale }]}>
              <Lucide name="circle-dot" size={18} color={colors.primaryMid} />
            </View>
            <Text style={styles.navLabel}>{s('equipment')}</Text>
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
    hero: {
      alignItems: 'center',
      paddingTop: Spacing.xl,
      paddingBottom: Spacing.md,
      paddingHorizontal: Spacing.md,
      gap: 6,
    },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...Shadows.md,
      marginBottom: 4,
    },
    avatarText: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.display,
      fontWeight: FontWeight.bold,
      color: colors.textOnPrimary,
    },
    name: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxxl,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    username: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.textFaint,
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
