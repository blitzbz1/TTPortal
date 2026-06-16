import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  Share,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { showAlert, showConfirm } from '../lib/dialogs';
import { Lucide } from '../components/Icon';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius, Shadows } from '../theme';
import { useI18n } from '../hooks/useI18n';
import { getDateLocale } from '../contexts/I18nProvider';
import { useSession } from '../hooks/useSession';
import {
  useClubDetailQuery,
  useLeaveClub,
  useRemoveMember,
  useRotateCode,
  type ClubMember,
} from '../features/clubs';
import { clubUrl, sharePayload } from '../lib/shareLinks';
import { venueImageUrl } from '../lib/imageTransforms';

export function ClubScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const clubId = id ? Number(id) : undefined;
  const { s, lang } = useI18n();
  const { user } = useSession();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { data: club, isLoading, refetch, isRefetching } = useClubDetailQuery(clubId);
  const leaveClub = useLeaveClub();
  const removeMember = useRemoveMember();
  const rotateCode = useRotateCode();

  const isAdmin = club?.my_role === 'admin';

  const handleShareCode = useCallback(() => {
    if (!club) return;
    Share.share(sharePayload(s('clubShareMessage', club.join_code), clubUrl(club.join_code)));
  }, [club, s]);

  const handleRotate = useCallback(async () => {
    if (!clubId) return;
    const ok = await showConfirm(s('clubRotateConfirmTitle'), s('clubRotateConfirmBody'), {
      confirmLabel: s('clubRotateCta'),
    });
    if (!ok) return;
    try {
      const code = await rotateCode.mutateAsync(clubId);
      showAlert(s('clubRotateDoneTitle'), s('clubRotateDoneBody', code));
    } catch {
      showAlert(s('error'), s('clubActionFailed'));
    }
  }, [clubId, rotateCode, s]);

  const handleLeave = useCallback(async () => {
    if (!clubId) return;
    const ok = await showConfirm(s('clubLeaveConfirmTitle'), s('clubLeaveConfirmBody'), {
      confirmLabel: s('clubLeaveCta'),
      destructive: true,
    });
    if (!ok) return;
    try {
      await leaveClub.mutateAsync(clubId);
      router.back();
    } catch {
      showAlert(s('error'), s('clubLeaveLastAdmin'));
    }
  }, [clubId, leaveClub, router, s]);

  const handleRemove = useCallback(
    async (member: ClubMember) => {
      if (!clubId || !isAdmin || member.user_id === user?.id) return;
      const ok = await showConfirm(
        s('clubRemoveConfirmTitle'),
        s('clubRemoveConfirmBody', member.full_name || member.username || s('anon')),
        { confirmLabel: s('clubRemoveCta'), destructive: true },
      );
      if (!ok) return;
      try {
        await removeMember.mutateAsync({ clubId, userId: member.user_id });
      } catch {
        showAlert(s('error'), s('clubActionFailed'));
      }
    },
    [clubId, isAdmin, user?.id, removeMember, s],
  );

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(getDateLocale(lang), {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

  if (isLoading && !club) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header onBack={() => router.back()} title={s('clubsTitle')} styles={styles} colors={colors} backLabel={s('back')} />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} testID="club-loading" />
        </View>
      </SafeAreaView>
    );
  }

  if (!club) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header onBack={() => router.back()} title={s('clubsTitle')} styles={styles} colors={colors} backLabel={s('back')} />
        <View style={styles.center}>
          <Text style={styles.emptyText}>{s('clubNotFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header onBack={() => router.back()} title={club.name} styles={styles} colors={colors} backLabel={s('back')} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
        }
      >
        {/* Club identity */}
        <View style={styles.identity}>
          {club.avatar_url ? (
            <Image
              source={{ uri: venueImageUrl(club.avatar_url, { width: 160, quality: 80 }) ?? club.avatar_url }}
              style={styles.clubAvatar}
            />
          ) : (
            <View style={[styles.clubAvatar, styles.avatarPlaceholder]}>
              <Lucide name="users-round" size={28} color={colors.textFaint} />
            </View>
          )}
          <Text style={styles.clubName}>{club.name}</Text>
          {club.description ? <Text style={styles.clubDesc}>{club.description}</Text> : null}
          <Text style={styles.clubMeta}>{s('clubMemberCount', String(club.member_count))}</Text>
        </View>

        {/* Home venue card */}
        {club.home_venue_id && club.home_venue_name ? (
          <Pressable
            style={styles.venueCard}
            onPress={() => router.push({ pathname: '/venue/[id]', params: { id: String(club.home_venue_id) } })}
            testID="club-home-venue"
          >
            <View style={styles.venueIcon}>
              <Lucide name="home" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.venueLabel}>{s('clubHomeVenueLabel')}</Text>
              <Text style={styles.venueName} numberOfLines={1}>{club.home_venue_name}</Text>
            </View>
            <Lucide name="chevron-right" size={18} color={colors.textFaint} />
          </Pressable>
        ) : null}

        {/* Join code (admins can rotate + everyone can share) */}
        <View style={styles.codeRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionHeader}>{s('clubJoinCodeLabel')}</Text>
            <Text style={styles.codeValue} testID="club-detail-code">{club.join_code}</Text>
          </View>
          <Pressable style={styles.iconBtn} onPress={handleShareCode} testID="club-share-code" accessibilityLabel={s('clubShareCta')}>
            <Lucide name="share-2" size={18} color={colors.text} />
          </Pressable>
          {isAdmin ? (
            <Pressable
              style={styles.iconBtn}
              onPress={handleRotate}
              testID="club-rotate-code"
              accessibilityLabel={s('clubRotateCta')}
            >
              <Lucide name="refresh-cw" size={18} color={colors.text} />
            </Pressable>
          ) : null}
        </View>

        {/* Upcoming club events */}
        <Text style={styles.sectionHeader}>{s('clubUpcomingEvents')}</Text>
        {club.upcoming_events.length === 0 ? (
          <Text style={styles.subtle}>{s('clubNoEvents')}</Text>
        ) : (
          club.upcoming_events.map((ev) => (
            <Pressable
              key={ev.id}
              style={styles.eventRow}
              onPress={() => router.push({ pathname: '/(protected)/event/[eventId]', params: { eventId: String(ev.id) } })}
              testID={`club-event-${ev.id}`}
            >
              <View style={styles.eventIcon}>
                <Lucide name="calendar" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.eventTitle} numberOfLines={1}>{ev.title}</Text>
                <Text style={styles.eventDate}>{fmtDate(ev.starts_at)}</Text>
              </View>
              <Lucide name="chevron-right" size={16} color={colors.textFaint} />
            </Pressable>
          ))
        )}

        {/* Members */}
        <Text style={styles.sectionHeader}>{s('clubMembers')}</Text>
        {isAdmin ? <Text style={styles.subtle}>{s('clubRemoveHint')}</Text> : null}
        {club.members.map((m) => (
          <Pressable
            key={m.user_id}
            style={styles.memberRow}
            onLongPress={() => handleRemove(m)}
            delayLongPress={400}
            disabled={!isAdmin || m.user_id === user?.id}
            testID={`club-member-${m.user_id}`}
          >
            {m.avatar_url ? (
              <Image
                source={{ uri: venueImageUrl(m.avatar_url, { width: 80, quality: 75 }) ?? m.avatar_url }}
                style={styles.memberAvatar}
              />
            ) : (
              <View style={[styles.memberAvatar, styles.avatarPlaceholder]}>
                <Lucide name="user" size={18} color={colors.textFaint} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName} numberOfLines={1}>
                {m.full_name || m.username || s('anon')}
              </Text>
              {m.username ? <Text style={styles.memberUsername}>@{m.username}</Text> : null}
            </View>
            {m.role === 'admin' ? (
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>{s('clubRoleAdmin')}</Text>
              </View>
            ) : null}
          </Pressable>
        ))}

        {/* Leave club */}
        <Pressable style={styles.leaveBtn} onPress={handleLeave} testID="club-leave">
          <Lucide name="log-out" size={18} color={colors.red} />
          <Text style={styles.leaveText}>{s('clubLeaveCta')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({
  onBack,
  title,
  styles,
  colors,
  backLabel,
}: {
  onBack: () => void;
  title: string;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
  backLabel: string;
}) {
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
        accessibilityLabel={backLabel}
        testID="club-back"
      >
        <Lucide name="arrow-left" size={22} color={colors.text} />
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
      <View style={{ width: 22 }} />
    </View>
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
      flex: 1,
      textAlign: 'center',
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    scroll: { flex: 1 },
    content: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 40 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
    emptyText: { fontFamily: Fonts.body, fontSize: 15, color: colors.textMuted },
    identity: { alignItems: 'center', gap: 8, paddingVertical: Spacing.sm },
    clubAvatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.bgMuted },
    avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    clubName: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxxl,
      fontWeight: FontWeight.bold,
      color: colors.text,
      textAlign: 'center',
    },
    clubDesc: { fontFamily: Fonts.body, fontSize: 14, color: colors.textMuted, textAlign: 'center' },
    clubMeta: { fontFamily: Fonts.body, fontSize: 13, color: colors.textFaint },
    venueCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.bgAlt,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: Radius.md,
      padding: 12,
    },
    venueIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primaryPale,
      alignItems: 'center',
      justifyContent: 'center',
    },
    venueLabel: { fontFamily: Fonts.body, fontSize: 12, color: colors.textFaint },
    venueName: { fontFamily: Fonts.body, fontSize: 15, fontWeight: FontWeight.semibold, color: colors.text },
    codeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.bgAlt,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: Radius.md,
      padding: 12,
    },
    codeValue: {
      fontFamily: Fonts.heading,
      fontSize: 24,
      fontWeight: FontWeight.bold,
      color: colors.primary,
      letterSpacing: 4,
    },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionHeader: {
      fontFamily: Fonts.body,
      fontSize: 12,
      fontWeight: FontWeight.bold,
      color: colors.textFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: Spacing.sm,
    },
    subtle: { fontFamily: Fonts.body, fontSize: 13, color: colors.textMuted },
    eventRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.bgAlt,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: Radius.md,
      padding: 12,
    },
    eventIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primaryPale,
      alignItems: 'center',
      justifyContent: 'center',
    },
    eventTitle: { fontFamily: Fonts.body, fontSize: 15, fontWeight: FontWeight.semibold, color: colors.text },
    eventDate: { fontFamily: Fonts.body, fontSize: 13, color: colors.textFaint },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    memberAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bgMuted },
    memberName: { fontFamily: Fonts.body, fontSize: 15, fontWeight: FontWeight.semibold, color: colors.text },
    memberUsername: { fontFamily: Fonts.body, fontSize: 13, color: colors.textFaint },
    roleBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: Radius.sm,
      backgroundColor: colors.primaryPale,
    },
    roleBadgeText: {
      fontFamily: Fonts.body,
      fontSize: 11,
      fontWeight: FontWeight.bold,
      color: colors.primaryMid,
      textTransform: 'uppercase',
    },
    leaveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.redPale,
      borderRadius: Radius.md,
      paddingVertical: 14,
      marginTop: Spacing.lg,
    },
    leaveText: { fontFamily: Fonts.body, fontSize: 15, fontWeight: FontWeight.semibold, color: colors.red },
  });
}
