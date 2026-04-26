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
import { getFriends, getPendingRequests, acceptRequest, declineRequest, findUserByUsername, getFriendshipBetweenUsers, sendRequest } from '../services/friends';
import { loadCachedFriends, saveCachedFriends, loadCachedPending, saveCachedPending } from '../lib/friendsCache';
import { sendAppInviteEmail } from '../services/invites';
import { getActiveFriendCheckins } from '../services/checkins';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { isValidEmail } from '../lib/auth-utils';

type FriendsTab = 'all' | 'playing' | 'pending';
type AddFriendResult = 'idle' | 'sent' | 'not_found' | 'already_friends' | 'already_pending' | 'incoming_pending' | 'self' | 'error';
type InviteEmailResult = 'idle' | 'sent' | 'invalid' | 'already_registered' | 'error';

export function FriendsScreen() {
  const [activeTab, setActiveTab] = useState<FriendsTab>('all');
  const [friends, setFriends] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [playingFriends, setPlayingFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteEmailLoading, setInviteEmailLoading] = useState(false);
  const [inviteEmailResult, setInviteEmailResult] = useState<InviteEmailResult>('idle');
  const [addFriendModalVisible, setAddFriendModalVisible] = useState(false);
  const [enteredUsername, setEnteredUsername] = useState('');
  const [addFriendLoading, setAddFriendLoading] = useState(false);
  const [addFriendResult, setAddFriendResult] = useState<AddFriendResult>('idle');
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useSession();
  const router = useRouter();
  const { s } = useI18n();
  const { colors } = useTheme();
  const { styles, im } = useMemo(() => createStyles(colors), [colors]);

  // Pre-parse start timestamps once per friends update — avoids creating a Date
  // and calling toLocaleTimeString for every row on every render.
  const playingFriendsWithTime = useMemo(
    () =>
      playingFriends.map((f: any) => {
        const startedAt = f?.checkin?.started_at;
        const timeStr = startedAt
          ? new Date(startedAt).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
          : '';
        return { ...f, _timeStr: timeStr };
      }),
    [playingFriends],
  );

  const fetchData = useCallback(async (force = false) => {
    if (!user) return;
    let normalizedFriends: any[] = [];

    // Cache-first hydrate of the friends + pending lists. Active-friend
    // checkins are always fetched fresh further down (live data).
    if (!force) {
      const cachedFriends = loadCachedFriends<any>(user.id);
      const cachedPending = loadCachedPending<any>(user.id);
      if (cachedFriends) {
        normalizedFriends = cachedFriends.data;
        setFriends(normalizedFriends);
      }
      if (cachedPending) setPending(cachedPending.data);
      const friendsFresh = !!cachedFriends?.fresh;
      const pendingFresh = !!cachedPending?.fresh;
      if (friendsFresh && pendingFresh) {
        // Skip the network for friends + pending; still refresh active checkins.
        setLoading(false);
      } else if (cachedFriends || cachedPending) {
        setLoading(false); // already showing cached data; refresh in background
      } else {
        setLoading(true);
      }
    } else {
      setLoading(true);
    }

    try {
      const cachedFriends = !force ? loadCachedFriends<any>(user.id) : null;
      const cachedPending = !force ? loadCachedPending<any>(user.id) : null;
      const skipFriendsFetch = !!cachedFriends?.fresh;
      const skipPendingFetch = !!cachedPending?.fresh;

      const [friendsRes, pendingRes] = await Promise.all([
        skipFriendsFetch ? Promise.resolve({ data: cachedFriends!.data, error: null }) : getFriends(user.id),
        skipPendingFetch ? Promise.resolve({ data: cachedPending!.data, error: null }) : getPendingRequests(user.id),
      ]);

      if (friendsRes.data && !skipFriendsFetch) {
        normalizedFriends = (friendsRes.data as any[]).map((f: any) => {
          const isRequester = f.requester_id === user.id;
          const profile = isRequester ? f.addressee : f.requester;
          return { ...f, friend: profile };
        });
        setFriends(normalizedFriends);
        saveCachedFriends(user.id, normalizedFriends);
      } else if (skipFriendsFetch) {
        normalizedFriends = cachedFriends!.data;
      }
      if (pendingRes.data && !skipPendingFetch) {
        setPending(pendingRes.data as any[]);
        saveCachedPending(user.id, pendingRes.data as any[]);
      }

      if (normalizedFriends.length > 0) {
        const friendIds = normalizedFriends.map((f: any) =>
          f.requester_id === user.id ? f.addressee_id : f.requester_id,
        );
        const { data: checkins } = await getActiveFriendCheckins(friendIds);
        if (checkins?.length) {
          const checkinMap = new Map<string, any>();
          for (const c of checkins) {
            if (!checkinMap.has(c.user_id)) checkinMap.set(c.user_id, c);
          }
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
      } else {
        setPlayingFriends([]);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData(true);
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
  }, [fetchData, s, user]);

  const handleDecline = useCallback(async (id: number) => {
    if (!user) return;
    const { error } = await declineRequest(id, user.id);
    if (error) {
      Alert.alert(s('error'), s('declineError'));
      return;
    }
    setPending((prev) => prev.filter((p) => p.id !== id));
  }, [s, user]);

  const handleOpenAddFriend = useCallback(() => {
    setEnteredUsername('');
    setAddFriendResult('idle');
    setAddFriendModalVisible(true);
  }, []);

  const handleInvite = useCallback(() => {
    setInviteEmail('');
    setInviteEmailResult('idle');
    setInviteModalVisible(true);
  }, []);

  const handleSendInviteEmail = useCallback(async () => {
    const normalizedEmail = inviteEmail.trim().toLowerCase();
    if (!normalizedEmail) return;

    if (!isValidEmail(normalizedEmail)) {
      setInviteEmailResult('invalid');
      return;
    }

    setInviteEmailLoading(true);
    setInviteEmailResult('idle');

    try {
      const { error } = await sendAppInviteEmail(normalizedEmail);
      setInviteEmailLoading(false);
      if (error) {
        const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: string }).code ?? '') : '';
        setInviteEmailResult(code === 'already_registered' ? 'already_registered' : 'error');
        return;
      }
      setInviteEmailResult('sent');
      setInviteEmail('');
    } catch {
      setInviteEmailLoading(false);
      setInviteEmailResult('error');
    }
  }, [inviteEmail, s]);

  const handleSendFriendRequest = useCallback(async () => {
    if (!user || !enteredUsername.trim()) return;

    setAddFriendLoading(true);
    setAddFriendResult('idle');

    const normalizedUsername = enteredUsername.trim().replace(/^@+/, '').toLowerCase();
    const { data: target, error: lookupError } = await findUserByUsername(normalizedUsername);

    if (lookupError) {
      setAddFriendLoading(false);
      setAddFriendResult('error');
      return;
    }

    if (!target) {
      setAddFriendLoading(false);
      setAddFriendResult('not_found');
      return;
    }

    if (target.id === user.id) {
      setAddFriendLoading(false);
      setAddFriendResult('self');
      return;
    }

    const { data: existingFriendship, error: friendshipError } = await getFriendshipBetweenUsers(user.id, target.id);
    if (friendshipError) {
      setAddFriendLoading(false);
      setAddFriendResult('error');
      return;
    }

    if (existingFriendship?.status === 'accepted') {
      setAddFriendLoading(false);
      setAddFriendResult('already_friends');
      return;
    }

    if (existingFriendship?.status === 'pending') {
      setAddFriendLoading(false);
      setAddFriendResult(existingFriendship.requester_id === user.id ? 'already_pending' : 'incoming_pending');
      return;
    }

    const { error } = await sendRequest(user.id, target.id);
    setAddFriendLoading(false);
    if (error) {
      setAddFriendResult('error');
      return;
    }

    setAddFriendResult('sent');
    setEnteredUsername('');
    fetchData();
  }, [enteredUsername, fetchData, user]);

  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((w: string) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const AVATAR_COLORS = useMemo(
    () => [colors.primary, colors.primaryMid, colors.purple, colors.purpleMid, colors.accent, colors.blue, colors.textMuted],
    [colors],
  );
  const getColor = useCallback(
    (index: number) => AVATAR_COLORS[index % AVATAR_COLORS.length],
    [AVATAR_COLORS],
  );

  const openPlayerProfile = useCallback((profile: any) => {
    if (!profile?.id) return;
    router.push(`/(protected)/player/${profile.id}` as any);
  }, [router]);

  const filteredFriends = friends.filter((f) => {
    if (!searchQuery) return true;
    const name = f.friend?.full_name ?? '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Lucide name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{s('friendsTitle')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
      >
        <View style={styles.actionsRow}>
          <TouchableOpacity style={[styles.actionCard, styles.actionCardPrimary]} onPress={handleOpenAddFriend} activeOpacity={0.85}>
            <View style={[styles.actionIconWrap, styles.actionIconPrimary]}>
              <Lucide name="user-plus" size={17} color={colors.textOnPrimary} />
            </View>
            <Text style={[styles.actionTitle, styles.actionTitlePrimary]}>{s('addFriend')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionCard, styles.actionCardSecondary]} onPress={handleInvite} activeOpacity={0.85}>
            <View style={[styles.actionIconWrap, styles.actionIconSecondary]}>
              <Lucide name="send" size={17} color={colors.accent} />
            </View>
            <Text style={[styles.actionTitle, styles.actionTitleSecondary]}>{s('inviteFriends')}</Text>
          </TouchableOpacity>
        </View>

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
                    onCtaPress={searchQuery ? undefined : handleOpenAddFriend}
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
                  playingFriendsWithTime.map((friendItem, index) => {
                    const profile = friendItem.friend;
                    const ci = friendItem.checkin;
                    const venueName = ci?.venues?.name ?? '';
                    const venueCity = ci?.venues?.city ?? '';
                    const timeStr = friendItem._timeStr;
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
                                {venueName}{venueCity ? `, ${venueCity}` : ''}
                              </Text>
                              <Text style={styles.playingTime}>
                                {s('checkedInSince')} {timeStr}
                              </Text>
                            </View>
                            <View style={styles.playingBadge}>
                              <Lucide name="activity" size={16} color={colors.primaryMid} />
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

      <Modal visible={addFriendModalVisible} transparent animationType="slide" onRequestClose={() => setAddFriendModalVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={im.overlay} onPress={() => setAddFriendModalVisible(false)}>
            <Pressable style={im.sheet} onPress={() => {}}>
              <View style={im.handleWrap}><View style={im.handle} /></View>
              <Text style={im.title}>{s('addFriend')}</Text>
              <Text style={im.desc}>{s('addFriendModalDesc')}</Text>

              <View style={im.inputRow}>
                <TextInput
                  style={im.input}
                  placeholder={s('addFriendPlaceholder')}
                  placeholderTextColor={colors.textFaint}
                  value={enteredUsername}
                  onChangeText={(value) => {
                    setEnteredUsername(value);
                    setAddFriendResult('idle');
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                />
              </View>

              {addFriendResult === 'sent' && (
                <View style={im.resultRow}>
                  <Lucide name="check-circle" size={16} color={colors.primaryMid} />
                  <Text style={[im.resultText, { color: colors.primaryMid }]}>{s('friendRequestSent')}</Text>
                </View>
              )}
              {addFriendResult === 'not_found' && (
                <View style={im.resultRow}>
                  <Lucide name="alert-circle" size={16} color={colors.accent} />
                  <Text style={[im.resultText, { color: colors.accent }]}>{s('usernameNotFound')}</Text>
                </View>
              )}
              {addFriendResult === 'already_friends' && (
                <View style={im.resultRow}>
                  <Lucide name="users" size={16} color={colors.textFaint} />
                  <Text style={[im.resultText, { color: colors.textFaint }]}>{s('alreadyFriends')}</Text>
                </View>
              )}
              {addFriendResult === 'already_pending' && (
                <View style={im.resultRow}>
                  <Lucide name="clock-3" size={16} color={colors.textFaint} />
                  <Text style={[im.resultText, { color: colors.textFaint }]}>{s('friendRequestAlreadySent')}</Text>
                </View>
              )}
              {addFriendResult === 'incoming_pending' && (
                <View style={im.resultRow}>
                  <Lucide name="mail" size={16} color={colors.textFaint} />
                  <Text style={[im.resultText, { color: colors.textFaint }]}>{s('friendRequestAlreadyReceived')}</Text>
                </View>
              )}
              {addFriendResult === 'self' && (
                <View style={im.resultRow}>
                  <Lucide name="alert-circle" size={16} color={colors.accent} />
                  <Text style={[im.resultText, { color: colors.accent }]}>{s('cannotAddYourself')}</Text>
                </View>
              )}
              {addFriendResult === 'error' && (
                <View style={im.resultRow}>
                  <Lucide name="x-circle" size={16} color={colors.red} />
                  <Text style={[im.resultText, { color: colors.red }]}>{s('error')}</Text>
                </View>
              )}

              <View style={im.actions}>
                <TouchableOpacity style={im.cancelBtn} onPress={() => setAddFriendModalVisible(false)}>
                  <Text style={im.cancelText}>{s('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[im.sendBtn, (!enteredUsername.trim() || addFriendLoading) && im.sendBtnDisabled]}
                  onPress={handleSendFriendRequest}
                  disabled={!enteredUsername.trim() || addFriendLoading}
                >
                  {addFriendLoading ? (
                    <ActivityIndicator size="small" color={colors.textOnPrimary} />
                  ) : (
                    <>
                      <Lucide name="send" size={14} color={colors.textOnPrimary} />
                      <Text style={im.sendText}>{s('sendFriendRequest')}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={inviteModalVisible} transparent animationType="slide" onRequestClose={() => setInviteModalVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={im.overlay} onPress={() => setInviteModalVisible(false)}>
            <Pressable style={im.sheet} onPress={() => {}}>
              <View style={im.handleWrap}><View style={im.handle} /></View>
              <Text style={im.title}>{s('inviteFriends')}</Text>
              <Text style={im.desc}>{s('inviteEmailDesc')}</Text>

              <View style={im.inputRow}>
                <TextInput
                  style={im.input}
                  placeholder={s('inviteEmailPlaceholder')}
                  placeholderTextColor={colors.textFaint}
                  value={inviteEmail}
                  onChangeText={(value) => {
                    setInviteEmail(value);
                    setInviteEmailResult('idle');
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  autoFocus
                />
              </View>

              {inviteEmailResult === 'sent' && (
                <View style={im.resultRow}>
                  <Lucide name="check-circle" size={16} color={colors.primaryMid} />
                  <Text style={[im.resultText, { color: colors.primaryMid }]}>{s('inviteEmailSent')}</Text>
                </View>
              )}
              {inviteEmailResult === 'invalid' && (
                <View style={im.resultRow}>
                  <Lucide name="alert-circle" size={16} color={colors.accent} />
                  <Text style={[im.resultText, { color: colors.accent }]}>{s('inviteEmailInvalid')}</Text>
                </View>
              )}
              {inviteEmailResult === 'already_registered' && (
                <View style={im.resultRow}>
                  <Lucide name="users" size={16} color={colors.textFaint} />
                  <Text style={[im.resultText, { color: colors.textFaint }]}>{s('inviteEmailAlreadyRegistered')}</Text>
                </View>
              )}
              {inviteEmailResult === 'error' && (
                <View style={im.resultRow}>
                  <Lucide name="x-circle" size={16} color={colors.red} />
                  <Text style={[im.resultText, { color: colors.red }]}>{s('inviteEmailError')}</Text>
                </View>
              )}

              <View style={im.actions}>
                <TouchableOpacity style={im.cancelBtn} onPress={() => setInviteModalVisible(false)}>
                  <Text style={im.cancelText}>{s('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[im.sendBtn, (!inviteEmail.trim() || inviteEmailLoading) && im.sendBtnDisabled]}
                  onPress={handleSendInviteEmail}
                  disabled={!inviteEmail.trim() || inviteEmailLoading}
                >
                  {inviteEmailLoading ? (
                    <ActivityIndicator size="small" color={colors.textOnPrimary} />
                  ) : (
                    <>
                      <Lucide name="send" size={14} color={colors.textOnPrimary} />
                      <Text style={im.sendText}>{s('sendInviteEmail')}</Text>
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
