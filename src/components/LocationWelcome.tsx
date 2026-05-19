import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import type { Lang } from '../contexts/I18nProvider';
import { useI18n } from '../hooks/useI18n';
import { useSelectedLocation } from '../hooks/useSelectedLocation';
import { useTheme } from '../hooks/useTheme';
import { getStringSync } from '../lib/mmkv';
import { foldDiacritics } from '../lib/textSearch';
import { getCountryFlagEmoji } from '../lib/locationHelpers';
import type { Country, LocationCity } from '../lib/locationTypes';
import { Fonts, FontSize, FontWeight, Spacing, type ThemeColors } from '../theme';

interface LocationWelcomeProps {
  visible: boolean;
}

const ALL_COUNTRIES: Country = { code: 'ALL', name: 'Europe', active: true };
const CITY_VISIT_COUNTS_KEY = 'location_city_visit_counts';

export function LocationWelcome({ visible }: LocationWelcomeProps) {
  const { s, lang, setLang } = useI18n();
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const {
    activeCountries,
    activeCities,
    loadingCities,
    setSelectedCity,
    completeInitialLocationSetup,
  } = useSelectedLocation();
  const styles = useMemo(() => createStyles(colors, isDark, width), [colors, isDark, width]);
  const [query, setQuery] = useState('');
  const [pendingCountry, setPendingCountry] = useState<Country>(ALL_COUNTRIES);
  const [countryPanelOpen, setCountryPanelOpen] = useState(false);
  const normalizedQuery = normalizeLocationText(query.trim());
  const heroTitle = s('locationWelcomeHeroTitle');
  const cityVisitCounts = useMemo(() => readCityVisitCounts(), []);
  const selectedCountryLabel = pendingCountry.code === 'ALL'
    ? s('locationSelectorAllCountries')
    : getCountryLabel(pendingCountry, s);
  const countriesWithCities = useMemo(
    () => activeCountries
      .filter((country) => activeCities.some((city) => city.country_code === country.code))
      .sort((a, b) => getCountryLabel(a, s).localeCompare(getCountryLabel(b, s), lang)),
    [activeCities, activeCountries, lang, s],
  );

  const cities = useMemo(() => {
    const source = activeCities.filter(
      (city) => city.expansion_status !== 'hidden' && (pendingCountry.code === 'ALL' || city.country_code === pendingCountry.code),
    );
    const filtered = normalizedQuery
      ? source.filter((city) => normalizeLocationText(`${city.name} ${city.country_name}`).includes(normalizedQuery))
      : source;

    return [...filtered].sort((a, b) => sortLocationCities(a, b, normalizedQuery, cityVisitCounts, lang));
  }, [activeCities, cityVisitCounts, lang, normalizedQuery, pendingCountry.code]);

  const [pendingCityId, setPendingCityId] = useState<number | null>(null);
  const pendingCity = cities.find((city) => city.id === pendingCityId) ?? cities[0] ?? null;

  const chooseCountry = (country: Country | 'ALL') => {
    setPendingCountry(country === 'ALL' ? ALL_COUNTRIES : country);
    setPendingCityId(null);
    setCountryPanelOpen(false);
  };

  const applyCity = () => {
    if (!pendingCity) return;
    setSelectedCity(pendingCity);
    completeInitialLocationSetup();
  };

  if (!visible) return null;

  return (
    <LinearGradient
      colors={isDark ? ['#07130d', '#0e2216', '#14281b'] : ['#F8FFF8', '#EEF9EF', '#DDF2E2']}
      start={{ x: 0.08, y: 0 }}
      end={{ x: 0.96, y: 1 }}
      style={styles.screen}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <BrandLockup
              color={isDark ? colors.textOnPrimary : colors.primary}
              pinWidth={20}
              wordmarkSize={17}
              gap={6}
              style={styles.brandLockup}
            />
            <LanguageSelector lang={lang} setLang={setLang} styles={styles} />
          </View>
          <Text style={styles.title} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.86}>
            {heroTitle}
          </Text>
        </View>

        <View style={styles.searchBox}>
          <Lucide name="search" size={18} color={colors.textFaint} />
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
              <Lucide name="x-circle" size={18} color={colors.textFaint} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.scopeWrap}>
          <TouchableOpacity
            style={styles.scopeButton}
            onPress={() => setCountryPanelOpen((open) => !open)}
            activeOpacity={0.78}
          >
            <View style={styles.scopeIcon}>
              <Text style={styles.scopeFlag}>{getCountryFlag(pendingCountry.code)}</Text>
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
                  flag={getCountryFlag('ALL')}
                  active={pendingCountry.code === 'ALL'}
                  onPress={() => chooseCountry('ALL')}
                  styles={styles}
                  colors={colors}
                />
                {countriesWithCities.map((country) => (
                  <CountryOption
                    key={country.code}
                    label={getCountryLabel(country, s)}
                    flag={getCountryFlag(country.code)}
                    active={pendingCountry.code === country.code}
                    onPress={() => chooseCountry(country)}
                    styles={styles}
                    colors={colors}
                  />
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>

        {!normalizedQuery ? (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{s('locationSelectorFeaturedCities')}</Text>
          </View>
        ) : null}

        {loadingCities && cities.length === 0 ? (
          <View style={styles.loader}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <View style={styles.cityGrid}>
            {cities.map((city) => (
              <WelcomeCityCard
                key={city.id}
                city={city}
                selected={pendingCity?.id === city.id}
                onPress={() => setPendingCityId(city.id)}
                styles={styles}
                s={s}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.selectedCopy}>
          <Text style={styles.selectedLabel}>{s('locationSelectorSelectedCity')}</Text>
          <Text style={styles.selectedTitle} numberOfLines={1}>
            {pendingCity ? pendingCity.name : s('initialLocationChooseCity')}
          </Text>
          {pendingCity ? <Text style={styles.selectedMeta} numberOfLines={1}>{getCityCountryLabel(pendingCity, s)}</Text> : null}
        </View>
        <TouchableOpacity
          style={[styles.cta, !pendingCity && styles.ctaDisabled]}
          onPress={applyCity}
          disabled={!pendingCity}
          activeOpacity={0.86}
        >
          <Text style={styles.ctaText}>
            {pendingCity ? s('locationSelectorExploreCity', pendingCity.name) : s('initialLocationChooseCity')}
          </Text>
          <Lucide name="arrow-right" size={18} color={colors.textOnPrimary} />
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

function WelcomeCityCard({
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
    <TouchableOpacity
      style={[styles.cityCard, selected && styles.cityCardSelected]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.cityCardTop}>
        <Text style={styles.cityFlag}>{getCountryFlag(city.country_code)}</Text>
        <View style={styles.cityCopy}>
        <Text style={[styles.cityName, selected && styles.cityNameSelected]} numberOfLines={1}>
          {city.name}
        </Text>
          <Text style={styles.cityMeta} numberOfLines={1}>{getCityCountryLabel(city, s)}</Text>
        </View>
        {selected ? (
          <View style={styles.checkSelected}>
            <Lucide name="check" size={13} color="#FFFFFF" />
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

function normalizeLocationText(value: string): string {
  return foldDiacritics(value).toLowerCase();
}

function LanguageSelector({
  lang,
  setLang,
  styles,
}: {
  lang: Lang;
  setLang: (lang: Lang) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.languageSwitch} accessibilityLabel="Language">
      {(['ro', 'en'] as Lang[]).map((option) => {
        const active = lang === option;
        return (
          <TouchableOpacity
            key={option}
            style={[styles.languageOption, active && styles.languageOptionActive]}
            onPress={() => setLang(option)}
            activeOpacity={0.78}
          >
            <Text style={[styles.languageText, active && styles.languageTextActive]}>
              {option.toUpperCase()}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
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

function sortLocationCities(
  a: LocationCity,
  b: LocationCity,
  normalizedQuery: string,
  cityVisitCounts: Record<number, number>,
  locale: string,
): number {
  if (!normalizedQuery) {
    const visitDelta = (cityVisitCounts[b.id] ?? 0) - (cityVisitCounts[a.id] ?? 0);
    if (visitDelta !== 0) return visitDelta;
    const venueDelta = (b.venue_count ?? 0) - (a.venue_count ?? 0);
    if (venueDelta !== 0) return venueDelta;
    return a.name.localeCompare(b.name, locale);
  }

  const aName = normalizeLocationText(a.name);
  const bName = normalizeLocationText(b.name);
  const aStrong = aName.startsWith(normalizedQuery) ? 0 : 1;
  const bStrong = bName.startsWith(normalizedQuery) ? 0 : 1;
  if (aStrong !== bStrong) return aStrong - bStrong;
  if (aStrong === 0) {
    const venueDelta = (b.venue_count ?? 0) - (a.venue_count ?? 0);
    if (venueDelta !== 0) return venueDelta;
  }
  return a.name.localeCompare(b.name, locale);
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
  flag: string;
  active: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
}) {
  return (
    <TouchableOpacity style={[styles.countryOption, active && styles.countryOptionActive]} onPress={onPress} activeOpacity={0.76}>
      <View style={[styles.countryOptionMark, active && styles.countryOptionMarkActive]}>
        <Text style={styles.countryOptionFlag}>{flag}</Text>
      </View>
      <Text style={[styles.countryOptionLabel, active && styles.countryOptionLabelActive]} numberOfLines={1}>{label}</Text>
      {active ? <Lucide name="check" size={14} color={colors.primary} /> : null}
    </TouchableOpacity>
  );
}

function getCountryFlag(code: string | null | undefined): string {
  return getCountryFlagEmoji(code);
}

function getCountryLabel(country: Country, s: (key: string, ...args: string[]) => string): string {
  const key = `country_${country.code}`;
  const label = s(key);
  return label === key ? country.name : label;
}

function getCityCountryLabel(city: LocationCity, s: (key: string, ...args: string[]) => string): string {
  return getCountryLabel({ code: city.country_code, name: city.country_name, active: true }, s);
}

function createStyles(colors: ThemeColors, isDark: boolean, width: number) {
  const layoutWidth = Math.min(width, 430);
  const isWide = layoutWidth >= 720;
  const ink = isDark ? colors.text : '#0F2F22';
  const muted = isDark ? colors.textMuted : '#537062';
  const card = isDark ? '#172018' : '#FFFFFF';
  const border = isDark ? '#303833' : '#DCE8DD';
  const selectedCard = isDark ? '#0A2A16' : '#EFFAF1';

  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    scroll: {
      flex: 1,
    },
    content: {
      paddingHorizontal: isWide ? 28 : 18,
      paddingTop: isWide ? 28 : 20,
      paddingBottom: 116,
      gap: 10,
    },
    hero: {
      alignItems: 'center',
      gap: 7,
    },
    heroTop: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    brandLockup: {
      flexShrink: 1,
    },
    languageSwitch: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 999,
      borderWidth: 1,
      borderColor: border,
      backgroundColor: isDark ? '#111b13' : '#FFFFFFB8',
      padding: 2,
    },
    languageOption: {
      minWidth: 32,
      minHeight: 26,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    languageOptionActive: {
      backgroundColor: colors.primary,
    },
    languageText: {
      fontFamily: Fonts.body,
      fontSize: 11,
      fontWeight: FontWeight.bold,
      color: muted,
    },
    languageTextActive: {
      color: colors.textOnPrimary,
    },
    title: {
      maxWidth: 356,
      fontFamily: Fonts.heading,
      fontSize: isWide ? 28 : 22,
      lineHeight: isWide ? 32 : 27,
      fontWeight: FontWeight.bold,
      color: ink,
      marginTop: isWide ? 12 : 10,
      paddingHorizontal: 4,
      textAlign: 'center',
    },
    searchBox: {
      minHeight: 44,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: border,
      backgroundColor: card,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingHorizontal: Spacing.md,
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: ink,
      paddingVertical: Spacing.xs,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      marginTop: 2,
    },
    sectionTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.bold,
      color: ink,
      textAlign: 'center',
    },
    scopeWrap: {
      gap: Spacing.xs,
    },
    scopeButton: {
      minHeight: 42,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: border,
      backgroundColor: card,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingHorizontal: Spacing.sm,
    },
    scopeIcon: {
      width: 32,
      height: 28,
      borderRadius: 7,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#0B2A15' : '#EAF8EE',
    },
    scopeFlag: {
      fontFamily: Fonts.body,
      fontSize: 16,
      lineHeight: 20,
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
      color: ink,
    },
    countryPanel: {
      borderRadius: 9,
      borderWidth: 1,
      borderColor: border,
      backgroundColor: card,
      padding: 6,
    },
    countryOptionsScroll: {
      maxHeight: 184,
      flexGrow: 0,
    },
    countryOptionsContent: {
      paddingBottom: 2,
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
      borderColor: border,
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
    countryOptionLabel: {
      flex: 1,
      minWidth: 0,
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.semibold,
      color: muted,
    },
    countryOptionLabelActive: {
      color: ink,
    },
    loader: {
      minHeight: 180,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cityGrid: {
      flexDirection: 'column',
      flexWrap: 'nowrap',
      gap: 5,
    },
    cityCard: {
      width: '100%',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: border,
      backgroundColor: card,
      paddingVertical: 8,
      paddingHorizontal: 10,
    },
    cityCardSelected: {
      borderColor: colors.primary,
      backgroundColor: selectedCard,
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
      fontSize: FontSize.md,
      fontWeight: FontWeight.bold,
      color: ink,
      flexShrink: 1,
    },
    cityNameSelected: {
      color: colors.primary,
    },
    cityMeta: {
      flexShrink: 0,
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      color: muted,
    },
    checkSelected: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    footer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: isWide ? 'row' : 'column',
      alignItems: isWide ? 'center' : 'stretch',
      gap: 10,
      borderTopWidth: 1,
      borderTopColor: border,
      backgroundColor: isDark ? '#101711F2' : '#FFFFFFF2',
      paddingHorizontal: isWide ? 30 : 18,
      paddingTop: 10,
      paddingBottom: 18,
    },
    selectedCopy: {
      flex: 1,
      minWidth: 0,
    },
    selectedLabel: {
      fontFamily: Fonts.body,
      fontSize: 10,
      fontWeight: FontWeight.bold,
      color: colors.primary,
      textTransform: 'uppercase',
    },
    selectedTitle: {
      marginTop: 2,
      fontFamily: Fonts.heading,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.bold,
      color: ink,
    },
    selectedMeta: {
      marginTop: 1,
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      color: muted,
    },
    cta: {
      minHeight: 44,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      backgroundColor: colors.primary,
      paddingHorizontal: 18,
    },
    ctaDisabled: {
      opacity: 0.5,
    },
    ctaText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.bold,
      color: colors.textOnPrimary,
    },
  });
}
