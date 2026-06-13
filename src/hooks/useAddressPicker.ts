import { useCallback, useMemo, useRef, useState } from 'react';
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

function getGeocodingHeaders(): HeadersInit {
  return { 'Accept-Language': 'en' };
}

export interface NominatimSuggestion extends AddressSuggestionLike {
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

export interface KnownCityRecord extends AddressSearchCityRecord {
  name: string;
  country_code?: string | null;
  country_name?: string | null;
  lat: number | null;
  lng: number | null;
  zoom: number | null;
}

/**
 * Imperative surface the address-picker logic needs from the platform map.
 * Satisfied structurally by react-native-maps' MapView and both shims
 * (MapLibre on Android, Leaflet on web), so the hook stays map-agnostic.
 */
export interface AddressPickerMapHandle {
  animateToRegion: (
    region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number },
    duration?: number,
  ) => void;
}

/** Press / drag-end event shape shared by react-native-maps and the shims. */
export interface MapCoordinateEvent {
  nativeEvent?: { coordinate?: { latitude: number; longitude: number } };
}

export type ParentScrollRef = React.RefObject<{
  setNativeProps: (p: { scrollEnabled?: boolean }) => void;
} | null>;

/**
 * Props contract for the platform map layer (AddressPickerMap /
 * AddressPickerMap.ios). Defined here so the two platform files cannot
 * drift apart on their public shape.
 */
export interface AddressPickerMapProps {
  lat: number;
  lng: number;
  mapRef: React.MutableRefObject<AddressPickerMapHandle | null>;
  onMapPress: (event: MapCoordinateEvent) => void;
  onMarkerDragEnd: (event: MapCoordinateEvent) => void;
  // Used by the Android map to freeze the parent ScrollView mid-pan;
  // accepted-but-ignored on iOS and web. See AddressPickerMap.tsx.
  parentScrollRef?: ParentScrollRef;
}

export interface UseAddressPickerOptions {
  address: string;
  city: string;
  knownCities: string[];
  knownCityRecords?: KnownCityRecord[];
  countryCode?: string | null;
  countryName?: string | null;
  cityCenterLat?: number | null;
  cityCenterLng?: number | null;
  cityZoom?: number | null;
  onChange: (patch: AddressPickerChange) => void;
}

/**
 * All platform-independent address-picker behavior: debounced typeahead
 * against Nominatim, explicit geocode, reverse geocode for pin moves
 * (map tap or marker drag), and known-city matching/center lookup.
 * The platform components only render the map and forward gestures.
 */
export function useAddressPicker({
  address,
  city,
  knownCities,
  knownCityRecords = [],
  countryCode,
  countryName,
  cityCenterLat,
  cityCenterLng,
  cityZoom,
  onChange,
}: UseAddressPickerOptions) {
  const mapRef = useRef<AddressPickerMapHandle | null>(null);

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
    (event: MapCoordinateEvent) => {
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
    (event: MapCoordinateEvent) => {
      const coord = event?.nativeEvent?.coordinate;
      if (!coord) return;
      void reverseGeocodeLatLng(coord.latitude, coord.longitude);
    },
    [reverseGeocodeLatLng],
  );

  return {
    mapRef,
    suggestions,
    showSuggestions,
    searching,
    geocoding,
    reverseGeocoding,
    handleAddressChange,
    handleSuggestionSelect,
    handleGeocode,
    handleMapPress,
    handleMarkerDragEnd,
  };
}
