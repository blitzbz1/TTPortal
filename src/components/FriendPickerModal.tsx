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
} from 'react-native';
import { Lucide } from './Icon';
import { Colors, Fonts, Radius } from '../theme';
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

  const handleConfirm = useCallback(() => {
    onConfirm(Array.from(selected));
  }, [selected, onConfirm]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTouchable} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{s('inviteToEvent')}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Lucide name="x" size={22} color={Colors.inkMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchRow}>
            <Lucide name="search" size={18} color={Colors.inkFaint} />
            <TextInput
              style={styles.searchInput}
              placeholder={s('searchFriends')}
              placeholderTextColor={Colors.inkFaint}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
            />
          </View>

          {loading ? (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color={Colors.green} />
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
                      {isSelected && <Lucide name="check" size={14} color={Colors.white} />}
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
              <Lucide name="send" size={16} color={Colors.white} />
              <Text style={styles.confirmText}>
                {s('inviteToEvent')} ({selected.size})
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  backdropTouchable: { flex: 1 },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '75%',
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: Fonts.heading,
    color: Colors.ink,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.bgDark,
    borderRadius: Radius.md,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.ink,
    padding: 0,
  },
  loader: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontFamily: Fonts.body, fontSize: 14, color: Colors.inkFaint },
  list: { flexShrink: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  rowContent: { flex: 1 },
  rowText: { fontSize: 15, fontFamily: Fonts.body, color: Colors.ink },
  rowTextSelected: { fontWeight: '600', color: Colors.green },
  rowSubtext: { fontSize: 13, fontFamily: Fonts.body, color: Colors.inkFaint, marginTop: 2 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: Colors.greenLight,
    borderColor: Colors.greenLight,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
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
    fontSize: 14,
    color: Colors.inkFaint,
  },
  confirmBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.greenLight,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
});
