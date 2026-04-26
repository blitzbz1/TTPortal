import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Modal, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius, Shadows } from '../theme';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import { getProfile, getProfileStats } from '../services/profiles';
import { getEvents, sendEventInvites } from '../services/events';
import { getCurrentEquipmentForUser } from '../services/equipment';
import type { Profile, EquipmentSelection } from '../types/database';

interface Props {
  userId: string;
}

export function PlayerProfileScreen({ userId }: Props) {
  const router = useRouter();
  const { user } = useSession();
  const { s } = useI18n();
  const { colors, isDark } = useTheme();
  const headerFg = isDark ? colors.text : colors.textOnPrimary;
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<{ total_checkins: number; unique_venues: number; events_joined: number; total_hours_played: number } | null>(null);
  const [equipment, setEquipment] = useState<EquipmentSelection | null>(null);
  const [equipmentLoading, setEquipmentLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [myEvents, setMyEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [sendingInviteId, setSendingInviteId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setEquipmentLoading(true);
      // allSettled: a slow stats/equipment call shouldn't block rendering the
      // profile header. Each fetch lands independently with whatever it has.
      const [profileRes, statsRes, equipmentRes] = await Promise.allSettled([
        getProfile(userId),
        getProfileStats(userId),
        getCurrentEquipmentForUser(userId),
      ]);
      if (cancelled) return;
      if (profileRes.status === 'fulfilled' && profileRes.value.data) {
        setProfile(profileRes.value.data as Profile);
      }
      if (statsRes.status === 'fulfilled' && statsRes.value.data) {
        setStats(statsRes.value.data);
      }
      if (equipmentRes.status === 'fulfilled') {
        setEquipment(equipmentRes.value.data?.[0] ?? null);
      }
      setEquipmentLoading(false);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  const handLabel = useCallback((value?: string | null) => {
    if (value === 'right') return s('equipmentHandRight');
    if (value === 'left') return s('equipmentHandLeft');
    return '-';
  }, [s]);

  const styleLabel = useCallback((value?: string | null) => {
    if (value === 'attacker') return s('equipmentStyleAttacker');
    if (value === 'defender') return s('equipmentStyleDefender');
    if (value === 'all_rounder') return s('equipmentStyleAllRounder');
    return '-';
  }, [s]);

  const gripLabel = useCallback((value?: string | null) => {
    if (value === 'shakehand') return s('equipmentGripShakehand');
    if (value === 'penhold') return s('equipmentGripPenhold');
    if (value === 'other') return s('equipmentGripOther');
    return '-';
  }, [s]);

  const renderEquipmentLine = (label: string, value: string) => (
    <View key={label} style={styles.equipmentLine}>
      <Text style={styles.equipmentLineLabel}>{label}</Text>
      <Text style={styles.equipmentLineValue}>{value}</Text>
    </View>
  );

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
    const { error } = await sendEventInvites(event.id, [userId], user.id);
    setSendingInviteId(null);
    if (error) {
      Alert.alert(s('error'), error.message ?? s('genericError'));
      return;
    }
    setPickerVisible(false);
    if (Platform.OS === 'web') {
      window.alert(s('inviteSent'));
    } else {
      Alert.alert(s('success'), s('inviteSent'));
    }
  }, [user, userId, s]);

  const isSelf = user?.id === userId;

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

          <View style={styles.equipmentSection}>
            <Text style={styles.equipmentHeading}>
              {s('equipmentFriendTitle', profile?.full_name ?? s('user'))}
            </Text>
            {equipmentLoading ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: Spacing.md }} />
            ) : equipment ? (
              <View style={styles.equipmentPreview}>
                {renderEquipmentLine(
                  s('equipmentBlade'),
                  `${equipment.blade_manufacturer} ${equipment.blade_model}`,
                )}
                {renderEquipmentLine(
                  s('equipmentForehand'),
                  `${equipment.forehand_rubber_manufacturer} ${equipment.forehand_rubber_model} \u00B7 ${s(`equipmentColor_${equipment.forehand_rubber_color}`)}`,
                )}
                {renderEquipmentLine(
                  s('equipmentBackhand'),
                  `${equipment.backhand_rubber_manufacturer} ${equipment.backhand_rubber_model} \u00B7 ${s(`equipmentColor_${equipment.backhand_rubber_color}`)}`,
                )}
                {renderEquipmentLine(s('equipmentHand'), handLabel(equipment.dominant_hand))}
                {renderEquipmentLine(s('equipmentPlayingStyle'), styleLabel(equipment.playing_style))}
                {renderEquipmentLine(s('equipmentGrip'), gripLabel(equipment.grip))}
              </View>
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
            </View>
          )}
        </ScrollView>
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
                  const dateStr = new Date(ev.starts_at).toLocaleString('ro-RO', {
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
