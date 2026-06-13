// T052: the default moderation tab — pending venues (admin-only) + flagged
// reviews. Owns its react-query data; row mutations update the query cache
// in place (no refetch) to match the old surgical setState removals.
import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Modal, Pressable } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { showAlert } from '../../lib/dialogs';
import { Fonts } from '../../theme';
import { useTheme } from '../../hooks/useTheme';
import { useI18n } from '../../hooks/useI18n';
import { useSession } from '../../hooks/useSession';
import { citiesQueryKey } from '../../hooks/queries/useCitiesQuery';
import {
  adminPendingVenuesKey,
  adminFlaggedReviewsKey,
  useAdminPendingVenuesQuery,
  useAdminFlaggedReviewsQuery,
} from '../../hooks/queries/useAdminListsQuery';
import { approveVenue, rejectVenue, keepReview, deleteReview } from '../../services/admin';
import { PendingVenueCard, FlaggedReviewCard } from './cards';
import type { AdminModerationStyles } from '../AdminModerationScreen.styles';

interface ReviewsTabProps {
  isAdmin: boolean;
  styles: AdminModerationStyles;
  onEditVenue: (venue: any) => void;
}

export function ReviewsTab({ isAdmin, styles, onEditVenue }: ReviewsTabProps) {
  const { user } = useSession();
  const { s } = useI18n();
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const { data: pendingVenues = [], isLoading: pendingLoading } = useAdminPendingVenuesQuery();
  const { data: flaggedReviews = [], isLoading: flaggedLoading } = useAdminFlaggedReviewsQuery();

  // Reject confirmation bottom sheet — set to a venue to open, null to close.
  const [rejectTarget, setRejectTarget] = useState<any | null>(null);
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  const removePendingVenue = useCallback((id: number) => {
    queryClient.setQueryData<any[]>(adminPendingVenuesKey, (prev) =>
      prev?.filter((v) => v.id !== id),
    );
  }, [queryClient]);

  const removeFlaggedReview = useCallback((id: number) => {
    queryClient.setQueryData<any[]>(adminFlaggedReviewsKey, (prev) =>
      prev?.filter((r) => r.id !== id),
    );
  }, [queryClient]);

  const handleApprove = useCallback(async (id: number) => {
    const { error } = await approveVenue(id, user!.id);
    if (error) {
      showAlert(s('error'), s('approveError'));
      return;
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['venues'], exact: false }),
      queryClient.invalidateQueries({ queryKey: citiesQueryKey }),
    ]);
    removePendingVenue(id);
  }, [queryClient, removePendingVenue, user, s]);

  const handleReject = useCallback((venue: any) => {
    setRejectTarget(venue);
  }, []);

  const confirmReject = useCallback(async () => {
    if (!rejectTarget || !user) return;
    setRejectSubmitting(true);
    const { error } = await rejectVenue(rejectTarget.id, user.id);
    setRejectSubmitting(false);
    if (error) {
      showAlert(s('error'), s('rejectError'));
      return;
    }
    removePendingVenue(rejectTarget.id);
    setRejectTarget(null);
  }, [rejectTarget, removePendingVenue, user, s]);

  const handleKeep = useCallback(async (id: number) => {
    const { error } = await keepReview(id, user!.id);
    if (error) {
      showAlert(s('error'), s('keepError'));
      return;
    }
    removeFlaggedReview(id);
  }, [removeFlaggedReview, user, s]);

  const handleDelete = useCallback(async (id: number) => {
    const { error } = await deleteReview(id, user!.id);
    if (error) {
      showAlert(s('error'), s('deleteError'));
      return;
    }
    removeFlaggedReview(id);
  }, [removeFlaggedReview, user, s]);

  if (pendingLoading || flaggedLoading) {
    return <ActivityIndicator size="large" color={colors.primary} style={{ flex: 1, marginTop: 40 }} />;
  }

  const stats = [
    { value: String(pendingVenues.length), label: s('pendingStat'), bg: colors.amberPale, color: colors.accent },
    { value: '—', label: s('approvedStat'), bg: colors.primaryPale, color: colors.greenDeep },
    { value: String(flaggedReviews.length), label: s('reportedStat'), bg: colors.redPale, color: colors.redDeep },
  ];

  return (
    <>
      <ScrollView style={styles.scroll}>
        {isAdmin && (<>
        {/* Stats */}
        <View style={styles.statsRow}>
          {stats.map((stat) => (
            <View key={stat.label} style={[styles.statCard, { backgroundColor: stat.bg }]}>
              <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Pending Venues */}
        <View style={styles.secLabel}>
          <Text style={styles.secLabelText}>{s('pendingVenues')}</Text>
        </View>
        <View style={styles.modList}>
          {pendingVenues.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <Text style={{ fontFamily: Fonts.body, fontSize: 13, color: colors.textFaint }}>
                {s('noPendingVenues')}
              </Text>
            </View>
          ) : (
            pendingVenues.map((venue) => (
              <PendingVenueCard
                key={venue.id}
                venue={venue}
                styles={styles}
                colors={colors}
                s={s}
                onApprove={handleApprove}
                onEdit={onEditVenue}
                onReject={handleReject}
              />
            ))
          )}
        </View>
        </>)}

        {/* Flagged Reviews */}
        <View style={styles.secLabel}>
          <Text style={styles.secLabelText}>{s('reportedReviews')}</Text>
        </View>
        <View style={styles.flagList}>
          {flaggedReviews.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <Text style={{ fontFamily: Fonts.body, fontSize: 13, color: colors.textFaint }}>
                {s('noReportedReviews')}
              </Text>
            </View>
          ) : (
            flaggedReviews.map((review) => (
              <FlaggedReviewCard
                key={review.id}
                review={review}
                styles={styles}
                colors={colors}
                s={s}
                onKeep={handleKeep}
                onDelete={handleDelete}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* Reject confirmation bottom sheet. Reject is a hard delete (no
          rejected_at flag, no submitter notification), so we surface the
          consequence and require an explicit confirmation tap. */}
      <Modal
        visible={rejectTarget !== null}
        transparent
        animationType="slide"
        onRequestClose={() => !rejectSubmitting && setRejectTarget(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => !rejectSubmitting && setRejectTarget(null)}>
          <Pressable style={styles.confirmSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle}><View style={styles.modalHandleBar} /></View>
            <Text style={styles.modalTitle}>{s('confirmRejectTitle')}</Text>
            <View style={styles.confirmBody}>
              {rejectTarget?.name ? (
                <Text style={styles.confirmVenueName}>{rejectTarget.name}</Text>
              ) : null}
              <Text style={styles.confirmMessage}>{s('confirmRejectMessage')}</Text>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setRejectTarget(null)}
                disabled={rejectSubmitting}
              >
                <Text style={styles.modalCancelText}>{s('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmRejectBtn, rejectSubmitting && { opacity: 0.6 }]}
                onPress={confirmReject}
                disabled={rejectSubmitting}
              >
                {rejectSubmitting ? (
                  <ActivityIndicator size="small" color={colors.textOnPrimary} />
                ) : (
                  <Text style={styles.confirmRejectText}>{s('reject')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
