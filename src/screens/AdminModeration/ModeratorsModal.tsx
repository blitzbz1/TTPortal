// T052: moderator-management modal (admin-only). Kept mounted by the shell
// (visibility via prop) so the search state survives close/reopen, as it did
// when this lived in the screen body.
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { showAlert } from '../../lib/dialogs';
import { Lucide } from '../../components/Icon';
import { Fonts } from '../../theme';
import { useTheme } from '../../hooks/useTheme';
import { useI18n } from '../../hooks/useI18n';
import { useSession } from '../../hooks/useSession';
import { searchUsersAdmin, setUserModerator, type AdminUserSearchRow } from '../../services/admin';
import type { AdminModerationStyles } from '../AdminModerationScreen.styles';

interface ModeratorsModalProps {
  visible: boolean;
  styles: AdminModerationStyles;
  onClose: () => void;
}

export function ModeratorsModal({ visible, styles, onClose }: ModeratorsModalProps) {
  const { user } = useSession();
  const { s } = useI18n();
  const { colors } = useTheme();

  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState<AdminUserSearchRow[]>([]);
  const [usersSearching, setUsersSearching] = useState(false);
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);
  const userDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleUserSearch = useCallback((text: string) => {
    setUserQuery(text);
    if (userDebounceRef.current) clearTimeout(userDebounceRef.current);
    if (text.trim().length < 3) {
      setUserResults([]);
      setUsersSearching(false);
      return;
    }
    setUsersSearching(true);
    userDebounceRef.current = setTimeout(async () => {
      const { data } = await searchUsersAdmin(text.trim());
      setUserResults(data);
      setUsersSearching(false);
    }, 400);
  }, []);

  useEffect(() => () => {
    if (userDebounceRef.current) clearTimeout(userDebounceRef.current);
  }, []);

  const handleToggleModerator = useCallback(async (u: AdminUserSearchRow) => {
    if (!user) return;
    setTogglingUserId(u.id);
    const next = !u.is_moderator;
    const { error } = await setUserModerator(user.id, u.id, next);
    setTogglingUserId(null);
    if (error) {
      showAlert(s('error'), s('moderatorUpdateError'));
      return;
    }
    setUserResults((prev) => prev.map((r) => (r.id === u.id ? { ...r, is_moderator: next } : r)));
  }, [user, s]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle}><View style={styles.modalHandleBar} /></View>
          <Text style={styles.modalTitle}>{s('manageModerators')}</Text>

          <View style={styles.venueSearchWrap}>
            <Lucide name="search" size={16} color={colors.textFaint} />
            <TextInput
              style={styles.venueSearchInput}
              placeholder={s('searchUsers')}
              placeholderTextColor={colors.textFaint}
              value={userQuery}
              onChangeText={handleUserSearch}
              autoCapitalize="none"
              autoCorrect={false}
              testID="moderator-search-input"
            />
            {userQuery.length > 0 && (
              <TouchableOpacity onPress={() => { setUserQuery(''); setUserResults([]); }}>
                <Lucide name="x" size={16} color={colors.textFaint} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.venueList}>
              {userQuery.trim().length < 3 ? (
                <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                  <Lucide name="users" size={32} color={colors.border} />
                  <Text style={{ fontFamily: Fonts.body, fontSize: 13, color: colors.textFaint, marginTop: 8 }}>
                    {s('searchUsersHint')}
                  </Text>
                </View>
              ) : usersSearching ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ paddingVertical: 24 }} />
              ) : userResults.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                  <Text style={{ fontFamily: Fonts.body, fontSize: 13, color: colors.textFaint }}>
                    {s('noUsersFound')}
                  </Text>
                </View>
              ) : (
                userResults.map((u) => (
                  <View key={u.id} style={styles.venueCard} testID={`moderator-user-${u.id}`}>
                    <View style={styles.venueInfo}>
                      <Text style={styles.venueName}>{u.full_name ?? u.username ?? s('user')}</Text>
                      <Text style={styles.venueMeta} numberOfLines={1}>
                        {u.email ?? ''}{u.username ? ` · @${u.username}` : ''}
                      </Text>
                    </View>
                    {u.is_admin ? (
                      <View style={styles.adminBadge}>
                        <Text style={styles.adminBadgeText}>{s('admin')}</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => void handleToggleModerator(u)}
                        disabled={togglingUserId === u.id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: 84,
                          paddingHorizontal: 14,
                          height: 36,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: u.is_moderator ? colors.redBorder : colors.primaryDim,
                          backgroundColor: u.is_moderator ? colors.redPale : colors.primaryPale,
                          opacity: togglingUserId === u.id ? 0.5 : 1,
                        }}
                        testID={`toggle-moderator-${u.id}`}
                      >
                        {togglingUserId === u.id ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <Text style={{ fontFamily: Fonts.body, fontSize: 13, fontWeight: '600', color: u.is_moderator ? colors.red : colors.primaryMid }}>
                            {s(u.is_moderator ? 'revokeModerator' : 'grantModerator')}
                          </Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              )}
            </View>
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose} testID="close-moderators-modal">
              <Text style={styles.modalCancelText}>{s('close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
