import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, ActivityIndicator, Alert, Platform, RefreshControl, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Callout } from 'react-native-maps';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Lucide } from '../components/Icon';
import { Card } from '../components/Card';
import { CityPickerModal } from '../components/CityPickerModal';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, Radius, Shadows } from '../theme';
import { getVenues } from '../services/venues';
import { getCities } from '../services/cities';
import { getActiveFriendCheckins } from '../services/checkins';
import { getFriendIds } from '../services/friends';
import { useSession } from '../hooks/useSession';
import { useNotifications } from '../hooks/useNotifications';
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

type VenueWithDistance = VenueWithStats & {
  distanceKm: number | null;
};

type FilterKey = 'toate' | 'parcuri' | 'indoor' | 'verificat';

const EARTH_RADIUS_KM = 6371;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function getDistanceKm(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(distanceKm: number) {
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
  if (distanceKm < 10) return `${distanceKm.toFixed(1)} km`;
  return `${Math.round(distanceKm)} km`;
}

interface MapViewScreenProps {
  hideTabBar?: boolean;
}

export function MapViewScreen({ hideTabBar = false }: MapViewScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { s } = useI18n();
  const { user } = useSession();
  const { unreadCount } = useNotifications();
  const { colors } = useTheme();
  const { styles, pinStyles } = useMemo(() => createStyles(colors), [colors]);

  const [venues, setVenues] = useState<VenueWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
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

  const fetchVenues = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const { data } = await getVenues(selectedCity);
      if (data) setVenues(data as VenueWithStats[]);
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [selectedCity]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchVenues();
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

  // Fetch active friend checkins
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
      const { data: checkins } = await getActiveFriendCheckins(fIds);
      if (!checkins?.length) {
        setFriendCheckinVenueIds(new Set());
        setActiveFriendsCount(0);
        return;
      }
      const venueIds = new Set(checkins.map((c: any) => c.venue_id as number));
      const uniqueFriends = new Set(checkins.map((c: any) => c.user_id as string));
      setFriendCheckinVenueIds(venueIds);
      setActiveFriendsCount(uniqueFriends.size);
    })();
  }, [user?.id]);

  const handleNearMe = useCallback(async () => {
    if (nearMeEnabled) {
      setNearMeEnabled(false);
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

    if (nearMeEnabled && userLocation) {
      result = [...result].sort((a, b) => {
        if (a.distanceKm == null && b.distanceKm == null) return a.name.localeCompare(b.name);
        if (a.distanceKm == null) return 1;
        if (b.distanceKm == null) return -1;
        return a.distanceKm - b.distanceKm;
      });
    }

    return result;
  }, [venuesWithDistance, activeFilter, searchQuery, nearMeEnabled, userLocation]);

  return (
    <View style={styles.container}>
      {/* App Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerEmoji}>{'\uD83C\uDFD3'}</Text>
          <Text style={styles.headerTitle}>TT PORTAL</Text>
        </View>
        <TouchableOpacity style={styles.cityPicker} onPress={() => setCityModalVisible(true)}>
          <Text style={styles.cityText}>{selectedCity}</Text>
          <Lucide name="chevron-down" size={14} color="#ffffffaa" />
        </TouchableOpacity>
        <View style={styles.headerRight}>
          {user ? (
            <>
              <TouchableOpacity style={styles.bellBtn} onPress={() => router.push('/(protected)/notifications' as any)}>
                <Lucide name="bell" size={18} color={colors.textOnPrimary} />
                {unreadCount > 0 && (
                  <View style={styles.bellBadge}>
                    <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.profileBtn} onPress={() => router.push('/(tabs)/profile' as any)}>
                <Lucide name="user" size={18} color={colors.textOnPrimary} />
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/sign-in')}>
              <Lucide name="log-in" size={14} color={colors.textOnPrimary} />
              <Text style={styles.addBtnText}>{s('authLogin')}</Text>
            </TouchableOpacity>
          )}
        </View>
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
          {venuesWithDistance.map((venue) => {
            if (!venue.lat || !venue.lng) return null;
            const condInfo = conditionLabel(venue.condition);
            const isIndoor = venue.type === 'sala_indoor';
            const hasFriend = friendCheckinVenueIds.has(venue.id);
            const isVisible = filteredVenues.includes(venue);
            return (
              <Marker
                key={venue.id}
                coordinate={{ latitude: venue.lat, longitude: venue.lng }}
                tracksViewChanges={false}
                opacity={isVisible ? 1 : 0}
                tappable={isVisible}
              >
                <View style={pinStyles.outer}>
                  <View style={[pinStyles.wrap, { backgroundColor: condInfo.color }]}>
                    <Text style={pinStyles.icon}>{isIndoor ? '🏢' : '🏓'}</Text>
                  </View>
                  {hasFriend && (
                    <View style={pinStyles.friendBadge}>
                      <Text style={pinStyles.friendBadgeIcon}>👋</Text>
                    </View>
                  )}
                  <View style={pinStyles.arrow} />
                </View>
                <Callout tooltip onPress={() => router.push(`/venue/${venue.id}` as any)}>
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
            { color: colors.primaryLight, icon: '🏓', label: s('conditionGood') },
            { color: colors.amber, icon: '🏓', label: s('conditionAcceptable') },
            { color: colors.red, icon: '🏓', label: s('conditionDegraded') },
            { color: colors.conditionPro, icon: '🏢', label: s('conditionIndoor') },
          ].map((item) => (
            <View key={item.label} style={styles.legendRow}>
              <View style={[styles.legendMarker, { backgroundColor: item.color }]}>
                <Text style={styles.legendIcon}>{item.icon}</Text>
              </View>
              <Text style={styles.legendText}>{item.label}</Text>
            </View>
          ))}
        </Card>

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
      </View>

      {/* Venue List Panel */}
      <View style={styles.panel}>
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
          <TouchableOpacity
            style={[styles.nearMeListBtn, nearMeEnabled && styles.nearMeListBtnActive]}
            onPress={handleNearMe}
            disabled={locating}
            testID="near-me-list-button"
          >
            {locating ? (
              <ActivityIndicator
                size="small"
                color={nearMeEnabled ? colors.textOnPrimary : colors.primaryMid}
              />
            ) : (
              <Lucide
                name="locate"
                size={14}
                color={nearMeEnabled ? colors.textOnPrimary : colors.primaryMid}
              />
            )}
            <Text style={[styles.nearMeListText, nearMeEnabled && styles.nearMeListTextActive]}>
              {s('nearMe')}
            </Text>
          </TouchableOpacity>
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
                onPress={() => setActiveFilter(f.key)}
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

        {/* Venue Cards */}
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 32 }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : fetchError ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 32, gap: 12 }}>
            <Lucide name="alert-triangle" size={28} color={colors.textFaint} />
            <Text style={{ fontFamily: Fonts.body, fontSize: 14, color: colors.textFaint }}>{s('venueLoadError')}</Text>
            <TouchableOpacity onPress={fetchVenues} style={{ backgroundColor: colors.primaryPale, borderRadius: Radius.md, paddingVertical: 8, paddingHorizontal: 16 }}>
              <Text style={{ fontFamily: Fonts.body, fontSize: 13, fontWeight: '600', color: colors.primaryMid }}>{s('retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : filteredVenues.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 32 }}>
            <Text style={{ fontFamily: Fonts.body, fontSize: 14, color: colors.textFaint }}>{s('noVenues')}</Text>
          </View>
        ) : (
          <ScrollView style={styles.venueList} testID="venue-list" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}>
            {filteredVenues.map((venue, index) => {
              const conditionInfo = conditionLabel(venue.condition);
              const avgRating = venue.venue_stats?.avg_rating;
              const starsText = avgRating != null ? `\u2605 ${avgRating.toFixed(1)}` : '';
              const tablesText = venue.tables_count != null ? `${venue.tables_count} ${s('tables')}` : '';

              return (
                <Card key={venue.id} shadow="sm" borderRadius={Radius.md} style={{ marginBottom: 6 }}>
                  <TouchableOpacity
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
              );
            })}
          </ScrollView>
        )}
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

