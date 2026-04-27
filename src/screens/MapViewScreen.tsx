import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, ActivityIndicator, Alert, RefreshControl, FlatList } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Callout } from 'react-native-maps';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Lucide } from '../components/Icon';
import { NotificationBellButton } from '../components/NotificationBellButton';
import { FeedbackHeaderButton } from '../components/FeedbackHeaderButton';
import { Card } from '../components/Card';
import { CityPickerModal } from '../components/CityPickerModal';
import { VenueCardSkeleton, SkeletonList } from '../components/SkeletonLoader';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { DraggableSheet } from '../components/DraggableSheet';
import { hapticSelection } from '../lib/haptics';
import { useTheme } from '../hooks/useTheme';
import { Radius, Spacing } from '../theme';
import { createStyles } from './MapViewScreen.styles';
import { getVenues } from '../services/venues';
import { getCities } from '../services/cities';
import { getActiveFriendCheckins } from '../services/checkins';
import { getActiveFriendEvents } from '../services/events';
import { getFriendIds } from '../services/friends';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import type { Venue, VenueCondition } from '../types/database';
import { setCacheItem, getCacheItem } from '../lib/offline-cache';
import { ProductEvents, trackProductEvent } from '../lib/analytics';
import { getDistanceKm, formatDistance } from '../lib/geo';

type VenueWithStats = Venue & {
  venue_stats: {
    venue_id: number;
    avg_rating: number | null;
    review_count: number;
    checkin_count: number;
    favorite_count: number;
  } | null;
};

type VenueWithDistance = VenueWithStats & {
  distanceKm: number | null;
};

type FilterKey = 'toate' | 'parcuri' | 'indoor' | 'verificat';

interface MapViewScreenProps {
  hideTabBar?: boolean;
}

