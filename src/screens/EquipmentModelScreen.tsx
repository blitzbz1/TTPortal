import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  // eslint-disable-next-line no-restricted-imports -- dynamic review action sheet keeps Alert; it has an explicit web fallback (mirrors VenueDetailScreen)
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { showAlert, showConfirm } from '../lib/dialogs';
import { Lucide } from '../components/Icon';
import { ReportReasonModal } from '../components/ReportReasonModal';
import { useSession } from '../hooks/useSession';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../hooks/useI18n';
import { useOfflineQueue } from '../contexts/OfflineQueueProvider';
import {
  useCallerOwnsModelQuery,
  useEquipmentModelReviewsQuery,
  useEquipmentModelSummaryQuery,
  usePostEquipmentReviewMutation,
} from '../hooks/queries/useEquipmentReviewsQuery';
import { reportContent, blockUser, type ReportReason } from '../services/moderation';
import type {
  EquipmentCategory,
  EquipmentReview,
  EquipmentTimeUsed,
} from '../types/database';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Radius, Spacing } from '../theme';

interface Props {
  category: EquipmentCategory;
  manufacturerId: string;
  manufacturer?: string;
  model: string;
}

const TIME_USED_OPTIONS: EquipmentTimeUsed[] = ['lt_1m', '1_6m', '6_12m', '1_2y', 'gt_2y'];
const TIME_USED_LABEL: Record<EquipmentTimeUsed, string> = {
  lt_1m: 'equipReviewTimeLt1m',
  '1_6m': 'equipReviewTime1to6m',
  '6_12m': 'equipReviewTime6to12m',
  '1_2y': 'equipReviewTime1to2y',
  gt_2y: 'equipReviewTimeGt2y',
};

function StarsRow({
  rating,
  onPress,
  styles,
  idPrefix = 'equip-star',
}: {
  rating: number;
  onPress?: (n: number) => void;
  styles: ReturnType<typeof createStyles>;
  idPrefix?: string;
}) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity
          key={star}
          disabled={!onPress}
          testID={`${idPrefix}-${star}`}
          style={styles.starBtn}
          onPress={() => onPress?.(star)}
        >
          <Lucide
            name="star"
            size={onPress ? 26 : 16}
            color={star <= rating ? '#f59e0b' : styles._faint.color}
            strokeWidth={2}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

function AxisScale({
  label,
  value,
  onChange,
  styles,
}: {
  label: string;
  value: number | null;
  onChange?: (n: number) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.axisRow}>
      <Text style={styles.axisLabel}>{label}</Text>
      <View style={styles.axisScale}>
        {Array.from({ length: 11 }, (_, n) => {
          const active = value != null && n <= value;
          return (
            <TouchableOpacity
              key={n}
              disabled={!onChange}
              testID={`equip-axis-${label}-${n}`}
              style={[styles.axisDot, active && styles.axisDotActive]}
              onPress={() => onChange?.(n)}
            />
          );
        })}
      </View>
      <Text style={styles.axisValue}>{value == null ? '—' : value}</Text>
    </View>
  );
}

