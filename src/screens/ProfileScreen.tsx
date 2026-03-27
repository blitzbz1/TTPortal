import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { TabBar } from '../components/TabBar';
import { Colors, Fonts, Radius } from '../theme';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import { getProfile, getProfileStats } from '../services/profiles';
import type { Profile } from '../types/database';

const QUICK_ACTIONS_DATA = [
  { icon: 'users', labelKey: 'friends' as const, color: Colors.greenMid, bg: Colors.greenPale, border: Colors.greenDim, route: '/(protected)/friends' as const },
  { icon: 'trophy', labelKey: 'playHistory' as const, color: Colors.purple, bg: Colors.purplePale, border: Colors.purpleDim, route: '/(protected)/play-history' as const },
  { icon: 'bookmark', labelKey: 'favorites' as const, color: Colors.orange, bg: Colors.amberPale, border: Colors.amberDeep, route: '/(tabs)/favorites' as const },
];

const ACTIVITIES_DATA = [
  { icon: 'map-pin', iconColor: Colors.greenMid, bg: Colors.greenDim, textKey: 'activityCheckin' as const, time: 'Azi, 14:30' },
  { icon: 'star', iconColor: Colors.orange, bg: Colors.amberPale, textKey: 'activityReview' as const, time: 'Ieri, 18:15' },
  { icon: 'user-plus', iconColor: Colors.purple, bg: Colors.purplePale, textKey: 'activityFriend' as const, time: 'Luni, 10:00' },
];

interface ProfileScreenProps {
  hideTabBar?: boolean;
}

