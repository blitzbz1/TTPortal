// INVARIANT (Stage 1.5): the root LocationProvider must NOT parse the full
// cities catalog on the synchronous mount path. Boot resolves selectedCity from
// a persisted 1-row object (loadPersistedSelectedCity); the heavy activeCities
// build (toLocationCity + mergeExpansionCityWave over ~10k rows) is deferred off
// first paint via InteractionManager / requestCatalog.
import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { InteractionManager } from 'react-native';
import { getStringSync, removeString, setString } from '../lib/mmkv';
import { useCitiesQuery } from '../hooks/queries/useCitiesQuery';
import {
  FALLBACK_COUNTRY_CODE,
  getCountriesFromCities,
  getCountryForCity,
  getCountryByCode,
  getDefaultCity,
  mergeExpansionCityWave,
  toLocationCity,
} from '../lib/locationHelpers';
import type { Country, CountryCode, LocationCity } from '../lib/locationTypes';
import { traceSegment } from '../lib/launchTrace';

const COUNTRY_KEY = 'last_selected_country_code';
const CITY_KEY = 'last_selected_city_id';
const CITY_OBJ_KEY = 'last_selected_city';
const CITY_VISIT_COUNTS_KEY = 'location_city_visit_counts';
const SETUP_DONE_KEY = 'initial_location_setup_completed';

// Stable empty reference so the deferred activeCities memo doesn't churn.
const EMPTY_CITIES: LocationCity[] = [];

function hasInitialLocationResetParam(): boolean {
  if (typeof window === 'undefined') return false;
  const location = window.location;
  if (!location) return false;
  const href = location.href ?? '';
  const search = location.search ?? '';
  const hash = location.hash ?? '';
  const hashSearch = hash.includes('?') ? hash.slice(hash.indexOf('?')) : '';
  return (
    new URLSearchParams(search).has('resetInitialLocation') ||
    new URLSearchParams(hashSearch).has('resetInitialLocation') ||
    href.includes('?resetInitialLocation') ||
    href.includes('&resetInitialLocation') ||
    href.includes('#resetInitialLocation')
  );
}

export interface LocationContextValue {
  selectedCountry: Country;
  selectedCity: LocationCity | null;
  activeCountries: Country[];
  activeCities: LocationCity[];
  citiesForSelectedCountry: LocationCity[];
  loadingCities: boolean;
  locationReady: boolean;
  /** Stage 1.5: force the deferred full-catalog build (called on switcher-open). */
  requestCatalog: () => void;
  hasCompletedInitialLocationSetup: boolean;
  refreshCities: () => Promise<void>;
  setSelectedCountry: (country: Country | CountryCode) => void;
  setSelectedCity: (city: LocationCity | null) => void;
  completeInitialLocationSetup: () => void;
  resetInitialLocationSetup: () => void;
}

export const LocationContext = createContext<LocationContextValue | null>(null);

function loadCountry(): Country {
  if (hasInitialLocationResetParam()) return getCountryByCode(FALLBACK_COUNTRY_CODE);
  return getCountryByCode(getStringSync(COUNTRY_KEY) ?? FALLBACK_COUNTRY_CODE);
}

