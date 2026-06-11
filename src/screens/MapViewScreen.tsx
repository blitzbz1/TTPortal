import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, FlatList } from 'react-native';
import { showAlert } from '../lib/dialogs';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Lucide } from '../components/Icon';
import { NotificationBellButton } from '../components/NotificationBellButton';
import { FeedbackHeaderButton } from '../components/FeedbackHeaderButton';
import { BrandLockup, BrandPin } from '../components/BrandLockup';
import { Card } from '../components/Card';
import { LocationSelector, SelectedCityPill } from '../components/LocationSelector';
import { VenueCardSkeleton, SkeletonList } from '../components/SkeletonLoader';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { DraggableSheet } from '../components/DraggableSheet';
import { VenueMarkers } from '../components/VenueMarkers';
import { MapSearchBar } from '../components/MapSearchBar';
import { hapticSelection } from '../lib/haptics';
import { matchesQuery } from '../lib/textSearch';
import { useTheme } from '../hooks/useTheme';
import { Radius, Spacing } from '../theme';
import { createStyles } from './MapViewScreen.styles';
import { useVenuesQuery } from '../hooks/queries/useVenuesQuery';
import { useFriendPresenceQuery } from '../hooks/queries/useFriendPresenceQuery';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import { useSelectedLocation } from '../hooks/useSelectedLocation';
import type { Venue, VenueCondition } from '../types/database';
import { ProductEvents, trackProductEvent } from '../lib/analytics';
import { getDistanceKm, formatDistance } from '../lib/geo';
import { getCityDisplayName, getMapRegionForCity } from '../lib/locationHelpers';

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

interface CurrentLocationMarkerProps {
  pinStyles: ReturnType<typeof createStyles>['pinStyles'];
  color: string;
}

function CurrentLocationMarker({ pinStyles, color }: CurrentLocationMarkerProps) {
  return (
    <View style={pinStyles.currentLocationOuter} testID="current-location-marker">
      <View style={[pinStyles.currentLocationBadge, { backgroundColor: color }]}>
        <BrandPin color="#FFFFFF" width={18} />
      </View>
    </View>
  );
}

interface VenueListRowProps {
  venue: VenueWithDistance;
  index: number;
  /** Stagger only on the initial reveal (T046) — never on recycled remounts. */
  animateIn: boolean;
  conditionInfo: { label: string; color: string };
  typeText: string;
  tablesLabel: string;
  styles: ReturnType<typeof createStyles>['styles'];
  onPress: (venueId: number) => void;
}

