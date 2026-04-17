import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, Platform, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NotificationBellButton } from '../components/NotificationBellButton';
import { useTheme } from '../hooks/useTheme';
import { createStyles } from './ProfileScreen.styles';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import { getProfile } from '../services/profiles';
import type { Profile } from '../types/database';
import { ProfileSkeleton } from '../components/SkeletonLoader';
import { ErrorState } from '../components/ErrorState';
import { useBadgeProgress } from '../features/challenges';

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
              <Text style={styles.summaryName}>{fullName || s('user')}</Text>
              <View style={styles.identityMetaRow}>
                {usernameDisplay ? <Text style={styles.summaryHandle} numberOfLines={1}>{usernameDisplay}</Text> : null}
                <TouchableOpacity
                  testID="profile-challenges-pill"
                  style={styles.challengeChip}
                  onPress={() => router.push({ pathname: '/(tabs)/challenges', params: { tab: 'badges' } } as any)}
                  activeOpacity={0.78}
                >
                  <Lucide name="medal" size={12} color={colors.primary} />
                  <Text style={styles.challengeChipText}>
                    {completedChallengeCount} {s('profileChallengesCompleted')}
                  </Text>
                </TouchableOpacity>
              </View>
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
          <TouchableOpacity style={styles.navRow} onPress={() => router.push('/(protected)/equipment' as any)}>
            <View style={[styles.navIcon, { backgroundColor: colors.primaryPale }]}>
              <MaterialCommunityIcons name="table-tennis" size={18} color={colors.primaryMid} />
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
