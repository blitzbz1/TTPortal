import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Modal, Pressable, Platform } from 'react-native';
import { showAlert } from '../lib/dialogs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { EquipmentSummaryCard } from '../components/EquipmentSummaryCard';
import { Lucide } from '../components/Icon';
import { SkillChip } from '../components/SkillChip';
import { RatingChip } from '../components/RatingChip';
import { usePlayerRatingQuery } from '../features/ratings';
import { useHeadToHeadQuery } from '../features/matches';
import { LogMatchModal } from '../components/LogMatchModal';
import { getOrCreateDmThread } from '../features/messaging';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius, Shadows } from '../theme';
import { useSession } from '../hooks/useSession';
import { useCanModerate } from '../hooks/useCanModerate';
import { useI18n } from '../hooks/useI18n';
import { getDateLocale } from '../contexts/I18nProvider';
import { useProfileQuery, useProfileStatsQuery } from '../hooks/queries/useProfileQuery';
import { useCoachProfileQuery } from '../features/coaches';
import { getEvents, sendEventInvites } from '../services/events';
import { getCurrentEquipmentForUser } from '../services/equipment';
import type { Profile, EquipmentSelection } from '../types/database';

interface Props {
  userId: string;
  /** F034: open the Log Match sheet on mount (Quick Match QR deep link). */
  autoLogMatch?: boolean;
}