export function MapViewScreen({ hideTabBar = false }: MapViewScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { s } = useI18n();
  const { user } = useSession();
  const { colors, isDark } = useTheme();
  const headerFg = isDark ? colors.text : colors.textOnPrimary;
  const { styles, pinStyles } = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [venues, setVenues] = useState<VenueWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebouncedValue(searchQuery, 150);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('toate');
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [selectedCity, setSelectedCity] = useState<string>('București');
  const [friendCheckinVenueIds, setFriendCheckinVenueIds] = useState<Set<number>>(new Set());
  const [activeFriendsCount, setActiveFriendsCount] = useState(0);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [nearMeEnabled, setNearMeEnabled] = useState(false);
  const [locating, setLocating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const mapRef = useRef<MapView>(null);

  const filters: { key: FilterKey; label: string; icon?: string }[] = [
    { key: 'toate', label: s('filterAll') },
    { key: 'parcuri', label: s('filterParks') },
    { key: 'indoor', label: s('filterIndoor') },
    { key: 'verificat', label: s('filterVerified'), icon: 'check' },
  ];

  const conditionLabel = useCallback((condition: VenueCondition | null) => {
    if (!condition) return { label: s('conditionUnknown'), color: colors.textFaint };
    const map: Record<string, { label: string; color: string }> = {
      buna: { label: s('conditionGood'), color: colors.primaryLight },
      acceptabila: { label: s('conditionAcceptable'), color: colors.amber },
      deteriorata: { label: s('conditionDegraded'), color: colors.red },
      profesionala: { label: s('conditionPro'), color: colors.conditionPro },
      necunoscuta: { label: s('conditionUnknown'), color: colors.textFaint },
    };
    return map[condition] || { label: condition, color: colors.textFaint };
  }, [colors, s]);

  const typeLabel = (type: string) => {
    if (type === 'parc_exterior') return s('typePark');
    if (type === 'sala_indoor') return s('typeHall');
    return type;
  };

  const fetchVenues = useCallback(async (force = false) => {
    // Cache-first: paint markers from cache immediately while we refresh in
    // the background. On error, the cache also acts as the fallback.
    const cached = getCacheItem<VenueWithStats[]>(`venues_${selectedCity}`);
    if (cached && !force) {
      setVenues(cached);
      setFromCache(false);
      setFetchError(false);
      setLoading(false);
    } else {
      setLoading(true);
      setFromCache(false);
      setFetchError(false);
    }
    try {
      const { data } = await getVenues(selectedCity);
      if (data) {
        setVenues(data as VenueWithStats[]);
        setCacheItem(`venues_${selectedCity}`, data);
      }
    } catch {
      if (cached) {
        setVenues(cached);
        setFetchError(false);
        setFromCache(true);
      } else {
        setFetchError(true);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedCity]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchVenues(true);
    setRefreshing(false);
  }, [fetchVenues]);

  useEffect(() => {
    fetchVenues();
  }, [fetchVenues]);

  // Reposition map when city changes
  useEffect(() => {
    if (!selectedCity) return;
    (async () => {
      const { data: cities } = await getCities();
      const city = cities?.find((c: any) => c.name === selectedCity);
      if (city && mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: city.lat,
          longitude: city.lng,
          latitudeDelta: city.zoom ? 360 / Math.pow(2, city.zoom) : 0.08,
          longitudeDelta: city.zoom ? 360 / Math.pow(2, city.zoom) : 0.08,
        }, 500);
      }
    })();
  }, [selectedCity]);

  // Fetch active friend presence — checkins AND in-progress event
  // participation. A friend at an event in progress shows the same
  // friend-presence badge on the venue marker as a friend who has checked in.
  useEffect(() => {
    if (!user?.id) {
      setFriendCheckinVenueIds(new Set());
      setActiveFriendsCount(0);
      return;
    }
    (async () => {
      const fIds = await getFriendIds(user.id);
      if (!fIds.length) {
        setFriendCheckinVenueIds(new Set());
        setActiveFriendsCount(0);
        return;
      }
      const [checkinsRes, eventsRes] = await Promise.all([
        getActiveFriendCheckins(fIds),
        getActiveFriendEvents(fIds),
      ]);
      const venueIds = new Set<number>();
      const uniqueFriends = new Set<string>();
      for (const c of (checkinsRes.data ?? []) as any[]) {
        if (typeof c.venue_id === 'number') venueIds.add(c.venue_id);
        if (typeof c.user_id === 'string') uniqueFriends.add(c.user_id);
      }
      for (const ev of eventsRes.data ?? []) {
        if (typeof ev.venue_id === 'number') venueIds.add(ev.venue_id);
        for (const p of ev.event_participants ?? []) {
          if (typeof p.user_id === 'string') uniqueFriends.add(p.user_id);
        }
      }
      setFriendCheckinVenueIds(venueIds);
      setActiveFriendsCount(uniqueFriends.size);
    })();
  }, [user?.id]);

  const handleNearMe = useCallback(async () => {
    if (nearMeEnabled) {
      setNearMeEnabled(false);
      trackProductEvent(ProductEvents.mapNearMeToggled, { enabled: false });
      return;
    }

    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(s('error'), s('locationPermissionDenied') || 'Location permission denied');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const nextLocation = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      setUserLocation(nextLocation);
      setNearMeEnabled(true);
      trackProductEvent(ProductEvents.mapNearMeToggled, { enabled: true });
      mapRef.current?.animateToRegion({
        latitude: nextLocation.latitude,
        longitude: nextLocation.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }, 800);
    } catch {
      Alert.alert(s('error'), s('couldNotGetLocation'));
    } finally {
      setLocating(false);
    }
  }, [nearMeEnabled, s]);

  const openVenue = useCallback((venueId: number, source: 'map' | 'list') => {
    trackProductEvent(ProductEvents.mapVenueOpened, { venueId, source });
    router.push(`/venue/${venueId}` as any);
  }, [router]);

  const venuesWithDistance = useMemo<VenueWithDistance[]>(() => {
    return venues.map((venue) => {
      if (userLocation == null || venue.lat == null || venue.lng == null) {
        return { ...venue, distanceKm: null };
      }

      return {
        ...venue,
        distanceKm: getDistanceKm(
          userLocation.latitude,
          userLocation.longitude,
          venue.lat,
          venue.lng,
        ),
      };
    });
  }, [userLocation, venues]);

  const filteredVenues = useMemo(() => {
    let result = venuesWithDistance;

    // Apply filter chip
    if (activeFilter === 'parcuri') {
      result = result.filter((v) => v.type === 'parc_exterior');
    } else if (activeFilter === 'indoor') {
      result = result.filter((v) => v.type === 'sala_indoor');
    } else if (activeFilter === 'verificat') {
      result = result.filter((v) => v.verified === true);
    }

    // Apply search query (debounced)
    if (debouncedQuery.trim()) {
      const q = debouncedQuery.trim().toLowerCase();
      result = result.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          (v.address && v.address.toLowerCase().includes(q)) ||
          (v.city && v.city.toLowerCase().includes(q)),
      );
    }

    if (nearMeEnabled) {
      // Sort only when near-me is on. Distances are precomputed on
      // venuesWithDistance, so this branch never recomputes haversine.
      result = [...result].sort((a, b) => {
        if (a.distanceKm == null) return b.distanceKm == null ? 0 : 1;
        if (b.distanceKm == null) return -1;
        return a.distanceKm - b.distanceKm;
      });
    }

    return result;
  }, [venuesWithDistance, activeFilter, debouncedQuery, nearMeEnabled]);

  return (
    <View style={styles.container}>
      {/* App Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Text style={styles.headerTitle}>TT Portal</Text>
        <View style={styles.headerCenter}>
          <TouchableOpacity style={styles.cityPicker} onPress={() => setCityModalVisible(true)}>
            <Lucide name="map-pin" size={14} color={headerFg} />
            <Text style={styles.cityText}>{selectedCity}</Text>
            <Lucide name="chevron-down" size={12} color={isDark ? colors.textFaint : '#ffffffaa'} />
          </TouchableOpacity>
        </View>
        {user ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <FeedbackHeaderButton color={headerFg} />
            <NotificationBellButton color={headerFg} />
          </View>
        ) : (
          <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/sign-in')}>
            <Lucide name="log-in" size={14} color={colors.textOnPrimary} />
            <Text style={styles.addBtnText}>{s('authLogin')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Map + Draggable Sheet */}
      <View style={styles.mapContainer}>
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
            const hasFriend = friendCheckinVenueIds.has(venue.id);
            return (
              <Marker
                key={venue.id}
                coordinate={{ latitude: venue.lat, longitude: venue.lng }}
                tracksViewChanges={false}
              >
                <View style={pinStyles.outer}>
                  <View style={[pinStyles.wrap, { backgroundColor: condInfo.color }]}>
                    <Lucide name={isIndoor ? 'building-2' : 'activity'} size={14} color={colors.textOnPrimary} />
                  </View>
                  {hasFriend && (
                    <View style={pinStyles.friendBadge}>
                      <Lucide name="users" size={8} color={colors.textOnPrimary} />
                    </View>
                  )}
                  <View style={pinStyles.arrow} />
                </View>
                <Callout tooltip onPress={() => openVenue(venue.id, 'map')}>
                  <View style={pinStyles.callout}>
                    <Text style={pinStyles.calloutTitle} numberOfLines={1}>{venue.name}</Text>
                    <Text style={pinStyles.calloutSub}>
                      {typeLabel(venue.type)} · {condInfo.label}
                      {hasFriend ? ` · 👋 ${s('friendsActive')}` : ''}
                    </Text>
                  </View>
                </Callout>
              </Marker>
            );
          })}
        </MapView>

        <Card shadow="md" borderRadius={Radius.md} style={styles.legend}>
          {[
            { color: colors.primaryLight, icon: 'activity', label: s('conditionGood') },
            { color: colors.amber, icon: 'activity', label: s('conditionAcceptable') },
            { color: colors.red, icon: 'activity', label: s('conditionDegraded') },
            { color: colors.conditionPro, icon: 'building-2', label: s('conditionIndoor') },
          ].map((item) => (
            <View key={item.label} style={styles.legendRow}>
              <View style={[styles.legendMarker, { backgroundColor: item.color }]}>
                <Lucide name={item.icon} size={10} color={colors.textOnPrimary} />
              </View>
              <Text style={styles.legendText}>{item.label}</Text>
            </View>
          ))}
        </Card>

        <DraggableSheet
          floatingContent={
            <TouchableOpacity
              style={[styles.nearMeBtn, nearMeEnabled && styles.nearMeBtnActive]}
              onPress={handleNearMe}
              disabled={locating}
              testID="near-me-map-button"
            >
              {locating ? (
                <ActivityIndicator
                  size="small"
                  color={nearMeEnabled ? colors.textOnPrimary : colors.primary}
                />
              ) : (
                <Lucide
                  name="locate"
                  size={22}
                  color={nearMeEnabled ? colors.textOnPrimary : colors.primary}
                />
              )}
            </TouchableOpacity>
          }
        >
          {/* Search Row */}
          <View style={styles.searchRow}>
            <Card shadow="sm" borderRadius={Radius.md} style={{ flex: 1 }}>
              <View style={styles.searchBar}>
                <Lucide name="search" size={16} color={colors.textFaint} />
                <TextInput
                  style={styles.searchInput}
                  placeholder={s('searchPlaceholder')}
                  placeholderTextColor={colors.textFaint}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8} testID="search-clear">
                    <Lucide name="x" size={16} color={colors.textFaint} />
                  </TouchableOpacity>
                )}
              </View>
            </Card>
            {user && (
              <TouchableOpacity style={styles.addChip} onPress={() => router.push('/(protected)/add-venue' as any)}>
                <Lucide name="plus" size={14} color={colors.textOnPrimary} />
                <Text style={styles.addChipText}>{s('addBtn')}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Filters */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
            <View style={styles.filtersRow}>
              {filters.map((f) => (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.filterChip, activeFilter === f.key && styles.filterChipActive]}
                  onPress={() => { hapticSelection(); setActiveFilter(f.key); }}
                  hitSlop={{ top: 6, bottom: 6 }}
                >
                  {f.icon && <Lucide name={f.icon} size={12} color={activeFilter === f.key ? colors.textOnPrimary : colors.primaryMid} />}
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
            {activeFriendsCount > 0 && (
              <View style={styles.friendsOnline}>
                <View style={[styles.friendsDot, { backgroundColor: colors.purpleMid }]} />
                <Text style={styles.friendsText}>{activeFriendsCount} {s('friendsActive')}</Text>
              </View>
            )}
          </View>

          {fromCache && (
            <View style={styles.offlineBanner}>
              <Lucide name="wifi-off" size={12} color={colors.textFaint} />
              <Text style={styles.offlineText}>{s('offlineData')}</Text>
            </View>
          )}

          {/* Venue Cards */}
          {loading ? (
            <View style={{ paddingHorizontal: Spacing.sm, paddingTop: Spacing.xs }}>
              <SkeletonList count={4}><VenueCardSkeleton /></SkeletonList>
            </View>
          ) : fetchError ? (
            <ErrorState
              title={s('venueLoadError')}
              description={s('venueLoadErrorDesc')}
              ctaLabel={s('retry')}
              onRetry={fetchVenues}
            />
          ) : filteredVenues.length === 0 ? (
            <EmptyState
              icon="search"
              title={s('emptyVenuesTitle')}
              description={s('emptyVenuesDesc')}
            />
          ) : (
            <FlatList
              style={styles.venueList}
              testID="venue-list"
              data={filteredVenues}
              keyExtractor={(venue) => String(venue.id)}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
              initialNumToRender={8}
              maxToRenderPerBatch={8}
              windowSize={7}
              removeClippedSubviews
              updateCellsBatchingPeriod={50}
              renderItem={({ item: venue, index }) => {
                const conditionInfo = conditionLabel(venue.condition);
                const avgRating = venue.venue_stats?.avg_rating;
                const starsText = avgRating != null ? `\u2605 ${avgRating.toFixed(1)}` : '';
                const tablesText = venue.tables_count != null ? `${venue.tables_count} ${s('tables')}` : '';

                return (
                  <Animated.View key={venue.id} entering={FadeInDown.delay(Math.min(index, 8) * 60).duration(300)}>
                    <Card shadow="sm" borderRadius={Radius.md} style={{ marginBottom: Spacing.xs }}>
                      <TouchableOpacity
                        style={[styles.venueCard, index === 0 && styles.venueCardHighlight]}
                        onPress={() => openVenue(venue.id, 'list')}
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
                          {venue.distanceKm != null ? (
                            <View style={styles.distanceBadge}>
                              <Text style={styles.distanceText}>{formatDistance(venue.distanceKm)}</Text>
                            </View>
                          ) : venue.city ? (
                            <View style={styles.distanceBadge}>
                              <Text style={styles.distanceText}>{venue.city}</Text>
                            </View>
                          ) : null}
                          {starsText ? <Text style={styles.venueStars}>{starsText}</Text> : null}
                        </View>
                      </TouchableOpacity>
                    </Card>
                  </Animated.View>
                );
              }}
            />
          )}
        </DraggableSheet>
      </View>


      <CityPickerModal
        visible={cityModalVisible}
        selectedCity={selectedCity}
        onSelect={(c) => { if (c) setSelectedCity(c); setCityModalVisible(false); }}
        onClose={() => setCityModalVisible(false)}
      />
    </View>
  );
}
