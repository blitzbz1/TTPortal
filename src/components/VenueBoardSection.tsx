// F016: venue board & Q&A section (below reviews on venue detail). Questions
// with one level of replies, a helpful vote, report/delete, and a >60-day
// collapse. Block filtering + auto-flag happen server-side (migration 112).
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { showAlert, showConfirm } from '../lib/dialogs';
import { Lucide } from './Icon';
import { Card } from './Card';
import { ReportReasonModal } from './ReportReasonModal';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../hooks/useI18n';
import { getDateLocale } from '../contexts/I18nProvider';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius } from '../theme';
import {
  useVenueBoardQuery,
  usePostVenueMessageMutation,
  useTogglePostHelpfulMutation,
  useDeleteVenuePostMutation,
  type BoardPost,
} from '../features/venueBoard';
import { reportContent, type ReportReason } from '../services/moderation';

const COLLAPSE_AGE_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

interface Props {
  venueId: number;
  currentUserId: string | undefined;
}

export function VenueBoardSection({ venueId, currentUserId }: Props) {
  const { colors } = useTheme();
  const { s, lang } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dateLocale = getDateLocale(lang);

  const { data: posts = [], isLoading } = useVenueBoardQuery(venueId);
  const postMutation = usePostVenueMessageMutation(venueId);
  const helpfulMutation = useTogglePostHelpfulMutation(venueId);
  const deleteMutation = useDeleteVenuePostMutation(venueId);

  const [askText, setAskText] = useState('');
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [showOlder, setShowOlder] = useState(false);
  const [reportingPostId, setReportingPostId] = useState<number | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const now = Date.now();
  const { recent, older } = useMemo(() => {
    const r: BoardPost[] = [];
    const o: BoardPost[] = [];
    for (const p of posts) {
      (now - new Date(p.created_at).getTime() > COLLAPSE_AGE_MS ? o : r).push(p);
    }
    return { recent: r, older: o };
  }, [posts, now]);

  const submitAsk = useCallback(async () => {
    const body = askText.trim();
    if (!body) return;
    try {
      await postMutation.mutateAsync({ body });
      setAskText('');
    } catch {
      showAlert(s('error'), s('venueBoardPostError'));
    }
  }, [askText, postMutation, s]);

  const submitReply = useCallback(async (parentId: number) => {
    const body = replyText.trim();
    if (!body) return;
    try {
      await postMutation.mutateAsync({ body, parentId });
      setReplyText('');
      setReplyTo(null);
    } catch {
      showAlert(s('error'), s('venueBoardPostError'));
    }
  }, [replyText, postMutation, s]);

  const onLongPressPost = useCallback(async (post: BoardPost) => {
    if (!currentUserId) return;
    if (post.user_id === currentUserId) {
      if (await showConfirm(s('venueBoardDeleteAction'), s('venueBoardDeleteConfirm'), {
        confirmLabel: s('venueBoardDeleteAction'), cancelLabel: s('cancel'), destructive: true,
      })) {
        void deleteMutation.mutateAsync(post.id);
      }
    } else {
      setReportingPostId(post.id);
    }
  }, [currentUserId, deleteMutation, s]);

  const handleSubmitReport = useCallback(async (reason: ReportReason, notes: string | undefined) => {
    if (reportingPostId == null) return;
    setReportSubmitting(true);
    const { error } = await reportContent('venue_post', reportingPostId, reason, notes);
    setReportSubmitting(false);
    setReportingPostId(null);
    showAlert(error ? s('error') : s('reportedToastTitle'), error ? s('reportError') : s('reportedToastBody'));
  }, [reportingPostId, s]);

  const fmtAge = (iso: string) => new Date(iso).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' });

  const renderPost = (post: BoardPost) => (
    <Card key={post.id} shadow="sm" borderRadius={Radius.md} style={styles.postCard}>
      <TouchableOpacity activeOpacity={0.9} onLongPress={() => onLongPressPost(post)} testID={`board-post-${post.id}`}>
        <View style={styles.postTop}>
          <Text style={styles.author}>{post.author_name || s('anon')}</Text>
          <Text style={styles.age}>{fmtAge(post.created_at)}</Text>
        </View>
        <Text style={styles.body}>{post.body}</Text>
      </TouchableOpacity>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => currentUserId && helpfulMutation.mutate(post.id)}
          disabled={!currentUserId}
          accessibilityRole="button"
          testID={`board-helpful-${post.id}`}
        >
          <Lucide name="check-circle" size={14} color={post.viewer_voted ? colors.primaryLight : colors.textFaint} />
          <Text style={[styles.actionText, post.viewer_voted && { color: colors.primaryMid }]}>
            {s('venueBoardHelpful')}{post.helpful_count > 0 ? ` · ${post.helpful_count}` : ''}
          </Text>
        </TouchableOpacity>
        {currentUserId ? (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => { setReplyTo(replyTo === post.id ? null : post.id); setReplyText(''); }}
            accessibilityRole="button"
            testID={`board-reply-btn-${post.id}`}
          >
            <Lucide name="message-circle" size={14} color={colors.textFaint} />
            <Text style={styles.actionText}>{s('venueBoardReply')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Replies */}
      {post.replies.map((r) => (
        <View key={r.id} style={styles.reply}>
          <View style={styles.postTop}>
            <Text style={styles.replyAuthor}>{r.author_name || s('anon')}</Text>
            <Text style={styles.age}>{fmtAge(r.created_at)}</Text>
          </View>
          <Text style={styles.replyBody}>{r.body}</Text>
        </View>
      ))}

      {/* Inline reply input */}
      {replyTo === post.id ? (
        <View style={styles.replyInputRow}>
          <TextInput
            style={styles.replyInput}
            value={replyText}
            onChangeText={setReplyText}
            placeholder={s('venueBoardReplyPlaceholder')}
            placeholderTextColor={colors.textFaint}
            maxLength={1000}
            multiline
            testID={`board-reply-input-${post.id}`}
          />
          <TouchableOpacity
            style={styles.sendBtn}
            onPress={() => submitReply(post.id)}
            disabled={postMutation.isPending || !replyText.trim()}
            testID={`board-reply-send-${post.id}`}
          >
            <Lucide name="send" size={16} color={colors.textOnPrimary} />
          </TouchableOpacity>
        </View>
      ) : null}
    </Card>
  );

  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <Lucide name="message-square" size={16} color={colors.text} />
        <Text style={styles.title}>{s('venueBoardTitle')}</Text>
      </View>

      {/* Ask box */}
      {currentUserId ? (
        <View style={styles.askRow}>
          <TextInput
            style={styles.askInput}
            value={askText}
            onChangeText={setAskText}
            placeholder={s('venueBoardAskPlaceholder')}
            placeholderTextColor={colors.textFaint}
            maxLength={1000}
            multiline
            testID="board-ask-input"
          />
          <TouchableOpacity
            style={styles.sendBtn}
            onPress={submitAsk}
            disabled={postMutation.isPending || !askText.trim()}
            testID="board-ask-send"
          >
            <Lucide name="send" size={16} color={colors.textOnPrimary} />
          </TouchableOpacity>
        </View>
      ) : null}

      {isLoading && posts.length === 0 ? (
        <ActivityIndicator size="small" color={colors.primary} style={{ paddingVertical: 16 }} />
      ) : posts.length === 0 ? (
        <Text style={styles.empty}>{s('venueBoardEmpty')}</Text>
      ) : (
        <>
          {recent.map(renderPost)}
          {older.length > 0 && !showOlder ? (
            <TouchableOpacity onPress={() => setShowOlder(true)} style={styles.showOlder} testID="board-show-older">
              <Text style={styles.showOlderText}>{s('venueBoardShowOlder', String(older.length))}</Text>
            </TouchableOpacity>
          ) : null}
          {showOlder ? older.map(renderPost) : null}
        </>
      )}

      <ReportReasonModal
        visible={reportingPostId !== null}
        submitting={reportSubmitting}
        onClose={() => setReportingPostId(null)}
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
    askRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
    askInput: {
      flex: 1,
      backgroundColor: colors.bgAlt,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
      minHeight: 40,
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.text,
      textAlignVertical: 'top',
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: Radius.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    empty: { fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.textFaint, paddingVertical: 8 },
    postCard: { padding: Spacing.md, gap: 6, backgroundColor: colors.bgAlt },
    postTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    author: { fontFamily: Fonts.body, fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: colors.text },
    age: { fontFamily: Fonts.body, fontSize: FontSize.sm, color: colors.textFaint },
    body: { fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.text },
    actionsRow: { flexDirection: 'row', gap: 16, marginTop: 2 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    actionText: { fontFamily: Fonts.body, fontSize: FontSize.sm, color: colors.textMuted },
    reply: {
      marginTop: 6,
      marginLeft: 12,
      paddingLeft: 10,
      borderLeftWidth: 2,
      borderLeftColor: colors.border,
      gap: 2,
    },
    replyAuthor: { fontFamily: Fonts.body, fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: colors.textMuted },
    replyBody: { fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.text },
    replyInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 8 },
    replyInput: {
      flex: 1,
      backgroundColor: colors.bg,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 10,
      paddingVertical: 6,
      minHeight: 36,
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.text,
      textAlignVertical: 'top',
    },
    showOlder: { paddingVertical: 8, alignItems: 'center' },
    showOlderText: { fontFamily: Fonts.body, fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: colors.primaryMid },
  });
}
