import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BrandLockup } from './BrandLockup';
import { Lucide } from './Icon';
import { useI18n } from '../hooks/useI18n';
import { useSelectedLocation } from '../hooks/useSelectedLocation';
import { useTheme } from '../hooks/useTheme';
import { getDistanceKm } from '../lib/geo';
import { getStringSync } from '../lib/mmkv';
import { getCountryFlagEmoji } from '../lib/locationHelpers';
import type { Country, LocationCity } from '../lib/locationTypes';
import { Fonts, FontSize, FontWeight, Radius, Shadows, Spacing, type ThemeColors } from '../theme';

type LocationSelectorMode = 'welcome' | 'switcher';

const ALL_COUNTRIES: Country = { code: 'ALL', name: 'Europe', active: true };
const CITY_VISIT_COUNTS_KEY = 'location_city_visit_counts';

interface LocationSelectorProps {
  visible: boolean;
  mode: LocationSelectorMode;
  onClose?: () => void;
  onDone?: (city: LocationCity) => void;
}

export function LocationSelector({
  visible,
  mode,
  onClose,
  onDone,
}: LocationSelectorProps) {
  const { s, lang } = useI18n();
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors, isDark, mode, width), [colors, isDark, mode, width]);
  const {
    selectedCountry,
    selectedCity,
    activeCountries,
    activeCities,
    loadingCities,
    setSelectedCity,
    completeInitialLocationSetup,
  } = useSelectedLocation();
  const [pendingCountry, setPendingCountry] = useState(selectedCountry);
  const [pendingCity, setPendingCity] = useState<LocationCity | null>(selectedCity);
  const [query, setQuery] = useState('');
  const [locating, setLocating] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [countryPanelOpen, setCountryPanelOpen] = useState(false);
  const hasSearchQuery = query.trim().length > 0;
  const cityVisitCounts = useMemo(() => readCityVisitCounts(), []);

  const searchedCities = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    const countryCities = activeCities.filter((city) => {
      if (pendingCountry.code !== 'ALL' && city.country_code !== pendingCountry.code) return false;
      return true;
    });
    if (!normalizedQuery) return getLaunchCities(countryCities, cityVisitCounts);

    const filtered = countryCities.filter((city) => {
      if (!normalizedQuery) return true;
      return getCitySearchText(city).includes(normalizedQuery);
    });
    return [...filtered].sort((a, b) => sortSearchCities(a, b, normalizedQuery, lang));
  }, [activeCities, cityVisitCounts, lang, pendingCountry.code, query]);
  const countriesWithCities = useMemo(
    () => activeCountries
      .filter((country) => activeCities.some((city) => city.country_code === country.code))
      .sort((a, b) => getCountryLabel(a, s).localeCompare(getCountryLabel(b, s), lang)),
    [activeCities, activeCountries, lang, s],
  );
  const menuCities = useMemo(() => searchedCities.slice(0, 8), [searchedCities]);
  const filteredCities = countryPanelOpen ? menuCities : searchedCities;
  const selectedCountryLabel = pendingCountry.code === 'ALL'
    ? s('locationSelectorAllCountries')
    : getCountryLabel(pendingCountry, s);

  useEffect(() => {
    if (!visible) return;
    setPendingCountry(ALL_COUNTRIES);
    setPendingCity(selectedCity);
    setQuery('');
    setHint(null);
    setCountryPanelOpen(false);
  }, [selectedCity, visible]);

  const chooseCountry = (country: Country | 'ALL') => {
    if (country === 'ALL') {
      setPendingCountry(ALL_COUNTRIES);
      setCountryPanelOpen(false);
      return;
    }
    setPendingCountry(country);
    const best = getLaunchCities(
      activeCities.filter((city) => city.country_code === country.code),
      cityVisitCounts,
    )[0];
    if (best) setPendingCity(best);
    setCountryPanelOpen(false);
  };

  const applyCity = (city: LocationCity) => {
    setPendingCity(city);
    setSelectedCity(city);
    if (mode === 'welcome') completeInitialLocationSetup();
    onDone?.(city);
    if (mode === 'switcher') onClose?.();
  };

  const handleUseLocation = async () => {
    setLocating(true);
    setHint(null);
    try {
      const Location = await import('expo-location');
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setHint(s('initialLocationPermissionDenied'));
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      const nearest = getNearestCity(activeCities, position.coords.latitude, position.coords.longitude);
      if (!nearest) {
        setHint(s('initialLocationNoNearbyCity'));
        return;
      }
      applyCity(nearest);
    } catch {
      setHint(s('initialLocationLocateError'));
    } finally {
      setLocating(false);
    }
  };

  const shell = (
    <View style={styles.shell}>
      {mode === 'switcher' ? (
        <View style={styles.switcherHeader}>
          <View style={styles.handle} />
          <View style={styles.switcherTitleRow}>
            <View>
              <Text style={styles.switcherTitle}>{s('locationSelectorSwitcherTitle')}</Text>
              <Text style={styles.switcherSubtitle}>{s('locationSelectorSearchPlaceholder')}</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={10}>
              <Lucide name="x" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {mode === 'welcome' ? (
        <LinearGradient
          colors={['#F7FFF8', '#E5F8EA', '#CFF2DA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroTop}>
            <View style={styles.heroIdentity}>
              <BrandLockup color={colors.primary} pinWidth={14} wordmarkSize={17} gap={5} style={styles.heroBrand} />
              <View>
                <Text style={styles.brandMeta}>{s('locationSelectorKicker')}</Text>
              </View>
            </View>
            <View style={styles.launchBadge}>
              <Text style={styles.launchBadgeValue}>10</Text>
              <Text style={styles.launchBadgeLabel}>{s('locationSelectorLaunchMetric')}</Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>{s('locationSelectorTitle')}</Text>
          <Text style={styles.heroBody}>{s('locationSelectorBody')}</Text>
          <Text style={styles.heroSupport}>{s('locationSelectorSupport')}</Text>
        </LinearGradient>
      ) : null}

      <View style={styles.content}>
        {mode === 'switcher' ? (
          <View style={styles.activeCard}>
            <View style={styles.activeIcon}>
              <Lucide name="navigation" size={18} color={colors.textOnPrimary} />
            </View>
            <View style={styles.activeCopy}>
              <Text style={styles.activeLabel}>{s('locationSelectorCurrentCity')}</Text>
              <Text style={styles.activeTitle} numberOfLines={1}>
                {pendingCity ? pendingCity.name : s('initialLocationChooseCity')}
              </Text>
              <Text style={styles.activeMeta} numberOfLines={1}>
                {pendingCity ? getLocalizedCitySupportLine(pendingCity, s) : s('locationSelectorSelectedHint')}
              </Text>
            </View>
            {pendingCity ? (
              <View style={styles.activeSelectedMark}>
                <Lucide name="check" size={14} color={colors.textOnPrimary} />
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.searchBox}>
          <Lucide name="search" size={17} color={colors.textFaint} />
          <TextInput
            value={query}
            onChangeText={(value) => {
              setQuery(value);
              if (value.trim()) setCountryPanelOpen(false);
            }}
            placeholder={s('locationSelectorSearchPlaceholder')}
            placeholderTextColor={colors.textFaint}
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <Lucide name="x-circle" size={17} color={colors.textFaint} />
            </TouchableOpacity>
          ) : null}
        </View>

        {!hasSearchQuery ? (
          <View style={styles.scopeWrap}>
          <TouchableOpacity
            style={styles.scopeButton}
            onPress={() => setCountryPanelOpen((open) => !open)}
            activeOpacity={0.78}
          >
            <View style={styles.scopeIcon}>
              <Text style={styles.scopeFlag}>{getDisplayCountryFlag(pendingCountry.code)}</Text>
            </View>
            <View style={styles.scopeCopy}>
            <Text style={styles.scopeLabel}>{s('initialLocationCountryLabel')}</Text>
              <Text style={styles.scopeValue} numberOfLines={1}>{selectedCountryLabel}</Text>
            </View>
            <Lucide name={countryPanelOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textFaint} />
          </TouchableOpacity>

          {countryPanelOpen ? (
            <View style={styles.countryPanel}>
              <ScrollView
                style={styles.countryOptionsScroll}
                contentContainerStyle={styles.countryOptionsContent}
                showsVerticalScrollIndicator
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                <CountryOption
                  label={s('locationSelectorAllCountries')}
                  active={pendingCountry.code === 'ALL'}
                  onPress={() => chooseCountry('ALL')}
                  styles={styles}
                  colors={colors}
                />
                {countriesWithCities.map((country) => (
                  <CountryOption
                    key={country.code}
                    label={getCountryLabel(country, s)}
                    flag={getDisplayCountryFlag(country.code)}
                    active={pendingCountry.code === country.code}
                    onPress={() => chooseCountry(country)}
                    styles={styles}
                    colors={colors}
                  />
                ))}
              </ScrollView>
              <View style={styles.countryPanelDivider} />
              <Text style={styles.countryPanelLabel}>{s('locationSelectorFeaturedCities')}</Text>
              {menuCities.map((city) => (
                <CityMenuOption
                  key={city.id}
                  city={city}
                  selected={pendingCity?.id === city.id}
                  onPress={() => (mode === 'welcome' ? setPendingCity(city) : applyCity(city))}
                  styles={styles}
                  colors={colors}
                  s={s}
                />
              ))}
            </View>
          ) : null}
          </View>
        ) : null}

        {!countryPanelOpen && !hasSearchQuery ? (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{s('locationSelectorFeaturedCities')}</Text>
            {mode === 'welcome' ? (
              <TouchableOpacity style={styles.locateMiniBtn} onPress={handleUseLocation} disabled={locating || loadingCities}>
                {locating ? <ActivityIndicator size="small" color={colors.primary} /> : <Lucide name="crosshair" size={15} color={colors.primary} />}
                <Text style={styles.locateMiniText}>{s('initialLocationUseLocation')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {hint ? <Text style={styles.hintText}>{hint}</Text> : null}

        {countryPanelOpen ? null : loadingCities && filteredCities.length === 0 ? (
          <View style={styles.loader}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : filteredCities.length === 0 ? (
          <View style={styles.emptyPanel}>
            <Lucide name="map" size={22} color={colors.textFaint} />
            <Text style={styles.emptyTitle}>{s('cityModalNoSearchResults')}</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.cityList}
            contentContainerStyle={styles.cityListContent}
            showsVerticalScrollIndicator={mode === 'switcher'}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {filteredCities.map((city) => (
              <CityLaunchCard
                key={city.id}
                city={city}
                selected={pendingCity?.id === city.id}
                onPress={() => (mode === 'welcome' ? setPendingCity(city) : applyCity(city))}
                styles={styles}
                s={s}
              />
            ))}
          </ScrollView>
        )}

        {mode === 'welcome' ? (
          <View style={styles.welcomeFooter}>
            <View style={styles.selectedPreview}>
              <View style={styles.selectedPreviewIcon}>
                <Lucide name="map-pin" size={17} color={colors.primary} />
              </View>
              <View style={styles.selectedPreviewCopy}>
                <Text style={styles.selectedPreviewLabel}>{s('locationSelectorSelectedCity')}</Text>
                <Text style={styles.selectedPreviewTitle} numberOfLines={1}>
                  {pendingCity ? pendingCity.name : s('initialLocationChooseCity')}
                </Text>
                <Text style={styles.selectedPreviewMeta} numberOfLines={1}>
                  {pendingCity ? getLocalizedCitySupportLine(pendingCity, s) : s('locationSelectorSelectedHint')}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.primaryButton, !pendingCity && styles.primaryButtonDisabled]}
              onPress={() => pendingCity && applyCity(pendingCity)}
              disabled={!pendingCity}
              activeOpacity={0.86}
            >
              <Text style={styles.primaryButtonText}>
                {pendingCity ? s('locationSelectorExploreCity', pendingCity.name) : s('initialLocationChooseCity')}
              </Text>
              <Lucide name="arrow-right" size={18} color={colors.textOnPrimary} />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType={mode === 'welcome' ? 'fade' : 'slide'} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {mode === 'switcher' ? <TouchableOpacity style={styles.dismissLayer} activeOpacity={1} onPress={onClose} /> : null}
        {shell}
      </View>
    </Modal>
  );
}

export function SelectedCityPill({
  city,
  onPress,
  compact = false,
}: {
  city: LocationCity | null;
  onPress: () => void;
  compact?: boolean;
}) {
  const { s } = useI18n();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createPillStyles(colors, isDark, compact), [colors, compact, isDark]);

  return (
    <TouchableOpacity style={styles.pill} onPress={onPress} activeOpacity={0.78}>
      <Text style={styles.city} numberOfLines={1}>
        {city ? `${city.name}, ${getCityCountryLabel(city, s)}` : s('initialLocationChooseCity')}
      </Text>
      <Lucide name="chevron-down" size={13} color={isDark ? colors.textFaint : '#ffffffcc'} />
    </TouchableOpacity>
  );
}

function CityLaunchCard({
  city,
  selected,
  onPress,
  styles,
  s,
}: {
  city: LocationCity;
  selected: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  s: (key: string, ...args: string[]) => string;
}) {
  return (
    <TouchableOpacity style={[styles.cityCard, selected && styles.cityCardSelected]} onPress={onPress} activeOpacity={0.78}>
      <View style={styles.cityCardTop}>
        <Text style={styles.cityFlag}>{getDisplayCountryFlag(city.country_code)}</Text>
        <View style={styles.cityCopy}>
          <Text style={[styles.cityName, selected && styles.cityNameSelected]} numberOfLines={1}>{city.name}</Text>
          <Text style={styles.cityCountry} numberOfLines={1}>{getCityCountryLabel(city, s)}</Text>
        </View>
        {selected ? (
          <View style={styles.cityActionSelected}>
            <Lucide name="check" size={13} color="#FFFFFF" />
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

function CountryOption({
  label,
  flag,
  active,
  onPress,
  styles,
  colors,
}: {
  label: string;
  flag?: string;
  active: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
}) {
  return (
    <TouchableOpacity style={[styles.countryOption, active && styles.countryOptionActive]} onPress={onPress} activeOpacity={0.76}>
      <View style={[styles.countryOptionMark, active && styles.countryOptionMarkActive]}>
        <Text style={styles.countryOptionFlag}>{flag ?? getDisplayCountryFlag('ALL')}</Text>
      </View>
      <View style={styles.countryOptionCopy}>
        <Text style={[styles.countryOptionLabel, active && styles.countryOptionLabelActive]} numberOfLines={1}>{label}</Text>
      </View>
      {active ? <Lucide name="check" size={14} color={colors.primary} /> : null}
    </TouchableOpacity>
  );
}

function getCountryFlag(code: string | null | undefined): string {
  const flags: Record<string, string> = {
    ALL: '🇪🇺',
    RO: '🇷🇴',
    AT: '🇦🇹',
    DE: '🇩🇪',
    ES: '🇪🇸',
    CZ: '🇨🇿',
    PL: '🇵🇱',
    GB: '🇬🇧',
    FR: '🇫🇷',
    IT: '🇮🇹',
  };
  return flags[code ?? 'ALL'] ?? '🏓';
}

function CityMenuOption({
  city,
  selected,
  onPress,
  styles,
  colors,
  s,
}: {
  city: LocationCity;
  selected: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
  s: (key: string, ...args: string[]) => string;
}) {
  return (
    <TouchableOpacity style={[styles.cityMenuOption, selected && styles.cityMenuOptionSelected]} onPress={onPress} activeOpacity={0.76}>
      <Text style={styles.cityMenuFlag}>{getDisplayCountryFlag(city.country_code)}</Text>
      <View style={styles.cityMenuCopy}>
        <Text style={[styles.cityMenuName, selected && styles.cityMenuNameSelected]} numberOfLines={1}>{city.name}</Text>
        <Text style={styles.cityMenuMeta} numberOfLines={1}>{getCityCountryLabel(city, s)}</Text>
      </View>
      {selected ? <Lucide name="check" size={16} color={colors.primary} /> : <Lucide name="chevron-right" size={15} color={colors.textFaint} />}
    </TouchableOpacity>
  );
}

function getDisplayCountryFlag(code: string | null | undefined): string {
  void getCountryFlag;
  return getCountryFlagEmoji(code);
}

function getLaunchCities(cities: LocationCity[], cityVisitCounts: Record<number, number>): LocationCity[] {
  return [...cities]
    .sort((a, b) => {
      const visitDelta = (cityVisitCounts[b.id] ?? 0) - (cityVisitCounts[a.id] ?? 0);
      if (visitDelta !== 0) return visitDelta;
      return (b.venue_count ?? 0) - (a.venue_count ?? 0) || a.name.localeCompare(b.name);
    })
    .slice(0, 50);
}

function sortSearchCities(a: LocationCity, b: LocationCity, normalizedQuery: string, locale: string): number {
  const aName = normalizeSearch(a.name);
  const bName = normalizeSearch(b.name);
  const aStrong = aName.startsWith(normalizedQuery) ? 0 : 1;
  const bStrong = bName.startsWith(normalizedQuery) ? 0 : 1;
  if (aStrong !== bStrong) return aStrong - bStrong;
  if (aStrong === 0) {
    const venueDelta = (b.venue_count ?? 0) - (a.venue_count ?? 0);
    if (venueDelta !== 0) return venueDelta;
  }
  return a.name.localeCompare(b.name, locale);
}

function readCityVisitCounts(): Record<number, number> {
  try {
    const raw = getStringSync(CITY_VISIT_COUNTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([cityId, count]) => [Number(cityId), Number(count)])
        .filter(([cityId, count]) => Number.isFinite(cityId) && Number.isFinite(count)),
    );
  } catch {
    return {};
  }
}

function normalizeSearch(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('ro')
    .trim();
}

function getCitySearchText(city: LocationCity): string {
  return normalizeSearch([
    city.name,
    city.country_name,
    city.country_code,
    city.admin_area,
    city.local_area,
    city.county,
  ].filter(Boolean).join(' '));
}

function getCountryLabel(country: Country, s: (key: string, ...args: string[]) => string): string {
  const key = `country_${country.code}`;
  const label = s(key);
  return label === key ? country.name : label;
}

function getCityCountryLabel(city: LocationCity, s: (key: string, ...args: string[]) => string): string {
  return getCountryLabel({ code: city.country_code, name: city.country_name, active: true }, s);
}

function getLocalizedCitySupportLine(city: LocationCity, s: (key: string, ...args: string[]) => string): string {
  void getCitySupportLine;
  return `${getCityCountryLabel(city, s)} · ${getVenueCountLabel(city.venue_count ?? 0, s)}`;
}

function getVenueCountLabel(count: number, s: (key: string, ...args: string[]) => string): string {
  return count === 1 ? s('cityModalVenueCountOne') : s('cityModalVenueCount', String(count));
}

function getCitySupportLine(city: LocationCity, s: (key: string, ...args: string[]) => string): string {
  return `${city.country_name} · ${getVenueCountLabel(city.venue_count ?? 0, s)}`;
}

function getNearestCity(cities: LocationCity[], lat: number, lng: number): LocationCity | null {
  let best: { city: LocationCity; distance: number } | null = null;
  for (const city of cities) {
    if (city.lat == null || city.lng == null) continue;
    const distance = getDistanceKm(lat, lng, city.lat, city.lng);
    if (!best || distance < best.distance) best = { city, distance };
  }
  return best?.city ?? null;
}

function createStyles(colors: ThemeColors, isDark: boolean, mode: LocationSelectorMode, width: number) {
  const isWide = Platform.OS === 'web' && width >= 760;
  const isCompactWelcome = mode === 'welcome' && (width <= 520 || Platform.OS === 'web');
  const isSwitcher = mode === 'switcher';
  const welcomeInk = '#0F2F22';
  const welcomeMuted = '#537062';
  const welcomeSurface = '#F8FCF7';
  const welcomeCard = '#FFFFFF';
  const switcherSurface = isDark ? '#151a16' : '#F7FAF6';
  const switcherPanel = isDark ? '#1d231e' : '#FFFFFF';
  const switcherPanelAlt = isDark ? '#182219' : '#F1F8F2';
  const switcherBorder = isDark ? '#353e36' : '#DCE8DD';
  const switcherMutedBorder = isDark ? '#303833' : '#E1ECE2';
  const switcherText = isDark ? colors.text : welcomeInk;
  const switcherMutedText = isDark ? colors.textMuted : welcomeMuted;
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: mode === 'welcome' ? 'center' : 'flex-end',
      padding: mode === 'welcome' ? 0 : 0,
      backgroundColor: mode === 'welcome' ? '#EAF6EC' : colors.overlay,
    },
    dismissLayer: {
      flex: 1,
      alignSelf: 'stretch',
    },
    shell: {
      width: '100%',
      maxWidth: mode === 'welcome' ? (isWide ? 980 : '100%') : 480,
      maxHeight: mode === 'welcome' ? '100%' : '82%',
      minHeight: mode === 'welcome' ? '100%' : undefined,
      alignSelf: mode === 'welcome' ? 'center' : undefined,
      overflow: 'hidden',
      borderRadius: mode === 'welcome' ? (isWide ? 28 : 0) : 22,
      borderBottomLeftRadius: mode === 'switcher' ? 0 : mode === 'welcome' && !isWide ? 0 : Radius.xl,
      borderBottomRightRadius: mode === 'switcher' ? 0 : mode === 'welcome' && !isWide ? 0 : Radius.xl,
      backgroundColor: isSwitcher ? switcherSurface : welcomeSurface,
      ...Shadows.lg,
    },
    switcherHeader: {
      paddingTop: Spacing.xs,
      paddingHorizontal: Spacing.md,
      backgroundColor: switcherSurface,
    },
    handle: {
      alignSelf: 'center',
      width: 38,
      height: 4,
      borderRadius: 4,
      backgroundColor: isDark ? '#667066' : '#B8C9BC',
      marginBottom: Spacing.sm,
    },
    switcherTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: Spacing.sm,
    },
    closeBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#232923' : '#EAF1EA',
    },
    hero: {
      paddingTop: mode === 'welcome' ? (isCompactWelcome ? 22 : 34) : Spacing.md,
      paddingHorizontal: mode === 'welcome' ? (isCompactWelcome ? 18 : 30) : Spacing.md,
      paddingBottom: mode === 'welcome' ? (isCompactWelcome ? 18 : 26) : Spacing.md,
      minHeight: mode === 'welcome' ? (isCompactWelcome ? 190 : 250) : 150,
      justifyContent: 'center',
      gap: isCompactWelcome ? 8 : Spacing.sm,
    },
    heroTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: isCompactWelcome ? 8 : Spacing.sm,
    },
    heroIdentity: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: isCompactWelcome ? 8 : Spacing.sm,
      minWidth: 0,
      flex: 1,
    },
    heroBrand: {
      flexShrink: 0,
    },
    logoMark: {
      width: isCompactWelcome ? 30 : 38,
      height: isCompactWelcome ? 30 : 38,
      borderRadius: isCompactWelcome ? 8 : 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#ffffff22',
      borderWidth: 1,
      borderColor: '#ffffff35',
    },
    brand: {
      fontFamily: Fonts.heading,
      fontSize: isCompactWelcome ? FontSize.sm : FontSize.xl,
      fontWeight: FontWeight.bold,
      color: colors.textOnPrimary,
    },
    brandMeta: {
      marginTop: 1,
      fontFamily: Fonts.body,
      fontSize: 10,
      fontWeight: FontWeight.bold,
      color: colors.primary,
      textTransform: 'uppercase',
    },
    launchBadge: {
      minWidth: isCompactWelcome ? 50 : 74,
      minHeight: isCompactWelcome ? 30 : 38,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: '#BEE8C8',
      backgroundColor: '#FFFFFFAA',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 10,
    },
    launchBadgeValue: {
      fontFamily: Fonts.heading,
      fontSize: isCompactWelcome ? FontSize.sm : FontSize.lg,
      fontWeight: FontWeight.bold,
      color: colors.primary,
      lineHeight: isCompactWelcome ? 15 : 20,
    },
    launchBadgeLabel: {
      fontFamily: Fonts.body,
      fontSize: 9,
      fontWeight: FontWeight.bold,
      color: welcomeMuted,
      textTransform: 'uppercase',
    },
    eyebrow: {
      fontFamily: Fonts.body,
      fontSize: 11,
      fontWeight: FontWeight.bold,
      color: isSwitcher ? switcherMutedText : colors.textFaint,
      textTransform: 'uppercase',
    },
    eyebrowLight: {
      marginTop: mode === 'welcome' ? (isCompactWelcome ? 2 : Spacing.md) : Spacing.xs,
      fontFamily: Fonts.body,
      fontSize: isCompactWelcome ? 10 : 11,
      fontWeight: FontWeight.bold,
      color: '#d8f7e3',
      textTransform: 'uppercase',
      display: isCompactWelcome ? 'none' : 'flex',
    },
    heroTitle: {
      maxWidth: 640,
      fontFamily: Fonts.heading,
      fontSize: mode === 'welcome' ? (isCompactWelcome ? 28 : isWide ? 42 : 34) : 23,
      lineHeight: mode === 'welcome' ? (isCompactWelcome ? 32 : isWide ? 46 : 39) : 28,
      fontWeight: FontWeight.bold,
      color: mode === 'welcome' ? welcomeInk : colors.textOnPrimary,
    },
    heroBody: {
      maxWidth: 650,
      fontFamily: Fonts.body,
      fontSize: isCompactWelcome ? FontSize.md : FontSize.lg,
      lineHeight: isCompactWelcome ? 21 : 24,
      color: welcomeMuted,
    },
    heroSupport: {
      maxWidth: 620,
      fontFamily: Fonts.body,
      fontSize: isCompactWelcome ? FontSize.sm : FontSize.md,
      lineHeight: isCompactWelcome ? 18 : 21,
      color: '#6C8376',
    },
    heroStats: {
      flexDirection: 'row',
      gap: Spacing.xs,
      marginTop: Spacing.sm,
      flexWrap: 'wrap',
      display: isCompactWelcome ? 'none' : 'flex',
    },
    statPill: {
      minHeight: isCompactWelcome ? 34 : 38,
      borderRadius: 8,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 5,
      backgroundColor: '#ffffff18',
      borderWidth: 1,
      borderColor: '#ffffff24',
    },
    statValue: {
      fontFamily: Fonts.heading,
      fontSize: isCompactWelcome ? FontSize.md : FontSize.lg,
      fontWeight: FontWeight.bold,
      color: colors.textOnPrimary,
    },
    statLabel: {
      fontFamily: Fonts.body,
      fontSize: 10,
      color: '#d8f7e3',
      textTransform: 'uppercase',
    },
    content: {
      padding: mode === 'welcome' ? (isCompactWelcome ? 14 : 22) : 14,
      gap: isSwitcher ? 10 : isCompactWelcome ? 10 : Spacing.md,
    },
    switcherTitle: {
      marginTop: 2,
      fontFamily: Fonts.heading,
      fontSize: FontSize.xl,
      fontWeight: FontWeight.bold,
      color: switcherText,
    },
    switcherSubtitle: {
      marginTop: 2,
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      color: switcherMutedText,
    },
    activeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: isSwitcher ? 10 : Spacing.sm,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isSwitcher ? switcherBorder : colors.primaryDim,
      backgroundColor: isSwitcher ? switcherPanelAlt : isDark ? '#062813' : colors.primaryPale,
      padding: isSwitcher ? 12 : isCompactWelcome ? 10 : Spacing.md,
      ...(!isSwitcher ? Shadows.sm : {}),
    },
    activeIcon: {
      width: isSwitcher ? 34 : isCompactWelcome ? 34 : 40,
      height: isSwitcher ? 34 : isCompactWelcome ? 34 : 40,
      borderRadius: isSwitcher ? 9 : isCompactWelcome ? 8 : 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    activeCopy: {
      flex: 1,
      minWidth: 0,
    },
    activeLabel: {
      fontFamily: Fonts.body,
      fontSize: isSwitcher ? 9 : isCompactWelcome ? 10 : 11,
      fontWeight: FontWeight.bold,
      color: isSwitcher ? colors.primary : colors.primary,
      textTransform: 'uppercase',
    },
    activeTitle: {
      marginTop: 2,
      fontFamily: Fonts.heading,
      fontSize: isSwitcher ? FontSize.lg : isCompactWelcome ? FontSize.md : FontSize.xl,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    activeMeta: {
      marginTop: 2,
      fontFamily: Fonts.body,
      fontSize: isSwitcher ? FontSize.xs : isCompactWelcome ? FontSize.xs : FontSize.sm,
      color: colors.textMuted,
    },
    activeSelectedMark: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    searchBox: {
      minHeight: isSwitcher ? 44 : isCompactWelcome ? 40 : 46,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isSwitcher ? switcherBorder : '#D6E6D8',
      backgroundColor: isSwitcher ? switcherPanel : welcomeCard,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingHorizontal: Spacing.md,
      ...(!isSwitcher ? Shadows.sm : {}),
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.text,
      paddingVertical: Spacing.xs,
    },
    scopeWrap: {
      gap: Spacing.xs,
    },
    scopeButton: {
      minHeight: isSwitcher ? 42 : isCompactWelcome ? 38 : 42,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isSwitcher ? switcherBorder : '#D6E6D8',
      backgroundColor: isSwitcher ? switcherPanel : welcomeCard,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingHorizontal: Spacing.sm,
    },
    scopeIcon: {
      width: isSwitcher ? 28 : 32,
      height: isSwitcher ? 24 : 28,
      borderRadius: 7,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isSwitcher ? (isDark ? '#092d16' : '#EAF8EE') : colors.primaryPale,
    },
    scopeFlag: {
      fontFamily: Fonts.body,
      fontSize: isSwitcher ? 15 : 16,
      lineHeight: isSwitcher ? 18 : 20,
    },
    scopeCopy: {
      flex: 1,
      minWidth: 0,
    },
    scopeLabel: {
      fontFamily: Fonts.body,
      fontSize: 10,
      fontWeight: FontWeight.bold,
      color: colors.textFaint,
      textTransform: 'uppercase',
    },
    scopeValue: {
      marginTop: 1,
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    scopeMeta: {
      maxWidth: 112,
      fontFamily: Fonts.body,
      fontSize: 11,
      color: colors.textFaint,
      textAlign: 'right',
    },
    countryPanel: {
      gap: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isSwitcher ? switcherBorder : '#D6E6D8',
      backgroundColor: isSwitcher ? switcherPanel : welcomeCard,
      padding: 6,
      ...(!isSwitcher ? Shadows.sm : {}),
    },
    countryOptionsScroll: {
      maxHeight: isSwitcher ? 190 : 230,
      flexGrow: 0,
    },
    countryOptionsContent: {
      paddingBottom: 2,
    },
    countryPanelDivider: {
      height: 1,
      alignSelf: 'stretch',
      backgroundColor: isSwitcher ? switcherMutedBorder : '#E1ECE2',
      marginVertical: 4,
    },
    countryPanelLabel: {
      fontFamily: Fonts.body,
      fontSize: 10,
      fontWeight: FontWeight.bold,
      color: colors.textFaint,
      textTransform: 'uppercase',
      paddingHorizontal: 9,
      paddingTop: 2,
      paddingBottom: 2,
    },
    countryPill: {
      minHeight: isCompactWelcome ? 30 : 36,
      justifyContent: 'center',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.bgMuted,
      paddingHorizontal: isCompactWelcome ? Spacing.sm : Spacing.md,
    },
    countryPillActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    countryPillText: {
      fontFamily: Fonts.body,
      fontSize: isCompactWelcome ? FontSize.xs : FontSize.sm,
      fontWeight: FontWeight.semibold,
      color: colors.textMuted,
    },
    countryPillTextActive: {
      color: colors.textOnPrimary,
    },
    countryOption: {
      minHeight: 38,
      borderRadius: 7,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      paddingHorizontal: 9,
      backgroundColor: 'transparent',
    },
    countryOptionActive: {
      backgroundColor: isDark ? '#203225' : '#EDF8EF',
    },
    countryOptionMark: {
      width: 26,
      height: 22,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: isDark ? '#3d493f' : '#DCE8DD',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#111611' : '#F7FAF6',
    },
    countryOptionMarkActive: {
      backgroundColor: isDark ? '#0B2A15' : '#EAF8EE',
      borderColor: colors.primary,
    },
    countryOptionFlag: {
      fontFamily: Fonts.body,
      fontSize: 14,
      lineHeight: 17,
    },
    countryOptionCopy: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    countryOptionLabel: {
      flex: 1,
      minWidth: 0,
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.semibold,
      color: switcherMutedText,
    },
    countryOptionLabelActive: {
      color: switcherText,
    },
    cityMenuOption: {
      minHeight: 44,
      borderRadius: 7,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      paddingHorizontal: 9,
      backgroundColor: 'transparent',
    },
    cityMenuOptionSelected: {
      backgroundColor: isDark ? '#203225' : '#EDF8EF',
    },
    cityMenuFlag: {
      width: 26,
      textAlign: 'center',
      fontFamily: Fonts.body,
      fontSize: 15,
      lineHeight: 18,
    },
    cityMenuCopy: {
      flex: 1,
      minWidth: 0,
    },
    cityMenuName: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.bold,
      color: switcherText,
    },
    cityMenuNameSelected: {
      color: isDark ? colors.primaryLight : colors.primary,
    },
    cityMenuMeta: {
      marginTop: 1,
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      color: isDark ? colors.textFaint : welcomeMuted,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
    },
    sectionTitle: {
      fontFamily: Fonts.heading,
      fontSize: isCompactWelcome ? FontSize.lg : FontSize.xl,
      fontWeight: FontWeight.bold,
      color: isSwitcher ? switcherText : welcomeInk,
      textAlign: 'center',
    },
    sectionMeta: {
      marginTop: 1,
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      color: isSwitcher ? switcherMutedText : welcomeMuted,
    },
    locateMiniBtn: {
      minHeight: 34,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.primaryDim,
      backgroundColor: colors.bgAlt,
      paddingHorizontal: Spacing.sm,
      maxWidth: isCompactWelcome ? 150 : undefined,
    },
    locateMiniText: {
      fontFamily: Fonts.body,
      fontSize: isCompactWelcome ? FontSize.xs : FontSize.sm,
      fontWeight: FontWeight.bold,
      color: colors.primary,
    },
    hintText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      color: colors.textMuted,
    },
    loader: {
      minHeight: 160,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyPanel: {
      minHeight: 140,
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.bgMuted,
    },
    emptyTitle: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.textMuted,
    },
    cityList: {
      flexGrow: 0,
      maxHeight: mode === 'welcome' ? (isCompactWelcome ? 340 : 410) : 360,
    },
    cityListContent: {
      flexDirection: 'column',
      flexWrap: 'nowrap',
      gap: isSwitcher ? 5 : 6,
      paddingBottom: 2,
    },
    cityCard: {
      width: '100%',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isSwitcher ? switcherMutedBorder : '#DCE8DD',
      backgroundColor: isSwitcher ? switcherPanel : welcomeCard,
      paddingVertical: isSwitcher ? 8 : isCompactWelcome ? 10 : 12,
      paddingHorizontal: isSwitcher ? 10 : isCompactWelcome ? 12 : 14,
      ...(!isSwitcher ? Shadows.sm : {}),
    },
    cityCardSelected: {
      borderColor: colors.primary,
      backgroundColor: isSwitcher ? '#062813' : '#EFFAF1',
      ...Shadows.md,
    },
    cityCardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
    },
    cityFlag: {
      width: 28,
      textAlign: 'center',
      fontFamily: Fonts.body,
      fontSize: 17,
      lineHeight: 20,
    },
    cityCopy: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 8,
    },
    cityName: {
      fontFamily: Fonts.heading,
      fontSize: isSwitcher ? FontSize.md : isCompactWelcome ? FontSize.md : FontSize.lg,
      fontWeight: FontWeight.bold,
      color: isSwitcher ? colors.text : welcomeInk,
      flexShrink: 1,
    },
    cityNameSelected: {
      color: colors.primary,
    },
    cityCountry: {
      flexShrink: 0,
      fontFamily: Fonts.body,
      fontSize: isSwitcher ? FontSize.xs : FontSize.sm,
      color: isSwitcher ? colors.textMuted : welcomeMuted,
    },
    cityMetaRow: {
      marginTop: 2,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      minWidth: 0,
    },
    cityMetaDot: {
      fontFamily: Fonts.body,
      fontSize: isSwitcher ? FontSize.xs : FontSize.sm,
      color: colors.textFaint,
    },
    cityVenueCount: {
      flexShrink: 1,
      fontFamily: Fonts.body,
      fontSize: isSwitcher ? FontSize.xs : FontSize.sm,
      color: isSwitcher ? colors.textMuted : welcomeMuted,
    },
    cityAction: {
      minHeight: isSwitcher || isCompactWelcome ? 26 : 30,
      justifyContent: 'center',
      borderRadius: 8,
      backgroundColor: colors.bgMuted,
      paddingHorizontal: Spacing.sm,
    },
    cityActionSelected: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    cityActionText: {
      fontFamily: Fonts.body,
      fontSize: isSwitcher || isCompactWelcome ? FontSize.xs : FontSize.sm,
      fontWeight: FontWeight.bold,
      color: colors.primary,
    },
    cityActionTextSelected: {
      color: colors.textOnPrimary,
    },
    welcomeFooter: {
      gap: 10,
      paddingTop: 2,
    },
    selectedPreview: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#CAE7D1',
      backgroundColor: '#FFFFFF',
      paddingVertical: 10,
      paddingHorizontal: 12,
      ...Shadows.sm,
    },
    selectedPreviewIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#EAF8EE',
    },
    selectedPreviewCopy: {
      flex: 1,
      minWidth: 0,
    },
    selectedPreviewLabel: {
      fontFamily: Fonts.body,
      fontSize: 10,
      fontWeight: FontWeight.bold,
      color: colors.primary,
      textTransform: 'uppercase',
    },
    selectedPreviewTitle: {
      marginTop: 1,
      fontFamily: Fonts.heading,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.bold,
      color: welcomeInk,
    },
    selectedPreviewMeta: {
      marginTop: 1,
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      color: welcomeMuted,
    },
    primaryButton: {
      minHeight: isCompactWelcome ? 42 : 52,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      backgroundColor: colors.primary,
      ...Shadows.md,
    },
    primaryButtonDisabled: {
      opacity: 0.5,
    },
    primaryButtonText: {
      fontFamily: Fonts.body,
      fontSize: isCompactWelcome ? FontSize.md : FontSize.lg,
      fontWeight: FontWeight.bold,
      color: colors.textOnPrimary,
    },
  });
}

function createPillStyles(colors: ThemeColors, isDark: boolean, compact: boolean) {
  return StyleSheet.create({
    pill: {
      maxWidth: compact ? 164 : 238,
      minHeight: compact ? 32 : 36,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: isDark ? '#ffffff18' : '#ffffff35',
      backgroundColor: isDark ? '#ffffff0f' : '#ffffff24',
      paddingHorizontal: compact ? 9 : 12,
      paddingVertical: 6,
      ...Shadows.sm,
    },
    city: {
      minWidth: 0,
      flexShrink: 1,
      fontFamily: Fonts.body,
      fontSize: compact ? FontSize.sm : FontSize.base,
      fontWeight: FontWeight.bold,
      color: isDark ? colors.text : colors.textOnPrimary,
    },
  });
}
