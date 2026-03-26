import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Lucide } from '../components/Icon';
import { Colors, Fonts, Radius } from '../theme';

const SUMMARY_STATS = [
  { value: '47', label: 'Check-ins', bg: Colors.greenPale, color: Colors.green },
  { value: '18', label: 'Loca\u021Bii', bg: Colors.purplePale, color: Colors.purple },
  { value: '32h', label: 'Timp jucat', bg: Colors.amberPale, color: Colors.orange },
];

const TIMELINE = [
  {
    dayLabel: 'Azi \u2014 26 Martie',
    dotColor: Colors.green,
    entries: [
      { title: 'Parcul Her\u0103str\u0103u \u2014 Masa 3', time: '14:30', duration: '1h 20min', icon: 'map-pin', iconColor: Colors.greenLight, bg: Colors.greenPale, friends: 'cu Radu C.' },
      { title: 'Club Sportiv Dinamo \u2014 Indoor', time: '10:00', duration: '2h', icon: 'map-pin', iconColor: Colors.blue, bg: Colors.bluePale },
    ],
  },
  {
    dayLabel: 'Ieri \u2014 25 Martie',
    dotColor: Colors.inkFaint,
    entries: [
      { title: 'Parcul Titan \u2014 Masa 1', time: '16:00', duration: '45min', icon: 'map-pin', iconColor: Colors.greenLight, bg: Colors.greenPale, friends: 'cu Elena V., Sergiu N.' },
    ],
  },
  {
    dayLabel: '24 Martie',
    dotColor: Colors.inkFaint,
    entries: [
      { title: 'Parcul Ci\u0219migiu \u2014 Masa 2', time: '11:30', duration: '1h 10min', icon: 'map-pin', iconColor: Colors.greenLight, bg: Colors.greenPale, friends: 'cu Ana T.' },
    ],
  },
];

export function PlayHistoryScreen() {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Lucide name="arrow-left" size={24} color={Colors.ink} />
        <Text style={styles.headerTitle}>Istoric joc</Text>
        <TouchableOpacity style={styles.filterBtn}>
          <Lucide name="calendar" size={14} color={Colors.inkMuted} />
          <Text style={styles.filterText}>Mar 2026</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll}>
        {/* Stats Summary */}
        <View style={styles.statsRow}>
          {SUMMARY_STATS.map((stat) => (
            <View key={stat.label} style={[styles.statCard, { backgroundColor: stat.bg }]}>
              <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Streak Bar */}
        <View style={styles.streakBar}>
          <Lucide name="flame" size={18} color={Colors.orangeBright} />
          <Text style={styles.streakText}>Serie activ&#259;: 5 zile consecutive!</Text>
        </View>

        {/* Timeline */}
        <View style={styles.timeline}>
          {TIMELINE.map((day) => (
            <View key={day.dayLabel}>
              <View style={styles.dayLabel}>
                <View style={[styles.dayDot, { backgroundColor: day.dotColor }]} />
                <Text style={styles.dayText}>{day.dayLabel}</Text>
              </View>
              {day.entries.map((entry) => (
                <TouchableOpacity key={entry.title} style={styles.entry}>
                  <View style={[styles.entryIcon, { backgroundColor: entry.bg }]}>
                    <Lucide name={entry.icon} size={18} color={entry.iconColor} />
                  </View>
                  <View style={styles.entryInfo}>
                    <Text style={styles.entryTitle}>{entry.title}</Text>
                    <View style={styles.entryDetails}>
                      <Text style={styles.entryTime}>{entry.time}</Text>
                      <Text style={styles.entryDot}>{'\u00B7'}</Text>
                      <Text style={styles.entryDuration}>{entry.duration}</Text>
                    </View>
                    {entry.friends && (
                      <View style={styles.entryFriends}>
                        <Lucide name="users" size={10} color={Colors.purpleMid} />
                        <Text style={styles.entryFriendsText}>{entry.friends}</Text>
                      </View>
                    )}
                  </View>
                  <Lucide name="chevron-right" size={18} color={Colors.inkFaint} />
                </TouchableOpacity>
              ))}
            </View>
          ))}

          {/* Load More */}
          <View style={styles.loadMore}>
            <TouchableOpacity style={styles.loadMoreBtn}>
              <Lucide name="chevrons-down" size={16} color={Colors.inkMuted} />
              <Text style={styles.loadMoreText}>Mai vechi</Text>
            </TouchableOpacity>
          </View>
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
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgDark,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '500',
    color: Colors.inkMuted,
  },
  scroll: {
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    paddingBottom: 8,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  statValue: {
    fontFamily: Fonts.heading,
    fontSize: 24,
    fontWeight: '800',
  },
  statLabel: {
    fontFamily: Fonts.body,
    fontSize: 11,
    fontWeight: '500',
    color: Colors.inkMuted,
  },
  streakBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  streakText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.orange,
  },
  timeline: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  dayLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  dayDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dayText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.inkMuted,
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingLeft: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    borderLeftWidth: 2,
    borderLeftColor: Colors.borderLight,
  },
  entryIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryInfo: {
    flex: 1,
    gap: 2,
  },
  entryTitle: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ink,
  },
  entryDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  entryTime: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.inkFaint,
  },
  entryDot: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.inkFaint,
  },
  entryDuration: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.inkFaint,
  },
  entryFriends: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  entryFriendsText: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.purpleMid,
  },
  loadMore: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgDark,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  loadMoreText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    fontWeight: '500',
    color: Colors.inkMuted,
  },
});
