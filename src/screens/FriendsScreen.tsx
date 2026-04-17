import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, Modal, Pressable, KeyboardAvoidingView, Platform, RefreshControl } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { useTheme } from '../hooks/useTheme';
import { createStyles } from './FriendsScreen.styles';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import { getFriends, getPendingRequests, acceptRequest, declineRequest, searchUsers, sendRequest } from '../services/friends';
import { getActiveFriendCheckins } from '../services/checkins';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';

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
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useSession();
  const router = useRouter();
  const { s } = useI18n();
  const { colors } = useTheme();
  const { styles, im } = useMemo(() => createStyles(colors), [colors]);

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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAccept = useCallback(async (id: number) => {
    if (!user) return;
    const { error } = await acceptRequest(id, user.id);
    if (error) {
      Alert.alert(s('error'), s('acceptError'));
      return;
    }
    fetchData();
  }, [fetchData, user, s]);

  const handleDecline = useCallback(async (id: number) => {
    if (!user) return;
    const { error } = await declineRequest(id, user.id);
    if (error) {
      Alert.alert(s('error'), s('declineError'));
      return;
    }
    setPending((prev) => prev.filter((p) => p.id !== id));
  }, [user, s]);

  const handleInvite = useCallback(() => {
    setInviteEmail('');
    setInviteResult('idle');
    setInviteModalVisible(true);
  }, []);


  const handleSendInvite = useCallback(async () => {
    if (!user || !inviteEmail.trim()) return;
    setInviteLoading(true);
    setInviteResult('idle');

    // Look up users by name
    const { data: results } = await searchUsers(inviteEmail.trim());

    if (!results || results.length === 0) {
      setInviteResult('not_found');
      setInviteLoading(false);
      return;
    }

    // Use the first matching result
    const target = results[0];

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
    if (!name) return '?';
    return name
      .split(' ')
      .map((w: string) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const AVATAR_COLORS = [colors.primary, colors.primaryMid, colors.purple, colors.purpleMid, colors.accent, colors.blue, colors.textMuted];
  const getColor = (index: number) => AVATAR_COLORS[index % AVATAR_COLORS.length];

  const openPlayerProfile = useCallback((profile: any) => {
    if (!profile?.id) return;
    router.push(`/(protected)/player/${profile.id}` as any);
  }, [router]);

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
          <Lucide name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{s('friendsTitle')}</Text>
        <TouchableOpacity style={styles.inviteBtn} onPress={handleInvite}>
          <Lucide name="user-plus" size={16} color={colors.textOnPrimary} />
          <Text style={styles.inviteBtnText}>{s('invite')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} keyboardDismissMode="on-drag" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}>
        {/* Search friends */}
        <View style={styles.searchWrap}>
          <View style={styles.searchBar}>
            <Lucide name="search" size={18} color={colors.textFaint} />
            <TextInput
              style={styles.searchInput}
              placeholder={s('searchFriends')}
              placeholderTextColor={colors.textFaint}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
                <Lucide name="x" size={16} color={colors.textFaint} />
              </TouchableOpacity>
            )}
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
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Pending Invites */}
            {pending.length > 0 && (activeTab === 'all' || activeTab === 'pending') && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>{s('receivedInvites')}</Text>
                {pending.map((inv, index) => (
                  <Animated.View key={inv.id} entering={FadeInDown.delay(Math.min(index, 8) * 60).duration(300)}>
                    <View style={styles.inviteCard}>
                      <View style={[styles.inviteAvatar, { backgroundColor: colors.purple }]}>
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
                          <Lucide name="x" size={20} color={colors.textFaint} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Animated.View>
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
                  <EmptyState
                    icon={searchQuery ? 'search' : 'users'}
                    title={searchQuery ? s('noFriendFound') : s('emptyFriendsTitle')}
                    description={searchQuery ? s('emptySearchDesc') : s('emptyFriendsDesc')}
                    ctaLabel={searchQuery ? undefined : s('emptyFriendsCta')}
                    onCtaPress={searchQuery ? undefined : handleInvite}
                    iconColor={colors.purple}
                    iconBg={colors.purplePale}
                  />
                ) : (
                  filteredFriends.map((friendItem, index) => {
                    const profile = friendItem.friend;
                    return (
                      <Animated.View key={friendItem.id} entering={FadeInDown.delay(Math.min(index, 8) * 60).duration(300)}>
                        <TouchableOpacity activeOpacity={0.78} onPress={() => openPlayerProfile(profile)}>
                          <Card shadow="sm" borderRadius={14} style={styles.friendRow}>
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
                            <Lucide name="chevron-right" size={18} color={colors.textFaint} />
                          </Card>
                        </TouchableOpacity>
                      </Animated.View>
                    );
                  })
                )}
              </View>
            )}

            {/* Playing Friends (La joc tab) */}
            {activeTab === 'playing' && (
              <View style={styles.section}>
                {playingFriends.length === 0 ? (
                  <EmptyState
                    icon="activity"
                    title={s('noFriendsPlaying')}
                    iconColor={colors.primaryLight}
                    iconBg={colors.primaryPale}
                  />
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
                      <Animated.View key={friendItem.id} entering={FadeInDown.delay(Math.min(index, 8) * 60).duration(300)}>
                        <TouchableOpacity activeOpacity={0.78} onPress={() => openPlayerProfile(profile)}>
                          <Card shadow="sm" borderRadius={14} style={styles.friendRow}>
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
                          </Card>
                        </TouchableOpacity>
                      </Animated.View>
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
                placeholder={s('searchFriends')}
                placeholderTextColor={colors.textFaint}
                value={inviteEmail}
                onChangeText={(t) => { setInviteEmail(t); setInviteResult('idle'); }}
                autoCapitalize="none"
                autoFocus
              />
            </View>

            {inviteResult === 'sent' && (
              <View style={im.resultRow}>
                <Lucide name="check-circle" size={16} color={colors.primaryMid} />
                <Text style={[im.resultText, { color: colors.primaryMid }]}>{s('requestSentSuccess')}</Text>
              </View>
            )}
            {inviteResult === 'not_found' && (
              <View style={im.resultRow}>
                <Lucide name="alert-circle" size={16} color={colors.accent} />
                <Text style={[im.resultText, { color: colors.accent }]}>{s('noUsersFound')}</Text>
              </View>
            )}
            {inviteResult === 'already_friends' && (
              <View style={im.resultRow}>
                <Lucide name="users" size={16} color={colors.textFaint} />
                <Text style={[im.resultText, { color: colors.textFaint }]}>{s('alreadyFriends')}</Text>
              </View>
            )}
            {inviteResult === 'error' && (
              <View style={im.resultRow}>
                <Lucide name="x-circle" size={16} color={colors.red} />
                <Text style={[im.resultText, { color: colors.red }]}>{s('error')}</Text>
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
                  <ActivityIndicator size="small" color={colors.textOnPrimary} />
                ) : (
                  <>
                    <Lucide name="send" size={14} color={colors.textOnPrimary} />
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
