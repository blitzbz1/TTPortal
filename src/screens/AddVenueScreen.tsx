import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { AddressPickerField } from '../components/AddressPickerField';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius, Shadows } from '../theme';
import { useI18n } from '../hooks/useI18n';
import { createVenue } from '../services/venues';
import { upsertCity } from '../services/cities';
import { canonicalizeCityName } from '../lib/cityCatalog';
import { useCitiesQuery } from '../hooks/queries/useCitiesQuery';
import { useSelectedLocation } from '../hooks/useSelectedLocation';
import { safeErrorMessage } from '../lib/auth-utils';
import { rateLimitMessageFor } from '../lib/rateLimit';
import type { VenueType } from '../types/database';

/** Strip diacritics and lowercase for fuzzy city matching. */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Shape of the `address` object returned by Nominatim /search and /reverse. */
export interface NominatimAddressDetails {
  house_number?: string;
  road?: string;
  pedestrian?: string;
  footway?: string;
  neighbourhood?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  city_district?: string;
  state?: string;
  state_district?: string;
  county?: string;
  country?: string;
  country_code?: string;
}

/** Extract city name from Nominatim address details. */
export function extractNominatimCity(address?: NominatimAddressDetails): string | null {
  return address?.city || address?.town || address?.village || address?.municipality || null;
}

/**
 * English exonym → Romanian canonical name for cities that Nominatim commonly
 * returns under their international form. Keys are normalized (lowercased,
 * diacritic-stripped) so lookups are case-insensitive.
 */
export const CITY_ALIASES_RO: Readonly<Record<string, string>> = {
  bucharest: 'București',
  jassy: 'Iași',
  kronstadt: 'Brașov',
  temeschwar: 'Timișoara',
  hermannstadt: 'Sibiu',
  klausenburg: 'Cluj-Napoca',
};

/**
 * Match a city name against a list of known cities (case & diacritic
 * insensitive). If the name is a known English exonym (e.g., "Bucharest"),
 * matches it to the Romanian canonical ("București") first.
 * Returns the canonical DB name or null.
 */
export function matchCity(nominatimCity: string, knownCities: string[]): string | null {
  const norm = normalize(nominatimCity);
  const direct = knownCities.find((c) => normalize(c) === norm);
  if (direct) return direct;
  const canonical = CITY_ALIASES_RO[norm];
  if (canonical) {
    const aliased = knownCities.find((c) => normalize(c) === normalize(canonical));
    if (aliased) return aliased;
  }
  return null;
}

interface CitySuggestion {
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
  namedetails?: {
    name?: string;
    ['name:en']?: string;
    int_name?: string;
  };
  class?: string;
  type?: string;
  addresstype?: string;
  address?: NominatimAddressDetails;
  source?: 'local' | 'nominatim' | 'photon';
}

const CITY_LIKE_ADDRESS_TYPES = new Set([
  'city',
  'town',
  'village',
  'municipality',
  'administrative',
  'state',
]);

const CITY_LIKE_TYPES = new Set([
  'city',
  'town',
  'village',
  'municipality',
  'administrative',
  'capital',
]);

const CITY_STATE_COUNTRY_CODES = new Set([
  'mc',
  'sg',
  'va',
  'lu',
  'sm',
  'ad',
  'li',
]);

function debouncedCityClearsAddress(nextCity: string, previousCity: string): boolean {
  return previousCity.trim().length > 0 && normalize(nextCity) !== normalize(previousCity);
}

function formatCitySuggestionTitle(item: CitySuggestion): string {
  return getCitySuggestionName(item) ?? item.display_name.split(', ')[0] ?? item.display_name;
}

function formatCitySuggestionSubtitle(item: CitySuggestion): string {
  const parts = [
    item.address?.state ?? item.address?.state_district ?? item.address?.county,
    item.address?.country,
  ].filter((part): part is string => typeof part === 'string' && part.length > 0);
  return parts.join(', ') || item.display_name;
}

