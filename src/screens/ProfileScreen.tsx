import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Lucide } from '../components/Icon';
import { TabBar } from '../components/TabBar';
import { Colors, Fonts, Radius } from '../theme';

const STATS = [
  { value: '47', label: 'Check-ins' },
  { value: '12', label: 'Recenzii' },
  { value: '3', label: 'Loca\u021Bii ad\u0103ugate' },
];

const QUICK_ACTIONS = [
  { icon: 'users', label: 'Prieteni', color: Colors.greenMid, bg: Colors.greenPale, border: Colors.greenDim },
  { icon: 'trophy', label: 'Istoric joc', color: Colors.purple, bg: Colors.purplePale, border: Colors.purpleDim },
  { icon: 'bookmark', label: 'Favorite', color: Colors.orange, bg: Colors.amberPale, border: Colors.amberDeep },
];

const ACTIVITIES = [
  { icon: 'map-pin', iconColor: Colors.greenMid, bg: Colors.greenDim, text: 'Check-in la Parcul Na\u021Bional', time: 'Azi, 14:30' },
  { icon: 'star', iconColor: Colors.orange, bg: Colors.amberPale, text: 'Recenzie la Sala Sporturilor', time: 'Ieri, 18:15' },
  { icon: 'user-plus', iconColor: Colors.purple, bg: Colors.purplePale, text: 'Maria P. a acceptat invita\u021Bia', time: 'Luni, 10:00' },
];

const SETTINGS = [
  { icon: 'bell', label: 'Notific\u0103ri', chevron: true },
  { icon: 'globe', label: 'Limb\u0103', value: 'RO' },
  { icon: 'shield', label: 'Confiden\u021Bialitate', chevron: true },
];

export function ProfileScreen() {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profilul meu</Text>
        <Lucide name="settings" size={22} color={Colors.inkFaint} />
      </View>

      <ScrollView style={styles.scroll}>
        {/* Profile Hero */}
        <View style={styles.hero}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>AM</Text>
            </View>
            <View style={styles.onlineDot} />
          </View>
          <Text style={styles.name}>Andrei Marinescu</Text>
          <Text style={styles.username}>@andrei_m &#183; Bucure&#537;ti</Text>
          <View style={styles.badges}>
            <View style={styles.badgeGreen}>
              <Text style={styles.badgeEmoji}>{'\uD83C\uDFD3'}</Text>
              <Text style={styles.badgeGreenText}>Juc\u0103tor activ</Text>
            </View>
            <View style={styles.badgePurple}>
              <Text style={styles.badgeEmoji}>{'\u2B50'}</Text>
              <Text style={styles.badgePurpleText}>Top contributor</Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {STATS.map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ac&#539;iuni rapide</Text>
          <View style={styles.quickRow}>
            {QUICK_ACTIONS.map((action) => (
              <TouchableOpacity key={action.label} style={[styles.quickBtn, { backgroundColor: action.bg, borderColor: action.border }]}>
                <Lucide name={action.icon} size={22} color={action.color} />
                <Text style={[styles.quickLabel, { color: action.color }]}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activitate recent&#259;</Text>
          {ACTIVITIES.map((act) => (
            <View key={act.text} style={styles.activityCard}>
              <View style={[styles.actIcon, { backgroundColor: act.bg }]}>
                <Lucide name={act.icon} size={18} color={act.iconColor} />
              </View>
              <View style={styles.actInfo}>
                <Text style={styles.actText}>{act.text}</Text>
                <Text style={styles.actTime}>{act.time}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Set&#259;ri</Text>
          {SETTINGS.map((item) => (
            <TouchableOpacity key={item.label} style={styles.settingsRow}>
              <View style={styles.settingsLeft}>
                <Lucide name={item.icon} size={18} color={Colors.inkMuted} />
                <Text style={styles.settingsLabel}>{item.label}</Text>
              </View>
              {item.chevron ? (
                <Lucide name="chevron-right" size={16} color={Colors.inkFaint} />
              ) : (
                <Text style={styles.settingsValue}>{item.value}</Text>
              )}
            </TouchableOpacity>
          ))}

          {/* Admin / Moderare */}
          <TouchableOpacity style={styles.settingsRow}>
            <View style={styles.settingsLeft}>
              <Lucide name="shield-check" size={18} color={Colors.inkMuted} />
              <Text style={styles.settingsLabel}>Moderare</Text>
            </View>
            <View style={styles.adminBadge}>
              <View style={styles.adminPill}>
                <Text style={styles.adminPillText}>Admin</Text>
              </View>
              <Lucide name="chevron-right" size={16} color={Colors.inkFaint} />
            </View>
          </TouchableOpacity>

          {/* Logout */}
          <TouchableOpacity style={styles.logoutRow}>
            <Lucide name="log-out" size={18} color={Colors.red} />
            <Text style={styles.logoutText}>Deconectare</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <TabBar activeTab="profile" />
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
  scroll: {
    flex: 1,
  },
  hero: {
    backgroundColor: Colors.white,
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 24,
    gap: 16,
  },
  avatarWrap: {
    width: 88,
    height: 88,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: Fonts.heading,
    fontSize: 32,
    fontWeight: '700',
    color: Colors.white,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.greenLight,
    borderWidth: 3,
    borderColor: Colors.white,
  },
  name: {
    fontFamily: Fonts.heading,
    fontSize: 22,
    fontWeight: '700',
    color: Colors.ink,
  },
  username: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.inkFaint,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
  },
  badgeEmoji: {
    fontSize: 12,
  },
  badgeGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.greenDim,
    borderRadius: 100,
    paddingVertical: 4,
    paddingHorizontal: 10,
    gap: 4,
  },
  badgeGreenText: {
    fontFamily: Fonts.body,
    fontSize: 11,
    fontWeight: '600',
    color: Colors.greenMid,
  },
  badgePurple: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.purplePale,
    borderRadius: 100,
    paddingVertical: 4,
    paddingHorizontal: 10,
    gap: 4,
  },
  badgePurpleText: {
    fontFamily: Fonts.body,
    fontSize: 11,
    fontWeight: '600',
    color: Colors.purple,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  statValue: {
    fontFamily: Fonts.heading,
    fontSize: 28,
    fontWeight: '700',
    color: Colors.green,
  },
  statLabel: {
    fontFamily: Fonts.body,
    fontSize: 11,
    fontWeight: '500',
    color: Colors.inkFaint,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 10,
  },
  sectionTitle: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ink,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickBtn: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 12,
    gap: 10,
    borderWidth: 1,
  },
  quickLabel: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '600',
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    paddingHorizontal: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  actIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actInfo: {
    flex: 1,
    gap: 2,
  },
  actText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    fontWeight: '500',
    color: Colors.ink,
  },
  actTime: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.inkFaint,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  settingsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsLabel: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.ink,
  },
  settingsValue: {
    fontFamily: Fonts.body,
    fontSize: 13,
    fontWeight: '500',
    color: Colors.inkFaint,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  adminPill: {
    backgroundColor: Colors.greenPale,
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  adminPillText: {
    fontFamily: Fonts.body,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.greenMid,
  },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  logoutText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.red,
  },
});
