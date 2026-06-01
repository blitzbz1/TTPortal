import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Lucide } from './Icon';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../hooks/useI18n';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Radius, Shadows, Spacing } from '../theme';
import {
  buildNominatimAddress,
  extractNominatimCity,
  matchCity,
  type NominatimAddressDetails,
} from '../screens/AddVenueScreen';
import {
  buildAddressSearchRequests,
  mergeAndRankAddressSuggestions,
  type AddressSearchContext,
  type AddressSearchCityRecord,
  type AddressSuggestionLike,
} from '../lib/addressSearch';

// This file is the Android + web implementation. iOS resolves to
// AddressPickerField.ios.tsx via Metro's platform-extension resolution —
// that file is the upstream/original (Apple Maps + stock Marker draggable),
// kept intact because every change made to it in this session regressed
// behavior on iOS. Do not add iOS branches here.

type ScrollNativeRef = React.RefObject<{ setNativeProps: (p: { scrollEnabled?: boolean }) => void } | null> | undefined;

function getGeocodingHeaders(): HeadersInit {
  return { 'Accept-Language': 'en' };
}

// Toggle the parent ScrollView's scrollEnabled imperatively. Under Fabric
// some ScrollView refs throw `_viewConfig of undefined` from setNativeProps,
// which would crash the screen on a single tap. Swallow that — we lose the
// gesture-handoff optimization but the map remains usable.
function setParentScrollEnabled(ref: ScrollNativeRef, enabled: boolean) {
  const fn = ref?.current?.setNativeProps;
  if (typeof fn !== 'function') return;
  try {
    fn({ scrollEnabled: enabled });
  } catch {
    // ignore — best-effort optimization
  }
}

interface NominatimSuggestion extends AddressSuggestionLike {
  display_name: string;
  lat: string;
  lon: string;
  address?: NominatimAddressDetails;
}

export interface AddressPickerChange {
  address?: string;
  city?: string;
  lat?: number | null;
  lng?: number | null;
  countryCode?: string | null;
  countryName?: string | null;
  cityCenterLat?: number | null;
  cityCenterLng?: number | null;
  cityZoom?: number | null;
}

interface KnownCityRecord extends AddressSearchCityRecord {
  name: string;
  country_code?: string | null;
  country_name?: string | null;
  lat: number | null;
  lng: number | null;
  zoom: number | null;
}

interface AddressPickerFieldProps {
  address: string;
  city: string;
  lat: number | null;
  lng: number | null;
  knownCities: string[];
  knownCityRecords?: KnownCityRecord[];
  countryCode?: string | null;
  countryName?: string | null;
  cityCenterLat?: number | null;
  cityCenterLng?: number | null;
  cityZoom?: number | null;
  onChange: (patch: AddressPickerChange) => void;
  disabled?: boolean;
  // Ref to a wrapping ScrollView. While the user is touching the map we
  // imperatively disable parent scrolling so single-finger pan gestures
  // aren't intercepted by the parent's native onInterceptTouchEvent before
  // MapLibre's MoveGestureDetector can claim them. Restored on touch end.
  // setNativeProps bypasses the React reconciler so the change is committed
  // before the next ACTION_MOVE arrives at the ScrollView.
  parentScrollRef?: React.RefObject<{ setNativeProps: (p: { scrollEnabled?: boolean }) => void } | null>;
}

/**
 * Shared address picker: typeahead + geocode button + conditional mini-map
 * with tap-to-set pin + reverse geocoding on tap.
 * Used by AddVenueScreen and the admin edit-venue modal.
 */
