import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Lucide } from './Icon';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius, Shadows } from '../theme';
import { useI18n } from '../hooks/useI18n';
import { getFriends } from '../services/friends';

interface FriendItem {
  id: string;
  full_name: string;
  city: string | null;
}

interface FriendPickerModalProps {
  visible: boolean;
  userId: string;
  onConfirm: (selectedIds: string[]) => void;
  onClose: () => void;
}

export function FriendPickerModal({
  visible,
  userId,
  onConfirm,
  onClose,
}: FriendPickerModalProps) {
  const { s } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    async function fetch() {
      setLoading(true);
      const { data } = await getFriends(userId);
      if (!cancelled && data) {
        const normalized: FriendItem[] = data.map((f: any) => {
          const isRequester = f.requester_id === userId;
          const profile = isRequester ? f.addressee : f.requester;
          return {
            id: profile.id,
            full_name: profile.full_name ?? '',
            city: profile.city,
          };
        });
        setFriends(normalized);
      }
      if (!cancelled) setLoading(false);
    }

    fetch();
    setSelected(new Set());
    setQuery('');
    return () => { cancelled = true; };
  }, [visible, userId]);

  const filtered = useMemo(() => {
    if (!query.trim()) return friends;
    const q = query.trim().toLowerCase();
    return friends.filter((f) => f.full_name.toLowerCase().includes(q));
  }, [friends, query]);

  const toggleFriend = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allSelected = friends.length > 0 && selected.size === friends.length;

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(friends.map((f) => f.id)));
    }
  }, [allSelected, friends]);

  const handleConfirm = useCallback(() => {
    onConfirm(Array.from(selected));
  }, [selected, onConfirm]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.backdropTouchable} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{s('inviteToEvent')}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Lucide name="x" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchRow}>
            <Lucide name="search" size={18} color={colors.textFaint} />
            <TextInput
              style={styles.searchInput}
              placeholder={s('searchFriends')}
              placeholderTextColor={colors.textFaint}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
            />
          </View>

          {!loading && friends.length > 1 && (
            <TouchableOpacity style={styles.selectAllRow} onPress={toggleAll} activeOpacity={0.6}>
              <Text style={styles.selectAllText}>{s('selectAll')}</Text>
              <View style={[styles.checkbox, allSelected && styles.checkboxSelected]}>
                {allSelected && <Lucide name="check" size={14} color={colors.textOnPrimary} />}
              </View>
            </TouchableOpacity>
          )}

          {loading ? (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : friends.length === 0 ? (
            <View style={styles.loader}>
              <Text style={styles.emptyText}>{s('noFriendsToInvite')}</Text>
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.loader}>
              <Text style={styles.emptyText}>{s('noFriendFound')}</Text>
            </View>
          ) : (
            <ScrollView bounces={false} style={styles.list}>
              {filtered.map((friend) => {
                const isSelected = selected.has(friend.id);
                return (
                  <TouchableOpacity
                    key={friend.id}
                    style={styles.row}
                    onPress={() => toggleFriend(friend.id)}
                    activeOpacity={0.6}
                  >
                    <View style={styles.rowContent}>
                      <Text style={[styles.rowText, isSelected && styles.rowTextSelected]}>
                        {friend.full_name}
                      </Text>
                      {friend.city && (
                        <Text style={styles.rowSubtext}>{friend.city}</Text>
                      )}
                    </View>
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                      {isSelected && <Lucide name="check" size={14} color={colors.textOnPrimary} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          <View style={styles.footer}>
            <TouchableOpacity style={styles.skipBtn} onPress={onClose}>
              <Text style={styles.skipText}>{s('skip')}</Text>
            </TouchableOpacity>
            <Pressable
              style={[styles.confirmBtn, selected.size === 0 && styles.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={selected.size === 0}
            >
              <Lucide name="send" size={16} color={colors.textOnPrimary} />
              <Text style={styles.confirmText}>
                {s('inviteToEvent')} ({selected.size})
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    backdropTouchable: { flex: 1 },
    sheet: {
      backgroundColor: colors.bgAlt,
      borderTopLeftRadius: Radius.xl,
      borderTopRightRadius: Radius.xl,
      maxHeight: '75%',
      paddingBottom: Spacing.xxl,
      width: '100%',
      maxWidth: 430,
      ...Shadows.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      fontFamily: Fonts.heading,
      color: colors.text,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: Spacing.lg,
      marginVertical: Spacing.sm,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 10,
      backgroundColor: colors.bgMuted,
      borderRadius: Radius.md,
      gap: Spacing.xs,
      ...Shadows.sm,
    },
    searchInput: {
      flex: 1,
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      color: colors.text,
      padding: 0,
    },
    selectAllRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
    },
    selectAllText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.semibold,
      color: colors.primary,
    },
    loader: { paddingVertical: 40, alignItems: 'center' },
    emptyText: { fontFamily: Fonts.body, fontSize: FontSize.lg, color: colors.textFaint },
    list: { flexShrink: 1 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
      ...Shadows.sm,
    },
    rowContent: { flex: 1 },
    rowText: { fontSize: 15, fontFamily: Fonts.body, color: colors.text },
    rowTextSelected: { fontWeight: FontWeight.semibold, color: colors.primary },
    rowSubtext: { fontSize: FontSize.md, fontFamily: Fonts.body, color: colors.textFaint, marginTop: 2 },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxSelected: {
      backgroundColor: colors.primaryLight,
      borderColor: colors.primaryLight,
    },
    footer: {
      flexDirection: 'row',
      paddingHorizontal: Spacing.lg,
      paddingTop: 16,
      gap: 12,
    },
    skipBtn: {
      paddingVertical: 14,
      paddingHorizontal: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    skipText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      color: colors.textFaint,
    },
    confirmBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryLight,
      borderRadius: 12,
      paddingVertical: 14,
      gap: Spacing.xs,
      ...Shadows.md,
    },
    confirmBtnDisabled: { opacity: 0.4 },
    confirmText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.bold,
      color: colors.textOnPrimary,
    },
  });
}
