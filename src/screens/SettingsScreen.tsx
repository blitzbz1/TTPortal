import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, Linking, Share } from 'react-native';
import { showAlert } from '../lib/dialogs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Shadows } from '../theme';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import { getProfile, updateProfile, type CheckinVisibility } from '../services/profiles';
import { getReferralStats } from '../services/referrals';
import { joinUrl, sharePayload } from '../lib/shareLinks';
import { useQueryClient } from '@tanstack/react-query';
import { profileQueryKey } from '../hooks/queries/useProfileQuery';
import { NotificationInboxModal, type NotificationInboxModalRef } from '../components/NotificationInboxModal';
import { LanguagePicker } from '../components/LanguagePicker';
import { getPolicyUrl } from '../lib/policyUrls';
import { isAnalyticsOptedOut, setAnalyticsOptOut } from '../lib/telemetry';
import { downloadMyData } from '../lib/dataExport';
import { UserFeedbackModal } from '../components/UserFeedbackModal';

export function SettingsScreen() {
  const router = useRouter();
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { s, lang } = useI18n();
  const { colors, mode, setMode, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [notifyCheckins, setNotifyCheckins] = useState(true);
  // T086: sparse map — only categories the user turned OFF are stored.
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({});
  const [checkinVisibility, setCheckinVisibility] = useState<CheckinVisibility>('friends');
  const [showAsRegular, setShowAsRegular] = useState(true);
  // GDPR (T082): UI shows "share data" semantics; storage is opt-OUT.
  const [analyticsEnabled, setAnalyticsEnabled] = useState(() => !isAnalyticsOptedOut());
  const [exporting, setExporting] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  // F041: the caller's referral code + invited count, for the Invite row.
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [invitedCount, setInvitedCount] = useState(0);
  const inboxRef = useRef<NotificationInboxModalRef>(null);

  useEffect(() => {
    if (!user) return;
    getProfile(user.id).then((res) => {
      if (res.data) {
        setNotifyCheckins((res.data as any).notify_friend_checkins ?? true);
        setCheckinVisibility((res.data as any).checkin_visibility ?? 'friends');
        setNotifPrefs((res.data as any).notification_prefs ?? {});
        setShowAsRegular((res.data as any).show_as_regular ?? true);
      }
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    getReferralStats().then((res) => {
      if (res.data) {
        setReferralCode(res.data.referral_code ?? null);
        setInvitedCount(res.data.invited_count ?? 0);
      }
    });
  }, [user]);

  const handleInviteFriends = useCallback(async () => {
    if (!referralCode) return;
    try {
      await Share.share(sharePayload(s('inviteShareMessage'), joinUrl(referralCode)));
    } catch {
      // User dismissed the share sheet — no-op.
    }
  }, [referralCode, s]);

  const handleToggleNotifCategory = useCallback(async (category: string, enabled: boolean) => {
    const next = { ...notifPrefs };
    if (enabled) delete next[category];
    else next[category] = false;
    setNotifPrefs(next);
    if (user) {
      await updateProfile(user.id, { notification_prefs: next });
      queryClient.invalidateQueries({ queryKey: profileQueryKey(user.id) });
    }
  }, [notifPrefs, user, queryClient]);

  const handleToggleCheckinNotif = useCallback(async (value: boolean) => {
    setNotifyCheckins(value);
    if (user) {
      await updateProfile(user.id, { notify_friend_checkins: value });
      // T059: the service refreshes the domain cache; the react-query key
      // would otherwise stay stale for its full 5min TTL.
      queryClient.invalidateQueries({ queryKey: profileQueryKey(user.id) });
    }
  }, [user, queryClient]);

  const handleToggleAnalytics = useCallback((value: boolean) => {
    setAnalyticsEnabled(value);
    setAnalyticsOptOut(!value);
  }, []);

  const handleDownloadMyData = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    const { error } = await downloadMyData();
    setExporting(false);
    if (error) showAlert(s('error'), s('exportError'));
  }, [exporting, s]);

  const handleSetCheckinVisibility = useCallback(async (value: CheckinVisibility) => {
    setCheckinVisibility(value);
    if (user) {
      await updateProfile(user.id, { checkin_visibility: value });
      queryClient.invalidateQueries({ queryKey: profileQueryKey(user.id) });
    }
  }, [user, queryClient]);

  // F014: opt in/out of the home venue's public Regulars list.
  const handleToggleShowAsRegular = useCallback(async (value: boolean) => {
    setShowAsRegular(value);
    if (user) {
      await updateProfile(user.id, { show_as_regular: value });
      queryClient.invalidateQueries({ queryKey: profileQueryKey(user.id) });
    }
  }, [user, queryClient]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <Lucide name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{s('settings')}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView style={styles.scroll}>
        {/* Notifications */}
        <TouchableOpacity style={styles.row} onPress={() => inboxRef.current?.present()}>
          <View style={[styles.rowIcon, { backgroundColor: colors.amberPale }]}>
            <Lucide name="bell" size={18} color={colors.accent} />
          </View>
          <Text style={styles.rowLabel}>{s('notifications')}</Text>
          <Lucide name="chevron-right" size={16} color={colors.textFaint} />
        </TouchableOpacity>
        <NotificationInboxModal ref={inboxRef} />

        {/* Check-in notifications */}
        <View style={styles.row}>
          <View style={[styles.rowIcon, { backgroundColor: colors.primaryPale }]}>
            <Lucide name="map-pin" size={18} color={colors.primaryMid} />
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>{s('notifyFriendCheckins')}</Text>
            <Text style={styles.rowDesc}>{s('notifyFriendCheckinsDesc')}</Text>
          </View>
          <Switch
            value={notifyCheckins}
            onValueChange={handleToggleCheckinNotif}
            trackColor={{ false: colors.border, true: colors.primaryLight }}
            thumbColor={colors.bgAlt}
          />
        </View>

        {/* Per-category notification prefs (T086) */}
        {([
          { key: 'friend_requests', icon: 'users', labelKey: 'notifFriendRequests' },
          { key: 'events', icon: 'calendar', labelKey: 'notifEvents' },
          { key: 'club_event', icon: 'calendar', labelKey: 'notifClubEvents' },
          { key: 'reviews_on_my_venue', icon: 'star', labelKey: 'notifReviews' },
          { key: 'feedback_replies', icon: 'message-circle', labelKey: 'notifFeedbackReplies' },
          { key: 'referrals', icon: 'user-plus', labelKey: 'notifReferrals' },
          { key: 'streak', icon: 'flame', labelKey: 'notifStreak' },
          { key: 'recap', icon: 'calendar', labelKey: 'notifRecap' },
          { key: 'wrapped', icon: 'gift', labelKey: 'notifWrapped' },
          { key: 'wear', icon: 'timer', labelKey: 'notifWear' },
        ] as const).map(({ key, icon, labelKey }) => (
          <View style={styles.row} key={key} testID={`settings-notif-${key}`}>
            <View style={[styles.rowIcon, { backgroundColor: colors.bgMuted }]}>
              <Lucide name={icon} size={18} color={colors.textMuted} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>{s(labelKey)}</Text>
            </View>
            <Switch
              value={notifPrefs[key] !== false}
              onValueChange={(v) => handleToggleNotifCategory(key, v)}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={colors.bgAlt}
              accessibilityLabel={s(labelKey)}
            />
          </View>
        ))}

        {/* Language */}
        <View style={styles.row}>
          <View style={[styles.rowIcon, { backgroundColor: colors.bluePale }]}>
            <Lucide name="globe" size={18} color={colors.blue} />
          </View>
          <Text style={styles.rowLabel}>{s('language')}</Text>
          <LanguagePicker />
        </View>

        {/* Theme */}
        <View style={styles.row}>
          <View style={[styles.rowIcon, { backgroundColor: colors.purplePale }]}>
            <Lucide name={isDark ? 'moon' : 'sun'} size={18} color={colors.purple} />
          </View>
          <Text style={styles.rowLabel}>{s('theme')}</Text>
          <View style={styles.toggle}>
            {([{ key: 'light', icon: 'sun' }, { key: 'dark', icon: 'moon' }, { key: 'system', icon: 'monitor' }] as const).map(({ key: m, icon }) => (
              <TouchableOpacity
                key={m}
                style={[styles.toggleOption, mode === m && styles.toggleOptionActive]}
                onPress={() => setMode(m)}
              >
                <Lucide name={icon} size={14} color={mode === m ? colors.text : colors.textFaint} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* App permissions (OS settings) */}
        <TouchableOpacity style={styles.row} onPress={() => Linking.openSettings()}>
          <View style={[styles.rowIcon, { backgroundColor: colors.bgMuted }]}>
            <Lucide name="shield" size={18} color={colors.textMuted} />
          </View>
          <Text style={styles.rowLabel}>{s('appPermissions')}</Text>
          <Lucide name="chevron-right" size={16} color={colors.textFaint} />
        </TouchableOpacity>

        {/* Legal */}
        <Text style={styles.sectionHeader}>{s('legal')}</Text>

        <TouchableOpacity
          style={styles.row}
          onPress={() => Linking.openURL(getPolicyUrl(lang, 'privacy'))}
          testID="settings-privacy-policy"
        >
          <View style={[styles.rowIcon, { backgroundColor: colors.bgMuted }]}>
            <Lucide name="shield-check" size={18} color={colors.textMuted} />
          </View>
          <Text style={styles.rowLabel}>{s('privacyPolicy')}</Text>
          <Lucide name="external-link" size={16} color={colors.textFaint} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.row}
          onPress={() => Linking.openURL(getPolicyUrl(lang, 'terms'))}
          testID="settings-terms"
        >
          <View style={[styles.rowIcon, { backgroundColor: colors.bgMuted }]}>
            <Lucide name="file-text" size={18} color={colors.textMuted} />
          </View>
          <Text style={styles.rowLabel}>{s('termsOfService')}</Text>
          <Lucide name="external-link" size={16} color={colors.textFaint} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.row}
          onPress={() => Linking.openURL(getPolicyUrl(lang, 'cookies'))}
          testID="settings-cookies"
        >
          <View style={[styles.rowIcon, { backgroundColor: colors.bgMuted }]}>
            <Lucide name="cookie" size={18} color={colors.textMuted} />
          </View>
          <Text style={styles.rowLabel}>{s('cookiePolicy')}</Text>
          <Lucide name="external-link" size={16} color={colors.textFaint} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.row}
          onPress={() => showAlert(s('dataSources'), s('dataSourcesBody'))}
          testID="settings-data-sources"
        >
          <View style={[styles.rowIcon, { backgroundColor: colors.bgMuted }]}>
            <Lucide name="map" size={18} color={colors.textMuted} />
          </View>
          <Text style={styles.rowLabel}>{s('dataSources')}</Text>
          <Lucide name="chevron-right" size={16} color={colors.textFaint} />
        </TouchableOpacity>

        {/* Privacy */}
        <Text style={styles.sectionHeader}>{s('privacy')}</Text>

        {/* Check-in visibility */}
        <View style={styles.row} testID="settings-checkin-visibility">
          <View style={[styles.rowIcon, { backgroundColor: colors.primaryPale }]}>
            <Lucide name="eye" size={18} color={colors.primaryMid} />
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>{s('checkinVisibility')}</Text>
            <Text style={styles.rowDesc}>{s('checkinVisibilityDesc')}</Text>
          </View>
          <View style={styles.toggle}>
            {([
              { key: 'friends', label: s('visibilityFriends') },
              { key: 'private', label: s('visibilityPrivate') },
            ] as const).map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                style={[styles.toggleOption, checkinVisibility === key && styles.toggleOptionActive]}
                onPress={() => handleSetCheckinVisibility(key)}
                accessibilityRole="button"
                accessibilityState={{ selected: checkinVisibility === key }}
                testID={`checkin-visibility-${key}`}
              >
                <Text
                  style={[
                    styles.toggleLabel,
                    checkinVisibility === key && styles.toggleLabelActive,
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Show me as a regular (F014) */}
        <View style={styles.row} testID="settings-show-as-regular">
          <View style={[styles.rowIcon, { backgroundColor: colors.purplePale }]}>
            <Lucide name="users" size={18} color={colors.purple} />
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>{s('showAsRegularLabel')}</Text>
            <Text style={styles.rowDesc}>{s('showAsRegularDesc')}</Text>
          </View>
          <Switch
            value={showAsRegular}
            onValueChange={handleToggleShowAsRegular}
            trackColor={{ false: colors.border, true: colors.primaryLight }}
            thumbColor={colors.bgAlt}
            accessibilityLabel={s('showAsRegularLabel')}
          />
        </View>

        <TouchableOpacity
          style={styles.row}
          onPress={() => router.push('/(protected)/blocked-users')}
          testID="settings-blocked-users"
        >
          <View style={[styles.rowIcon, { backgroundColor: colors.bgMuted }]}>
            <Lucide name="user-x" size={18} color={colors.textMuted} />
          </View>
          <Text style={styles.rowLabel}>{s('blockedUsers')}</Text>
          <Lucide name="chevron-right" size={16} color={colors.textFaint} />
        </TouchableOpacity>

        {/* Analytics opt-out (T082) */}
        <View style={styles.row} testID="settings-analytics-toggle">
          <View style={[styles.rowIcon, { backgroundColor: colors.bgMuted }]}>
            <Lucide name="bar-chart-3" size={18} color={colors.textMuted} />
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>{s('analyticsOptOut')}</Text>
            <Text style={styles.rowDesc}>{s('analyticsOptOutDesc')}</Text>
          </View>
          <Switch
            value={analyticsEnabled}
            onValueChange={handleToggleAnalytics}
            trackColor={{ true: colors.primaryLight }}
            accessibilityLabel={s('analyticsOptOut')}
          />
        </View>

        {/* Data export (T082, mspec §11) */}
        <TouchableOpacity
          style={styles.row}
          onPress={handleDownloadMyData}
          disabled={exporting}
          testID="settings-download-data"
        >
          <View style={[styles.rowIcon, { backgroundColor: colors.bgMuted }]}>
            <Lucide name="download" size={18} color={colors.textMuted} />
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>{s('downloadMyData')}</Text>
            <Text style={styles.rowDesc}>{s('downloadMyDataDesc')}</Text>
          </View>
          <Lucide name="chevron-right" size={16} color={colors.textFaint} />
        </TouchableOpacity>

        {/* Support (T085) */}
        <Text style={styles.sectionHeader}>{s('supportSection')}</Text>

        {/* Invite friends (F041): native share of /join/<referral_code> + an
            "Invited: N" counter from get_referral_stats. */}
        <TouchableOpacity
          style={styles.row}
          onPress={handleInviteFriends}
          disabled={!referralCode}
          testID="settings-invite-friends"
        >
          <View style={[styles.rowIcon, { backgroundColor: colors.primaryPale }]}>
            <Lucide name="user-plus" size={18} color={colors.primaryMid} />
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>{s('inviteFriendsRow')}</Text>
            <Text style={styles.rowDesc}>{s('inviteFriendsInvitedCount', String(invitedCount))}</Text>
          </View>
          <Lucide name="share-2" size={16} color={colors.textFaint} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.row}
          onPress={() => setFeedbackOpen(true)}
          testID="settings-send-feedback"
        >
          <View style={[styles.rowIcon, { backgroundColor: colors.primaryPale }]}>
            <Lucide name="message-square" size={18} color={colors.primaryMid} />
          </View>
          <Text style={styles.rowLabel}>{s('sendFeedback')}</Text>
          <Lucide name="chevron-right" size={16} color={colors.textFaint} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.row}
          onPress={() => Linking.openURL('mailto:ttportal.info@gmail.com?subject=TT%20Portal%20support')}
          testID="settings-contact-support"
        >
          <View style={[styles.rowIcon, { backgroundColor: colors.bgMuted }]}>
            <Lucide name="mail" size={18} color={colors.textMuted} />
          </View>
          <Text style={styles.rowLabel}>{s('contactSupport')}</Text>
          <Lucide name="external-link" size={16} color={colors.textFaint} />
        </TouchableOpacity>

        {/* Danger zone */}
        <Text style={styles.sectionHeader}>{s('dangerZone')}</Text>

        <TouchableOpacity
          style={styles.row}
          onPress={() => router.push('/(protected)/delete-account')}
          testID="settings-delete-account"
        >
          <View style={[styles.rowIcon, { backgroundColor: colors.redPale }]}>
            <Lucide name="trash-2" size={18} color={colors.redDeep} />
          </View>
          <Text style={[styles.rowLabel, { color: colors.redDeep }]}>{s('deleteAccount')}</Text>
          <Lucide name="chevron-right" size={16} color={colors.textFaint} />
        </TouchableOpacity>

      </ScrollView>
      {feedbackOpen && <UserFeedbackModal visible onClose={() => setFeedbackOpen(false)} />}
    </SafeAreaView>
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
      backgroundColor: colors.bgAlt,
      height: 52,
      paddingHorizontal: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      ...Shadows.bar,
    },
    headerTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    scroll: {
      flex: 1,
      paddingTop: Spacing.xs,
    },
    sectionHeader: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.semibold,
      color: colors.textFaint,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.xs,
      paddingHorizontal: Spacing.md,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: Spacing.md,
      gap: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    rowIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowContent: {
      flex: 1,
      gap: 2,
    },
    rowLabel: {
      flex: 1,
      fontFamily: Fonts.body,
      fontSize: 15,
      fontWeight: FontWeight.medium,
      color: colors.text,
    },
    rowDesc: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      color: colors.textFaint,
    },
    toggle: {
      flexDirection: 'row',
      backgroundColor: colors.bgMuted,
      borderRadius: 8,
      padding: 2,
    },
    toggleOption: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 6,
    },
    toggleOptionActive: {
      backgroundColor: colors.bgAlt,
    },
    toggleLabel: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.medium,
      color: colors.textFaint,
    },
    toggleLabelActive: {
      color: colors.text,
    },
  });
}
