import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
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

const COUNTRY_KEY = 'last_selected_country_code';
const CITY_KEY = 'last_selected_city_id';
const CITY_VISIT_COUNTS_KEY = 'location_city_visit_counts';

function hasInitialLocationResetParam(): boolean {
  if (typeof window === 'undefined') return false;
  const location = window.location;
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
  hasCompletedInitialLocationSetup: boolean;
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

function loadInitialSetupCompleted(): boolean {
  return false;
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
  const { data: cityRows, isLoading } = useCitiesQuery();
  const [selectedCountry, setSelectedCountryState] = useState<Country>(loadCountry);
  const [selectedCityId, setSelectedCityId] = useState<number | null>(loadCityId);
  const [hasCompletedInitialLocationSetup, setHasCompletedInitialLocationSetup] = useState<boolean>(
    loadInitialSetupCompleted,
  );
  const cityRowsCount = cityRows?.length ?? 0;
  const locationReady = !isLoading || cityRowsCount > 0;

  const activeCities = useMemo(
    () => mergeExpansionCityWave(
      (cityRows ?? []).map(toLocationCity).filter((city) => city.expansion_status !== 'hidden'),
    ),
    [cityRows],
  );
  const activeCountries = useMemo(() => getCountriesFromCities(activeCities), [activeCities]);
  const citiesForSelectedCountry = useMemo(
    () => activeCities.filter((city) => city.country_code === selectedCountry.code),
    [activeCities, selectedCountry.code],
  );

  const selectedCity = useMemo(() => {
    if (!hasCompletedInitialLocationSetup) return null;
    if (selectedCityId != null) {
      const saved = activeCities.find((city) => city.id === selectedCityId);
      if (saved) return saved;
    }
    return getDefaultCity(citiesForSelectedCountry);
  }, [activeCities, citiesForSelectedCountry, hasCompletedInitialLocationSetup, selectedCityId]);

  useEffect(() => {
    if (!selectedCity || selectedCityId === selectedCity.id) return;
    if (!hasCompletedInitialLocationSetup && selectedCityId == null) return;
    setSelectedCityId(selectedCity.id);
    setString(CITY_KEY, String(selectedCity.id));
  }, [hasCompletedInitialLocationSetup, selectedCity, selectedCityId]);

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
    incrementCityVisitCount(city.id);
    const country = getCountryForCity(city);
    setSelectedCountryState(country);
    setString(COUNTRY_KEY, country.code);
  }, []);

  const completeInitialLocationSetup = useCallback(() => {
    setHasCompletedInitialLocationSetup(true);
  }, []);

  const resetInitialLocationSetup = useCallback(() => {
    setHasCompletedInitialLocationSetup(false);
    setSelectedCityId(null);
    removeString(CITY_KEY);
  }, []);

  const value = useMemo<LocationContextValue>(
    () => ({
      selectedCountry,
      selectedCity,
      activeCountries,
      activeCities,
      citiesForSelectedCountry,
      loadingCities: isLoading && cityRowsCount === 0,
      locationReady,
      hasCompletedInitialLocationSetup,
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
      hasCompletedInitialLocationSetup,
      setSelectedCountry,
      setSelectedCity,
      completeInitialLocationSetup,
      resetInitialLocationSetup,
    ],
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}