export function ProfileScreen({ hideTabBar = false }: ProfileScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useSession();
  const { lang, setLang, s } = useI18n();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<{ total_checkins: number; unique_venues: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);


  useEffect(() => {
    if (!user || dataLoaded) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const profileRes = await getProfile(user.id);
        if (cancelled) return;
        if (profileRes.data) setProfile(profileRes.data as Profile);

        const statsRes = await getProfileStats(user.id);
        if (cancelled) return;
        if (statsRes.data) setStats(statsRes.data as { total_checkins: number; unique_venues: number });
      } catch {
        // ignore
      } finally {
        if (!cancelled) {
          setLoading(false);
          setDataLoaded(true);
        }
      }
    })();

    return () => { cancelled = true; };
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
    { value: String(stats?.unique_venues ?? 0), label: s('venuesVisited') },
  ];

  const handleQuickAction = useCallback((route: string | null) => {
    if (route) {
      router.push(route as any);
    }
  }, [router]);

  const handleToggleLang = useCallback(() => {
    setLang(lang === 'ro' ? 'en' : 'ro');
  }, [lang, setLang]);

  const handleLogout = useCallback(async () => {
    await signOut();
    router.replace('/sign-in' as any);
  }, [signOut, router]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={() => router.push('/(tabs)/' as any)}>
            <Lucide name="arrow-left" size={22} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{s('myProfile')}</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={Colors.green} />
        </View>
        {!hideTabBar && <TabBar activeTab="profile" />}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/' as any)}>
          <Lucide name="arrow-left" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{s('myProfile')}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView style={styles.scroll}>
        {/* Profile Hero */}
        <View style={styles.hero}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.onlineDot} />
          </View>
          <Text style={styles.name}>{fullName || s('user')}</Text>
          {usernameDisplay ? <Text style={styles.username}>{usernameDisplay}</Text> : null}
          <View style={styles.badges}>
            <View style={styles.badgeGreen}>
              <Text style={styles.badgeEmoji}>{'\uD83C\uDFD3'}</Text>
              <Text style={styles.badgeGreenText}>{s('activePlayer')}</Text>
            </View>
            <View style={styles.badgePurple}>
              <Text style={styles.badgeEmoji}>{'\u2B50'}</Text>
              <Text style={styles.badgePurpleText}>{s('topContributor')}</Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {dynamicStats.map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{s('quickActions')}</Text>
          <View style={styles.quickRow}>
            {QUICK_ACTIONS_DATA.map((action) => (
              <TouchableOpacity
                key={action.labelKey}
                style={[styles.quickBtn, { backgroundColor: action.bg, borderColor: action.border }]}
                onPress={() => handleQuickAction(action.route)}
              >
                <Lucide name={action.icon} size={22} color={action.color} />
                <Text style={[styles.quickLabel, { color: action.color }]}>{s(action.labelKey)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{s('recentActivity')}</Text>
          {ACTIVITIES_DATA.map((act) => (
            <View key={act.textKey} style={styles.activityCard}>
              <View style={[styles.actIcon, { backgroundColor: act.bg }]}>
                <Lucide name={act.icon} size={18} color={act.iconColor} />
              </View>
              <View style={styles.actInfo}>
                <Text style={styles.actText}>{s(act.textKey)}</Text>
                <Text style={styles.actTime}>{act.time}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{s('settings')}</Text>

          {/* Notificări */}
          <TouchableOpacity style={styles.settingsRow} onPress={() => router.push('/(protected)/notifications' as any)}>
            <View style={styles.settingsLeft}>
              <Lucide name="bell" size={18} color={Colors.inkMuted} />
              <Text style={styles.settingsLabel}>{s('notifications')}</Text>
            </View>
            <Lucide name="chevron-right" size={16} color={Colors.inkFaint} />
          </TouchableOpacity>

          {/* Limbă */}
          <TouchableOpacity style={styles.settingsRow} onPress={handleToggleLang}>
            <View style={styles.settingsLeft}>
              <Lucide name="globe" size={18} color={Colors.inkMuted} />
              <Text style={styles.settingsLabel}>{s('language')}</Text>
            </View>
            <Text style={styles.settingsValue}>{lang.toUpperCase()}</Text>
          </TouchableOpacity>

          {/* Confidențialitate */}
          <TouchableOpacity style={styles.settingsRow} onPress={() => Linking.openSettings()}>
            <View style={styles.settingsLeft}>
              <Lucide name="shield" size={18} color={Colors.inkMuted} />
              <Text style={styles.settingsLabel}>{s('privacy')}</Text>
            </View>
            <Lucide name="chevron-right" size={16} color={Colors.inkFaint} />
          </TouchableOpacity>

          {/* Admin / Moderare - only if admin */}
          {profile?.is_admin && (
            <TouchableOpacity style={styles.settingsRow} onPress={() => router.push('/(protected)/admin' as any)}>
              <View style={styles.settingsLeft}>
                <Lucide name="shield-check" size={18} color={Colors.inkMuted} />
                <Text style={styles.settingsLabel}>{s('moderation')}</Text>
              </View>
              <View style={styles.adminBadge}>
                <View style={styles.adminPill}>
                  <Text style={styles.adminPillText}>{s('admin')}</Text>
                </View>
                <Lucide name="chevron-right" size={16} color={Colors.inkFaint} />
              </View>
            </TouchableOpacity>
          )}

          {/* Logout */}
          <TouchableOpacity style={styles.logoutRow} onPress={handleLogout}>
            <Lucide name="log-out" size={18} color={Colors.red} />
            <Text style={styles.logoutText}>{s('logout')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {!hideTabBar && <TabBar activeTab="profile" />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.green,
    paddingVertical: 10,
    minHeight: 52,
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontFamily: Fonts.heading,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
  },
  scroll: {
    flex: 1,
  },
  hero: {
    backgroundColor: Colors.white,
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
    backgroundColor: Colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: Fonts.heading,
    fontSize: 32,
    fontWeight: '700',
    color: Colors.white,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.greenLight,
    borderWidth: 3,
    borderColor: Colors.white,
  },
  name: {
    fontFamily: Fonts.heading,
    fontSize: 22,
    fontWeight: '700',
    color: Colors.ink,
  },
  username: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.inkFaint,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
  },
  badgeEmoji: {
    fontSize: 12,
  },
  badgeGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.greenDim,
    borderRadius: 100,
    paddingVertical: 4,
    paddingHorizontal: 10,
    gap: 4,
  },
  badgeGreenText: {
    fontFamily: Fonts.body,
    fontSize: 11,
    fontWeight: '600',
    color: Colors.greenMid,
  },
  badgePurple: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.purplePale,
    borderRadius: 100,
    paddingVertical: 4,
    paddingHorizontal: 10,
    gap: 4,
  },
  badgePurpleText: {
    fontFamily: Fonts.body,
    fontSize: 11,
    fontWeight: '600',
    color: Colors.purple,
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
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  statValue: {
    fontFamily: Fonts.heading,
    fontSize: 28,
    fontWeight: '700',
    color: Colors.green,
  },
  statLabel: {
    fontFamily: Fonts.body,
    fontSize: 11,
    fontWeight: '500',
    color: Colors.inkFaint,
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
    color: Colors.ink,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickBtn: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 12,
    gap: 10,
    borderWidth: 1,
  },
  quickLabel: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '600',
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    paddingHorizontal: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  actIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actInfo: {
    flex: 1,
    gap: 2,
  },
  actText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    fontWeight: '500',
    color: Colors.ink,
  },
  actTime: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.inkFaint,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  settingsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsLabel: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.ink,
  },
  settingsValue: {
    fontFamily: Fonts.body,
    fontSize: 13,
    fontWeight: '500',
    color: Colors.inkFaint,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  adminPill: {
    backgroundColor: Colors.greenPale,
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  adminPillText: {
    fontFamily: Fonts.body,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.greenMid,
  },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  logoutText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.red,
  },
});
