import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, ActivityIndicator, Alert, Modal, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { Colors, Fonts, Radius } from '../theme';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import { getFriends, getPendingRequests, acceptRequest, declineRequest, searchUsers, sendRequest } from '../services/friends';
import { getActiveFriendCheckins } from '../services/checkins';

type FriendsTab = 'all' | 'playing' | 'pending';

export function FriendsScreen() {
  const [activeTab, setActiveTab] = useState<FriendsTab>('all');
  const [friends, setFriends] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [playingFriends, setPlayingFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState<'idle' | 'sent' | 'not_found' | 'already_friends' | 'error'>('idle');
  const { user } = useSession();
  const router = useRouter();
  const { s } = useI18n();

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [friendsRes, pendingRes] = await Promise.all([
        getFriends(user.id),
        getPendingRequests(user.id),
      ]);

      let normalizedFriends: any[] = [];
      if (friendsRes.data) {
        normalizedFriends = friendsRes.data.map((f: any) => {
          const isRequester = f.requester_id === user.id;
          const profile = isRequester ? f.addressee : f.requester;
          return { ...f, friend: profile };
        });
        setFriends(normalizedFriends);
      }
      if (pendingRes.data) {
        setPending(pendingRes.data);
      }

      // Fetch active checkins for friends
      if (normalizedFriends.length > 0) {
        const friendIds = normalizedFriends.map((f: any) =>
          f.requester_id === user.id ? f.addressee_id : f.requester_id,
        );
        const { data: checkins } = await getActiveFriendCheckins(friendIds);
        if (checkins?.length) {
          // Build a map: friend user_id -> checkin info
          const checkinMap = new Map<string, any>();
          for (const c of checkins) {
            if (!checkinMap.has(c.user_id)) checkinMap.set(c.user_id, c);
          }
          // Match with friend profiles
          const playing = normalizedFriends
            .filter((f: any) => {
              const fid = f.requester_id === user.id ? f.addressee_id : f.requester_id;
              return checkinMap.has(fid);
            })
            .map((f: any) => {
              const fid = f.requester_id === user.id ? f.addressee_id : f.requester_id;
              return { ...f, checkin: checkinMap.get(fid) };
            });
          setPlayingFriends(playing);
        } else {
          setPlayingFriends([]);
        }
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAccept = useCallback(async (id: number) => {
    const { error } = await acceptRequest(id);
    if (error) {
      Alert.alert(s('error'), s('acceptError'));
      return;
    }
    fetchData();
  }, [fetchData]);

  const handleDecline = useCallback(async (id: number) => {
    const { error } = await declineRequest(id);
    if (error) {
      Alert.alert(s('error'), s('declineError'));
      return;
    }
    setPending((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleInvite = useCallback(() => {
    setInviteEmail('');
    setInviteResult('idle');
    setInviteModalVisible(true);
  }, []);


  const handleSendInvite = useCallback(async () => {
    if (!user || !inviteEmail.trim()) return;
    setInviteLoading(true);
    setInviteResult('idle');

    // Look up the user by email
    const { data: results } = await searchUsers(inviteEmail.trim());
    const target = results?.find((u: any) => u.email?.toLowerCase() === inviteEmail.trim().toLowerCase());

    if (!target) {
      setInviteResult('not_found');
      setInviteLoading(false);
      return;
    }

    if (target.id === user.id) {
      setInviteResult('error');
      setInviteLoading(false);
      return;
    }

    // Check if already friends
    const friendIdSet = new Set(friends.map((f: any) =>
      f.requester_id === user.id ? f.addressee_id : f.requester_id,
    ));
    if (friendIdSet.has(target.id)) {
      setInviteResult('already_friends');
      setInviteLoading(false);
      return;
    }

    const { error } = await sendRequest(user.id, target.id);
    setInviteLoading(false);
    if (error) {
      setInviteResult('error');
      return;
    }
    setInviteResult('sent');
    setInviteEmail('');
    fetchData(); // Refresh lists
  }, [user, inviteEmail, friends, fetchData]);

  const getInitials = (name?: string) => {
    if (!name) return '??';
    return name
      .split(' ')
      .map((w: string) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const AVATAR_COLORS = [Colors.green, Colors.greenMid, Colors.purple, Colors.purpleMid, Colors.orange, Colors.blue, Colors.inkMuted];
  const getColor = (index: number) => AVATAR_COLORS[index % AVATAR_COLORS.length];

  // Filter friends by search query
  const filteredFriends = friends.filter((f) => {
    if (!searchQuery) return true;
    const name = f.friend?.full_name ?? '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Lucide name="arrow-left" size={24} color={Colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{s('friendsTitle')}</Text>
        <TouchableOpacity style={styles.inviteBtn} onPress={handleInvite}>
          <Lucide name="user-plus" size={16} color={Colors.white} />
          <Text style={styles.inviteBtnText}>{s('invite')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll}>
        {/* Search friends */}
        <View style={styles.searchWrap}>
          <View style={styles.searchBar}>
            <Lucide name="search" size={18} color={Colors.inkFaint} />
            <TextInput
              style={styles.searchInput}
              placeholder={s('searchFriends')}
              placeholderTextColor={Colors.inkFaint}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {[
            { key: 'all' as FriendsTab, label: `${s('allFriends')} (${friends.length})` },
            { key: 'playing' as FriendsTab, label: `${s('online')} (${playingFriends.length})` },
            { key: 'pending' as FriendsTab, label: `${s('pending')} (${pending.length})` },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={Colors.green} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Pending Invites */}
            {pending.length > 0 && (activeTab === 'all' || activeTab === 'pending') && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>{s('receivedInvites')}</Text>
                {pending.map((inv) => (
                  <View key={inv.id} style={styles.inviteCard}>
                    <View style={[styles.inviteAvatar, { backgroundColor: Colors.purple }]}>
                      <Text style={styles.inviteInitials}>
                        {getInitials(inv.requester?.full_name)}
                      </Text>
                    </View>
                    <View style={styles.inviteInfo}>
                      <Text style={styles.inviteName}>
                        {inv.requester?.full_name ?? s('user')}
                      </Text>
                      <Text style={styles.inviteMutual}>{s('friendRequest')}</Text>
                    </View>
                    <View style={styles.inviteActions}>
                      <TouchableOpacity
                        style={styles.acceptBtn}
                        onPress={() => handleAccept(inv.id)}
                      >
                        <Text style={styles.acceptText}>{s('accept')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDecline(inv.id)}>
                        <Lucide name="x" size={20} color={Colors.inkFaint} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Friends List (All tab) */}
            {activeTab === 'all' && (
              <View style={styles.section}>
                <View style={styles.friendsLabel}>
                  <Text style={styles.sectionLabel}>{s('friendsTitle')}</Text>
                  <View style={styles.onlineCount}>
                    <View style={styles.onlineDot} />
                    <Text style={styles.onlineText}>{friends.length} {s('friendsTitle').toLowerCase()}</Text>
                  </View>
                </View>
                {filteredFriends.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                    <Text style={{ fontFamily: Fonts.body, fontSize: 14, color: Colors.inkFaint }}>
                      {searchQuery ? s('noFriendFound') : s('noFriendsYet')}
                    </Text>
                  </View>
                ) : (
                  filteredFriends.map((friendItem, index) => {
                    const profile = friendItem.friend;
                    return (
                      <View key={friendItem.id} style={styles.friendRow}>
                        <View style={styles.friendAvatarWrap}>
                          <View style={[styles.friendAvatar, { backgroundColor: getColor(index) }]}>
                            <Text style={styles.friendInitials}>
                              {getInitials(profile?.full_name)}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.friendInfo}>
                          <Text style={styles.friendName}>
                            {profile?.full_name ?? s('user')}
                          </Text>
                          <Text style={styles.friendStatus}>
                            {profile?.city ?? ''}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            )}

            {/* Playing Friends (La joc tab) */}
            {activeTab === 'playing' && (
              <View style={styles.section}>
                {playingFriends.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                    <Text style={{ fontFamily: Fonts.body, fontSize: 14, color: Colors.inkFaint }}>
                      {s('noFriendsPlaying')}
                    </Text>
                  </View>
                ) : (
                  playingFriends.map((friendItem, index) => {
                    const profile = friendItem.friend;
                    const ci = friendItem.checkin;
                    const venueName = ci?.venues?.name ?? '';
                    const venueCity = ci?.venues?.city ?? '';
                    const startedAt = ci?.started_at ? new Date(ci.started_at) : null;
                    const timeStr = startedAt
                      ? startedAt.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
                      : '';
                    return (
                      <View key={friendItem.id} style={styles.friendRow}>
                        <View style={styles.friendAvatarWrap}>
                          <View style={[styles.friendAvatar, { backgroundColor: getColor(index) }]}>
                            <Text style={styles.friendInitials}>
                              {getInitials(profile?.full_name)}
                            </Text>
                          </View>
                          <View style={styles.playingDot} />
                        </View>
                        <View style={styles.friendInfo}>
                          <Text style={styles.friendName}>
                            {profile?.full_name ?? s('user')}
                          </Text>
                          <Text style={styles.playingVenue} numberOfLines={1}>
                            📍 {venueName}{venueCity ? `, ${venueCity}` : ''}
                          </Text>
                          <Text style={styles.playingTime}>
                            {s('checkedInSince')} {timeStr}
                          </Text>
                        </View>
                        <View style={styles.playingBadge}>
                          <Text style={styles.playingBadgeText}>🏓</Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            )}

          </>
        )}
      </ScrollView>

      {/* Invite by Email Modal */}
      <Modal visible={inviteModalVisible} transparent animationType="slide" onRequestClose={() => setInviteModalVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={im.overlay} onPress={() => setInviteModalVisible(false)}>
          <Pressable style={im.sheet} onPress={() => {}}>
            <View style={im.handleWrap}><View style={im.handle} /></View>
            <Text style={im.title}>{s('inviteFriends')}</Text>
            <Text style={im.desc}>{s('inviteDesc')}</Text>

            <View style={im.inputRow}>
              <TextInput
                style={im.input}
                placeholder="email@exemplu.com"
                placeholderTextColor={Colors.inkFaint}
                value={inviteEmail}
                onChangeText={(t) => { setInviteEmail(t); setInviteResult('idle'); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoFocus
              />
            </View>

            {inviteResult === 'sent' && (
              <View style={im.resultRow}>
                <Lucide name="check-circle" size={16} color={Colors.greenMid} />
                <Text style={[im.resultText, { color: Colors.greenMid }]}>{s('requestSentSuccess')}</Text>
              </View>
            )}
            {inviteResult === 'not_found' && (
              <View style={im.resultRow}>
                <Lucide name="alert-circle" size={16} color={Colors.orange} />
                <Text style={[im.resultText, { color: Colors.orange }]}>{s('noUsersFound')}</Text>
              </View>
            )}
            {inviteResult === 'already_friends' && (
              <View style={im.resultRow}>
                <Lucide name="users" size={16} color={Colors.inkFaint} />
                <Text style={[im.resultText, { color: Colors.inkFaint }]}>{s('alreadyFriends')}</Text>
              </View>
            )}
            {inviteResult === 'error' && (
              <View style={im.resultRow}>
                <Lucide name="x-circle" size={16} color={Colors.red} />
                <Text style={[im.resultText, { color: Colors.red }]}>{s('error')}</Text>
              </View>
            )}

            <View style={im.actions}>
              <TouchableOpacity style={im.cancelBtn} onPress={() => setInviteModalVisible(false)}>
                <Text style={im.cancelText}>{s('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[im.sendBtn, (!inviteEmail.trim() || inviteLoading) && im.sendBtnDisabled]}
                onPress={handleSendInvite}
                disabled={!inviteEmail.trim() || inviteLoading}
              >
                {inviteLoading ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <>
                    <Lucide name="send" size={14} color={Colors.white} />
                    <Text style={im.sendText}>{s('sendRequest')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    height: 52,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontFamily: Fonts.heading,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.ink,
  },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.green,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  inviteBtnText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
  },
  scroll: {
    flex: 1,
  },
  searchWrap: {
    padding: 12,
    paddingHorizontal: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgDark,
    borderRadius: Radius.md,
    height: 40,
    paddingHorizontal: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.ink,
    height: 40,
    padding: 0,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.green,
  },
  tabText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.inkFaint,
  },
  tabTextActive: {
    fontWeight: '600',
    color: Colors.green,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 10,
  },
  sectionLabel: {
    fontFamily: Fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.inkMuted,
  },
  inviteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.purplePale,
    borderRadius: 12,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.purpleMid,
  },
  inviteAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteInitials: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
  inviteInfo: {
    flex: 1,
    gap: 2,
  },
  inviteName: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ink,
  },
  inviteMutual: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.inkFaint,
  },
  inviteActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  acceptBtn: {
    backgroundColor: Colors.green,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  acceptText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.white,
  },
  friendsLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
  },
  onlineCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.greenLight,
  },
  onlineText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '500',
    color: Colors.greenLight,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  friendAvatarWrap: {
    width: 44,
    height: 44,
  },
  friendAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendInitials: {
    fontFamily: Fonts.body,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  friendOnlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.greenLight,
    borderWidth: 2,
    borderColor: Colors.bg,
  },
  friendInfo: {
    flex: 1,
    gap: 2,
  },
  friendName: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ink,
  },
  friendStatus: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.inkFaint,
  },
  playingDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.greenLight,
    borderWidth: 2,
    borderColor: Colors.bg,
  },
  playingVenue: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '500',
    color: Colors.greenMid,
  },
  playingTime: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.inkFaint,
  },
  playingBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.greenPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playingBadgeText: {
    fontSize: 16,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.green,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 4,
  },
  addBtnText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.white,
  },
  sentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sentText: {
    fontFamily: Fonts.body,
    fontSize: 11,
    fontWeight: '500',
    color: Colors.inkFaint,
  },
  shareSection: {
    padding: 16,
    paddingTop: 12,
  },
  shareCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.greenPale,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.greenDim,
  },
  shareIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareInfo: {
    flex: 1,
    gap: 2,
  },
  shareTitle: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ink,
  },
  shareDesc: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.inkMuted,
  },
});

const im = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingBottom: 32, width: '100%', maxWidth: 430 },
  handleWrap: { alignItems: 'center', paddingVertical: 10 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border },
  title: { fontFamily: Fonts.heading, fontSize: 18, fontWeight: '700', color: Colors.ink, marginBottom: 4 },
  desc: { fontFamily: Fonts.body, fontSize: 13, color: Colors.inkFaint, marginBottom: 16 },
  inputRow: { marginBottom: 12 },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, padding: 14, fontFamily: Fonts.body, fontSize: 16, color: Colors.ink },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, paddingHorizontal: 4 },
  resultText: { fontFamily: Fonts.body, fontSize: 13, fontWeight: '500' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.lg, paddingVertical: 14, borderWidth: 1, borderColor: Colors.border },
  cancelText: { fontFamily: Fonts.body, fontSize: 14, fontWeight: '600', color: Colors.inkMuted },
  sendBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: Radius.lg, paddingVertical: 14, backgroundColor: Colors.green, gap: 6 },
  sendBtnDisabled: { opacity: 0.5 },
  sendText: { fontFamily: Fonts.body, fontSize: 14, fontWeight: '600', color: Colors.white },
});