function formatSelectedCityLocation(countryName: string | null, countryCode: string | null): string | null {
  if (countryName && countryCode) return `${countryName} (${countryCode})`;
  return countryName ?? countryCode;
}

function getGeocodingHeaders(): HeadersInit {
  // Browsers reject the User-Agent header as unsafe. Native fetch accepts it,
  // but keeping headers browser-safe makes web and native behavior consistent.
  return { 'Accept-Language': 'en' };
}

export function getCitySuggestionName(item: CitySuggestion): string | null {
  return extractNominatimCity(item.address)
    ?? item.name
    ?? item.namedetails?.name
    ?? item.namedetails?.['name:en']
    ?? item.namedetails?.int_name
    ?? item.display_name.split(', ')[0]
    ?? null;
}

export function isLikelyCitySuggestion(item: CitySuggestion): boolean {
  const name = getCitySuggestionName(item);
  if (!name) return false;
  const addresstype = item.addresstype?.toLowerCase();
  const type = item.type?.toLowerCase();
  const klass = item.class?.toLowerCase();
  const countryCode = item.address?.country_code?.toLowerCase();
  if (addresstype === 'country') {
    return countryCode ? CITY_STATE_COUNTRY_CODES.has(countryCode) : false;
  }
  if (addresstype && CITY_LIKE_ADDRESS_TYPES.has(addresstype)) {
    return true;
  }
  if (type && CITY_LIKE_TYPES.has(type)) {
    return true;
  }
  return klass === 'boundary' || klass === 'place';
}

function getSuggestionImportance(item: CitySuggestion): number {
  const importance = (item as { importance?: unknown }).importance;
  return typeof importance === 'number' && Number.isFinite(importance) ? importance : 0;
}

function getSuggestionPlaceRank(item: CitySuggestion): number {
  const placeRank = (item as { place_rank?: unknown }).place_rank;
  return typeof placeRank === 'number' && Number.isFinite(placeRank) ? placeRank : 99;
}

function scoreCitySuggestion(item: CitySuggestion, query: string): number {
  const name = getCitySuggestionName(item) ?? '';
  const normName = normalize(name);
  const normQuery = normalize(query.trim());
  const addresstype = item.addresstype?.toLowerCase();
  const type = item.type?.toLowerCase();
  const klass = item.class?.toLowerCase();
  let score = 0;

  if (item.source === 'local') score += 120;
  if (normName === normQuery) score += 100;
  else if (normName.startsWith(normQuery)) score += 70;
  else if (normName.includes(normQuery)) score += 45;
  if (addresstype === 'city' || type === 'city') score += 45;
  else if (addresstype === 'town' || type === 'town') score += 35;
  else if (addresstype === 'municipality' || type === 'municipality') score += 30;
  else if (addresstype === 'village' || type === 'village') score += 20;
  else if (addresstype === 'administrative' || type === 'administrative') score += 14;
  else if (addresstype === 'country') score += 4;
  if (klass === 'place') score += 10;
  if (klass === 'boundary') score += 5;
  score += getSuggestionImportance(item) * 35;
  score += Math.max(0, 30 - getSuggestionPlaceRank(item));
  return score;
}

function createLocalCitySuggestion(city: {
  name: string;
  country_code?: string | null;
  country_name?: string | null;
  admin_area?: string | null;
  lat: number | null;
  lng: number | null;
  zoom: number | null;
}): CitySuggestion | null {
  if (city.lat == null || city.lng == null) return null;
  return {
    name: city.name,
    display_name: [city.name, city.admin_area, city.country_name].filter(Boolean).join(', '),
    lat: String(city.lat),
    lon: String(city.lng),
    class: 'place',
    type: 'city',
    addresstype: 'city',
    address: {
      city: city.name,
      state: city.admin_area ?? undefined,
      country: city.country_name ?? undefined,
      country_code: city.country_code?.toLowerCase(),
    },
    source: 'local',
  };
}

