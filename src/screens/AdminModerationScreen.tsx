import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius, Shadows } from '../theme';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import {
  getPendingVenues,
  approveVenue,
  rejectVenue,
  getFlaggedReviews,
  keepReview,
  deleteReview,
} from '../services/admin';
import { getProfile } from '../services/profiles';

export function AdminModerationScreen() {
  const [pendingVenues, setPendingVenues] = useState<any[]>([]);
  const [flaggedReviews, setFlaggedReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);
  const router = useRouter();
  const { user } = useSession();
  const { s } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    if (!user) return;
    getProfile(user.id).then(({ data }) => {
      setIsAdmin(data?.is_admin === true);
      setAdminLoading(false);
    });
  }, [user]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [venuesRes, reviewsRes] = await Promise.all([
        getPendingVenues(),
        getFlaggedReviews(),
      ]);
      if (venuesRes.data) setPendingVenues(venuesRes.data);
      if (reviewsRes.data) setFlaggedReviews(reviewsRes.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = useCallback(async (id: number) => {
    const { error } = await approveVenue(id, user!.id);
    if (error) {
      Alert.alert(s('error'), s('approveError'));
      return;
    }
    setPendingVenues((prev) => prev.filter((v) => v.id !== id));
  }, [user]);

  const handleReject = useCallback(async (id: number) => {
    const { error } = await rejectVenue(id, user!.id);
    if (error) {
      Alert.alert(s('error'), s('rejectError'));
      return;
    }
    setPendingVenues((prev) => prev.filter((v) => v.id !== id));
  }, [user]);

  const handleKeep = useCallback(async (id: number) => {
    const { error } = await keepReview(id, user!.id);
    if (error) {
      Alert.alert(s('error'), s('keepError'));
      return;
    }
    setFlaggedReviews((prev) => prev.filter((r) => r.id !== id));
  }, [user]);

  const handleDelete = useCallback(async (id: number) => {
    const { error } = await deleteReview(id, user!.id);
    if (error) {
      Alert.alert(s('error'), s('deleteError'));
      return;
    }
    setFlaggedReviews((prev) => prev.filter((r) => r.id !== id));
  }, [user]);

  if (adminLoading) return <ActivityIndicator />;
  if (!isAdmin) {
    router.back();
    return null;
  }

  const stats = [
    { value: String(pendingVenues.length), label: s('pendingStat'), bg: colors.amberPale, color: colors.accent },
    { value: '—', label: s('approvedStat'), bg: colors.primaryPale, color: colors.greenDeep },
    { value: String(flaggedReviews.length), label: s('reportedStat'), bg: colors.redPale, color: colors.redDeep },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Lucide name="arrow-left" size={24} color={colors.textOnPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{s('adminModeration')}</Text>
        <View style={styles.adminBadge}>
          <Text style={styles.adminBadgeText}>{s('admin')}</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ flex: 1, marginTop: 40 }} />
      ) : (
        <ScrollView style={styles.scroll}>
          {/* Stats */}
          <View style={styles.statsRow}>
            {stats.map((stat) => (
              <View key={stat.label} style={[styles.statCard, { backgroundColor: stat.bg }]}>
                <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>

          {/* Pending Section Label */}
          <View style={styles.secLabel}>
            <Text style={styles.secLabelText}>{s('pendingVenues')}</Text>
          </View>

          {/* Moderation Cards */}
          <View style={styles.modList}>
            {pendingVenues.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <Text style={{ fontFamily: Fonts.body, fontSize: 13, color: colors.textFaint }}>
                  {s('noPendingVenues')}
                </Text>
              </View>
            ) : (
              pendingVenues.map((venue) => (
                <View key={venue.id} style={styles.modCard}>
                  <View style={styles.modTop}>
                    <Text style={styles.modTitle}>{venue.name}</Text>
                    <View style={styles.modBadge}>
                      <Text style={styles.modBadgeText}>{s('newBadge')}</Text>
                    </View>
                  </View>
                  <Text style={styles.modMeta}>
                    {s('addedBy')}{venue.profiles?.full_name ?? s('user').toLowerCase()} {'\u00B7'}{' '}
                    {new Date(venue.created_at).toLocaleDateString('ro-RO')} {'\u00B7'}{' '}
                    {venue.city ?? ''}{venue.address ? `, ${venue.address}` : ''}
                  </Text>
                  <View style={styles.modActions}>
                    <TouchableOpacity
                      style={styles.approveBtn}
                      onPress={() => handleApprove(venue.id)}
                    >
                      <Lucide name="check" size={14} color={colors.textOnPrimary} />
                      <Text style={styles.approveBtnText}>{s('approve')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.editBtn} onPress={() => router.push('/venue/' + venue.id as any)}>
                      <Lucide name="pencil" size={14} color={colors.textMuted} />
                      <Text style={styles.editBtnText}>{s('edit')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.rejectBtn}
                      onPress={() => handleReject(venue.id)}
                    >
                      <Lucide name="x" size={14} color={colors.red} />
                      <Text style={styles.rejectBtnText}>{s('reject')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Flagged Reviews Section Label */}
          <View style={styles.secLabel}>
            <Text style={styles.secLabelText}>{s('reportedReviews')}</Text>
          </View>

          {/* Flagged Review Cards */}
          <View style={styles.flagList}>
            {flaggedReviews.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <Text style={{ fontFamily: Fonts.body, fontSize: 13, color: colors.textFaint }}>
                  {s('noReportedReviews')}
                </Text>
              </View>
            ) : (
              flaggedReviews.map((review) => (
                <View key={review.id} style={styles.flagCard}>
                  <View style={styles.flagTop}>
                    <View style={styles.flagInfo}>
                      <Text style={styles.flagAuthor}>
                        {review.profiles?.full_name ?? s('user')}
                      </Text>
                      <Text style={styles.flagMeta}>
                        {review.venues?.name ?? s('venue')} {'\u00B7'}{' '}
                        {new Date(review.created_at).toLocaleDateString('ro-RO')}
                      </Text>
                    </View>
                    <View style={styles.flagBadge}>
                      <Text style={styles.flagBadgeText}>
                        {review.flag_count ?? 0} {s('reports')}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.flagText}>
                    {`"${review.body ?? review.text ?? ''}"`}
                  </Text>
                  <View style={styles.flagActions}>
                    <TouchableOpacity
                      style={styles.keepBtn}
                      onPress={() => handleKeep(review.id)}
                    >
                      <Lucide name="check" size={14} color={colors.textMuted} />
                      <Text style={styles.keepBtnText}>{s('keep')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDelete(review.id)}
                    >
                      <Lucide name="trash-2" size={14} color={colors.textOnPrimary} />
                      <Text style={styles.deleteBtnText}>{s('deleteBtn')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
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
      backgroundColor: colors.primary,
      height: 52,
      paddingHorizontal: Spacing.md,
      ...Shadows.bar,
    },
    headerTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      color: colors.textOnPrimary,
    },
    adminBadge: {
      backgroundColor: colors.primaryLight,
      borderRadius: 12,
      paddingVertical: Spacing.xxs,
      paddingHorizontal: 10,
    },
    adminBadgeText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.bold,
      color: colors.textOnPrimary,
    },
    scroll: {
      flex: 1,
    },
    statsRow: {
      flexDirection: 'row',
      gap: Spacing.xs,
      padding: Spacing.md,
      paddingBottom: Spacing.sm,
    },
    statCard: {
      flex: 1,
      alignItems: 'center',
      borderRadius: Radius.md,
      padding: 10,
      gap: 2,
      ...Shadows.sm,
    },
    statValue: {
      fontFamily: Fonts.heading,
      fontSize: 22,
      fontWeight: FontWeight.extrabold,
    },
    statLabel: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.medium,
      color: colors.textMuted,
    },
    secLabel: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      paddingBottom: Spacing.xs,
    },
    secLabelText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.bold,
      color: colors.textFaint,
      letterSpacing: 1,
    },
    modList: {
      paddingHorizontal: Spacing.md,
      gap: 10,
    },
    modCard: {
      backgroundColor: colors.bgAlt,
      borderRadius: 12,
      padding: 14,
      gap: 10,
      borderWidth: 1.5,
      borderColor: colors.amber,
      ...Shadows.sm,
    },
    modTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    modTitle: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.semibold,
      color: colors.text,
      flex: 1,
    },
    modBadge: {
      backgroundColor: colors.amberPale,
      borderRadius: 8,
      paddingVertical: 2,
      paddingHorizontal: Spacing.xs,
    },
    modBadgeText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.semibold,
      color: colors.accent,
    },
    modMeta: {
      fontFamily: Fonts.body,
      fontSize: FontSize.base,
      color: colors.textFaint,
    },
    modActions: {
      flexDirection: 'row',
      gap: Spacing.xs,
    },
    approveBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderRadius: 8,
      height: 36,
      gap: 6,
      ...Shadows.md,
    },
    approveBtnText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.base,
      fontWeight: FontWeight.semibold,
      color: colors.textOnPrimary,
    },
    editBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      height: 36,
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    editBtnText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.base,
      fontWeight: FontWeight.semibold,
      color: colors.textMuted,
    },
    rejectBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      height: 36,
      gap: 6,
      borderWidth: 1,
      borderColor: colors.redBorder,
      ...Shadows.md,
    },
    rejectBtnText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.base,
      fontWeight: FontWeight.semibold,
      color: colors.red,
    },
    flagList: {
      paddingHorizontal: Spacing.md,
      gap: 10,
    },
    flagCard: {
      backgroundColor: colors.bgAlt,
      borderRadius: 12,
      padding: 14,
      gap: 10,
      borderWidth: 1.5,
      borderColor: colors.red,
      ...Shadows.sm,
    },
    flagTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    flagInfo: {
      gap: 2,
    },
    flagAuthor: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.semibold,
      color: colors.text,
    },
    flagMeta: {
      fontFamily: Fonts.body,
      fontSize: FontSize.base,
      color: colors.textFaint,
    },
    flagBadge: {
      backgroundColor: colors.redPale,
      borderRadius: 8,
      paddingVertical: 2,
      paddingHorizontal: 8,
    },
    flagBadgeText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.semibold,
      color: colors.red,
    },
    flagText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontStyle: 'italic',
      color: colors.textMuted,
    },
    flagActions: {
      flexDirection: 'row',
      gap: Spacing.xs,
    },
    keepBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      height: 36,
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
      ...Shadows.md,
    },
    keepBtnText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.base,
      fontWeight: FontWeight.semibold,
      color: colors.textMuted,
    },
    deleteBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.redDeep,
      borderRadius: 8,
      height: 36,
      gap: 6,
      ...Shadows.md,
    },
    deleteBtnText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.base,
      fontWeight: FontWeight.semibold,
      color: colors.textOnPrimary,
    },
  });
}
