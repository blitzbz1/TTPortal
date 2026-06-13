// T052: user feedback tab (admin-only). Owns the feedback query — it only
// mounts when the tab is active, which preserves the old lazy fetch-on-open.
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { showAlert, showConfirm } from '../../lib/dialogs';
import { Lucide } from '../../components/Icon';
import { FeedbackReplyModal } from '../../components/FeedbackReplyModal';
import { Fonts } from '../../theme';
import { useTheme } from '../../hooks/useTheme';
import { useI18n } from '../../hooks/useI18n';
import { useSession } from '../../hooks/useSession';
import { adminFeedbackKey, useAdminFeedbackQuery } from '../../hooks/queries/useAdminListsQuery';
import { deleteUserFeedback } from '../../services/admin';
import { FeedbackCard } from './cards';
import type { AdminModerationStyles } from '../AdminModerationScreen.styles';

interface FeedbackTabProps {
  styles: AdminModerationStyles;
}

export function FeedbackTab({ styles }: FeedbackTabProps) {
  const { user } = useSession();
  const { s } = useI18n();
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const { data: userFeedback = [], isLoading: feedbackLoading } = useAdminFeedbackQuery();
  const [replyTarget, setReplyTarget] = useState<any | null>(null);

  const handleDeleteFeedback = useCallback(async (id: string) => {
    if (await showConfirm(s('confirmDeleteFeedback'), '', { confirmLabel: s('deleteBtn'), cancelLabel: s('cancel'), destructive: true })) {
      const { error } = await deleteUserFeedback(id, user!.id);
      if (error) { showAlert(s('error'), s('deleteError')); return; }
      queryClient.setQueryData<any[]>(adminFeedbackKey, (prev) =>
        prev?.filter((f) => f.id !== id),
      );
    }
  }, [queryClient, user, s]);

  return (
    <>
      <ScrollView style={styles.scroll}>
        <View style={styles.secLabel}>
          <Text style={styles.secLabelText}>{s('userFeedbackSection')}</Text>
        </View>
        {feedbackLoading ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ paddingVertical: 24 }} />
        ) : userFeedback.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <Lucide name="clipboard-pen-line" size={32} color={colors.border} />
            <Text style={{ fontFamily: Fonts.body, fontSize: 13, color: colors.textFaint, marginTop: 8 }}>
              {s('noUserFeedback')}
            </Text>
          </View>
        ) : (
          userFeedback.map((item) => (
            <FeedbackCard
              key={item.id}
              item={item}
              styles={styles}
              colors={colors}
              s={s}
              onReply={setReplyTarget}
              onDelete={handleDeleteFeedback}
            />
          ))
        )}
      </ScrollView>
      <FeedbackReplyModal feedback={replyTarget} onClose={() => setReplyTarget(null)} />
    </>
  );
}
