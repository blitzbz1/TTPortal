import type { PersistedCity } from './citiesPersistentCache';

export type CountryCode = string;

export interface Country {
  code: CountryCode;
  name: string;
  active: boolean;
}

export type CityExpansionStatus =
  | 'active'
  | 'launch_ready'
  | 'community_review'
  | 'researching'
  | 'coming_soon'
  | 'hidden';

export type LocationCity = Omit<
  PersistedCity,
  'country_code' | 'country_name' | 'admin_area' | 'local_area' | 'expansion_status'
> & {
  country_code: CountryCode;
  country_name: string;
  admin_area: string | null;
  local_area: string | null;
  expansion_status: CityExpansionStatus;
};

export interface SelectedLocation {
  selectedCountry: Country;
  selectedCity: LocationCity | null;
}