export function PlayerProfileScreen({ userId, autoLogMatch }: Props) {
  const router = useRouter();
  const { user } = useSession();
  const { s, lang } = useI18n();
  const { colors, isDark } = useTheme();
  const headerFg = isDark ? colors.text : colors.textOnPrimary;
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  // T050: profile + stats via react-query (hooks hydrate from / mirror to
  // the persistent profileCache); equipment keeps its lightweight effect.
  const { data: profileRaw, isLoading: profileLoading } = useProfileQuery(userId);
  const { data: rating } = usePlayerRatingQuery(userId);
  const { data: h2h } = useHeadToHeadQuery(user?.id, userId);
  // F063: the viewed user's coach profile. Public-read-when-approved, so this
  // is only non-null here for an APPROVED coach (drives the pinned card + chip).
  const { data: coachProfile } = useCoachProfileQuery(userId);
  const isCoach = coachProfile?.status === 'approved';
  const profile = (profileRaw ?? null) as Profile | null;
  const { data: stats } = useProfileStatsQuery(userId) as {
    data: { total_checkins: number; unique_venues: number; events_joined: number; total_hours_played: number } | null | undefined;
  };
  const loading = profileLoading && !profile;
  const [equipment, setEquipment] = useState<EquipmentSelection | null>(null);
  const [equipmentLoading, setEquipmentLoading] = useState(true);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [myEvents, setMyEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [sendingInviteId, setSendingInviteId] = useState<number | null>(null);
  const [logMatchVisible, setLogMatchVisible] = useState(false);

  // F034: a Quick-Match QR deep link (?logMatch=1) opens the Log Match sheet,
  // already pre-targeted at this player via presetOpponentId.
  useEffect(() => {
    if (autoLogMatch) setLogMatchVisible(true);
  }, [autoLogMatch]);

  useEffect(() => {
    let cancelled = false;
    setEquipmentLoading(true);
    getCurrentEquipmentForUser(userId).then((res) => {
      if (cancelled) return;
      setEquipment(res.data?.[0] ?? null);
      setEquipmentLoading(false);
    }).catch(() => {
      if (!cancelled) setEquipmentLoading(false);
    });
    return () => { cancelled = true; };
  }, [userId]);

  const fullName = profile?.full_name || s('user');
  const nameParts = fullName.trim().split(/\s+/);
  const initials = nameParts.length >= 2
    ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
    : (nameParts[0]?.[0] || '?').toUpperCase();
  const username = profile?.username ? `@${profile.username}` : '';
  const city = profile?.city || '';
  const usernameDisplay = [username, city].filter(Boolean).join(' \u00B7 ');

  const formatHours = (h: number) => {
    if (h < 1 && h > 0) return `${Math.round(h * 60)}min`;
    return `${h.toFixed(1)}h`;
  };

  const summaryStats = stats
    ? [
        { value: String(stats.total_checkins), label: s('checkins'), bg: colors.primaryPale, color: colors.primary },
        { value: String(stats.unique_venues), label: s('locations'), bg: colors.purplePale, color: colors.purple },
        { value: String(stats.events_joined), label: s('eventsJoined'), bg: colors.amberPale, color: colors.accent },
        { value: formatHours(stats.total_hours_played), label: s('hoursInEvents'), bg: colors.bluePale, color: colors.blue },
      ]
    : [];

  const openInvitePicker = useCallback(async () => {
    if (!user) return;
    setPickerVisible(true);
    setEventsLoading(true);
    const { data } = await getEvents('mine', user.id);
    const upcoming = (data ?? []).filter((ev: any) =>
      ev.status !== 'cancelled' && new Date(ev.starts_at).getTime() > Date.now(),
    );
    setMyEvents(upcoming);
    setEventsLoading(false);
  }, [user]);

  const handlePickEvent = useCallback(async (event: any) => {
    if (!user) return;
    setSendingInviteId(event.id);
    const { error } = await sendEventInvites(event.id, [userId]);
    setSendingInviteId(null);
    if (error) {
      showAlert(s('error'), error.message ?? s('genericError'));
      return;
    }
    setPickerVisible(false);
    if (Platform.OS === 'web') {
      window.alert(s('inviteSent'));
    } else {
      showAlert(s('success'), s('inviteSent'));
    }
  }, [user, userId, s]);

  const handleMessage = useCallback(async () => {
    if (!user) return;
    const { data: threadId, error } = await getOrCreateDmThread(userId);
    if (error || !threadId) {
      showAlert(s('error'), s('messagesCannotSend'));
      return;
    }
    const path: string = `/messages/${threadId}?otherName=${encodeURIComponent(fullName)}`;
    router.push(path as Href);
  }, [user, userId, fullName, router, s]);

  const isSelf = user?.id === userId;
  // F023/136: DMs are staff-mediated — only admins/moderators may START a
  // conversation. Hide the entry point for everyone else (server enforces too).
  const canModerate = useCanModerate();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Lucide name="arrow-left" size={24} color={headerFg} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{s('playerProfile')}</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ flex: 1, marginTop: 40 }} />
      ) : (
        <ScrollView style={styles.scroll}>
          <View style={styles.hero}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <Text style={styles.name}>{fullName}</Text>
            {usernameDisplay ? <Text style={styles.username}>{usernameDisplay}</Text> : null}
            <SkillChip skillLevel={profile?.skill_level ?? null} />
            <RatingChip rating={rating?.rating} provisional={rating?.provisional} />
            {isCoach && (
              <View style={styles.coachChip} testID="coach-chip">
                <Lucide name="graduation-cap" size={13} color={colors.blue} />
                <Text style={styles.coachChipText}>{s('coachChip')}</Text>
              </View>
            )}
          </View>

          {stats && (
            <View style={styles.statsCard}>
              <View style={styles.statsRow}>
                {summaryStats.map((stat) => (
                  <View key={stat.label} style={[styles.statPill, { backgroundColor: stat.bg }]}>
                    <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
                    <Text style={styles.statLabel} numberOfLines={2}>{stat.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* F063: pinned coach card — bio/levels/languages/price/contact for an
              approved coach. Their real TTPortal activity is the stats card above. */}
          {isCoach && coachProfile && (
            <View style={styles.coachCard} testID="coach-card">
              <View style={styles.coachCardHeader}>
                <Lucide name="graduation-cap" size={16} color={colors.blue} />
                <Text style={styles.coachCardTitle}>{s('coachCardTitle')}</Text>
              </View>
              {coachProfile.bio ? <Text style={styles.coachBio}>{coachProfile.bio}</Text> : null}
              {coachProfile.experience ? (
                <Text style={styles.coachDetail}>
                  <Text style={styles.coachDetailLabel}>{s('coachExperienceLabel')}: </Text>
                  {coachProfile.experience}
                </Text>
              ) : null}
              {coachProfile.levels.length > 0 ? (
                <Text style={styles.coachDetail}>
                  <Text style={styles.coachDetailLabel}>{s('coachLevelsLabel')}: </Text>
                  {coachProfile.levels.join(', ')}
                </Text>
              ) : null}
              {coachProfile.languages.length > 0 ? (
                <Text style={styles.coachDetail}>
                  <Text style={styles.coachDetailLabel}>{s('coachLanguagesLabel')}: </Text>
                  {coachProfile.languages.join(', ')}
                </Text>
              ) : null}
              {coachProfile.price_range ? (
                <Text style={styles.coachDetail}>
                  <Text style={styles.coachDetailLabel}>{s('coachPriceLabel')}: </Text>
                  {coachProfile.price_range}
                </Text>
              ) : null}
              {coachProfile.contact ? (
                <Text style={styles.coachDetail}>
                  <Text style={styles.coachDetailLabel}>{s('coachContactLabel')}: </Text>
                  {coachProfile.contact}
                </Text>
              ) : null}
            </View>
          )}

          {/* F031: head-to-head vs the viewer */}
          {!isSelf && h2h && h2h.total > 0 && (
            <View style={styles.h2hCard}>
              <Text style={styles.h2hTitle}>{s('headToHeadTitle')}</Text>
              <View style={styles.h2hRow}>
                <View style={styles.h2hSide}>
                  <Text style={[styles.h2hScore, { color: colors.primary }]}>{h2h.my_wins}</Text>
                  <Text style={styles.h2hSideLabel}>{s('h2hYou')}</Text>
                </View>
                <Text style={styles.h2hDash}>—</Text>
                <View style={styles.h2hSide}>
                  <Text style={[styles.h2hScore, { color: colors.red }]}>{h2h.their_wins}</Text>
                  <Text style={styles.h2hSideLabel} numberOfLines={1}>{fullName}</Text>
                </View>
              </View>
              <View style={styles.h2hMetaRow}>
                <Text style={styles.h2hMeta}>{s('h2hSets', `${h2h.my_sets}`, `${h2h.their_sets}`)}</Text>
                {h2h.streak !== 0 ? (
                  <Text style={[styles.h2hMeta, { color: h2h.streak > 0 ? colors.primary : colors.red, fontWeight: '700' }]}>
                    {h2h.streak > 0 ? s('h2hStreakWin', `${h2h.streak}`) : s('h2hStreakLoss', `${-h2h.streak}`)}
                  </Text>
                ) : null}
              </View>
              {h2h.last5.length > 0 && (
                <View style={styles.h2hDots}>
                  {h2h.last5.map((win, i) => (
                    <View
                      key={i}
                      style={[styles.h2hDot, { backgroundColor: win ? colors.primaryPale : colors.redPale }]}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: win ? colors.primary : colors.red }}>
                        {win ? s('winShort') : s('lossShort')}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          <View style={styles.equipmentSection}>
            {equipmentLoading ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: Spacing.md }} />
            ) : equipment ? (
              <EquipmentSummaryCard
                equipment={equipment}
                title={s('equipmentFriendTitle', profile?.full_name ?? s('user'))}
                variant="profile"
              />
            ) : (
              <View style={styles.equipmentEmpty}>
                <Lucide name="badge-info" size={22} color={colors.textFaint} />
                <Text style={styles.equipmentEmptyTitle}>{s('equipmentFriendEmptyTitle')}</Text>
                <Text style={styles.equipmentEmptyText}>{s('equipmentFriendEmptyDesc')}</Text>
              </View>
            )}
          </View>

          {!isSelf && (
            <View style={styles.actions}>
              <TouchableOpacity style={styles.inviteBtn} onPress={openInvitePicker}>
                <Lucide name="send" size={16} color={colors.textOnPrimary} />
                <Text style={styles.inviteBtnText}>{s('inviteToEvent')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.inviteBtn, { backgroundColor: colors.bgAlt, borderWidth: 1, borderColor: colors.primary, marginTop: Spacing.sm }]}
                onPress={() => setLogMatchVisible(true)}
                testID="log-match-btn"
              >
                <Lucide name="swords" size={16} color={colors.primary} />
                <Text style={[styles.inviteBtnText, { color: colors.primary }]}>{s('logMatchTitle')}</Text>
              </TouchableOpacity>
              {canModerate && (
                <TouchableOpacity
                  style={[styles.inviteBtn, { backgroundColor: colors.bgAlt, borderWidth: 1, borderColor: colors.border, marginTop: Spacing.sm }]}
                  onPress={handleMessage}
                  testID="message-player-btn"
                >
                  <Lucide name="message-circle" size={16} color={colors.text} />
                  <Text style={[styles.inviteBtnText, { color: colors.text }]}>{s('messageButton')}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>
      )}

      {user?.id && (
        <LogMatchModal
          visible={logMatchVisible}
          currentUserId={user.id}
          opponentOptions={[{ id: userId, name: fullName }]}
          presetOpponentId={userId}
          onClose={() => setLogMatchVisible(false)}
          onLogged={() => showAlert(s('success'), s('matchLoggedPending'))}
        />
      )}

      <Modal visible={pickerVisible} transparent animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setPickerVisible(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.handleWrap}><View style={styles.handle} /></View>
            <Text style={styles.sheetTitle}>{s('pickEventToInvite')}</Text>

            {eventsLoading ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 24 }} />
            ) : myEvents.length === 0 ? (
              <Text style={styles.emptyText}>{s('noUpcomingEvents')}</Text>
            ) : (
              <ScrollView style={{ maxHeight: 360 }}>
                {myEvents.map((ev) => {
                  const dateStr = new Date(ev.starts_at).toLocaleString(getDateLocale(lang), {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                  });
                  return (
                    <TouchableOpacity
                      key={ev.id}
                      style={styles.eventRow}
                      onPress={() => handlePickEvent(ev)}
                      disabled={sendingInviteId !== null}
                    >
                      <View style={styles.eventIcon}>
                        <Lucide name="calendar" size={16} color={colors.accent} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.eventTitle} numberOfLines={1}>{ev.title}</Text>
                        <Text style={styles.eventMeta}>{dateStr}{ev.venues?.name ? ` \u00B7 ${ev.venues.name}` : ''}</Text>
                      </View>
                      {sendingInviteId === ev.id ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <Lucide name="chevron-right" size={18} color={colors.textFaint} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <TouchableOpacity style={styles.closeBtn} onPress={() => setPickerVisible(false)}>
              <Text style={styles.closeBtnText}>{s('cancel')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
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
      paddingHorizontal: Spacing.md,
      minHeight: 52,
      ...Shadows.bar,
    },
    headerTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      color: isDark ? colors.text : colors.textOnPrimary,
    },
    scroll: { flex: 1 },
    hero: {
      alignItems: 'center',
      paddingTop: Spacing.xl,
      paddingBottom: Spacing.md,
      paddingHorizontal: Spacing.md,
      gap: 6,
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...Shadows.md,
      marginBottom: 4,
    },
    avatarText: {
      fontFamily: Fonts.heading,
      fontSize: 32,
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
    statsCard: {
      marginHorizontal: Spacing.md,
      marginTop: Spacing.sm,
      backgroundColor: colors.bgAlt,
      borderRadius: 12,
      padding: Spacing.sm,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...Shadows.sm,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 6,
    },
    statPill: {
      flex: 1,
      alignItems: 'center',
      borderRadius: 12,
      paddingVertical: Spacing.sm,
      paddingHorizontal: 4,
      gap: Spacing.xxs,
      ...Shadows.sm,
    },
    statValue: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.extrabold,
    },
    statLabel: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.medium,
      color: colors.textMuted,
      textAlign: 'center',
    },
    h2hCard: {
      marginHorizontal: Spacing.md, marginTop: Spacing.lg,
      backgroundColor: colors.bgAlt, borderRadius: 12, padding: Spacing.md,
      borderWidth: 1, borderColor: colors.borderLight, gap: Spacing.sm, ...Shadows.sm,
    },
    h2hTitle: { fontFamily: Fonts.heading, fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: colors.text },
    h2hRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
    h2hSide: { alignItems: 'center', flex: 1, gap: 2 },
    h2hScore: { fontFamily: Fonts.heading, fontSize: 34, fontWeight: FontWeight.extrabold },
    h2hSideLabel: { fontFamily: Fonts.body, fontSize: FontSize.sm, color: colors.textMuted },
    h2hDash: { fontFamily: Fonts.heading, fontSize: FontSize.xxl, color: colors.textFaint },
    h2hMetaRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.md },
    h2hMeta: { fontFamily: Fonts.body, fontSize: FontSize.base, color: colors.textMuted },
    h2hDots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
    h2hDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    coachChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.bluePale,
      borderWidth: 1,
      borderColor: colors.blue,
      borderRadius: Radius.full,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginTop: 2,
    },
    coachChipText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.semibold,
      color: colors.blue,
    },
    coachCard: {
      marginHorizontal: Spacing.md,
      marginTop: Spacing.lg,
      backgroundColor: colors.bluePale,
      borderRadius: 12,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.blue,
      gap: Spacing.xs,
      ...Shadows.sm,
    },
    coachCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
    coachCardTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.bold,
      color: colors.blue,
    },
    coachBio: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.text,
      marginBottom: 2,
    },
    coachDetail: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      color: colors.textMuted,
    },
    coachDetailLabel: {
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    equipmentSection: {
      marginHorizontal: Spacing.md,
      marginTop: Spacing.lg,
    },
    equipmentHeading: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.bold,
      color: colors.text,
      marginBottom: Spacing.sm,
    },
    equipmentPreview: {
      gap: Spacing.xs,
    },
    equipmentLine: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
      borderRadius: Radius.sm,
      backgroundColor: colors.bgMuted,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 10,
    },
    equipmentLineLabel: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.bold,
      color: colors.textFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    equipmentLineValue: {
      flex: 1,
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
      color: colors.text,
      textAlign: 'right',
    },
    equipmentEmpty: {
      alignItems: 'center',
      gap: Spacing.xs,
      paddingVertical: Spacing.lg,
    },
    equipmentEmptyTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xl,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    equipmentEmptyText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.textMuted,
      textAlign: 'center',
    },
    actions: {
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.lg,
    },
    inviteBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderRadius: Radius.md,
      paddingVertical: 14,
      gap: Spacing.xs,
      ...Shadows.md,
    },
    inviteBtnText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.semibold,
      color: colors.textOnPrimary,
    },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    sheet: {
      backgroundColor: colors.bgAlt,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      width: '100%',
      maxWidth: 430,
      ...Shadows.lg,
    },
    handleWrap: { alignItems: 'center', paddingBottom: Spacing.sm },
    handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border },
    sheetTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      color: colors.text,
      marginBottom: Spacing.sm,
    },
    emptyText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.textFaint,
      textAlign: 'center',
      paddingVertical: Spacing.lg,
    },
    eventRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    eventIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.amberPale,
    },
    eventTitle: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.semibold,
      color: colors.text,
    },
    eventMeta: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      color: colors.textFaint,
    },
    closeBtn: {
      marginTop: Spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.md,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    closeBtnText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
      color: colors.textMuted,
    },
  });
}