const VenueListRow = React.memo(function VenueListRow({
  venue,
  index,
  animateIn,
  conditionInfo,
  typeText,
  tablesLabel,
  styles,
  onPress,
}: VenueListRowProps) {
  const avgRating = venue.venue_stats?.avg_rating;
  const starsText = avgRating != null ? `★ ${avgRating.toFixed(1)}` : '';
  const tablesText = venue.tables_count != null ? `${venue.tables_count} ${tablesLabel}` : '';

  return (
    <Animated.View entering={animateIn ? FadeInDown.delay(Math.min(index, 8) * 60).duration(300) : undefined}>
      <Card shadow="sm" borderRadius={Radius.md} style={{ marginBottom: Spacing.xs }}>
        <TouchableOpacity
          style={[styles.venueCard, index === 0 && styles.venueCardHighlight]}
          onPress={() => onPress(venue.id)}
          accessibilityRole="button"
          // T066: the sheet list is the non-visual alternative to the map —
          // carry type/condition/rating, not just the name.
          accessibilityLabel={[venue.name, typeText, conditionInfo.label, starsText || null]
            .filter(Boolean)
            .join(', ')}
        >
          <View style={styles.venueLeft}>
            <Text style={styles.venueName}>{venue.name}</Text>
            <View style={styles.venueMeta}>
              <Text style={styles.venueType}>{typeText}</Text>
              {tablesText ? (
                <>
                  <Text style={styles.venueMetaSep}>{'·'}</Text>
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
});

export function MapViewScreen({ hideTabBar = false }: MapViewScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { s } = useI18n();
  const { user } = useSession();
  const { selectedCity } = useSelectedLocation();
  const { colors, isDark } = useTheme();
  const headerFg = colors.textOnPrimary;
  const { styles, pinStyles } = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  // Keystroke state lives inside MapSearchBar (T041); the screen only sees
  // the debounced value.
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('toate');
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [nearMeEnabled, setNearMeEnabled] = useState(false);
  const [locating, setLocating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const mapRef = useRef<MapView>(null);
  // Rows only stagger-animate on the sheet's initial reveal — re-running
  // the entering animation on every clipped-row remount makes scrolling
  // rows pop blank then fade (T046).
  const listRevealedRef = useRef(false);

  const selectedCityName = getCityDisplayName(selectedCity);
  const selectedMapRegion = useMemo(() => getMapRegionForCity(selectedCity), [selectedCity]);
  const { data: venuesRaw, isLoading, isError, refetch, fromCache } = useVenuesQuery(
    selectedCityName,
    null,
    true,
    selectedCity?.id ?? null,
  );
  const venues = useMemo(
    () => (venuesRaw ?? []) as unknown as VenueWithStats[],
    [venuesRaw],
  );
  // Cache-first: as long as we have ANY rows (from MMKV), don't show a
  // spinner. The delta sync runs in the background and updates in place.
  // `fromCache` (real since T035) drives the offline/staleness banner when
  // the delta sync actually failed.
  const loading = isLoading && venues.length === 0;
  const fetchError = isError && venues.length === 0;

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

  // Stable identity (useCallback) so the memoized VenueMarkers props don't
  // churn per render.
  const typeLabel = useCallback((type: string) => {
    if (type === 'parc_exterior') return s('typePark');
    if (type === 'sala_indoor') return s('typeHall');
    return type;
  }, [s]);

  const fetchVenues = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  useEffect(() => {
    // City switches animate the existing native map (the remount-by-key is
    // gone — T041).
    if (selectedCity) {
      mapRef.current?.animateToRegion(getMapRegionForCity(selectedCity), 500);
    }
  }, [selectedCity]);

  // Friend presence overlay (which venues currently host a friend) is
  // cached via React Query — see useFriendPresenceQuery. Derived with
  // useMemo (T041): no extra render pass through useEffect→useState copies.
  const { data: friendPresence } = useFriendPresenceQuery(user?.id);
  const friendCheckinVenueIds = useMemo(
    () => friendPresence?.venueIds ?? new Set<number>(),
    [friendPresence],
  );
  const activeFriendsCount = friendPresence?.uniqueFriends ?? 0;

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
        showAlert(s('error'), s('locationPermissionDenied') || 'Location permission denied');
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
      showAlert(s('error'), s('couldNotGetLocation'));
    } finally {
      setLocating(false);
    }
  }, [nearMeEnabled, s]);

  const openVenue = useCallback((venueId: number, source: 'map' | 'list') => {
    trackProductEvent(ProductEvents.mapVenueOpened, { venueId, source });
    router.push({ pathname: '/venue/[id]', params: { id: String(venueId) } });
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

  // Chip filter only — this feeds the MARKERS. Search text deliberately
  // does not filter the map (T041): the user is narrowing the list, and
  // re-clustering per debounce tick would make pins flicker.
  const chipFilteredVenues = useMemo(() => {
    if (activeFilter === 'parcuri') return venuesWithDistance.filter((v) => v.type === 'parc_exterior');
    if (activeFilter === 'indoor') return venuesWithDistance.filter((v) => v.type === 'sala_indoor');
    if (activeFilter === 'verificat') return venuesWithDistance.filter((v) => v.verified === true);
    return venuesWithDistance;
  }, [venuesWithDistance, activeFilter]);

  // Chip + search + near-me sort — this feeds the LIST.
  const filteredVenues = useMemo(() => {
    let result = chipFilteredVenues;

    // Apply search query (debounced). Diacritic- and case-insensitive
    // across name, address and city — see lib/textSearch.
    if (debouncedQuery.trim()) {
      const q = debouncedQuery.trim();
      result = result.filter(
        (v) =>
          matchesQuery(v.name, q) ||
          (!!v.address && matchesQuery(v.address, q)) ||
          (!!v.city && matchesQuery(v.city, q)),
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
  }, [chipFilteredVenues, debouncedQuery, nearMeEnabled]);

  const handleVenueMarkerPress = useCallback((venueId: number) => {
    openVenue(venueId, 'map');
  }, [openVenue]);

  const handleVenueListPress = useCallback((venueId: number) => {
    openVenue(venueId, 'list');
  }, [openVenue]);

  return (
    <View style={styles.container}>
      {/* App Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <BrandLockup color={headerFg} pinWidth={16} wordmarkSize={16} gap={5} style={styles.headerBrand} />
        <View style={styles.headerCenter}>
          <SelectedCityPill city={selectedCity} onPress={() => setCityModalVisible(true)} />
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
          showsUserLocation={false}
          initialRegion={selectedMapRegion}
        >
          <VenueMarkers
            venues={chipFilteredVenues}
            friendVenueIds={friendCheckinVenueIds}
            onVenuePress={handleVenueMarkerPress}
            conditionLabel={conditionLabel}
            typeLabel={typeLabel}
            friendsActiveLabel={s('friendsActive')}
            pinStyles={pinStyles}
            colors={colors}
          />
          {nearMeEnabled && userLocation ? (
            <Marker
              identifier="current-location"
              coordinate={userLocation}
              tracksViewChanges={false}
              testID="current-location-map-marker"
            >
              <CurrentLocationMarker pinStyles={pinStyles} color={colors.primary} />
            </Marker>
          ) : null}
        </MapView>

        <Card shadow="md" borderRadius={Radius.md} style={styles.legend}>
          {/* Glyphs mirror the pins' condition badges (T066) so the legend
              reads without color. */}
          {[
            { color: colors.primaryLight, icon: 'check', label: s('conditionGood') },
            { color: colors.amber, icon: 'minus', label: s('conditionAcceptable') },
            { color: colors.red, icon: 'alert-triangle', label: s('conditionDegraded') },
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
            <MapSearchBar
              placeholder={s('searchPlaceholder')}
              onDebouncedChange={setDebouncedQuery}
              searchBarStyle={styles.searchBar}
              searchInputStyle={styles.searchInput}
              placeholderColor={colors.textFaint}
              iconColor={colors.textFaint}
            />
            {user && (
              <TouchableOpacity style={styles.addChip} onPress={() => router.push('/(protected)/add-venue')}>
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
              title={selectedCity ? s('emptyCityVenuesTitle', selectedCity.name) : s('emptyVenuesTitle')}
              description={selectedCity ? s('emptyCityVenuesDesc') : s('emptyVenuesDesc')}
              ctaLabel={user ? s('emptyCityVenuesCta') : undefined}
              onCtaPress={user ? () => router.push('/(protected)/add-venue') : undefined}
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
                const animateIn = !listRevealedRef.current && index < 8;
                if (index >= 7) listRevealedRef.current = true;
                return (
                  <VenueListRow
                    venue={venue}
                    index={index}
                    animateIn={animateIn}
                    conditionInfo={conditionLabel(venue.condition)}
                    typeText={typeLabel(venue.type)}
                    tablesLabel={s('tables')}
                    styles={styles}
                    onPress={handleVenueListPress}
                  />
                );
              }}
            />
          )}
        </DraggableSheet>
      </View>


      <LocationSelector
        visible={cityModalVisible}
        mode="switcher"
        onClose={() => setCityModalVisible(false)}
      />
    </View>
  );
}
