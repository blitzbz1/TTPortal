import { useQuery } from '@tanstack/react-query';
import { searchCities } from '../../services/citiesDelta';
import { toLocationCity } from '../../lib/locationHelpers';
import { useDebouncedValue } from '../useDebouncedValue';
import type { LocationCity } from '../../lib/locationTypes';

// Stage 2 (T049): the long-tail city search hook. Fired ONLY when the in-tier
// client filter yields too few results (the caller passes `enabled`), so the
// common case (a venue-bearing city already in the cached tier) stays fully
// offline. Always debounced + min-length-gated (DO-NOT #13: a sub-2-char or
// un-debounced search would hammer the prefix index).
const MIN_QUERY_LEN = 2;
const DEBOUNCE_MS = 250;
const EMPTY: LocationCity[] = [];

// Transient per-keystroke key (no external invalidation), so it stays module-local.
const citySearchQueryKey = (query: string) => ['cities', 'search', query] as const;

export function useCitySearchQuery(rawQuery: string, enabled: boolean = true) {
  // Debounce BEFORE the value reaches the query key, so rapid keystrokes collapse
  // to a single trailing fetch. useDebouncedValue seeds with the first value, so
  // the hook must be mounted with an empty query (the selectors do) for the first
  // real keystroke to go through the debounce window.
  const trimmed = rawQuery.trim();
  const debounced = useDebouncedValue(trimmed, DEBOUNCE_MS);
  const active = enabled && debounced.length >= MIN_QUERY_LEN;
  // True from the instant a >=2-char server search is intended (before the
  // debounce settles) until results land, so the switcher shows a spinner
  // instead of flashing "no results" during the ~250ms debounce window.
  const pendingDebounce = enabled && trimmed.length >= MIN_QUERY_LEN && debounced !== trimmed;

  const query = useQuery<LocationCity[]>({
    queryKey: citySearchQueryKey(debounced),
    enabled: active,
    queryFn: async () => {
      const { data, error } = await searchCities(debounced);
      if (error) throw error;
      // Same projection as the tier upserts, so the searched rows map through the
      // exact same toLocationCity the catalog uses (consistent country_name /
      // admin_area derivation) and merge cleanly into activeCities (T050).
      return (data ?? []).map(toLocationCity);
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return {
    ...query,
    results: query.data ?? EMPTY,
    // True across the debounce window AND the in-flight fetch, until results (or
    // an empty result) settle — drives the switcher's "searching…" spinner
    // without flashing the empty state for ~250ms, and without flashing on every
    // keystroke (it is gated on the >=2-char intent, not the raw input).
    isSearching: pendingDebounce || (active && query.isFetching),
    isActive: active,
  };
}