function loadCityId(): number | null {
  if (hasInitialLocationResetParam()) return null;
  const raw = getStringSync(CITY_KEY);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function loadPersistedSelectedCity(): LocationCity | null {
  // Stage 1.5 (T030): resolve the saved city from a persisted 1-row object so
  // boot needs ZERO catalog parse. Stores the whole LocationCity, so negative
  // EXPANSION_CITY_WAVE client ids (e.g. Vienna -1001) rehydrate without any
  // catalog access. MUST NOT call readCities()/cleanCityCatalog.
  if (hasInitialLocationResetParam()) return null;
  const raw = getStringSync(CITY_OBJ_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LocationCity;
    return parsed && typeof parsed.id === 'number' ? parsed : null;
  } catch {
    return null;
  }
}

function loadInitialSetupCompleted(): boolean {
  if (hasInitialLocationResetParam()) return false;
  return getStringSync(SETUP_DONE_KEY) === 'true';
}

function incrementCityVisitCount(cityId: number): void {
  try {
    const raw = getStringSync(CITY_VISIT_COUNTS_KEY);
    const counts = raw ? JSON.parse(raw) as Record<string, number> : {};
    counts[String(cityId)] = (Number(counts[String(cityId)]) || 0) + 1;
    setString(CITY_VISIT_COUNTS_KEY, JSON.stringify(counts));
  } catch {
    setString(CITY_VISIT_COUNTS_KEY, JSON.stringify({ [String(cityId)]: 1 }));
  }
}

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [selectedCountry, setSelectedCountryState] = useState<Country>(loadCountry);
  const [selectedCityId, setSelectedCityId] = useState<number | null>(loadCityId);
  const [hasCompletedInitialLocationSetup, setHasCompletedInitialLocationSetup] = useState<boolean>(
    loadInitialSetupCompleted,
  );
  const [persistedCity] = useState<LocationCity | null>(loadPersistedSelectedCity);
  // Stage 1.5 (T031): defer the full-catalog activeCities build until the catalog
  // is "requested" — post-first-paint via InteractionManager, eagerly on
  // switcher-open (requestCatalog), or when there's no persisted city to resolve
  // from.
  const [catalogRequested, setCatalogRequested] = useState(false);
  const requestCatalog = useCallback(() => setCatalogRequested(true), []);

  // Stage 1.5: gate the cities query on catalogRequested so its initialData parse
  // is deferred off the synchronous mount path (boot resolves selectedCity from
  // the persisted 1-row object instead); enabling it post-first-paint hydrates
  // the catalog via queryFn.
  const { data: cityRows, isLoading, refreshCatalog } = useCitiesQuery(catalogRequested);

  const cityRowsCount = cityRows?.length ?? 0;

  useEffect(() => {
    if (catalogRequested) return;
    if (hasCompletedInitialLocationSetup && !persistedCity) {
      // Nothing persisted to resolve selectedCity from (first run, or an upgrade
      // from the id-only format) — build promptly instead of deferring.
      setCatalogRequested(true);
      return;
    }
    const handle = InteractionManager.runAfterInteractions(() => setCatalogRequested(true));
    return () => handle.cancel();
  }, [catalogRequested, hasCompletedInitialLocationSetup, persistedCity]);

  const activeCities = useMemo(() => {
    // Stage 1.5: [] until requested AND the rows are loaded, so the ~10k
    // toLocationCity map + mergeExpansionCityWave never runs on the synchronous
    // mount path, and selectedCity holds the persisted object (not a transient
    // EXPANSION_CITY_WAVE default) during the post-request load window.
    if (!catalogRequested || !cityRows) return EMPTY_CITIES;
    // T003 (Stage M): time the full-catalog build (warm-cache + post-delta).
    return traceSegment('cities: toLocationCity+mergeWave', () => mergeExpansionCityWave(
      (cityRows ?? []).map(toLocationCity).filter((city) => city.expansion_status !== 'hidden'),
    ));
  }, [catalogRequested, cityRows]);
  const activeCountries = useMemo(() => getCountriesFromCities(activeCities), [activeCities]);
  const citiesForSelectedCountry = useMemo(
    () => activeCities.filter((city) => city.country_code === selectedCountry.code),
    [activeCities, selectedCountry.code],
  );

  const selectedCity = useMemo(() => {
    if (!hasCompletedInitialLocationSetup) return null;
    // Pre-build (activeCities deferred to []): resolve from the persisted 1-row
    // object — zero catalog parse. Once built, activeCities is authoritative
    // (fresh venue_count, tombstone-aware). EXPANSION_CITY_WAVE cities (negative
    // ids) are merged into activeCities, so a saved wave id resolves via find too.
    if (activeCities.length === 0) return persistedCity;
    if (selectedCityId != null) {
      const saved = activeCities.find((city) => city.id === selectedCityId);
      if (saved) return saved;
    }
    return getDefaultCity(citiesForSelectedCountry);
  }, [activeCities, citiesForSelectedCountry, hasCompletedInitialLocationSetup, selectedCityId, persistedCity]);

  // Stage 1.5 (T032): ready once a city is resolved (persisted or catalog) or the
  // cities query settles — no longer keyed off cityRowsCount, so nothing blocks
  // the tree on the catalog parse. NOTE: no tree-gating consumer reads this today
  // (the visible gate is appReady = fontsLoaded && !isLoading in _layout.tsx);
  // keep it honest, but the app tree must NEVER block on the full-catalog build.
  const locationReady = selectedCity != null || !isLoading;

  useEffect(() => {
    if (!selectedCity || selectedCityId === selectedCity.id) return;
    if (!hasCompletedInitialLocationSetup && selectedCityId == null) return;
    setSelectedCityId(selectedCity.id);
    setString(CITY_KEY, String(selectedCity.id));
  }, [hasCompletedInitialLocationSetup, selectedCity, selectedCityId]);

  useEffect(() => {
    // Stage 1.5 (T030): keep the persisted 1-row boot cache fresh with the
    // resolved city. Skips the redundant boot write when selectedCity IS the
    // persisted object; writes the authoritative catalog row once it's built
    // (and seeds CITY_OBJ_KEY for users upgrading from the id-only format).
    if (selectedCity && selectedCity !== persistedCity) {
      setString(CITY_OBJ_KEY, JSON.stringify(selectedCity));
    }
  }, [selectedCity, persistedCity]);

  useEffect(() => {
    if (!selectedCity || selectedCity.country_code === selectedCountry.code) return;
    const country = getCountryForCity(selectedCity);
    setSelectedCountryState(country);
    setString(COUNTRY_KEY, country.code);
  }, [selectedCity, selectedCountry.code]);

  const setSelectedCountry = useCallback((countryOrCode: Country | CountryCode) => {
    const next = typeof countryOrCode === 'string' ? getCountryByCode(countryOrCode) : countryOrCode;
    setSelectedCountryState(next);
    setSelectedCityId(null);
    setString(COUNTRY_KEY, next.code);
  }, []);

  const setSelectedCity = useCallback((city: LocationCity | null) => {
    if (!city) {
      setSelectedCityId(null);
      return;
    }
    setSelectedCityId(city.id);
    setString(CITY_KEY, String(city.id));
    setString(CITY_OBJ_KEY, JSON.stringify(city)); // Stage 1.5: 1-row boot cache
    incrementCityVisitCount(city.id);
    const country = getCountryForCity(city);
    setSelectedCountryState(country);
    setString(COUNTRY_KEY, country.code);
  }, []);

  const completeInitialLocationSetup = useCallback(() => {
    setHasCompletedInitialLocationSetup(true);
    setString(SETUP_DONE_KEY, 'true');
  }, []);

  const resetInitialLocationSetup = useCallback(() => {
    setHasCompletedInitialLocationSetup(false);
    setSelectedCityId(null);
    removeString(CITY_KEY);
    removeString(CITY_OBJ_KEY);
    removeString(SETUP_DONE_KEY);
  }, []);

  const refreshCities = useCallback(async () => {
    await refreshCatalog();
  }, [refreshCatalog]);

  const value = useMemo<LocationContextValue>(
    () => ({
      selectedCountry,
      selectedCity,
      activeCountries,
      activeCities,
      citiesForSelectedCountry,
      loadingCities: isLoading && cityRowsCount === 0,
      locationReady,
      requestCatalog,
      hasCompletedInitialLocationSetup,
      refreshCities,
      setSelectedCountry,
      setSelectedCity,
      completeInitialLocationSetup,
      resetInitialLocationSetup,
    }),
    [
      selectedCountry,
      selectedCity,
      activeCountries,
      activeCities,
      citiesForSelectedCountry,
      isLoading,
      cityRowsCount,
      locationReady,
      requestCatalog,
      hasCompletedInitialLocationSetup,
      refreshCities,
      setSelectedCountry,
      setSelectedCity,
      completeInitialLocationSetup,
      resetInitialLocationSetup,
    ],
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}
