import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Lucide } from '../components/Icon';
import { TabBar } from '../components/TabBar';
import { Colors, Fonts, Radius } from '../theme';

type EventTab = 'upcoming' | 'past' | 'mine';

const EVENTS = [
  {
    date: 'S\u00e2mb\u0103t\u0103, 29 Mar',
    time: '16:00',
    location: 'Parcul Her\u0103str\u0103u \u2014 Masa 3',
    badge: 'Confirmat',
    badgeBg: Colors.greenPale,
    badgeColor: Colors.greenMid,
    avatars: ['RC', 'EV', 'AM'],
    joined: true,
    attendees: '3/6 locuri',
  },
  {
    date: 'Duminic\u0103, 30 Mar',
    time: '10:00',
    location: 'Parcul Titan \u2014 Zone principal\u0103',
    badge: 'Deschis',
    badgeBg: Colors.amberPale,
    badgeColor: Colors.orange,
    avatars: ['SN', 'MI'],
    joined: false,
    attendees: '2/8 locuri',
  },
  {
    date: 'Miercuri, 2 Apr',
    time: '18:30',
    location: 'Club Sportiv Dinamo \u2014 Sal\u0103',
    badge: 'Turneu',
    badgeBg: Colors.bluePale,
    badgeColor: Colors.blue,
    avatars: ['LP', 'DM', 'AT'],
    joined: false,
    attendees: '3/16 locuri',
  },
];

export function EventSchedulingScreen() {
  const [activeTab, setActiveTab] = useState<EventTab>('upcoming');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Lucide name="arrow-left" size={24} color={Colors.ink} />
        <Text style={styles.headerTitle}>Evenimente</Text>
        <TouchableOpacity style={styles.createBtn}>
          <Lucide name="plus" size={14} color={Colors.white} />
          <Text style={styles.createText}>Creeaz&#259;</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll}>
        {/* Tabs */}
        <View style={styles.tabs}>
          {[
            { key: 'upcoming' as EventTab, label: 'Viitoare (4)' },
            { key: 'past' as EventTab, label: 'Trecute' },
            { key: 'mine' as EventTab, label: 'Ale mele' },
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

        {/* Event Cards */}
        <View style={styles.eventsList}>
          {EVENTS.map((event) => (
            <View key={event.location} style={styles.eventCard}>
              {/* Top */}
              <View style={styles.eventTop}>
                <View style={styles.eventDateWrap}>
                  <Lucide name="calendar" size={14} color={Colors.orangeBright} />
                  <Text style={styles.eventDate}>{event.date} &#183; {event.time}</Text>
                </View>
                <View style={[styles.eventBadge, { backgroundColor: event.badgeBg }]}>
                  <Text style={[styles.eventBadgeText, { color: event.badgeColor }]}>
                    {event.badge}
                  </Text>
                </View>
              </View>

              {/* Location */}
              <View style={styles.eventMid}>
                <Lucide name="map-pin" size={14} color={Colors.inkFaint} />
                <Text style={styles.eventLocation}>{event.location}</Text>
              </View>

              {/* Bottom */}
              <View style={styles.eventBot}>
                <View style={styles.avatarStack}>
                  {event.avatars.map((init, i) => (
                    <View
                      key={init}
                      style={[
                        styles.stackAvatar,
                        { marginLeft: i > 0 ? -8 : 0, zIndex: event.avatars.length - i },
                      ]}
                    >
                      <Text style={styles.stackInitials}>{init}</Text>
                    </View>
                  ))}
                  <Text style={styles.attendeesText}>{event.attendees}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.joinBtn, event.joined ? styles.joinedBtn : styles.notJoinedBtn]}
                >
                  <Lucide
                    name={event.joined ? 'check' : 'user-plus'}
                    size={14}
                    color={event.joined ? Colors.white : Colors.green}
                  />
                  <Text style={[styles.joinText, event.joined ? styles.joinedText : styles.notJoinedText]}>
                    {event.joined ? 'Participi' : 'Particip\u0103'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <TabBar activeTab="events" />
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
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.orangeBright,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  createText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
  },
  scroll: {
    flex: 1,
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
    borderBottomColor: Colors.orangeBright,
  },
  tabText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.inkFaint,
  },
  tabTextActive: {
    fontWeight: '600',
    color: Colors.orangeBright,
  },
  eventsList: {
    padding: 16,
    paddingTop: 12,
    gap: 12,
  },
  eventCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  eventTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventDateWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventDate: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ink,
  },
  eventBadge: {
    borderRadius: Radius.md,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  eventBadgeText: {
    fontFamily: Fonts.body,
    fontSize: 11,
    fontWeight: '600',
  },
  eventMid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  eventLocation: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.inkMuted,
  },
  eventBot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stackAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  stackInitials: {
    fontFamily: Fonts.body,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.white,
  },
  attendeesText: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.inkFaint,
    marginLeft: 8,
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 6,
  },
  joinedBtn: {
    backgroundColor: Colors.green,
  },
  notJoinedBtn: {
    borderWidth: 1.5,
    borderColor: Colors.green,
  },
  joinText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '600',
  },
  joinedText: {
    color: Colors.white,
  },
  notJoinedText: {
    color: Colors.green,
  },
});
