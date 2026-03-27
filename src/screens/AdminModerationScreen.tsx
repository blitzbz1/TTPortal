import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { Colors, Fonts, Radius } from '../theme';
import { useI18n } from '../hooks/useI18n';
import {
  getPendingVenues,
  approveVenue,
  rejectVenue,
  getFlaggedReviews,
  keepReview,
  deleteReview,
} from '../services/admin';

export function AdminModerationScreen() {
  const [pendingVenues, setPendingVenues] = useState<any[]>([]);
  const [flaggedReviews, setFlaggedReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { s } = useI18n();

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
    const { error } = await approveVenue(id);
    if (error) {
      Alert.alert(s('error'), s('approveError'));
      return;
    }
    setPendingVenues((prev) => prev.filter((v) => v.id !== id));
  }, []);

  const handleReject = useCallback(async (id: number) => {
    const { error } = await rejectVenue(id);
    if (error) {
      Alert.alert(s('error'), s('rejectError'));
      return;
    }
    setPendingVenues((prev) => prev.filter((v) => v.id !== id));
  }, []);

  const handleKeep = useCallback(async (id: number) => {
    const { error } = await keepReview(id);
    if (error) {
      Alert.alert(s('error'), s('keepError'));
      return;
    }
    setFlaggedReviews((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const handleDelete = useCallback(async (id: number) => {
    const { error } = await deleteReview(id);
    if (error) {
      Alert.alert(s('error'), s('deleteError'));
      return;
    }
    setFlaggedReviews((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const stats = [
    { value: String(pendingVenues.length), label: s('pendingStat'), bg: Colors.amberPale, color: Colors.orange },
    { value: '—', label: s('approvedStat'), bg: Colors.greenPale, color: '#15803d' },
    { value: String(flaggedReviews.length), label: s('reportedStat'), bg: Colors.redPale, color: Colors.redDeep },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Lucide name="arrow-left" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{s('adminModeration')}</Text>
        <View style={styles.adminBadge}>
          <Text style={styles.adminBadgeText}>{s('admin')}</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.green} style={{ flex: 1, marginTop: 40 }} />
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
                <Text style={{ fontFamily: Fonts.body, fontSize: 13, color: Colors.inkFaint }}>
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
                      <Lucide name="check" size={14} color={Colors.white} />
                      <Text style={styles.approveBtnText}>{s('approve')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.editBtn} onPress={() => router.push('/venue/' + venue.id as any)}>
                      <Lucide name="pencil" size={14} color={Colors.inkMuted} />
                      <Text style={styles.editBtnText}>{s('edit')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.rejectBtn}
                      onPress={() => handleReject(venue.id)}
                    >
                      <Lucide name="x" size={14} color={Colors.red} />
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
                <Text style={{ fontFamily: Fonts.body, fontSize: 13, color: Colors.inkFaint }}>
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
                      <Lucide name="check" size={14} color={Colors.inkMuted} />
                      <Text style={styles.keepBtnText}>{s('keep')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDelete(review.id)}
                    >
                      <Lucide name="trash-2" size={14} color={Colors.white} />
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
    height: 52,
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontFamily: Fonts.heading,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
  },
  adminBadge: {
    backgroundColor: Colors.greenLight,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  adminBadgeText: {
    fontFamily: Fonts.body,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.white,
  },
  scroll: {
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    paddingBottom: 12,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    borderRadius: Radius.md,
    padding: 10,
    gap: 2,
  },
  statValue: {
    fontFamily: Fonts.heading,
    fontSize: 22,
    fontWeight: '800',
  },
  statLabel: {
    fontFamily: Fonts.body,
    fontSize: 10,
    fontWeight: '500',
    color: Colors.inkMuted,
  },
  secLabel: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 8,
  },
  secLabelText: {
    fontFamily: Fonts.body,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.inkFaint,
    letterSpacing: 1,
  },
  modList: {
    paddingHorizontal: 16,
    gap: 10,
  },
  modCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    borderWidth: 1.5,
    borderColor: Colors.amber,
  },
  modTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modTitle: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ink,
    flex: 1,
  },
  modBadge: {
    backgroundColor: Colors.amberPale,
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  modBadgeText: {
    fontFamily: Fonts.body,
    fontSize: 10,
    fontWeight: '600',
    color: Colors.orange,
  },
  modMeta: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.inkFaint,
  },
  modActions: {
    flexDirection: 'row',
    gap: 8,
  },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.green,
    borderRadius: 8,
    height: 36,
    gap: 6,
  },
  approveBtnText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.white,
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
    borderColor: Colors.border,
  },
  editBtnText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.inkMuted,
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
    borderColor: '#fecaca',
  },
  rejectBtnText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.red,
  },
  flagList: {
    paddingHorizontal: 16,
    gap: 10,
  },
  flagCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    borderWidth: 1.5,
    borderColor: Colors.red,
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
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ink,
  },
  flagMeta: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.inkFaint,
  },
  flagBadge: {
    backgroundColor: Colors.redPale,
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  flagBadgeText: {
    fontFamily: Fonts.body,
    fontSize: 10,
    fontWeight: '600',
    color: Colors.red,
  },
  flagText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    fontStyle: 'italic',
    color: Colors.inkMuted,
  },
  flagActions: {
    flexDirection: 'row',
    gap: 8,
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
    borderColor: Colors.border,
  },
  keepBtnText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.inkMuted,
  },
  deleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.redDeep,
    borderRadius: 8,
    height: 36,
    gap: 6,
  },
  deleteBtnText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.white,
  },
});
