import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Platform,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Lucide } from '../components/Icon';
import { showAlert, showConfirm } from '../lib/dialogs';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../hooks/useI18n';
import { useSession } from '../hooks/useSession';
import { useFocusRefresh } from '../hooks/useFocusRefresh';
import { getDateLocale } from '../contexts/I18nProvider';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Radius, Shadows, Spacing } from '../theme';
import {
  markDmThreadRead, reportDm,
  useDmMessagesQuery, useSendDmMutation, useCanSendInThreadQuery, unreadDmCountQueryKey,
  type DmMessage,
} from '../features/messaging';

interface Props {
  threadId: number;
  otherName?: string;
}

type Row = DmMessage & { daySeparator: string | null };

export function MessageThreadScreen({ threadId, otherName }: Props) {
  const router = useRouter();
  const { user } = useSession();
  const { s, lang } = useI18n();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<Row>>(null);

  const { data: messages = [], isLoading, refetch } = useDmMessagesQuery(threadId);
  const { data: canSend, isLoading: canSendLoading } = useCanSendInThreadQuery(threadId);
  const sendMut = useSendDmMutation(threadId, user?.id);

  // On focus: refetch + mark read + refresh the unread badge.
  useFocusRefresh(() => {
    void (async () => {
      await refetch();
      await markDmThreadRead(threadId);
      qc.invalidateQueries({ queryKey: unreadDmCountQueryKey(user?.id) });
    })();
  }, [threadId, user?.id]);

  const rows = useMemo<Row[]>(() => {
    let prevDay = '';
    return messages.map((m) => {
      const day = new Date(m.createdAt).toLocaleDateString(getDateLocale(lang), { day: '2-digit', month: 'short' });
      const sep = day !== prevDay ? day : null;
      prevDay = day;
      return { ...m, daySeparator: sep };
    });
  }, [messages, lang]);

  const handleSend = useCallback(() => {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    sendMut.mutate(body, {
      onError: () => {
        setDraft(body);
        showAlert(s('error'), s('messagesCannotSend'));
      },
    });
  }, [draft, sendMut, s]);

  const handleReport = useCallback(async (m: DmMessage) => {
    if (m.isMine) return;
    if (await showConfirm(s('messagesReportTitle'), s('messagesReportBody'), { confirmLabel: s('report'), cancelLabel: s('cancel'), destructive: true })) {
      const { error } = await reportDm(m.id, 'harassment');
      showAlert(error ? s('error') : s('reportedToastTitle'), error ? s('reportError') : s('reportedToastBody'));
    }
  }, [s]);

  const renderItem = useCallback(({ item }: { item: Row }) => (
    <View>
      {item.daySeparator ? (
        <View style={styles.daySepWrap}><Text style={styles.daySep}>{item.daySeparator}</Text></View>
      ) : null}
      <TouchableOpacity
        activeOpacity={0.9}
        onLongPress={() => handleReport(item)}
        delayLongPress={350}
        style={[styles.bubbleRow, item.isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}
      >
        <View style={[styles.bubble, item.isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
          <Text style={[styles.bubbleText, item.isMine && styles.bubbleTextMine]}>{item.body}</Text>
          <Text style={[styles.bubbleTime, item.isMine && styles.bubbleTimeMine]}>
            {new Date(item.createdAt).toLocaleTimeString(getDateLocale(lang), { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  ), [handleReport, lang, styles]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel={s('back')}>
          <Lucide name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{otherName || s('messagesTitle')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
        {isLoading && messages.length === 0 ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            ref={listRef}
            data={rows}
            keyExtractor={(m) => String(m.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        {canSend ? (
          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              placeholder={s('messagesInputPlaceholder')}
              placeholderTextColor={colors.textFaint}
              value={draft}
              onChangeText={setDraft}
              multiline
              maxLength={2000}
              testID="dm-input"
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!draft.trim() || sendMut.isPending) && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!draft.trim() || sendMut.isPending}
              accessibilityLabel={s('send')}
              testID="dm-send"
            >
              <Lucide name="send" size={18} color={colors.textOnPrimary} />
            </TouchableOpacity>
          </View>
        ) : canSendLoading ? null : (
          <View style={styles.readOnlyBar} testID="dm-readonly">
            <Lucide name="lock" size={14} color={colors.textFaint} />
            <Text style={styles.readOnlyText}>{s('messagesReadOnly')}</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    flex: { flex: 1 },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: colors.bgAlt, height: 52, paddingHorizontal: Spacing.md,
      borderBottomWidth: 1, borderBottomColor: colors.border, ...Shadows.bar, gap: Spacing.sm,
    },
    headerTitle: { flex: 1, textAlign: 'center', fontFamily: Fonts.heading, fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: colors.text },
    list: { padding: Spacing.md, gap: 6 },
    daySepWrap: { alignItems: 'center', marginVertical: Spacing.sm },
    daySep: { fontFamily: Fonts.body, fontSize: FontSize.sm, color: colors.textFaint, backgroundColor: colors.bgMuted, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
    bubbleRow: { flexDirection: 'row', marginVertical: 1 },
    bubbleRowMine: { justifyContent: 'flex-end' },
    bubbleRowTheirs: { justifyContent: 'flex-start' },
    bubble: { maxWidth: '78%', borderRadius: Radius.lg, paddingHorizontal: 12, paddingVertical: 8 },
    bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
    bubbleTheirs: { backgroundColor: colors.bgAlt, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.borderLight },
    bubbleText: { fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.text },
    bubbleTextMine: { color: colors.textOnPrimary },
    bubbleTime: { fontFamily: Fonts.body, fontSize: 10, color: colors.textFaint, alignSelf: 'flex-end', marginTop: 2 },
    bubbleTimeMine: { color: colors.textOnPrimary, opacity: 0.8 },
    inputBar: {
      flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm,
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
      borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bgAlt,
    },
    input: {
      flex: 1, maxHeight: 120, minHeight: 40, borderRadius: Radius.lg, borderWidth: 1, borderColor: colors.border,
      paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.text,
    },
    sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...Shadows.sm },
    sendBtnDisabled: { opacity: 0.5 },
    readOnlyBar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
      borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bgMuted,
    },
    readOnlyText: { fontFamily: Fonts.body, fontSize: FontSize.sm, color: colors.textFaint, textAlign: 'center' },
  });
}