function photonFeatureToCitySuggestion(feature: {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    city?: string;
    state?: string;
    county?: string;
    country?: string;
    countrycode?: string;
    type?: string;
    osm_value?: string;
  };
}): CitySuggestion | null {
  const coordinates = feature.geometry?.coordinates;
  const props = feature.properties;
  if (!coordinates || !props) return null;
  const [lon, lat] = coordinates;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const name = props.city ?? props.name;
  if (!name) return null;
  const placeType = props.type ?? props.osm_value ?? 'city';
  return {
    name,
    display_name: [name, props.state ?? props.county, props.country].filter(Boolean).join(', '),
    lat: String(lat),
    lon: String(lon),
    class: 'place',
    type: placeType,
    addresstype: placeType,
    address: {
      city: name,
      state: props.state,
      county: props.county,
      country: props.country,
      country_code: props.countrycode?.toLowerCase(),
    },
    source: 'photon',
  };
}

function mergeCitySuggestions(...groups: CitySuggestion[][]): CitySuggestion[] {
  const byKey = new Map<string, CitySuggestion>();
  for (const group of groups) {
    for (const item of group) {
      const name = getCitySuggestionName(item);
      const country = item.address?.country_code ?? '';
      const lat = Number.parseFloat(item.lat);
      const lon = Number.parseFloat(item.lon);
      if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const key = `${normalize(name)}:${country.toLowerCase()}:${lat.toFixed(3)}:${lon.toFixed(3)}`;
      if (!byKey.has(key)) byKey.set(key, item);
    }
  }
  return Array.from(byKey.values());
}

export function orderCitySuggestions(suggestions: CitySuggestion[], query: string): CitySuggestion[] {
  return [...suggestions].sort((a, b) => {
    const scoreDiff = scoreCitySuggestion(b, query) - scoreCitySuggestion(a, query);
    if (scoreDiff !== 0) return scoreDiff;
    const importanceDiff = getSuggestionImportance(b) - getSuggestionImportance(a);
    if (importanceDiff !== 0) return importanceDiff;
    return formatCitySuggestionSubtitle(a).localeCompare(formatCitySuggestionSubtitle(b), 'en');
  });
}

/**
 * Build a human-readable street address from Nominatim's structured `address`
 * object, preserving the house number whenever Nominatim returned one.
 * Falls back to the first three comma-separated segments of `displayName`
 * only if the structured object lacks a road.
 */
export function buildNominatimAddress(
  address: NominatimAddressDetails | undefined,
  displayName?: string,
): string {
  const road = address?.road || address?.pedestrian || address?.footway;
  if (road) {
    const streetLine = address?.house_number ? `${road} ${address.house_number}` : road;
    const area = address?.neighbourhood || address?.suburb;
    const city = address?.city || address?.town || address?.village || address?.municipality;
    const parts = [streetLine, area, city].filter((p): p is string => typeof p === 'string' && p.length > 0);
    return parts.join(', ');
  }
  if (displayName) {
    const parts = displayName.split(', ');
    return parts.slice(0, Math.min(3, parts.length)).join(', ');
  }
  return '';
}

