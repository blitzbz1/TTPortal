import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Lucide } from '../components/Icon';
import { TabBar } from '../components/TabBar';
import { Colors, Fonts, Radius } from '../theme';

const FILTERS = [
  { label: 'Toate', active: true },
  { label: '\uD83C\uDF33 Parcuri', active: false },
  { label: '\uD83C\uDFE2 Indoor', active: false },
  { label: 'Verificat', active: false, icon: 'check' },
];

const VENUES = [
  {
    name: 'Parcul Na\u021Bional',
    type: '\uD83C\uDF33 Parc',
    tables: '4 mese',
    condition: 'Bun\u0103',
    conditionColor: Colors.greenLight,
    distance: '0.8 km',
    stars: '\u2605 4.5',
    highlight: true,
  },
  {
    name: 'Sala Sporturilor Titan',
    type: '\uD83C\uDFE2 Sal\u0103',
    tables: '8 mese',
    condition: 'Profesional\u0103',
    conditionColor: '#1a5080',
    distance: '2.1 km',
    stars: '\u2605 4.8',
    highlight: false,
  },
  {
    name: 'Parcul IOR',
    type: '\uD83C\uDF33 Parc',
    tables: '2 mese',
    condition: 'Acceptabil\u0103',
    conditionColor: Colors.amber,
    distance: '1.5 km',
    stars: '\u2605 4.0',
    highlight: false,
  },
];

