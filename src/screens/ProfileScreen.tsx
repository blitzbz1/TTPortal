import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Linking, Switch, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Card } from '../components/Card';
import { Lucide } from '../components/Icon';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, Shadows } from '../theme';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import { getProfile, getProfileStats, updateProfile } from '../services/profiles';
import type { Profile } from '../types/database';

function getQuickActions(colors: ThemeColors) {
  return [
    { icon: 'users', labelKey: 'friends' as const, color: colors.primaryMid, bg: colors.primaryPale, border: colors.primaryDim, route: '/(protected)/friends' as const },
    { icon: 'trophy', labelKey: 'playHistory' as const, color: colors.purple, bg: colors.purplePale, border: colors.purpleDim, route: '/(protected)/play-history' as const },
    { icon: 'bookmark', labelKey: 'favorites' as const, color: colors.accent, bg: colors.amberPale, border: colors.amberDeep, route: '/(tabs)/favorites' as const },
  ];
}


interface ProfileScreenProps {
  hideTabBar?: boolean;
}

export function ProfileScreen({ hideTabBar = false }: ProfileScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useSession();
  const { lang, setLang, s } = useI18n();
  const { colors, mode, setMode, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const quickActions = useMemo(() => getQuickActions(colors), [colors]);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<{ total_checkins: number; events_joined: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [profileError, setProfileError] = useState(false);
  const [notifyCheckins, setNotifyCheckins] = useState(true);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setProfileError(false);

    try {
      const profileRes = await getProfile(user.id);
      if (profileRes.data) {
        setProfile(profileRes.data as Profile);
        setNotifyCheckins((profileRes.data as any).notify_friend_checkins ?? true);
      }

      const statsRes = await getProfileStats(user.id);
      if (statsRes.data) setStats(statsRes.data as { total_checkins: number; events_joined: number });
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

  const dynamicStats = [
    { value: String(stats?.total_checkins ?? 0), label: s('checkins') },
    { value: String(stats?.events_joined ?? 0), label: s('eventsJoined') },
  ];

  const handleQuickAction = useCallback((route: string | null) => {
    if (route) {
      router.push(route as any);
    }
  }, [router]);


  const handleToggleCheckinNotif = useCallback(async (value: boolean) => {
    setNotifyCheckins(value);
    if (user) {
      await updateProfile(user.id, { notify_friend_checkins: value });
    }
  }, [user]);

  const handleLogout = useCallback(() => {
    Alert.alert(
      s('logout'),
      s('confirmLogout'),
      [
        { text: s('cancel'), style: 'cancel' },
        { text: s('logout'), style: 'destructive', onPress: async () => {
          await signOut();
          router.replace('/sign-in' as any);
        }},
      ]
    );
  }, [signOut, router, s]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Lucide name="arrow-left" size={22} color={colors.textOnPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{s('myProfile')}</Text>
          <View style={{ width: 22 }} />
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
            <ActivityIndicator size="large" color={colors.primary} />
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Lucide name="arrow-left" size={22} color={colors.textOnPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{s('myProfile')}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView style={styles.scroll}>
        {/* Profile Hero */}
        <Card shadow="sm" borderRadius={0} style={styles.hero}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          </View>
          <Text style={styles.name}>{fullName || s('user')}</Text>
          {usernameDisplay ? <Text style={styles.username}>{usernameDisplay}</Text> : null}
        </Card>

        {/* Stats */}
        <View style={styles.statsRow}>
          {dynamicStats.map((stat) => (
            <Card key={stat.label} shadow="sm" borderRadius={14} style={styles.statCard}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </Card>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{s('quickActions')}</Text>
          <View style={styles.quickRow}>
            {quickActions.map((action) => (
              <Card key={action.labelKey} shadow="sm" borderRadius={14} style={styles.quickBtn}>
                <TouchableOpacity
                  style={styles.quickBtnInner}
                  onPress={() => handleQuickAction(action.route)}
                >
                  <Lucide name={action.icon} size={22} color={action.color} />
                  <Text style={[styles.quickLabel, { color: action.color }]}>{s(action.labelKey)}</Text>
                </TouchableOpacity>
              </Card>
            ))}
          </View>
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{s('settings')}</Text>

          {/* Notificari */}
          <TouchableOpacity style={styles.settingsRow} onPress={() => router.push('/(protected)/notifications' as any)}>
            <View style={styles.settingsLeft}>
              <Lucide name="bell" size={18} color={colors.textMuted} />
              <Text style={styles.settingsLabel}>{s('notifications')}</Text>
            </View>
            <Lucide name="chevron-right" size={16} color={colors.textFaint} />
          </TouchableOpacity>

          {/* Notificari check-in prieteni */}
          <View style={styles.settingsRow}>
            <View style={styles.settingsLeft}>
              <Lucide name="map-pin" size={18} color={colors.textMuted} />
              <View>
                <Text style={styles.settingsLabel}>{s('notifyFriendCheckins')}</Text>
                <Text style={styles.settingsDesc}>{s('notifyFriendCheckinsDesc')}</Text>
              </View>
            </View>
            <Switch
              value={notifyCheckins}
              onValueChange={handleToggleCheckinNotif}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={colors.bgAlt}
            />
          </View>

          {/* Limba */}
          <View style={styles.settingsRow}>
            <View style={styles.settingsLeft}>
              <Lucide name="globe" size={18} color={colors.textMuted} />
              <Text style={styles.settingsLabel}>{s('language')}</Text>
            </View>
            <View style={styles.themeToggle}>
              {(['ro', 'en'] as const).map((l) => (
                <TouchableOpacity
                  key={l}
                  style={[styles.themeOption, lang === l && styles.themeOptionActive]}
                  onPress={() => setLang(l)}
                >
                  <Text style={[styles.themeOptionText, lang === l && styles.themeOptionTextActive]}>
                    {l.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Tema */}
          <View style={styles.settingsRow}>
            <View style={styles.settingsLeft}>
              <Lucide name={isDark ? 'moon' : 'sun'} size={18} color={colors.textMuted} />
              <Text style={styles.settingsLabel}>{s('theme')}</Text>
            </View>
            <View style={styles.themeToggle}>
              {([{ key: 'light', icon: 'sun' }, { key: 'dark', icon: 'moon' }, { key: 'system', icon: 'monitor' }] as const).map(({ key: m, icon }) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.themeOption, mode === m && styles.themeOptionActive]}
                  onPress={() => setMode(m)}
                >
                  <Lucide name={icon} size={14} color={mode === m ? colors.text : colors.textFaint} />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Confidentialitate */}
          <TouchableOpacity style={styles.settingsRow} onPress={() => Linking.openSettings()}>
            <View style={styles.settingsLeft}>
              <Lucide name="shield" size={18} color={colors.textMuted} />
              <Text style={styles.settingsLabel}>{s('privacy')}</Text>
            </View>
            <Lucide name="chevron-right" size={16} color={colors.textFaint} />
          </TouchableOpacity>

          {/* Admin / Moderare - only if admin */}
          {profile?.is_admin && (
            <TouchableOpacity style={styles.settingsRow} onPress={() => router.push('/(protected)/admin' as any)}>
              <View style={styles.settingsLeft}>
                <Lucide name="shield-check" size={18} color={colors.textMuted} />
                <Text style={styles.settingsLabel}>{s('moderation')}</Text>
              </View>
              <View style={styles.adminBadge}>
                <View style={styles.adminPill}>
                  <Text style={styles.adminPillText}>{s('admin')}</Text>
                </View>
                <Lucide name="chevron-right" size={16} color={colors.textFaint} />
              </View>
            </TouchableOpacity>
          )}

          {/* Logout */}
          <TouchableOpacity style={styles.logoutRow} onPress={handleLogout}>
            <Lucide name="log-out" size={18} color={colors.red} />
            <Text style={styles.logoutText}>{s('logout')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.primary,
      paddingVertical: 10,
      minHeight: 52,
      paddingHorizontal: 16,
      ...Shadows.bar,
    },
    headerTitle: {
      fontFamily: Fonts.heading,
      fontSize: 18,
      fontWeight: '700',
      color: colors.textOnPrimary,
    },
    scroll: {
      flex: 1,
    },
    hero: {
      alignItems: 'center',
      paddingTop: 28,
      paddingBottom: 24,
      paddingHorizontal: 24,
      gap: 16,
    },
    avatarWrap: {
      width: 88,
      height: 88,
    },
    avatar: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...Shadows.lg,
    },
    avatarText: {
      fontFamily: Fonts.heading,
      fontSize: 32,
      fontWeight: '700',
      color: colors.textOnPrimary,
    },
    name: {
      fontFamily: Fonts.heading,
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
    },
    username: {
      fontFamily: Fonts.body,
      fontSize: 14,
      color: colors.textFaint,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    statCard: {
      flex: 1,
      alignItems: 'center',
      padding: 14,
      gap: 4,
    },
    statValue: {
      fontFamily: Fonts.heading,
      fontSize: 28,
      fontWeight: '700',
      color: colors.primary,
    },
    statLabel: {
      fontFamily: Fonts.body,
      fontSize: 11,
      fontWeight: '500',
      color: colors.textFaint,
    },
    section: {
      paddingHorizontal: 16,
      paddingTop: 20,
      gap: 10,
    },
    sectionTitle: {
      fontFamily: Fonts.body,
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    quickRow: {
      flexDirection: 'row',
      gap: 10,
    },
    quickBtn: {
      flex: 1,
    },
    quickBtnInner: {
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 12,
      gap: 10,
    },
    quickLabel: {
      fontFamily: Fonts.body,
      fontSize: 12,
      fontWeight: '600',
    },
    settingsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    settingsLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    settingsLabel: {
      fontFamily: Fonts.body,
      fontSize: 14,
      color: colors.text,
    },
    settingsDesc: {
      fontFamily: Fonts.body,
      fontSize: 11,
      color: colors.textFaint,
      marginTop: 1,
    },
    settingsValue: {
      fontFamily: Fonts.body,
      fontSize: 13,
      fontWeight: '500',
      color: colors.textFaint,
    },
    themeToggle: {
      flexDirection: 'row',
      backgroundColor: colors.bgMuted,
      borderRadius: 8,
      padding: 2,
    },
    themeOption: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 6,
    },
    themeOptionActive: {
      backgroundColor: colors.bgAlt,
    },
    themeOptionText: {
      fontFamily: Fonts.body,
      fontSize: 11,
      fontWeight: '500',
      color: colors.textFaint,
    },
    themeOptionTextActive: {
      color: colors.text,
      fontWeight: '600',
    },
    adminBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    adminPill: {
      backgroundColor: colors.primaryPale,
      borderRadius: 8,
      paddingVertical: 2,
      paddingHorizontal: 6,
    },
    adminPillText: {
      fontFamily: Fonts.body,
      fontSize: 10,
      fontWeight: '700',
      color: colors.primaryMid,
    },
    logoutRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      gap: 12,
      ...Shadows.sm,
      backgroundColor: colors.redPale,
      borderRadius: 12,
      paddingHorizontal: 12,
      marginTop: 4,
    },
    logoutText: {
      fontFamily: Fonts.body,
      fontSize: 14,
      fontWeight: '500',
      color: colors.red,
    },
  });
}