export function AddressPickerField({
  address,
  city,
  lat,
  lng,
  knownCities,
  knownCityRecords = [],
  countryCode,
  countryName,
  cityCenterLat,
  cityCenterLng,
  cityZoom,
  onChange,
  disabled,
  parentScrollRef,
}: AddressPickerFieldProps) {
  const { colors } = useTheme();
  const { s } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const mapRef = useRef<MapView>(null);

  const [suggestions, setSuggestions] = useState<NominatimSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [reverseGeocoding, setReverseGeocoding] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueryRef = useRef(address);

  const closeSuggestions = useCallback(() => {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    setSuggestions([]);
    setShowSuggestions(false);
    setSearching(false);
  }, []);

  const findKnownCity = useCallback((nominatimCity: string, countryCode: string | null) => {
    const normalizedCountryCode = countryCode?.toUpperCase() ?? null;
    const sameCountry = normalizedCountryCode
      ? knownCityRecords.filter((record) => record.country_code?.toUpperCase() === normalizedCountryCode)
      : knownCityRecords;
    const candidates = sameCountry.length > 0 ? sameCountry : knownCityRecords;
    const matchedName = matchCity(nominatimCity, candidates.map((record) => record.name));
    return matchedName ? candidates.find((record) => record.name === matchedName) ?? null : null;
  }, [knownCityRecords]);

  const fetchCityCenter = useCallback(async (
    cityName: string,
    countryCode: string | null,
    countryName: string | null,
  ) => {
    try {
      const query = encodeURIComponent([cityName, countryName].filter(Boolean).join(', '));
      const countryParam = countryCode ? `&countrycodes=${encodeURIComponent(countryCode.toLowerCase())}` : '';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&dedupe=1&addressdetails=1${countryParam}&q=${query}`,
        { headers: getGeocodingHeaders(), signal: controller.signal },
      );
      clearTimeout(timeout);
      if (!res.ok) return;
      const data: NominatimSuggestion[] = await res.json();
      const first = data[0];
      if (!first) return;
      const nextLat = parseFloat(first.lat);
      const nextLng = parseFloat(first.lon);
      if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) return;
      onChange({
        cityCenterLat: nextLat,
        cityCenterLng: nextLng,
        cityZoom: 12,
        countryCode: first.address?.country_code?.toUpperCase() ?? countryCode,
        countryName: first.address?.country ?? countryName,
      });
    } catch { /* timeout / abort - ignore */ }
  }, [onChange]);

  const maybeSetCity = useCallback((addr: NominatimAddressDetails | undefined) => {
    const nominatimCity = extractNominatimCity(addr);
    if (!nominatimCity) return;
    const countryCode = addr?.country_code?.toUpperCase() ?? null;
    const countryName = addr?.country ?? null;
    const knownCity = findKnownCity(nominatimCity, countryCode);
    // Prefer the canonical casing from our known cities list; otherwise use
    // Nominatim's value as-is so new cities still flow through.
    const match = knownCity?.name ?? (knownCities.length > 0 ? matchCity(nominatimCity, knownCities) : null);
    onChange({
      city: match ?? nominatimCity,
      countryCode: knownCity?.country_code ?? countryCode,
      countryName: knownCity?.country_name ?? countryName,
      cityCenterLat: knownCity?.lat ?? null,
      cityCenterLng: knownCity?.lng ?? null,
      cityZoom: knownCity?.zoom ?? 12,
    });
    if (knownCity?.lat == null || knownCity?.lng == null) {
      void fetchCityCenter(match ?? nominatimCity, countryCode, countryName);
    }
  }, [fetchCityCenter, findKnownCity, knownCities, onChange]);

  const addressSearchContext = useMemo<AddressSearchContext>(() => ({
    city,
    countryCode,
    countryName,
    cityCenterLat,
    cityCenterLng,
    cityZoom,
    knownCityRecords,
  }), [city, countryCode, countryName, cityCenterLat, cityCenterLng, cityZoom, knownCityRecords]);

  const buildSearchRequests = useCallback((text: string, limit = 5) => (
    buildAddressSearchRequests(text, addressSearchContext, limit)
  ), [addressSearchContext]);

  const fetchFirstSuccessfulSearch = useCallback(async (
    text: string,
    limit: number,
    signal?: AbortSignal,
  ): Promise<NominatimSuggestion[]> => {
    const requests = buildSearchRequests(text, limit);
    const responses = await Promise.allSettled(requests.map(async (request) => {
      const res = await fetch(request.url, { headers: getGeocodingHeaders(), signal });
      if (!res.ok) return { items: [] as NominatimSuggestion[], weight: request.weight };
      const items: NominatimSuggestion[] = await res.json();
      return { items, weight: request.weight };
    }));
    const groups = responses
      .filter((response): response is PromiseFulfilledResult<{ items: NominatimSuggestion[]; weight: number }> => response.status === 'fulfilled')
      .map((response) => response.value);
    return mergeAndRankAddressSuggestions(groups, addressSearchContext, limit);
  }, [addressSearchContext, buildSearchRequests]);

  const handleAddressChange = useCallback((text: string) => {
    onChange({ address: text });
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (text.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const trimmed = text.trim();
      if (trimmed === lastQueryRef.current) { setSearching(false); return; }
      lastQueryRef.current = trimmed;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const data = await fetchFirstSuccessfulSearch(trimmed, 5, controller.signal);
        clearTimeout(timeout);
        setSuggestions(data);
        setShowSuggestions(data.length > 0);
      } catch { /* timeout / abort — ignore */ }
      setSearching(false);
    }, 800);
  }, [fetchFirstSuccessfulSearch, onChange]);

  const handleSuggestionSelect = useCallback((item: NominatimSuggestion) => {
    const nextLat = parseFloat(item.lat);
    const nextLng = parseFloat(item.lon);
    const short = buildNominatimAddress(item.address, item.display_name);
    onChange({ address: short, lat: nextLat, lng: nextLng });
    closeSuggestions();
    lastQueryRef.current = short;
    mapRef.current?.animateToRegion({ latitude: nextLat, longitude: nextLng, latitudeDelta: 0.005, longitudeDelta: 0.005 }, 500);
    maybeSetCity(item.address);
  }, [onChange, closeSuggestions, maybeSetCity]);

  const handleGeocode = useCallback(async () => {
    if (!address.trim()) return;
    setGeocoding(true);
    try {
      const results = await fetchFirstSuccessfulSearch(address, 10);
      if (results && results.length > 0) {
        const nextLat = parseFloat(results[0].lat);
        const nextLng = parseFloat(results[0].lon);
        const normalized = buildNominatimAddress(results[0].address, results[0].display_name);
        const patch: AddressPickerChange = { lat: nextLat, lng: nextLng };
        if (normalized) { patch.address = normalized; lastQueryRef.current = normalized; }
        onChange(patch);
        closeSuggestions();
        mapRef.current?.animateToRegion({ latitude: nextLat, longitude: nextLng, latitudeDelta: 0.005, longitudeDelta: 0.005 }, 500);
        maybeSetCity(results[0].address);
      }
    } catch { /* ignore */ }
    setGeocoding(false);
  }, [address, fetchFirstSuccessfulSearch, onChange, closeSuggestions, maybeSetCity]);

  const reverseGeocodeLatLng = useCallback(async (nextLat: number, nextLng: number) => {
    onChange({ lat: nextLat, lng: nextLng });
    closeSuggestions();
    setReverseGeocoding(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat=${nextLat}&lon=${nextLng}`,
        { headers: getGeocodingHeaders(), signal: controller.signal },
      );
      clearTimeout(timeout);
      if (res.ok) {
        const data: { display_name?: string; address?: NominatimAddressDetails } = await res.json();
        const short = buildNominatimAddress(data.address, data.display_name);
        if (short) {
          onChange({ address: short });
          lastQueryRef.current = short;
        }
        maybeSetCity(data.address);
      }
    } catch { /* ignore */ }
    setReverseGeocoding(false);
  }, [onChange, closeSuggestions, maybeSetCity]);

  // Tap-to-place: tapping the map moves the pin to the tapped coordinate
  // (secondary affordance; primary is dragging the pin). Camera follows so
  // the new pin position stays visible without forcing the user to pan.
  const handleMapPress = useCallback(
    (event: { nativeEvent?: { coordinate?: { latitude: number; longitude: number } } }) => {
      const coord = event?.nativeEvent?.coordinate;
      if (!coord) return;
      mapRef.current?.animateToRegion(
        {
          latitude: coord.latitude,
          longitude: coord.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        },
        300,
      );
      void reverseGeocodeLatLng(coord.latitude, coord.longitude);
    },
    [reverseGeocodeLatLng],
  );

  // Drag-to-place: the dragged Marker's onDragEnd delivers the new
  // coordinate; reverse-geocode and patch the form. Same handler on every
  // platform since react-native-maps and the two shims emit the same shape.
  const handleMarkerDragEnd = useCallback(
    (event: { nativeEvent?: { coordinate?: { latitude: number; longitude: number } } }) => {
      const coord = event?.nativeEvent?.coordinate;
      if (!coord) return;
      void reverseGeocodeLatLng(coord.latitude, coord.longitude);
    },
    [reverseGeocodeLatLng],
  );

  const hasLocation = lat !== null && lng !== null;

  return (
    <>
      <View style={styles.addressRow}>
        <TextInput
          style={[styles.input, styles.inputText, { flex: 1 }]}
          placeholder={s('addressPlaceholder')}
          placeholderTextColor={colors.textFaint}
          value={address}
          onChangeText={handleAddressChange}
          maxLength={200}
          editable={!disabled}
          testID="address-input"
        />
        <TouchableOpacity
          style={[styles.geocodeBtn, hasLocation && { backgroundColor: colors.primaryLight }]}
          onPress={handleGeocode}
          disabled={geocoding || disabled}
          testID="address-geocode-btn"
        >
          {geocoding ? (
            <ActivityIndicator size="small" color={colors.textOnPrimary} />
          ) : (
            <>
              <Lucide name="map-pin" size={14} color={colors.textOnPrimary} />
              <Text style={styles.geocodeBtnText}>
                {hasLocation ? '\u2713' : s('pinOnMap')}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {(showSuggestions || searching) && (
        <View style={styles.suggestionsWrap}>
          {searching && suggestions.length === 0 ? (
            <View style={styles.suggestionLoading}>
              <ActivityIndicator size="small" color={colors.primaryMid} />
              <Text style={styles.suggestionLoadingText}>{s('searching') || 'Searching...'}</Text>
            </View>
          ) : (
            suggestions.map((item, idx) => (
              <Pressable
                key={`${item.lat}-${item.lon}`}
                style={({ pressed }) => [
                  styles.suggestionItem,
                  pressed && styles.suggestionItemPressed,
                  idx < suggestions.length - 1 && styles.suggestionBorder,
                ]}
                onPress={() => handleSuggestionSelect(item)}
              >
                <View style={{ marginTop: 2 }}>
                  <Lucide name="map-pin" size={14} color={colors.primaryMid} />
                </View>
                <Text style={styles.suggestionText} numberOfLines={2}>{item.display_name}</Text>
              </Pressable>
            ))
          )}
        </View>
      )}

      {hasLocation && (
        <View style={{ marginTop: Spacing.sm }}>
          <View style={styles.mapLabelRow}>
            <Text style={styles.fieldLabel}>{s('pinOnMap')}</Text>
            {reverseGeocoding && (
              <View style={styles.mapLabelSpinner} testID="reverse-geocoding-spinner">
                <ActivityIndicator size="small" color={colors.primaryMid} />
                <Text style={styles.mapLabelSpinnerText}>{s('updatingAddress')}</Text>
              </View>
            )}
          </View>
          {/* The responder-capture / touch-end pair below disables the
              parent ScrollView mid-touch so single-finger pan gestures
              reach MapLibre's MoveGestureDetector before being intercepted
              by the parent's onInterceptTouchEvent. Android-only: web
              Leaflet handles its own gestures, and iOS lives in the
              .ios.tsx variant which never reaches this code.
              Best-effort: under the new architecture (Fabric) some
              ScrollView refs throw `_viewConfig of undefined` from
              setNativeProps. We catch that — losing the parent-freeze
              optimization but keeping the screen alive, since the map's
              own gesture detector can usually claim the touch unaided. */}
          <View
            style={styles.mapWrap}
            {...(Platform.OS === 'android'
              ? {
                  onStartShouldSetResponderCapture: () => {
                    setParentScrollEnabled(parentScrollRef, false);
                    return false;
                  },
                  onTouchEnd: () => {
                    setParentScrollEnabled(parentScrollRef, true);
                  },
                  onTouchCancel: () => {
                    setParentScrollEnabled(parentScrollRef, true);
                  },
                }
              : null)}
          >
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={{
                latitude: lat!,
                longitude: lng!,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              }}
              onPress={handleMapPress}
            >
              <Marker
                identifier="address-picker"
                coordinate={{ latitude: lat!, longitude: lng! }}
                draggable
                onDragEnd={handleMarkerDragEnd}
              >
                <View style={styles.markerPinShadow} />
                <View style={styles.markerPinDot} />
              </Marker>
            </MapView>
          </View>
          <Text style={styles.mapHint}>{s('dragPinHint')}</Text>
        </View>
      )}
    </>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    input: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgAlt,
      borderRadius: Radius.md,
      height: 46,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    inputText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.text,
    },
    addressRow: {
      flexDirection: 'row',
      gap: Spacing.xs,
      ...Shadows.sm,
      borderRadius: Radius.md,
    },
    geocodeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primaryLight,
      borderRadius: Radius.md,
      height: 46,
      paddingHorizontal: 14,
      gap: 6,
      ...Shadows.md,
    },
    geocodeBtnText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.base,
      fontWeight: FontWeight.semibold,
      color: colors.textOnPrimary,
    },
    suggestionsWrap: {
      backgroundColor: colors.bgAlt,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      maxHeight: 200,
      overflow: 'hidden',
      marginTop: 6,
      ...Shadows.md,
    },
    suggestionItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    suggestionItemPressed: {
      backgroundColor: colors.bgMuted,
    },
    suggestionBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    suggestionText: {
      flex: 1,
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      color: colors.textMuted,
    },
    suggestionLoading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    suggestionLoadingText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      color: colors.textFaint,
    },
    mapWrap: {
      borderRadius: Radius.md,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
      ...Shadows.sm,
    },
    map: {
      width: '100%',
      height: 180,
    },
    markerPinDot: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.red,
      borderWidth: 2,
      borderColor: '#ffffff',
      ...Shadows.sm,
    },
    markerPinShadow: {
      width: 6,
      height: 3,
      borderRadius: 3,
      backgroundColor: 'rgba(0,0,0,0.25)',
      marginTop: 2,
    },
    mapHint: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      color: colors.textFaint,
      marginTop: 4,
    },
    mapLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    mapLabelSpinner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    mapLabelSpinnerText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      color: colors.primaryMid,
    },
    fieldLabel: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.semibold,
      color: colors.textFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.7,
    },
  });
}