export function MapViewScreen() {
  return (
    <View style={styles.container}>
      {/* App Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerEmoji}>{'\uD83C\uDFD3'}</Text>
          <Text style={styles.headerTitle}>TT PORTAL</Text>
        </View>
        <TouchableOpacity style={styles.cityPicker}>
          <Text style={styles.cityText}>Bucure\u0219ti</Text>
          <Lucide name="chevron-down" size={14} color="#ffffffaa" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.addBtn}>
          <Lucide name="plus" size={14} color={Colors.white} />
          <Text style={styles.addBtnText}>Adaug\u0103</Text>
        </TouchableOpacity>
      </View>

      {/* Map Area Placeholder */}
      <View style={styles.mapArea}>
        <View style={styles.legend}>
          {[
            { color: Colors.greenLight, label: 'Bun\u0103' },
            { color: Colors.amber, label: 'Acceptabil\u0103' },
            { color: Colors.red, label: 'Deteriorat\u0103' },
            { color: '#1a5080', label: 'Sal\u0103 indoor' },
          ].map((item) => (
            <View key={item.label} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <Text style={styles.legendText}>{item.label}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.nearMeBtn}>
          <Lucide name="locate" size={22} color={Colors.green} />
        </TouchableOpacity>
      </View>

      {/* Venue List Panel */}
      <View style={styles.panel}>
        {/* Handle */}
        <View style={styles.panelHandle}>
          <View style={styles.handleBar} />
        </View>

        {/* Search Row */}
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Lucide name="search" size={16} color={Colors.inkFaint} />
            <Text style={styles.searchText}>Caut\u0103 loca\u021Bii...</Text>
          </View>
          <TouchableOpacity style={styles.nearMeListBtn}>
            <Lucide name="locate" size={16} color={Colors.greenMid} />
            <Text style={styles.nearMeListText}>Aproape</Text>
          </TouchableOpacity>
        </View>

        {/* Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
          <View style={styles.filtersRow}>
            {FILTERS.map((f) => (
              <TouchableOpacity
                key={f.label}
                style={[styles.filterChip, f.active && styles.filterChipActive]}
              >
                {f.icon && <Lucide name={f.icon} size={12} color={Colors.greenMid} />}
                <Text style={[styles.filterText, f.active && styles.filterTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* List Header */}
        <View style={styles.listHeader}>
          <Text style={styles.listHeaderText}>54 loca\u021Bii afi\u0219ate</Text>
          <View style={styles.friendsOnline}>
            <View style={[styles.friendsDot, { backgroundColor: Colors.purpleMid }]} />
            <Text style={styles.friendsText}>2 prieteni activi</Text>
          </View>
        </View>

        {/* Venue Cards */}
        <ScrollView style={styles.venueList}>
          {VENUES.map((venue) => (
            <TouchableOpacity
              key={venue.name}
              style={[styles.venueCard, venue.highlight && styles.venueCardHighlight]}
            >
              <View style={styles.venueLeft}>
                <Text style={styles.venueName}>{venue.name}</Text>
                <View style={styles.venueMeta}>
                  <Text style={styles.venueType}>{venue.type}</Text>
                  <Text style={styles.venueMetaSep}>{'\u00B7'}</Text>
                  <Text style={styles.venueTables}>{venue.tables}</Text>
                  <View style={[styles.conditionDot, { backgroundColor: venue.conditionColor }]} />
                  <Text style={[styles.venueCondition, { color: venue.conditionColor }]}>
                    {venue.condition}
                  </Text>
                </View>
              </View>
              <View style={styles.venueRight}>
                <View style={styles.distanceBadge}>
                  <Text style={styles.distanceText}>{venue.distance}</Text>
                </View>
                <Text style={styles.venueStars}>{venue.stars}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <TabBar activeTab="map" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.black,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.green,
    height: 52,
    paddingHorizontal: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerEmoji: {
    fontSize: 16,
  },
  headerTitle: {
    fontFamily: Fonts.heading,
    fontSize: 14,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 1,
  },
  cityPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff18',
    borderRadius: 100,
    paddingVertical: 5,
    paddingHorizontal: 12,
    gap: 6,
  },
  cityText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    fontWeight: '500',
    color: Colors.white,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.orangeBright,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    gap: 4,
  },
  addBtnText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.white,
  },
  mapArea: {
    height: 400,
    backgroundColor: '#d4e4d0',
    position: 'relative',
  },
  legend: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#ffffffee',
    borderRadius: Radius.md,
    padding: 10,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontFamily: Fonts.body,
    fontSize: 10,
    color: Colors.inkMuted,
  },
  nearMeBtn: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  panel: {
    flex: 1,
    backgroundColor: Colors.bg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    marginTop: -16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 5,
  },
  panelHandle: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 28,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 100,
    backgroundColor: Colors.border,
  },
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    height: 40,
    paddingHorizontal: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.inkFaint,
  },
  nearMeListBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.greenPale,
    borderRadius: Radius.md,
    height: 40,
    paddingHorizontal: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.greenDim,
  },
  nearMeListText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.greenMid,
  },
  filtersScroll: {
    maxHeight: 44,
  },
  filtersRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 100,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  filterChipActive: {
    backgroundColor: Colors.green,
    borderColor: Colors.green,
  },
  filterText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '500',
    color: Colors.inkMuted,
  },
  filterTextActive: {
    color: Colors.white,
    fontWeight: '600',
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  listHeaderText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '500',
    color: Colors.inkFaint,
  },
  friendsOnline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  friendsDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  friendsText: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.purpleMid,
  },
  venueList: {
    flex: 1,
    paddingHorizontal: 12,
  },
  venueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    padding: 10,
    paddingHorizontal: 12,
    marginBottom: 2,
    gap: 10,
  },
  venueCardHighlight: {
    backgroundColor: Colors.greenPale,
    borderLeftWidth: 3,
    borderLeftColor: Colors.greenLight + '30',
  },
  venueLeft: {
    flex: 1,
    gap: 4,
  },
  venueName: {
    fontFamily: Fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.ink,
  },
  venueMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  venueType: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.inkMuted,
  },
  venueMetaSep: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.inkFaint,
  },
  venueTables: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.inkMuted,
  },
  conditionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  venueCondition: {
    fontFamily: Fonts.body,
    fontSize: 11,
    fontWeight: '500',
  },
  venueRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  distanceBadge: {
    backgroundColor: Colors.bluePale,
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  distanceText: {
    fontFamily: Fonts.body,
    fontSize: 11,
    fontWeight: '500',
    color: Colors.blue,
  },
  venueStars: {
    fontFamily: Fonts.body,
    fontSize: 11,
    fontWeight: '500',
    color: Colors.orange,
  },
});
