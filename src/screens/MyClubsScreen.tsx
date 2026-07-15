import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
  TextInput,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { showAlert, showConfirm } from '../lib/dialogs';
import { Lucide } from '../components/Icon';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius, Shadows } from '../theme';
import { useI18n } from '../hooks/useI18n';
import { useSession } from '../hooks/useSession';
import { useMyClubsQuery, useJoinClub, getClubByCode } from '../features/clubs';
import { venueImageUrl } from '../lib/imageTransforms';

export function MyClubsScreen() {
  const router = useRouter();
  const { s } = useI18n();
  const { user } = useSession();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { data: clubs = [], isLoading, refetch, isRefetching } = useMyClubsQuery(user?.id);
  const joinClub = useJoinClub();
  const [code, setCode] = useState('');

  const handleJoin = useCallback(async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    // Preview the club by code so the user confirms the right one before joining.
    const { data: preview } = await getClubByCode(trimmed);
    if (!preview) {
      showAlert(s('error'), s('clubJoinNotFound'));
      return;
    }
    if (preview.already_member) {
      setCode('');
      router.push({ pathname: '/(protected)/clubs/[id]', params: { id: String(preview.id) } });
      return;
    }
    const ok = await showConfirm(
      preview.name,
      s('clubJoinConfirmBody', s('clubMemberCount', String(preview.member_count))),
      { confirmLabel: s('clubJoinCta') },
    );
    if (!ok) return;
    try {
      const clubId = await joinClub.mutateAsync(trimmed);
      setCode('');
      router.push({ pathname: '/(protected)/clubs/[id]', params: { id: String(clubId) } });
    } catch {
      showAlert(s('error'), s('clubJoinNotFound'));
    }
  }, [code, joinClub, router, s]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          accessibilityLabel={s('back')}
          testID="my-clubs-back"
        >
          <Lucide name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{s('clubsTitle')}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
        }
      >
        {/* Create + join entry points */}
        <Pressable
          style={styles.primaryBtn}
          onPress={() => router.push('/(protected)/clubs/new')}
          testID="clubs-create"
        >
          <Lucide name="plus" size={18} color={colors.textOnPrimary} />
          <Text style={styles.primaryBtnText}>{s('clubCreateCta')}</Text>
        </Pressable>

        <View style={styles.joinRow}>
          <TextInput
            style={styles.joinInput}
            placeholder={s('clubJoinCodePlaceholder')}
            placeholderTextColor={colors.textFaint}
            autoCapitalize="characters"
            autoCorrect={false}
            value={code}
            onChangeText={setCode}
            maxLength={7}
            testID="clubs-join-code"
          />
          <Pressable
            style={[styles.joinBtn, (!code.trim() || joinClub.isPending) && styles.joinBtnDisabled]}
            onPress={handleJoin}
            disabled={!code.trim() || joinClub.isPending}
            testID="clubs-join-submit"
          >
            {joinClub.isPending ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <Text style={styles.joinBtnText}>{s('clubJoinCta')}</Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.sectionHeader}>{s('clubsMine')}</Text>

        {isLoading && clubs.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} testID="my-clubs-loading" />
          </View>
        ) : clubs.length === 0 ? (
          <View style={styles.empty}>
            <Lucide name="users-round" size={36} color={colors.textFaint} />
            <Text style={styles.emptyText}>{s('clubsEmpty')}</Text>
          </View>
        ) : (
          clubs.map((club) => (
            <Pressable
              key={club.id}
              style={styles.row}
              onPress={() => router.push({ pathname: '/(protected)/clubs/[id]', params: { id: String(club.id) } })}
              testID={`club-row-${club.id}`}
            >
              {club.avatar_url ? (
                <Image
                  source={{ uri: venueImageUrl(club.avatar_url, { width: 96, quality: 75 }) ?? club.avatar_url }}
                  style={styles.avatar}
                />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Lucide name="users-round" size={20} color={colors.textFaint} />
                </View>
              )}
              <View style={styles.rowInfo}>
                <Text style={styles.rowName} numberOfLines={1}>{club.name}</Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {club.role === 'admin' ? `${s('clubRoleAdmin')} · ` : ''}
                  {s('clubMemberCount', String(club.member_count))}
                </Text>
              </View>
              <Lucide name="chevron-right" size={18} color={colors.textFaint} />
            </Pressable>
          ))
        )}
      </ScrollView>
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
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    scroll: { flex: 1 },
    content: { padding: Spacing.md, gap: Spacing.sm },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: Radius.md,
      paddingVertical: 14,
    },
    primaryBtnText: {
      fontFamily: Fonts.body,
      fontSize: 15,
      fontWeight: FontWeight.bold,
      color: colors.textOnPrimary,
    },
    joinRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    joinInput: {
      flex: 1,
      backgroundColor: colors.bgAlt,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.md,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontFamily: Fonts.body,
      fontSize: 16,
      letterSpacing: 2,
      color: colors.text,
    },
    joinBtn: {
      paddingHorizontal: 18,
      paddingVertical: 13,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgAlt,
      minWidth: 72,
      alignItems: 'center',
    },
    joinBtnDisabled: { opacity: 0.5 },
    joinBtnText: {
      fontFamily: Fonts.body,
      fontSize: 14,
      fontWeight: FontWeight.semibold,
      color: colors.text,
    },
    sectionHeader: {
      fontFamily: Fonts.body,
      fontSize: 12,
      fontWeight: FontWeight.bold,
      color: colors.textFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: Spacing.md,
      marginBottom: Spacing.xxs,
    },
    center: { alignItems: 'center', paddingVertical: 40 },
    empty: { alignItems: 'center', paddingVertical: 48, gap: 12 },
    emptyText: {
      fontFamily: Fonts.body,
      fontSize: 15,
      color: colors.textMuted,
      textAlign: 'center',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.bgAlt,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bgMuted },
    avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    rowInfo: { flex: 1, gap: 2 },
    rowName: {
      fontFamily: Fonts.body,
      fontSize: 15,
      fontWeight: FontWeight.semibold,
      color: colors.text,
    },
    rowMeta: { fontFamily: Fonts.body, fontSize: 13, color: colors.textFaint },
  });
}
