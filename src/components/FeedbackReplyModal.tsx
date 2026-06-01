import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { Lucide } from './Icon';
import { useTheme } from '../hooks/useTheme';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius, Shadows } from '../theme';
import { getFeedbackReplies, replyToFeedback } from '../services/admin';

const REPLY_MAX = 2000;

interface FeedbackItem {
  id: string;
  message: string;
  category: string;
  created_at: string;
  profiles?: { full_name?: string | null; email?: string | null } | null;
}

interface ReplyRow {
  id: string;
  reply_text: string;
  created_at: string;
  admin_id: string;
  profiles?: { full_name?: string | null } | null;
}

interface FeedbackReplyModalProps {
  feedback: FeedbackItem | null;
  onClose: () => void;
}

export function FeedbackReplyModal({ feedback, onClose }: FeedbackReplyModalProps) {
  const { colors } = useTheme();
  const { s } = useI18n();
  const { user } = useSession();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [replies, setReplies] = useState<ReplyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    const { data } = await getFeedbackReplies(id);
    if (data) setReplies(data as unknown as ReplyRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (feedback) {
      setReplyText('');
      setReplies([]);
      load(feedback.id);
    }
  }, [feedback, load]);

  const handleSend = useCallback(async () => {
    if (!feedback || !user) return;
    const trimmed = replyText.trim();
    if (!trimmed) return;
    setSending(true);
    const { data, error } = await replyToFeedback(feedback.id, user.id, trimmed);
    setSending(false);
    if (error) {
      Alert.alert(s('error'), s('feedbackReplyError'));
      return;
    }
    if (data) {
      setReplies((prev) => [...prev, data as unknown as ReplyRow]);
      setReplyText('');
    }
  }, [feedback, user, replyText, s]);

  if (!feedback) return null;

  const authorName = feedback.profiles?.full_name || feedback.profiles?.email || s('anon');
  const canSend = !sending && replyText.trim().length > 0;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.handleWrap}>
              <View style={styles.handle} />
            </View>

            <View style={styles.headerRow}>
              <Text style={styles.title}>{s('feedbackReplyTitle')}</Text>
              <TouchableOpacity
                onPress={onClose}
                accessibilityLabel={s('close')}
                testID="feedback-reply-close"
                hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
              >
                <Lucide name="x" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
              {/* Original feedback */}
              <View style={styles.original}>
                <Text style={styles.originalAuthor}>{authorName}</Text>
                <Text style={styles.originalMessage}>{feedback.message}</Text>
                <Text style={styles.originalMeta}>
                  {new Date(feedback.created_at).toLocaleString()}
                </Text>
              </View>

              {/* Reply history */}
              {loading ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ paddingVertical: 16 }} />
              ) : (
                replies.map((r) => (
                  <View key={r.id} style={styles.reply} testID={`reply-${r.id}`}>
                    <Text style={styles.replyAuthor}>
                      {r.profiles?.full_name || s('admin')}
                    </Text>
                    <Text style={styles.replyText}>{r.reply_text}</Text>
                    <Text style={styles.replyMeta}>
                      {new Date(r.created_at).toLocaleString()}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>

            <View style={styles.composeRow}>
              <TextInput
                style={styles.input}
                value={replyText}
                onChangeText={setReplyText}
                placeholder={s('feedbackReplyPlaceholder')}
                placeholderTextColor={colors.textFaint}
                multiline
                maxLength={REPLY_MAX}
                editable={!sending}
                testID="feedback-reply-input"
              />
              <TouchableOpacity
                style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
                onPress={handleSend}
                disabled={!canSend}
                testID="feedback-reply-send"
              >
                {sending ? (
                  <ActivityIndicator size="small" color={colors.textOnPrimary} />
                ) : (
                  <Lucide name="send" size={16} color={colors.textOnPrimary} />
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlayHeavy,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.bgAlt,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: Spacing.xl,
      paddingBottom: Spacing.xl,
      maxHeight: '85%',
      ...Shadows.lg,
    },
    handleWrap: {
      alignItems: 'center',
      paddingVertical: 10,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    title: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    scroll: {
      maxHeight: 400,
      marginBottom: Spacing.sm,
    },
    original: {
      backgroundColor: colors.bgMuted,
      borderRadius: Radius.md,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
      borderLeftWidth: 3,
      borderLeftColor: colors.border,
    },
    originalAuthor: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.semibold,
      color: colors.textMuted,
      marginBottom: 2,
    },
    originalMessage: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.text,
      marginBottom: Spacing.xxs,
    },
    originalMeta: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      color: colors.textFaint,
    },
    reply: {
      backgroundColor: colors.primaryPale,
      borderRadius: Radius.md,
      padding: Spacing.md,
      marginBottom: Spacing.xs,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
    },
    replyAuthor: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.semibold,
      color: colors.primary,
      marginBottom: 2,
    },
    replyText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.text,
      marginBottom: Spacing.xxs,
    },
    replyMeta: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      color: colors.textFaint,
    },
    composeRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: Spacing.xs,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
      paddingTop: Spacing.sm,
    },
    input: {
      flex: 1,
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.text,
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      maxHeight: 120,
      textAlignVertical: 'top',
    },
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: Radius.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...Shadows.md,
    },
    sendBtnDisabled: {
      opacity: 0.5,
    },
  });
}
