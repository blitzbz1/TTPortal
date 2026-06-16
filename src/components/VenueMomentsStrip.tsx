// F042: "Recent moments" strip on venue detail (under the photo carousel).
// Photo cards from check-in moments; long-press to report (non-authors) or
// soft-delete (authors). Block filtering + auto-flag happen server-side
// (migration 125). Lazily loaded via its own RPC, mirroring VenueBoardSection.
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Image, ScrollView } from 'react-native';
import { showAlert, showConfirm } from '../lib/dialogs';
import { Lucide } from './Icon';
import { ReportReasonModal } from './ReportReasonModal';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../hooks/useI18n';
import { getDateLocale } from '../contexts/I18nProvider';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius } from '../theme';
import { venueImageUrl } from '../lib/imageTransforms';
import {
  useVenueMomentsQuery,
  useDeleteMomentMutation,
  type VenueMoment,
} from '../features/checkinMoments';
import { reportContent, type ReportReason } from '../services/moderation';

interface Props {
  venueId: number;
  currentUserId: string | undefined;
}

export function VenueMomentsStrip({ venueId, currentUserId }: Props) {
  const { colors } = useTheme();
  const { s, lang } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dateLocale = getDateLocale(lang);

  const { data: moments = [], isLoading } = useVenueMomentsQuery(venueId, currentUserId);
  const deleteMutation = useDeleteMomentMutation(venueId);

  const [reportingMomentId, setReportingMomentId] = useState<number | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const onLongPressMoment = useCallback(async (moment: VenueMoment) => {
    if (!currentUserId) return;
    if (moment.user_id === currentUserId) {
      if (await showConfirm(s('momentDeleteAction'), s('momentDeleteConfirm'), {
        confirmLabel: s('momentDeleteAction'), cancelLabel: s('cancel'), destructive: true,
      })) {
        void deleteMutation.mutateAsync(moment.id);
      }
    } else {
      setReportingMomentId(moment.id);
    }
  }, [currentUserId, deleteMutation, s]);

  const handleSubmitReport = useCallback(async (reason: ReportReason, notes: string | undefined) => {
    if (reportingMomentId == null) return;
    setReportSubmitting(true);
    const { error } = await reportContent('checkin_moment', reportingMomentId, reason, notes);
    setReportSubmitting(false);
    setReportingMomentId(null);
    showAlert(error ? s('error') : s('reportedToastTitle'), error ? s('reportError') : s('reportedToastBody'));
  }, [reportingMomentId, s]);

  const fmtAge = (iso: string) => new Date(iso).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' });

  // Nothing to show: keep the venue detail clean (no empty header).
  if ((isLoading && moments.length === 0)) {
    return (
      <View style={styles.section} testID="venue-moments-loading">
        <View style={styles.titleRow}>
          <Lucide name="camera" size={16} color={colors.text} />
          <Text style={styles.title}>{s('momentsTitle')}</Text>
        </View>
        <ActivityIndicator size="small" color={colors.primary} style={{ paddingVertical: 16 }} />
      </View>
    );
  }
  if (moments.length === 0) return null;

  return (
    <View style={styles.section} testID="venue-moments-strip">
      <View style={styles.titleRow}>
        <Lucide name="camera" size={16} color={colors.text} />
        <Text style={styles.title}>{s('momentsTitle')}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {moments.map((moment) => (
          <TouchableOpacity
            key={moment.id}
            activeOpacity={0.9}
            onLongPress={() => onLongPressMoment(moment)}
            style={styles.card}
            testID={`moment-card-${moment.id}`}
          >
            <Image
              source={{ uri: venueImageUrl(moment.photo_url, { width: 360, quality: 75 }) ?? moment.photo_url }}
              style={styles.photo}
              resizeMode="cover"
            />
            <View style={styles.meta}>
              <Text style={styles.author} numberOfLines={1}>{moment.author_name || s('anon')}</Text>
              <Text style={styles.age}>{fmtAge(moment.created_at)}</Text>
            </View>
            {moment.caption ? (
              <Text style={styles.caption} numberOfLines={2}>{moment.caption}</Text>
            ) : null}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ReportReasonModal
        visible={reportingMomentId !== null}
        submitting={reportSubmitting}
        onClose={() => setReportingMomentId(null)}
        onSubmit={handleSubmitReport}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    section: { backgroundColor: colors.bg, padding: Spacing.md, gap: 10 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    title: { fontFamily: Fonts.heading, fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: colors.text },
    row: { gap: 12, paddingRight: Spacing.md },
    card: { width: 180, gap: 4 },
    photo: {
      width: 180,
      height: 180,
      borderRadius: Radius.md,
      backgroundColor: colors.bgAlt,
    },
    meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    author: { flex: 1, fontFamily: Fonts.body, fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: colors.text },
    age: { fontFamily: Fonts.body, fontSize: FontSize.sm, color: colors.textFaint },
    caption: { fontFamily: Fonts.body, fontSize: FontSize.sm, color: colors.textMuted },
  });
}
