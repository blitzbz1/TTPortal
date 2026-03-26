import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Lucide } from '../components/Icon';
import { Colors, Fonts, Radius } from '../theme';

type FriendsTab = 'all' | 'online' | 'pending';

const INVITES = [
  { initials: 'DM', name: 'Dan Marin', mutual: '5 prieteni \u00een comun', color: Colors.purple },
  { initials: 'LP', name: 'Laura Popescu', mutual: '2 prieteni \u00een comun', color: Colors.purpleMid },
];

const FRIENDS = [
  { initials: 'RC', name: 'Radu Cristescu', status: 'Parcul Herăstrău', online: true, color: Colors.green },
  { initials: 'EV', name: 'Elena Voicu', status: 'Club Sportiv Dinamo', online: true, color: Colors.greenMid },
  { initials: 'MI', name: 'Mihai Ionescu', status: 'Ultima activitate: ieri', online: false, color: Colors.inkMuted },
  { initials: 'AT', name: 'Ana Tudor', status: 'Ultima activitate: acum 3 zile', online: false, color: Colors.purple },
  { initials: 'SN', name: 'Sergiu Neagu', status: 'Parcul Titan', online: true, color: Colors.orange },
];

export function FriendsScreen() {
  const [activeTab, setActiveTab] = useState<FriendsTab>('all');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Lucide name="arrow-left" size={24} color={Colors.ink} />
        <Text style={styles.headerTitle}>Prieteni</Text>
        <TouchableOpacity style={styles.inviteBtn}>
          <Lucide name="user-plus" size={16} color={Colors.white} />
          <Text style={styles.inviteBtnText}>Invit&#259;</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll}>
        {/* Search */}
        <View style={styles.searchWrap}>
          <View style={styles.searchBar}>
            <Lucide name="search" size={18} color={Colors.inkFaint} />
            <Text style={styles.searchPlaceholder}>Caut&#259; prieteni...</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {[
            { key: 'all' as FriendsTab, label: 'To\u021Bi (24)' },
            { key: 'online' as FriendsTab, label: 'Online (5)' },
            { key: 'pending' as FriendsTab, label: '\u00cen a\u0219teptare (3)' },
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

        {/* Pending Invites */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Invita&#539;ii primite</Text>
          {INVITES.map((inv) => (
            <View key={inv.name} style={styles.inviteCard}>
              <View style={[styles.inviteAvatar, { backgroundColor: inv.color }]}>
                <Text style={styles.inviteInitials}>{inv.initials}</Text>
              </View>
              <View style={styles.inviteInfo}>
                <Text style={styles.inviteName}>{inv.name}</Text>
                <Text style={styles.inviteMutual}>{inv.mutual}</Text>
              </View>
              <View style={styles.inviteActions}>
                <TouchableOpacity style={styles.acceptBtn}>
                  <Text style={styles.acceptText}>Accept&#259;</Text>
                </TouchableOpacity>
                <Lucide name="x" size={20} color={Colors.inkFaint} />
              </View>
            </View>
          ))}
        </View>

        {/* Friends List */}
        <View style={styles.section}>
          <View style={styles.friendsLabel}>
            <Text style={styles.sectionLabel}>Prieteni</Text>
            <View style={styles.onlineCount}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>5 online</Text>
            </View>
          </View>
          {FRIENDS.map((friend) => (
            <View key={friend.name} style={styles.friendRow}>
              <View style={styles.friendAvatarWrap}>
                <View style={[styles.friendAvatar, { backgroundColor: friend.color }]}>
                  <Text style={styles.friendInitials}>{friend.initials}</Text>
                </View>
                {friend.online && <View style={styles.friendOnlineDot} />}
              </View>
              <View style={styles.friendInfo}>
                <Text style={styles.friendName}>{friend.name}</Text>
                <Text style={styles.friendStatus}>{friend.status}</Text>
              </View>
              <Lucide name="message-circle" size={22} color={Colors.inkFaint} />
            </View>
          ))}
        </View>

        {/* Share Invite */}
        <View style={styles.shareSection}>
          <TouchableOpacity style={styles.shareCard}>
            <View style={styles.shareIconWrap}>
              <Lucide name="share-2" size={20} color={Colors.white} />
            </View>
            <View style={styles.shareInfo}>
              <Text style={styles.shareTitle}>Invit&#259; prieteni</Text>
              <Text style={styles.shareDesc}>
                Trimite un link de invita&#539;ie prin WhatsApp, SMS sau email
              </Text>
            </View>
            <Lucide name="chevron-right" size={20} color={Colors.inkFaint} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
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
  searchPlaceholder: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.inkFaint,
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
