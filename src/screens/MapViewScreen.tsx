import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, ActivityIndicator, Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Callout } from 'react-native-maps';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Lucide } from '../components/Icon';
import { TabBar } from '../components/TabBar';
import { CityPickerModal } from '../components/CityPickerModal';
import { Colors, Fonts, Radius } from '../theme';
import { getVenues } from '../services/venues';
import { useI18n } from '../hooks/useI18n';
import type { Venue, VenueCondition } from '../types/database';

type VenueWithStats = Venue & {
  venue_stats: {
    venue_id: number;
    avg_rating: number | null;
    review_count: number;
    checkin_count: number;
    favorite_count: number;
  } | null;
};

type FilterKey = 'toate' | 'parcuri' | 'indoor' | 'verificat';

interface MapViewScreenProps {
  hideTabBar?: boolean;
}

export function MapViewScreen({ hideTabBar = false }: MapViewScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { s } = useI18n();
  const [venues, setVenues] = useState<VenueWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('toate');
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const mapRef = useRef<MapView>(null);

  const filters: { key: FilterKey; label: string; icon?: string }[] = [
    { key: 'toate', label: s('filterAll') },
    { key: 'parcuri', label: s('filterParks') },
    { key: 'indoor', label: s('filterIndoor') },
    { key: 'verificat', label: s('filterVerified'), icon: 'check' },
  ];

  const conditionLabel = (condition: VenueCondition | null) => {
    if (!condition) return { label: s('conditionUnknown'), color: Colors.inkFaint };
    const map: Record<string, { label: string; color: string }> = {
      buna: { label: s('conditionGood'), color: Colors.greenLight },
      acceptabila: { label: s('conditionAcceptable'), color: Colors.amber },
      deteriorata: { label: s('conditionDegraded'), color: Colors.red },
      profesionala: { label: s('conditionPro'), color: '#1a5080' },
      necunoscuta: { label: s('conditionUnknown'), color: Colors.inkFaint },
    };
    return map[condition] || { label: condition, color: Colors.inkFaint };
  };

  const typeLabel = (type: string) => {
    if (type === 'parc_exterior') return s('typePark');
    if (type === 'sala_indoor') return s('typeHall');
    return type;
  };

  const fetchVenues = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getVenues(selectedCity ?? undefined);
      if (data) setVenues(data as VenueWithStats[]);
    } catch {
      // silently handle fetch errors
    } finally {
      setLoading(false);
    }
  }, [selectedCity]);

  useEffect(() => {
    fetchVenues();
  }, [fetchVenues]);

  const handleNearMe = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(s('error'), s('locationPermissionDenied') || 'Location permission denied');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      mapRef.current?.animateToRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }, 800);
    } catch {
      Alert.alert(s('error'), 'Could not get location');
    }
  }, [s]);

  const filteredVenues = useMemo(() => {
    let result = venues;

    // Apply filter chip
    if (activeFilter === 'parcuri') {
      result = result.filter((v) => v.type === 'parc_exterior');
    } else if (activeFilter === 'indoor') {
      result = result.filter((v) => v.type === 'sala_indoor');
    } else if (activeFilter === 'verificat') {
      result = result.filter((v) => v.verified === true);
    }

    // Apply search query
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          (v.address && v.address.toLowerCase().includes(q)) ||
          (v.city && v.city.toLowerCase().includes(q)),
      );
    }

    return result;
  }, [venues, activeFilter, searchQuery]);

  return (
    <View style={styles.container}>
      {/* App Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerEmoji}>{'\uD83C\uDFD3'}</Text>
          <Text style={styles.headerTitle}>TT PORTAL</Text>
        </View>
        <TouchableOpacity style={styles.cityPicker} onPress={() => setCityModalVisible(true)}>
          <Text style={styles.cityText}>{selectedCity || 'București'}</Text>
          <Lucide name="chevron-down" size={14} color="#ffffffaa" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/(protected)/add-venue' as any)}>
          <Lucide name="plus" size={14} color={Colors.white} />
          <Text style={styles.addBtnText}>{s('addBtn')}</Text>
        </TouchableOpacity>
      </View>

      {/* Map Area */}
      <View style={styles.mapArea}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          showsUserLocation
          initialRegion={{
            latitude: 44.4268,
            longitude: 26.1025,
            latitudeDelta: 0.08,
            longitudeDelta: 0.08,
          }}
        >
          {filteredVenues.map((venue) => {
            if (!venue.lat || !venue.lng) return null;
            const condInfo = conditionLabel(venue.condition);
            const isIndoor = venue.type === 'sala_indoor';
            return (
              <Marker
                key={venue.id}
                coordinate={{ latitude: venue.lat, longitude: venue.lng }}
                tracksViewChanges={false}
              >
                <View style={pinStyles.outer}>
                  <View style={[pinStyles.wrap, { backgroundColor: condInfo.color }]}>
                    <Text style={pinStyles.icon}>{isIndoor ? '🏢' : '🏓'}</Text>
                  </View>
                  <View style={pinStyles.arrow} />
                </View>
                <Callout tooltip onPress={() => router.push(`/venue/${venue.id}` as any)}>
                  <View style={pinStyles.callout}>
                    <Text style={pinStyles.calloutTitle} numberOfLines={1}>{venue.name}</Text>
                    <Text style={pinStyles.calloutSub}>{typeLabel(venue.type)} · {condInfo.label}</Text>
                  </View>
                </Callout>
              </Marker>
            );
          })}
        </MapView>

        <View style={styles.legend}>
          {[
            { color: Colors.greenLight, icon: '🏓', label: s('conditionGood') },
            { color: Colors.amber, icon: '🏓', label: s('conditionAcceptable') },
            { color: Colors.red, icon: '🏓', label: s('conditionDegraded') },
            { color: '#1a5080', icon: '🏢', label: s('conditionIndoor') },
          ].map((item) => (
            <View key={item.label} style={styles.legendRow}>
              <View style={[styles.legendMarker, { backgroundColor: item.color }]}>
                <Text style={styles.legendIcon}>{item.icon}</Text>
              </View>
              <Text style={styles.legendText}>{item.label}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.nearMeBtn} onPress={handleNearMe}>
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
            <TextInput
              style={styles.searchInput}
              placeholder={s('searchPlaceholder')}
              placeholderTextColor={Colors.inkFaint}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
          </View>
          <TouchableOpacity style={styles.nearMeListBtn} onPress={handleNearMe}>
            <Lucide name="locate" size={16} color={Colors.greenMid} />
            <Text style={styles.nearMeListText}>{s('nearbyBtn')}</Text>
          </TouchableOpacity>
        </View>

        {/* Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
          <View style={styles.filtersRow}>
            {filters.map((f) => (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterChip, activeFilter === f.key && styles.filterChipActive]}
                onPress={() => setActiveFilter(f.key)}
              >
                {f.icon && <Lucide name={f.icon} size={12} color={activeFilter === f.key ? Colors.white : Colors.greenMid} />}
                <Text style={[styles.filterText, activeFilter === f.key && styles.filterTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* List Header */}
        <View style={styles.listHeader}>
          <Text style={styles.listHeaderText} testID="venues-count">{filteredVenues.length} {s('venuesShown')}</Text>
          <View style={styles.friendsOnline}>
            <View style={[styles.friendsDot, { backgroundColor: Colors.purpleMid }]} />
            <Text style={styles.friendsText}>2 {s('friendsActive')}</Text>
          </View>
        </View>

        {/* Venue Cards */}
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 32 }}>
            <ActivityIndicator size="large" color={Colors.green} />
          </View>
        ) : filteredVenues.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 32 }}>
            <Text style={{ fontFamily: Fonts.body, fontSize: 14, color: Colors.inkFaint }}>{s('noVenues')}</Text>
          </View>
        ) : (
          <ScrollView style={styles.venueList} testID="venue-list">
            {filteredVenues.map((venue, index) => {
              const conditionInfo = conditionLabel(venue.condition);
              const avgRating = venue.venue_stats?.avg_rating;
              const starsText = avgRating != null ? `\u2605 ${avgRating.toFixed(1)}` : '';
              const tablesText = venue.tables_count != null ? `${venue.tables_count} ${s('tables')}` : '';

              return (
                <TouchableOpacity
                  key={venue.id}
                  style={[styles.venueCard, index === 0 && styles.venueCardHighlight]}
                  onPress={() => router.push(`/venue/${venue.id}` as any)}
                  accessibilityLabel={venue.name}
                >
                  <View style={styles.venueLeft}>
                    <Text style={styles.venueName}>{venue.name}</Text>
                    <View style={styles.venueMeta}>
                      <Text style={styles.venueType}>{typeLabel(venue.type)}</Text>
                      {tablesText ? (
                        <>
                          <Text style={styles.venueMetaSep}>{'\u00B7'}</Text>
                          <Text style={styles.venueTables}>{tablesText}</Text>
                        </>
                      ) : null}
                      <View style={[styles.conditionDot, { backgroundColor: conditionInfo.color }]} />
                      <Text style={[styles.venueCondition, { color: conditionInfo.color }]}>
                        {conditionInfo.label}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.venueRight}>
                    {venue.city ? (
                      <View style={styles.distanceBadge}>
                        <Text style={styles.distanceText}>{venue.city}</Text>
                      </View>
                    ) : null}
                    {starsText ? <Text style={styles.venueStars}>{starsText}</Text> : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {!hideTabBar && <TabBar activeTab="map" />}

      <CityPickerModal
        visible={cityModalVisible}
        selectedCity={selectedCity}
        onSelect={(c) => { setSelectedCity(c); setCityModalVisible(false); }}
        onClose={() => setCityModalVisible(false)}
      />
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
    paddingBottom: 10,
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
  legendMarker: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  legendIcon: {
    fontSize: 10,
    lineHeight: 13,
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
  searchInput: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.ink,
    padding: 0,
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
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderRadius: 100,
    height: 36,
    paddingHorizontal: 16,
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
    color: '#1a1c19',
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

/* ── Custom map pin ─────────────────────────────────── */
const pinStyles = StyleSheet.create({
  outer: {
    alignItems: 'center',
  },
  wrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2.5,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.25, shadowRadius: 3 },
      android: { elevation: 4 },
    }),
  },
  icon: {
    fontSize: 13,
    lineHeight: 16,
  },
  arrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: Colors.white,
    marginTop: -1,
  },
  callout: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: 10,
    minWidth: 140,
    maxWidth: 220,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6 },
      android: { elevation: 4 },
    }),
  },
  calloutTitle: {
    fontFamily: Fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.ink,
    marginBottom: 2,
  },
  calloutSub: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.inkFaint,
  },
});