export function AddVenueScreen() {
  const router = useRouter();
  const { s } = useI18n();
  const { colors } = useTheme();
  const { selectedCity } = useSelectedLocation();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [type, setType] = useState<VenueType>('parc_exterior');
  const [tablesCount, setTablesCount] = useState('');
  const [city, setCity] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [geoLat, setGeoLat] = useState<number | null>(null);
  const [geoLng, setGeoLng] = useState<number | null>(null);
  const [cityCountryCode, setCityCountryCode] = useState<string | null>(null);
  const [cityCountryName, setCityCountryName] = useState<string | null>(null);
  const [cityCenterLat, setCityCenterLat] = useState<number | null>(null);
  const [cityCenterLng, setCityCenterLng] = useState<number | null>(null);
  const [cityZoom, setCityZoom] = useState<number | null>(null);
  const [venueLocationConfirmed, setVenueLocationConfirmed] = useState(false);
  const [knownCities, setKnownCities] = useState<string[]>([]);
  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([]);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [citySearching, setCitySearching] = useState(false);
  const cityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCityQueryRef = useRef('');
  // Ref to the form's ScrollView so AddressPickerField can disable parent
  // scrolling while the user pans the map.
  const formScrollRef = useRef<any>(null);

  // Read from the delta-synced cities cache (see useCitiesQuery): warm
  // starts paint instantly and the network call only ships changed rows.
  const { data: citiesList } = useCitiesQuery();
  const knownCityRecords = useMemo(() => citiesList ?? [], [citiesList]);
  useEffect(() => {
    if (citiesList) setKnownCities(citiesList.map((c) => c.name));
  }, [citiesList]);

  const handleAddressPatch = useCallback((patch: {
    address?: string;
    city?: string;
    lat?: number | null;
    lng?: number | null;
    countryCode?: string | null;
    countryName?: string | null;
    cityCenterLat?: number | null;
    cityCenterLng?: number | null;
    cityZoom?: number | null;
  }) => {
    if (patch.address !== undefined) setAddress(patch.address);
    if (patch.city !== undefined) setCity(patch.city);
    if (patch.lat !== undefined) {
      setGeoLat(patch.lat);
      if (patch.lat != null) setVenueLocationConfirmed(true);
    }
    if (patch.lng !== undefined) {
      setGeoLng(patch.lng);
      if (patch.lng != null) setVenueLocationConfirmed(true);
    }
    if (patch.countryCode !== undefined) setCityCountryCode(patch.countryCode);
    if (patch.countryName !== undefined) setCityCountryName(patch.countryName);
    if (patch.cityCenterLat !== undefined) setCityCenterLat(patch.cityCenterLat);
    if (patch.cityCenterLng !== undefined) setCityCenterLng(patch.cityCenterLng);
    if (patch.cityZoom !== undefined) setCityZoom(patch.cityZoom);
  }, []);

  const closeCitySuggestions = useCallback(() => {
    if (cityDebounceRef.current) {
      clearTimeout(cityDebounceRef.current);
      cityDebounceRef.current = null;
    }
    setCitySuggestions([]);
    setShowCitySuggestions(false);
    setCitySearching(false);
  }, []);

  const handleCityChange = useCallback((text: string) => {
    setCity(text);
    setCityCountryCode(null);
    setCityCountryName(null);
    setCityCenterLat(null);
    setCityCenterLng(null);
    setCityZoom(null);
    if (debouncedCityClearsAddress(text, city)) {
      setAddress('');
      setGeoLat(null);
      setGeoLng(null);
      setVenueLocationConfirmed(false);
    }
    if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current);

    if (text.trim().length < 2) {
      setCitySuggestions([]);
      setShowCitySuggestions(false);
      setCitySearching(false);
      return;
    }

    const localSuggestions = mergeCitySuggestions(
      knownCityRecords
        .filter((record) => normalize(record.name).includes(normalize(text.trim())))
        .map(createLocalCitySuggestion)
        .filter((item): item is CitySuggestion => item != null),
    );
    const orderedLocalSuggestions = orderCitySuggestions(localSuggestions, text).slice(0, 5);
    setCitySuggestions(orderedLocalSuggestions);
    setShowCitySuggestions(orderedLocalSuggestions.length > 0);
    setCitySearching(true);
    cityDebounceRef.current = setTimeout(async () => {
      const trimmed = text.trim();
      if (trimmed === lastCityQueryRef.current) {
        setCitySearching(false);
        return;
      }
      lastCityQueryRef.current = trimmed;
      try {
        const freeformQuery = encodeURIComponent(trimmed);
        const cityQuery = encodeURIComponent(`${trimmed} city`);
        const capitalQuery = encodeURIComponent(`${trimmed} capital`);
        const structuredCity = encodeURIComponent(trimmed);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const headers = getGeocodingHeaders();
        const baseParams = 'format=json&dedupe=1&addressdetails=1&namedetails=1&extratags=1';
        const [structuredResult, freeformResult, cityResult, capitalResult, photonResult] = await Promise.allSettled([
          fetch(
            `https://nominatim.openstreetmap.org/search?${baseParams}&limit=10&city=${structuredCity}`,
            { headers, signal: controller.signal },
          ),
          fetch(
            `https://nominatim.openstreetmap.org/search?${baseParams}&limit=14&q=${freeformQuery}`,
            { headers, signal: controller.signal },
          ),
          fetch(
            `https://nominatim.openstreetmap.org/search?${baseParams}&limit=8&q=${cityQuery}`,
            { headers, signal: controller.signal },
          ),
          fetch(
            `https://nominatim.openstreetmap.org/search?${baseParams}&limit=6&q=${capitalQuery}`,
            { headers, signal: controller.signal },
          ),
          fetch(
            `https://photon.komoot.io/api/?limit=10&q=${freeformQuery}`,
            { headers, signal: controller.signal },
          ),
        ]);
        clearTimeout(timeout);
        if (lastCityQueryRef.current !== trimmed) return;
        const structuredRes = structuredResult.status === 'fulfilled' ? structuredResult.value : null;
        const freeformRes = freeformResult.status === 'fulfilled' ? freeformResult.value : null;
        const cityRes = cityResult.status === 'fulfilled' ? cityResult.value : null;
        const capitalRes = capitalResult.status === 'fulfilled' ? capitalResult.value : null;
        const photonRes = photonResult.status === 'fulfilled' ? photonResult.value : null;
        if (!(structuredRes?.ok) && !(freeformRes?.ok) && !(cityRes?.ok) && !(capitalRes?.ok) && !(photonRes?.ok)) {
          setCitySearching(false);
          return;
        }
        const structuredData: CitySuggestion[] = structuredRes?.ok ? await structuredRes.json() : [];
        const freeformData: CitySuggestion[] = freeformRes?.ok ? await freeformRes.json() : [];
        const cityData: CitySuggestion[] = cityRes?.ok ? await cityRes.json() : [];
        const capitalData: CitySuggestion[] = capitalRes?.ok ? await capitalRes.json() : [];
        const photonData: { features?: unknown[] } = photonRes?.ok ? await photonRes.json() : {};
        const photonSuggestions = (photonData.features ?? [])
          .map((feature) => photonFeatureToCitySuggestion(feature as Parameters<typeof photonFeatureToCitySuggestion>[0]))
          .filter((item): item is CitySuggestion => item != null);
        const cityResults = orderCitySuggestions(mergeCitySuggestions(
          localSuggestions,
          structuredData.filter(isLikelyCitySuggestion).map((item) => ({ ...item, source: 'nominatim' as const })),
          freeformData.filter(isLikelyCitySuggestion).map((item) => ({ ...item, source: 'nominatim' as const })),
          cityData.filter(isLikelyCitySuggestion).map((item) => ({ ...item, source: 'nominatim' as const })),
          capitalData.filter(isLikelyCitySuggestion).map((item) => ({ ...item, source: 'nominatim' as const })),
          photonSuggestions.filter(isLikelyCitySuggestion),
        ), trimmed).slice(0, 8);
        setCitySuggestions(cityResults);
        setShowCitySuggestions(cityResults.length > 0);
      } catch { /* timeout / abort - ignore */ }
      setCitySearching(false);
    }, 500);
  }, [city, knownCityRecords]);

  const handleCitySuggestionSelect = useCallback((item: CitySuggestion) => {
    const suggestionCity = getCitySuggestionName(item);
    const nextLat = parseFloat(item.lat);
    const nextLng = parseFloat(item.lon);
    if (!suggestionCity || !Number.isFinite(nextLat) || !Number.isFinite(nextLng)) return;
    const countryCode = item.address?.country_code?.toUpperCase() ?? null;
    const countryName = item.address?.country ?? null;
    const match = knownCityRecords.length > 0
      ? matchCity(
          suggestionCity,
          knownCityRecords
            .filter((record) => !countryCode || record.country_code?.toUpperCase() === countryCode)
            .map((record) => record.name),
        )
      : null;
    const selectedName = match ?? suggestionCity;
    setCity(selectedName);
    setCityCountryCode(countryCode);
    setCityCountryName(countryName);
    setCityCenterLat(nextLat);
    setCityCenterLng(nextLng);
    setCityZoom(12);
    setGeoLat(nextLat);
    setGeoLng(nextLng);
    setVenueLocationConfirmed(false);
    closeCitySuggestions();
    lastCityQueryRef.current = selectedName;
  }, [closeCitySuggestions, knownCityRecords]);

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) { Alert.alert(s('error'), s('nameRequired')); return; }
    if (!city.trim()) { Alert.alert(s('error'), s('cityRequired')); return; }
    const canonicalCity = canonicalizeCityName(city);
    let resolvedCountryCode = cityCountryCode;
    let resolvedCountryName = cityCountryName;
    let resolvedCityCenterLat = cityCenterLat;
    let resolvedCityCenterLng = cityCenterLng;
    let resolvedCityZoom = cityZoom;

    if (resolvedCityCenterLat == null || resolvedCityCenterLng == null || !resolvedCountryCode) {
      Alert.alert(s('error'), s('cityRequired'));
      return;
    }
    if (!address.trim()) { Alert.alert(s('error'), s('addressRequired')); return; }
    if (!venueLocationConfirmed || geoLat == null || geoLng == null) {
      Alert.alert(s('error'), s('dragPinHint'));
      return;
    }
    if (tablesCount) {
      const count = parseInt(tablesCount, 10);
      if (isNaN(count) || count < 1 || count > 100) {
        Alert.alert(s('error'), s('genericError'));
        return;
      }
    }
    setLoading(true);

    // Upsert city to get its id (city name extracted from Nominatim)
    const { id: cityId, error: cityError } = await upsertCity(
      canonicalCity,
      {
        countryCode: resolvedCountryCode ?? selectedCity?.country_code,
        countryName: resolvedCountryName ?? selectedCity?.country_name,
        lat: getCityCenterLat(canonicalCity, selectedCity, resolvedCityCenterLat),
        lng: getCityCenterLng(canonicalCity, selectedCity, resolvedCityCenterLng),
        zoom: selectedCity?.name === canonicalCity ? selectedCity.zoom : resolvedCityZoom ?? 12,
      },
    );
    if (cityError || !cityId) { setLoading(false); Alert.alert(s('error'), safeErrorMessage(cityError ?? 'genericError', 'genericError', s)); return; }

    const { error } = await createVenue({
      name: name.trim(),
      type,
      city: canonicalCity,
      city_id: cityId,
      county: null,
      sector: null,
      address: address.trim(),
      lat: geoLat ?? selectedCity?.lat ?? 44.43,
      lng: geoLng ?? selectedCity?.lng ?? 26.10,
      tables_count: tablesCount ? Number(tablesCount) : null,
      condition: null,
      hours: null,
      description: notes.trim() || null,
      tags: null,
      photos: null,
      free_access: null,
      night_lighting: null,
      nets: null,
      tariff: null,
      website: null,
      approved: false,
    });
    setLoading(false);
    if (error) {
      const rateMsg = rateLimitMessageFor(error, s);
      // Postgres unique_violation (idx_venues_name_city / venues_name_key) →
      // surface a meaningful "already exists" message instead of the generic
      // fallback so the user knows to change the name.
      const isDuplicate = (error as { code?: string }).code === '23505';
      const msg = rateMsg
        ?? (isDuplicate ? s('venueAlreadyExists') : safeErrorMessage(error, 'genericError', s));
      Alert.alert(s('error'), msg);
      return;
    }
    Alert.alert(s('success'), s('venueSubmitted'));
    router.back();
  }, [name, address, type, city, tablesCount, notes, router, geoLat, geoLng, venueLocationConfirmed, selectedCity, cityCountryCode, cityCountryName, cityCenterLat, cityCenterLng, cityZoom, s]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.header}>{s('addVenueTitle')}</Text>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={formScrollRef} style={styles.formScroll} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
          {/* Name Field */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{s('fieldName')}</Text>
            <TextInput
              style={[styles.input, styles.inputText]}
              placeholder={s('fieldNamePlaceholder')}
              placeholderTextColor={colors.textFaint}
              value={name}
              onChangeText={setName}
              maxLength={100}
            />
          </View>

          {/* Type Field */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{s('fieldType')}</Text>
            <View style={styles.typeRow}>
              <TouchableOpacity
                style={[styles.typeBtn, type === 'parc_exterior' && styles.typeBtnActive]}
                onPress={() => setType('parc_exterior')}
              >
                <Text style={[styles.typeBtnText, type === 'parc_exterior' && styles.typeBtnTextActive]}>
                  {s('typeParcExterior')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeBtn, type === 'sala_indoor' && styles.typeBtnActive]}
                onPress={() => setType('sala_indoor')}
              >
                <Text style={[styles.typeBtnText, type === 'sala_indoor' && styles.typeBtnTextActive]}>
                  {s('typeSalaIndoor')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Nr Mese */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{s('fieldTables')}</Text>
            <TextInput
              style={[styles.input, styles.inputText]}
              placeholder="2"
              placeholderTextColor={colors.textFaint}
              value={tablesCount}
              onChangeText={setTablesCount}
              keyboardType="numeric"
            />
          </View>

          {/* Address field (with typeahead, geocode button, map) */}
          <View style={[styles.field, { zIndex: 20 }]}>
            <Text style={styles.fieldLabel}>{s('fieldCity')}</Text>
            <TextInput
              style={[styles.input, styles.inputText]}
              placeholder={s('cityModalSearchPlaceholder')}
              placeholderTextColor={colors.textFaint}
              value={city}
              onChangeText={handleCityChange}
              maxLength={100}
            />
            {formatSelectedCityLocation(cityCountryName, cityCountryCode) && (
              <Text style={styles.selectedCityMeta}>
                {formatSelectedCityLocation(cityCountryName, cityCountryCode)}
              </Text>
            )}
            {(showCitySuggestions || citySearching) && (
              <View style={styles.suggestionsWrap}>
                {citySearching && citySuggestions.length === 0 ? (
                  <View style={styles.suggestionLoading}>
                    <ActivityIndicator size="small" color={colors.primaryMid} />
                    <Text style={styles.suggestionLoadingText}>{s('searching') || 'Searching...'}</Text>
                  </View>
                ) : (
                  citySuggestions.map((item, idx) => (
                    <Pressable
                      key={`${item.lat}-${item.lon}-${idx}`}
                      style={({ pressed }) => [
                        styles.suggestionItem,
                        pressed && styles.suggestionItemPressed,
                        idx < citySuggestions.length - 1 && styles.suggestionBorder,
                      ]}
                      onPress={() => handleCitySuggestionSelect(item)}
                    >
                      <View style={{ marginTop: 2 }}>
                        <Lucide name="map-pin" size={14} color={colors.primaryMid} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.suggestionTitle} numberOfLines={1}>
                          {formatCitySuggestionTitle(item)}
                        </Text>
                        <Text style={styles.suggestionText} numberOfLines={1}>
                          {formatCitySuggestionSubtitle(item)}
                        </Text>
                      </View>
                    </Pressable>
                  ))
                )}
              </View>
            )}
          </View>

          <View style={[styles.field, { zIndex: 10 }]}>
            <Text style={styles.fieldLabel}>{s('fieldAddress')}</Text>
            <AddressPickerField
              address={address}
              city={city}
              lat={geoLat}
              lng={geoLng}
              knownCities={knownCities}
              knownCityRecords={knownCityRecords}
              countryCode={cityCountryCode}
              countryName={cityCountryName}
              cityCenterLat={cityCenterLat}
              cityCenterLng={cityCenterLng}
              cityZoom={cityZoom}
              onChange={handleAddressPatch}
              parentScrollRef={formScrollRef}
            />
          </View>

          {/* Notes Field */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{s('fieldNotes')}</Text>
            <TextInput
              style={[styles.textarea, styles.textareaInput]}
              placeholder={s('notesPlaceholder')}
              placeholderTextColor={colors.textFaint}
              value={notes}
              onChangeText={setNotes}
              maxLength={500}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
              <Text style={styles.cancelText}>{s('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.submitBtn, loading && { opacity: 0.6 }]} onPress={handleSubmit} disabled={loading}>
              {loading ? (
                <ActivityIndicator size="small" color={colors.textOnPrimary} />
              ) : (
                <>
                  <Lucide name="plus" size={16} color={colors.textOnPrimary} />
                  <Text style={styles.submitText}>{s('addBtn')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
      </ScrollView>
      </KeyboardAvoidingView>

    </SafeAreaView>
  );
}

function getCityCenterLat(
  canonicalCity: string,
  selectedCity: { name: string; lat: number | null; lng: number | null } | null,
  venueLat: number | null,
): number | null {
  if (selectedCity?.name === canonicalCity && selectedCity.lat != null) return selectedCity.lat;
  return venueLat;
}

function getCityCenterLng(
  canonicalCity: string,
  selectedCity: { name: string; lat: number | null; lng: number | null } | null,
  venueLng: number | null,
): number | null {
  if (selectedCity?.name === canonicalCity && selectedCity.lng != null) return selectedCity.lng;
  return venueLng;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    header: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.display,
      fontWeight: FontWeight.extrabold,
      color: colors.text,
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.xs,
    },
    formScroll: {
      flex: 1,
    },
    formContent: {
      padding: Spacing.xl,
      paddingTop: Spacing.xs,
      gap: 0,
    },
    field: {
      gap: 6,
      marginBottom: Spacing.md,
    },
    fieldLabel: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.semibold,
      color: colors.textFaint,
      letterSpacing: 0.7,
    },
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
    selectedCityMeta: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      color: colors.textMuted,
      marginTop: -2,
    },
    suggestionsWrap: {
      backgroundColor: colors.bgAlt,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      maxHeight: 220,
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
    suggestionTitle: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.semibold,
      color: colors.text,
    },
    suggestionText: {
      flex: 1,
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      color: colors.textMuted,
      marginTop: 2,
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
    typeRow: {
      flexDirection: 'row',
      gap: Spacing.xs,
    },
    typeBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bgAlt,
      borderRadius: Radius.md,
      height: 46,
      borderWidth: 1,
      borderColor: colors.border,
      ...Shadows.sm,
    },
    typeBtnActive: {
      backgroundColor: colors.primaryPale,
      borderColor: colors.primaryDim,
      ...Shadows.md,
    },
    typeBtnText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.textMuted,
    },
    typeBtnTextActive: {
      color: colors.primaryMid,
      fontWeight: FontWeight.semibold,
    },
    textarea: {
      backgroundColor: colors.bgAlt,
      borderRadius: Radius.md,
      height: 70,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    textareaInput: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.text,
      textAlignVertical: 'top',
    },
    actions: {
      flexDirection: 'row',
      gap: Spacing.sm,
      paddingVertical: Spacing.xs,
      paddingBottom: Spacing.md,
    },
    cancelBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      height: 50,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgAlt,
      ...Shadows.sm,
    },
    cancelText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.semibold,
      color: colors.textMuted,
    },
    submitBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryLight,
      borderRadius: 12,
      height: 50,
      gap: Spacing.xs,
      ...Shadows.md,
    },
    submitText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.semibold,
      color: colors.textOnPrimary,
    },
  });
}