function ReviewCard({
  review,
  isOwn,
  onMenu,
  styles,
  s,
}: {
  review: EquipmentReview;
  isOwn: boolean;
  onMenu: (r: EquipmentReview) => void;
  styles: ReturnType<typeof createStyles>;
  s: (key: string, ...args: string[]) => string;
}) {
  const tags: string[] = [];
  if (review.author_grip) tags.push(s(`equipmentGrip${cap(review.author_grip)}`));
  if (review.author_style) tags.push(s(styleKey(review.author_style)));
  if (review.author_hand) tags.push(s(review.author_hand === 'left' ? 'equipmentHandLeft' : 'equipmentHandRight'));
  if (review.time_used) tags.push(s(TIME_USED_LABEL[review.time_used]));
  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHead}>
        <StarsRow rating={review.rating} styles={styles} />
        <TouchableOpacity
          testID={`equip-review-menu-${review.id}`}
          onPress={() => onMenu(review)}
          style={styles.reviewMenuBtn}
          accessibilityRole="button"
          accessibilityLabel={s('reviewActions')}
        >
          <Lucide name="flag-off" size={16} color={styles._faint.color} />
        </TouchableOpacity>
      </View>
      {tags.length > 0 ? (
        <View style={styles.reviewTags}>
          {tags.map((t, i) => (
            <View key={`${t}-${i}`} style={styles.reviewTag}>
              <Text style={styles.reviewTagText}>{t}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {review.body ? <Text style={styles.reviewBody}>{review.body}</Text> : null}
      {isOwn ? <Text style={styles.reviewOwnHint}>{s('equipReviewYours')}</Text> : null}
    </View>
  );
}

function cap(v: string) {
  return v.charAt(0).toUpperCase() + v.slice(1);
}
function styleKey(style: string) {
  if (style === 'attacker') return 'equipmentStyleAttacker';
  if (style === 'defender') return 'equipmentStyleDefender';
  return 'equipmentStyleAllRounder';
}

export function EquipmentModelScreen({ category, manufacturerId, manufacturer, model }: Props) {
  const router = useRouter();
  const { user } = useSession();
  const { colors } = useTheme();
  const { s } = useI18n();
  const { isOnline } = useOfflineQueue();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const modelKey = useMemo(
    () => ({ category, manufacturerId, model }),
    [category, manufacturerId, model],
  );

  const { data: summary, isLoading: summaryLoading } = useEquipmentModelSummaryQuery(modelKey);
  const { data: reviews = [], isLoading: reviewsLoading } = useEquipmentModelReviewsQuery(modelKey);
  const { data: owns = false } = useCallerOwnsModelQuery(modelKey, user?.id);
  const postReview = usePostEquipmentReviewMutation(modelKey);

  // Review form state.
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(4);
  const [speed, setSpeed] = useState<number | null>(null);
  const [spin, setSpin] = useState<number | null>(null);
  const [control, setControl] = useState<number | null>(null);
  const [timeUsed, setTimeUsed] = useState<EquipmentTimeUsed | null>(null);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Report state.
  const [reportingReview, setReportingReview] = useState<EquipmentReview | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const performBlockUser = useCallback(
    async (targetUserId: string) => {
      const { error } = await blockUser(targetUserId);
      if (error) {
        const isStaff = String((error as { message?: string })?.message ?? '').includes('cannot_block_staff');
        showAlert(s('error'), isStaff ? s('blockStaffError') : s('blockUserError'));
        return;
      }
      showAlert(s('blockedToastTitle'), s('blockedToastBody'));
    },
    [s],
  );

  const openReviewMenu = useCallback(
    (review: EquipmentReview) => {
      if (!user) return;
      const isOwn = review.user_id === user.id;
      const targetId = review.user_id;
      const buttons: { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }[] = [
        { text: s('reportReviewAction'), onPress: () => setReportingReview(review) },
      ];
      if (!isOwn && targetId) {
        buttons.push({
          text: s('blockUserAction'),
          style: 'destructive',
          onPress: async () => {
            if (
              await showConfirm(s('blockUserAction'), s('blockUserConfirm'), {
                confirmLabel: s('blockUserAction'),
                cancelLabel: s('cancel'),
                destructive: true,
              })
            ) {
              void performBlockUser(targetId);
            }
          },
        });
      }
      buttons.push({ text: s('cancel'), style: 'cancel' });

      if (Platform.OS === 'web') {
        const choices = buttons.filter((b) => b.style !== 'cancel');
        const label = choices.map((c, i) => `${i + 1}. ${c.text}`).join('\n');
        const choice = window.prompt(`${s('reviewActions')}\n\n${label}\n\n${s('reviewActionsHint')}`);
        const idx = Number(choice);
        if (Number.isInteger(idx) && idx >= 1 && idx <= choices.length) {
          choices[idx - 1].onPress?.();
        }
      } else {
        Alert.alert(s('reviewActions'), undefined, buttons);
      }
    },
    [user, s, performBlockUser],
  );

  const handleSubmitReport = useCallback(
    async (reason: ReportReason, notes: string | undefined) => {
      if (!reportingReview) return;
      setReportSubmitting(true);
      const { error } = await reportContent('equipment_review', reportingReview.id, reason, notes);
      setReportSubmitting(false);
      setReportingReview(null);
      if (error) {
        showAlert(s('error'), s('reportError'));
        return;
      }
      showAlert(s('reportedToastTitle'), s('reportedToastBody'));
    },
    [reportingReview, s],
  );

  const handleSubmitReview = useCallback(async () => {
    if (!isOnline) {
      showAlert(s('error'), s('offlineActionError'));
      return;
    }
    setSubmitting(true);
    try {
      await postReview.mutateAsync({
        category,
        manufacturerId,
        model,
        rating,
        speed,
        spin,
        control,
        timeUsed,
        body: body.trim() || null,
      });
      setShowForm(false);
      showAlert(s('success'), s('equipReviewPublished'));
    } catch {
      showAlert(s('error'), s('equipReviewError'));
    } finally {
      setSubmitting(false);
    }
  }, [
    isOnline, postReview, category, manufacturerId, model, rating, speed, spin, control, timeUsed, body, s,
  ]);

  const title = manufacturer ? `${manufacturer} ${model}` : model;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={s('back')}
        >
          <Lucide name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerEyebrow}>
            {s(category === 'blade' ? 'equipmentBlade' : 'gearRubber')}
          </Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Summary card */}
        <View style={styles.card}>
          {summaryLoading && !summary ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : summary && summary.review_count > 0 ? (
            <>
              <View style={styles.summaryHead}>
                <StarsRow rating={Math.round(summary.avg_rating ?? 0)} styles={styles} />
                <Text style={styles.summaryAvg}>
                  {summary.avg_rating != null ? summary.avg_rating.toFixed(1) : '—'}
                </Text>
                <Text style={styles.summaryCount}>
                  {s('equipReviewCount', String(summary.review_count))}
                </Text>
              </View>
              <View style={styles.axisGroup}>
                <AxisScale label={s('equipReviewSpeed')} value={summary.avg_speed != null ? Math.round(summary.avg_speed) : null} styles={styles} />
                <AxisScale label={s('equipReviewSpin')} value={summary.avg_spin != null ? Math.round(summary.avg_spin) : null} styles={styles} />
                <AxisScale label={s('equipReviewControl')} value={summary.avg_control != null ? Math.round(summary.avg_control) : null} styles={styles} />
              </View>
            </>
          ) : (
            <Text style={styles.emptySummary}>{s('equipReviewNoneYet')}</Text>
          )}
          <View style={styles.usageRow}>
            <Lucide name="users" size={15} color={colors.textFaint} />
            <Text style={styles.usageText}>
              {s('gearPlayersUseThis', String(summary?.users_count ?? 0))}
            </Text>
          </View>
        </View>

        {/* Owner-gated review form / CTA */}
        {user ? (
          owns ? (
            showForm ? (
              <View style={styles.card}>
                <Text style={styles.formTitle}>{s('equipReviewWriteTitle')}</Text>
                <Text style={styles.fieldLabel}>{s('fieldRating')}</Text>
                <StarsRow rating={rating} onPress={setRating} styles={styles} idPrefix="equip-form-star" />
                <View style={styles.axisGroup}>
                  <AxisScale label={s('equipReviewSpeed')} value={speed} onChange={setSpeed} styles={styles} />
                  <AxisScale label={s('equipReviewSpin')} value={spin} onChange={setSpin} styles={styles} />
                  <AxisScale label={s('equipReviewControl')} value={control} onChange={setControl} styles={styles} />
                </View>
                <Text style={styles.fieldLabel}>{s('equipReviewTimeUsed')}</Text>
                <View style={styles.timeRow}>
                  {TIME_USED_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      testID={`equip-time-${opt}`}
                      style={[styles.timeChip, timeUsed === opt && styles.timeChipActive]}
                      onPress={() => setTimeUsed((prev) => (prev === opt ? null : opt))}
                    >
                      <Text style={[styles.timeChipText, timeUsed === opt && styles.timeChipTextActive]}>
                        {s(TIME_USED_LABEL[opt])}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.fieldLabel}>{s('fieldYourReview')}</Text>
                <TextInput
                  testID="equip-review-body"
                  style={styles.textarea}
                  placeholder={s('equipReviewBodyPlaceholder')}
                  placeholderTextColor={colors.textFaint}
                  value={body}
                  onChangeText={setBody}
                  maxLength={2000}
                  multiline
                  textAlignVertical="top"
                />
                <View style={styles.formActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)}>
                    <Text style={styles.cancelText}>{s('cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID="equip-review-submit"
                    style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                    onPress={handleSubmitReview}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color={colors.textOnPrimary} />
                    ) : (
                      <Text style={styles.submitText}>{s('publish')}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                testID="equip-write-review"
                style={styles.writeCta}
                onPress={() => setShowForm(true)}
              >
                <Lucide name="pen-line" size={16} color={colors.primary} />
                <Text style={styles.writeCtaText}>{s('equipReviewWriteCta')}</Text>
              </TouchableOpacity>
            )
          ) : (
            <View style={styles.gateNote}>
              <Lucide name="info" size={15} color={colors.textFaint} />
              <Text style={styles.gateNoteText}>{s('equipReviewOwnerGate')}</Text>
            </View>
          )
        ) : null}

        {/* Reviews list */}
        <Text style={styles.sectionTitle}>{s('equipReviewSectionTitle')}</Text>
        {reviewsLoading && reviews.length === 0 ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 16 }} />
        ) : reviews.length > 0 ? (
          reviews.map((r) => (
            <ReviewCard
              key={r.id}
              review={r}
              isOwn={r.user_id === user?.id}
              onMenu={openReviewMenu}
              styles={styles}
              s={s}
            />
          ))
        ) : (
          <Text style={styles.emptyReviews}>{s('equipReviewNoneYet')}</Text>
        )}
        <View style={{ height: 32 }} />
      </ScrollView>

      <ReportReasonModal
        visible={!!reportingReview}
        submitting={reportSubmitting}
        onClose={() => setReportingReview(null)}
        onSubmit={handleSubmitReport}
      />
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    _faint: { color: colors.textFaint },
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      gap: Spacing.sm,
    },
    backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerCopy: { flex: 1 },
    headerSpacer: { width: 40 },
    headerEyebrow: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.semibold,
      color: colors.textFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.7,
    },
    headerTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.lg },
    card: {
      backgroundColor: colors.bgAlt,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.md,
      marginBottom: Spacing.md,
      gap: Spacing.sm,
    },
    summaryHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    summaryAvg: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    summaryCount: { fontFamily: Fonts.body, fontSize: FontSize.sm, color: colors.textFaint },
    emptySummary: { fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.textMuted },
    axisGroup: { gap: 8, marginTop: 4 },
    axisRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    axisLabel: { width: 64, fontFamily: Fonts.body, fontSize: FontSize.sm, color: colors.textMuted },
    axisScale: { flex: 1, flexDirection: 'row', gap: 3, alignItems: 'center' },
    axisDot: {
      flex: 1,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.bgMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    axisDotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    axisValue: { width: 22, textAlign: 'right', fontFamily: Fonts.body, fontSize: FontSize.sm, color: colors.text },
    usageRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    usageText: { fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.textMuted },
    starsRow: { flexDirection: 'row', gap: 2 },
    starBtn: { padding: 2 },
    writeCta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primaryPale,
      borderWidth: 1,
      borderColor: colors.primaryDim,
      borderRadius: Radius.md,
      paddingVertical: 14,
      marginBottom: Spacing.md,
    },
    writeCtaText: { fontFamily: Fonts.body, fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: colors.primaryMid },
    gateNote: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.bgMuted,
      borderRadius: Radius.md,
      padding: Spacing.sm,
      marginBottom: Spacing.md,
    },
    gateNoteText: { flex: 1, fontFamily: Fonts.body, fontSize: FontSize.sm, color: colors.textMuted },
    formTitle: { fontFamily: Fonts.heading, fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: colors.text },
    fieldLabel: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.semibold,
      color: colors.textFaint,
      letterSpacing: 0.5,
      marginTop: 4,
    },
    timeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    timeChip: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: colors.bgMuted,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    timeChipActive: { backgroundColor: colors.primaryPale, borderColor: colors.primaryDim },
    timeChipText: { fontFamily: Fonts.body, fontSize: FontSize.sm, color: colors.textMuted },
    timeChipTextActive: { color: colors.primaryMid, fontWeight: FontWeight.semibold },
    textarea: {
      backgroundColor: colors.bg,
      borderRadius: 8,
      minHeight: 80,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.text,
    },
    formActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
    cancelBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.md,
      height: 46,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelText: { fontFamily: Fonts.body, fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: colors.textMuted },
    submitBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderRadius: Radius.md,
      height: 46,
    },
    submitText: { fontFamily: Fonts.body, fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: colors.textOnPrimary },
    sectionTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.bold,
      color: colors.text,
      marginBottom: Spacing.sm,
    },
    reviewCard: {
      backgroundColor: colors.bgAlt,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
      gap: 8,
    },
    reviewHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    reviewMenuBtn: { padding: 4 },
    reviewTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    reviewTag: {
      backgroundColor: colors.bgMuted,
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    reviewTagText: { fontFamily: Fonts.body, fontSize: FontSize.xs, color: colors.textMuted },
    reviewBody: { fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.text, lineHeight: 20 },
    reviewOwnHint: { fontFamily: Fonts.body, fontSize: FontSize.xs, color: colors.textFaint, fontStyle: 'italic' },
    emptyReviews: { fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.textMuted, marginTop: 8 },
  });
}
