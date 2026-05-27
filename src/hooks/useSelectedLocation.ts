import { useContext } from 'react';
import { LocationContext } from '../contexts/LocationProvider';
import { COUNTRIES } from '../lib/locationHelpers';

export function useSelectedLocation() {
  const context = useContext(LocationContext);
  return context ?? {
    selectedCountry: COUNTRIES[0],
    selectedCity: null,
    activeCountries: COUNTRIES,
    activeCities: [],
    citiesForSelectedCountry: [],
    loadingCities: false,
    locationReady: true,
    hasCompletedInitialLocationSetup: true,
    refreshCities: async () => {},
    setSelectedCountry: () => {},
    setSelectedCity: () => {},
    completeInitialLocationSetup: () => {},
    resetInitialLocationSetup: () => {},
  };
}
