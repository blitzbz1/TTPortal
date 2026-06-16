// F063: the Coaches moderation tab (admin-only) — pending coach applications.
// Owns its react-query data; approve/reject update the query cache in place
// (no refetch), mirroring the surgical setState removals in ReviewsTab. Reject
// is a status transition (not a delete) but still asks for an explicit confirm
// via the same bottom-sheet pattern.
import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Modal, Pressable } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { showAlert } from '../../lib/dialogs';
import { Fonts } from '../../theme';
import { useTheme } from '../../hooks/useTheme';
import { useI18n } from '../../hooks/useI18n';
import { useSession } from '../../hooks/useSession';
import {
  adminPendingCoachesKey,
  useAdminPendingCoachesQuery,
} from '../../hooks/queries/useAdminListsQuery';
import { approveCoach, rejectCoach } from '../../services/admin';
import { PendingCoachCard } from './cards';
import type { AdminModerationStyles } from '../AdminModerationScreen.styles';

interface CoachesTabProps {
  styles: AdminModerationStyles;
}

export function CoachesTab({ styles }: CoachesTabProps) {
  const { user } = useSession();
  const { s } = useI18n();
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const { data: pendingCoaches = [], isLoading } = useAdminPendingCoachesQuery();

  // Reject confirmation bottom sheet — set to a coach to open, null to close.
  const [rejectTarget, setRejectTarget] = useState<any | null>(null);
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  const removePendingCoach = useCallback((id: number) => {
    queryClient.setQueryData<any[]>(adminPendingCoachesKey, (prev) =>
      prev?.filter((c) => c.id !== id),
    );
  }, [queryClient]);

  const handleApprove = useCallback(async (id: number) => {
    const { error } = await approveCoach(id, user!.id);
    if (error) {
      showAlert(s('error'), s('approveError'));
      return;
    }
    removePendingCoach(id);
  }, [removePendingCoach, user, s]);

  const handleReject = useCallback((coach: any) => {
    setRejectTarget(coach);
  }, []);

  const confirmReject = useCallback(async () => {
    if (!rejectTarget || !user) return;
    setRejectSubmitting(true);
    const { error } = await rejectCoach(rejectTarget.id, user.id);
    setRejectSubmitting(false);
    if (error) {
      showAlert(s('error'), s('rejectError'));
      return;
    }
    removePendingCoach(rejectTarget.id);
    setRejectTarget(null);
  }, [rejectTarget, removePendingCoach, user, s]);

  if (isLoading) {
    return <ActivityIndicator size="large" color={colors.primary} style={{ flex: 1, marginTop: 40 }} />;
  }

  return (
    <>
      <ScrollView style={styles.scroll}>
        <View style={styles.secLabel}>
          <Text style={styles.secLabelText}>{s('pendingCoaches')}</Text>
        </View>
        <View style={styles.modList}>
          {pendingCoaches.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <Text style={{ fontFamily: Fonts.body, fontSize: 13, color: colors.textFaint }}>
                {s('noPendingCoaches')}
              </Text>
            </View>
          ) : (
            pendingCoaches.map((coach) => (
              <PendingCoachCard
                key={coach.id}
                coach={coach}
                styles={styles}
                colors={colors}
                s={s}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* Reject confirmation bottom sheet. */}
      <Modal
        visible={rejectTarget !== null}
        transparent
        animationType="slide"
        onRequestClose={() => !rejectSubmitting && setRejectTarget(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => !rejectSubmitting && setRejectTarget(null)}>
          <Pressable style={styles.confirmSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle}><View style={styles.modalHandleBar} /></View>
            <Text style={styles.modalTitle}>{s('confirmRejectCoachTitle')}</Text>
            <View style={styles.confirmBody}>
              {rejectTarget?.profiles?.full_name ? (
                <Text style={styles.confirmVenueName}>{rejectTarget.profiles.full_name}</Text>
              ) : null}
              <Text style={styles.confirmMessage}>{s('confirmRejectCoachMessage')}</Text>
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
                testID="coach-confirm-reject"
              >
                {rejectSubmitting ? (
                  <ActivityIndicator size="small" color={colors.textOnPrimary} />
                ) : (
                  <Text style={styles.confirmRejectText}>{s('rejectCoach')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