function createStyles(colors: ThemeColors) {
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.black,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.primary,
      paddingVertical: 10,
      paddingHorizontal: 16,
      minHeight: 52,
      ...Shadows.bar,
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
      color: colors.textOnPrimary,
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
      ...Shadows.sm,
    },
    cityText: {
      fontFamily: Fonts.body,
      fontSize: 13,
      fontWeight: '500',
      color: colors.textOnPrimary,
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.accentBright,
      borderRadius: 8,
      paddingVertical: 5,
      paddingHorizontal: 10,
      gap: 4,
    },
    addBtnText: {
      fontFamily: Fonts.body,
      fontSize: 12,
      fontWeight: '600',
      color: colors.textOnPrimary,
    },
    loginBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.accentBright,
      borderRadius: 8,
      paddingVertical: 5,
      paddingHorizontal: 10,
      gap: 4,
      ...Shadows.md,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    profileBtn: {
      padding: 4,
    },
    bellBtn: {
      position: 'relative',
      padding: 4,
    },
    bellBadge: {
      position: 'absolute',
      top: 0,
      right: 0,
      backgroundColor: colors.red,
      borderRadius: 8,
      minWidth: 16,
      height: 16,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    bellBadgeText: {
      fontFamily: Fonts.body,
      fontSize: 9,
      fontWeight: '700',
      color: colors.textOnPrimary,
    },
    mapArea: {
      height: Math.round(Dimensions.get('window').height * 0.45),
      backgroundColor: colors.mapBg,
      position: 'relative',
    },
    legend: {
      position: 'absolute',
      top: 12,
      left: 12,
      padding: 10,
      gap: 6,
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
      borderColor: colors.bgAlt,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.shadow,
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
      color: colors.textMuted,
    },
    nearMeBtn: {
      position: 'absolute',
      right: 14,
      bottom: 14,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.bgAlt,
      alignItems: 'center',
      justifyContent: 'center',
      ...Shadows.lg,
    },
    nearMeBtnActive: {
      backgroundColor: colors.primary,
    },
    panel: {
      flex: 1,
      backgroundColor: colors.bg,
      paddingTop: 8,
      boxShadow: Shadows.bar.boxShadow.map((s, i) =>
        i === 0 ? { ...s, offsetY: -3 } : { ...s, offsetY: 1 },
      ),
    },
    searchRow: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      gap: 10,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 34,
      paddingHorizontal: 12,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      fontFamily: Fonts.body,
      fontSize: 13,
      color: colors.text,
      padding: 0,
    },
    searchText: {
      fontFamily: Fonts.body,
      fontSize: 13,
      color: colors.textFaint,
    },
    nearMeListBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primaryPale,
      borderRadius: Radius.md,
      height: 40,
      paddingHorizontal: 12,
      gap: 6,
      borderWidth: 1,
      borderColor: colors.primaryDim,
    },
    nearMeListBtnActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
      ...Shadows.md,
    },
    nearMeListText: {
      fontFamily: Fonts.body,
      fontSize: 12,
      fontWeight: '600',
      color: colors.primaryMid,
    },
    nearMeListTextActive: {
      color: colors.textOnPrimary,
    },
    filtersScroll: {
      flexGrow: 0,
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
      backgroundColor: colors.bgAlt,
      borderRadius: 100,
      height: 30,
      paddingHorizontal: 14,
      gap: 4,
      ...Shadows.sm,
    },
    filterChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
      ...Shadows.md,
    },
    filterText: {
      fontFamily: Fonts.body,
      fontSize: 12,
      fontWeight: '500',
      color: colors.text,
    },
    addChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.accentBright,
      borderRadius: Radius.md,
      paddingVertical: 5,
      paddingHorizontal: 12,
      gap: 4,
      ...Shadows.md,
    },
    addChipText: {
      fontFamily: Fonts.body,
      fontSize: 12,
      fontWeight: '600',
      color: colors.textOnPrimary,
    },
    filterTextActive: {
      color: colors.textOnPrimary,
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
      color: colors.textFaint,
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
      color: colors.purpleMid,
    },
    venueList: {
      flex: 1,
      paddingHorizontal: 12,
    },
    venueCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 10,
      paddingHorizontal: 12,
      gap: 10,
    },
    venueCardHighlight: {
      borderLeftWidth: 3,
      borderLeftColor: colors.primaryLight + '30',
    },
    venueLeft: {
      flex: 1,
      gap: 4,
    },
    venueName: {
      fontFamily: Fonts.body,
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    venueMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    venueType: {
      fontFamily: Fonts.body,
      fontSize: 11,
      color: colors.textMuted,
    },
    venueMetaSep: {
      fontFamily: Fonts.body,
      fontSize: 11,
      color: colors.textFaint,
    },
    venueTables: {
      fontFamily: Fonts.body,
      fontSize: 11,
      color: colors.textMuted,
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
      backgroundColor: colors.bluePale,
      borderRadius: 4,
      paddingVertical: 2,
      paddingHorizontal: 8,
    },
    distanceText: {
      fontFamily: Fonts.body,
      fontSize: 11,
      fontWeight: '500',
      color: colors.blue,
    },
    venueStars: {
      fontFamily: Fonts.body,
      fontSize: 11,
      fontWeight: '500',
      color: colors.accent,
    },
  });

  /* -- Custom map pin -- */
  const pinStyles = StyleSheet.create({
    outer: {
      alignItems: 'center',
    },
    wrap: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 2.5,
      borderColor: colors.bgAlt,
      alignItems: 'center',
      justifyContent: 'center',
      ...Platform.select({
        ios: { shadowColor: colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.25, shadowRadius: 3 },
        android: { elevation: 4 },
      }),
    },
    icon: {
      fontSize: 13,
      lineHeight: 16,
    },
    friendBadge: {
      position: 'absolute',
      top: -4,
      right: -4,
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.purpleMid,
      borderWidth: 1.5,
      borderColor: colors.bgAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    friendBadgeIcon: {
      fontSize: 8,
      lineHeight: 10,
    },
    arrow: {
      width: 0,
      height: 0,
      borderLeftWidth: 6,
      borderRightWidth: 6,
      borderTopWidth: 7,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderTopColor: colors.bgAlt,
      marginTop: -1,
    },
    callout: {
      backgroundColor: colors.bgAlt,
      borderRadius: Radius.md,
      padding: 10,
      minWidth: 140,
      maxWidth: 220,
      ...Platform.select({
        ios: { shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6 },
        android: { elevation: 4 },
      }),
    },
    calloutTitle: {
      fontFamily: Fonts.body,
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    calloutSub: {
      fontFamily: Fonts.body,
      fontSize: 11,
      color: colors.textFaint,
    },
  });

  return { styles, pinStyles };
}
