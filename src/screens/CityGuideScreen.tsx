// F015: public city guide for traveling players. Renders for logged-out web
// visitors (the /city/[id] route is outside the auth group). Aggregates only
// public data via get_city_guide (migration 111).
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { Lucide } from '../components/Icon';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../hooks/useI18n';
import { getDateLocale } from '../contexts/I18nProvider';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius } from '../theme';
import { useCityGuideQuery } from '../hooks/queries/useCityGuideQuery';
import type { CityGuideVenue } from '../services/cityGuide';

interface Props {
  cityId?: string;
}

export function CityGuideScreen({ cityId }: Props) {
  const router = useRouter();
  const { colors } = useTheme();
  const { s, lang } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dateLocale = getDateLocale(lang);

  const idNum = cityId && !isNaN(Number(cityId)) ? Number(cityId) : undefined;
  const { data: guide, isLoading, isError } = useCityGuideQuery(idNum);

  if (isLoading && !guide) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isError || !guide) {
    return (
      <View style={[styles.container, styles.center]}>
        <Lucide name="map-pin" size={28} color={colors.textFaint} />
        <Text style={styles.muted}>{s('cityGuideNotFound')}</Text>
      </View>
    );
  }

  const openVenue = (id: number) =>
    router.push({ pathname: '/venue/[id]', params: { id: String(id) } });

  const renderVenueList = (titleKey: string, icon: string, venues: CityGuideVenue[]) => {
    if (!venues || venues.length === 0) return null;
    return (
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <Lucide name={icon} size={16} color={colors.primaryMid} />
          <Text style={styles.sectionTitle}>{s(titleKey)}</Text>
        </View>
        {venues.map((v) => (
          <TouchableOpacity
            key={v.id}
            style={styles.venueCard}
            onPress={() => openVenue(v.id)}
            accessibilityRole="button"
            testID={`city-guide-venue-${v.id}`}
          >
            <Text style={styles.venueName} numberOfLines={1}>{v.name}</Text>
            {v.avg_rating > 0 ? (
              <Text style={styles.venueRating}>{`★ ${v.avg_rating.toFixed(1)}`}</Text>
            ) : null}
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const ogDescription = s('cityGuideOgDescription', guide.city.name);
  const ogTitle = `${s('cityGuideTagline', guide.city.name)} | TTPortal`;

  return (
    <SafeAreaView style={styles.container}>
      {/* SEO / OG — doubles the public guide as an acquisition surface (F015). */}
      <Head>
        <title>{ogTitle}</title>
        <meta name="description" content={ogDescription} />
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={ogDescription} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={ogTitle} />
        <meta name="twitter:description" content={ogDescription} />
      </Head>
      <ScrollView contentContainerStyle={{ paddingBottom: Spacing.xxl }}>
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>{guide.city.name}</Text>
          <Text style={styles.heroTagline}>{s('cityGuideTagline', guide.city.name)}</Text>
          <View style={styles.heroStat}>
            <Lucide name="map-pin" size={14} color={colors.textOnPrimary} />
            <Text style={styles.heroStatText}>{s('cityGuideVenuesCount', String(guide.venue_count))}</Text>
          </View>
        </View>

        {renderVenueList('cityGuideOutdoor', 'activity', guide.outdoor)}
        {renderVenueList('cityGuideIndoor', 'building-2', guide.indoor)}
        {renderVenueList('cityGuideFree', 'check-circle', guide.free_access)}

        {/* This week */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Lucide name="calendar" size={16} color={colors.accent} />
            <Text style={styles.sectionTitle}>{s('cityGuideEvents')}</Text>
          </View>
          {guide.events.length === 0 ? (
            <Text style={styles.muted}>{s('cityGuideEmptyEvents')}</Text>
          ) : (
            guide.events.map((e) => (
              <View key={e.id} style={styles.eventCard} testID={`city-guide-event-${e.id}`}>
                <Text style={styles.eventTitle} numberOfLines={1}>{e.title}</Text>
                <Text style={styles.eventMeta} numberOfLines={1}>
                  {new Date(e.starts_at).toLocaleDateString(dateLocale, { weekday: 'short', day: 'numeric', month: 'short' })}
                  {e.venue_name ? ` · ${e.venue_name}` : ''}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    center: { alignItems: 'center', justifyContent: 'center', gap: 10 },
    muted: { fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.textMuted },
    hero: {
      backgroundColor: colors.primary,
      padding: Spacing.lg,
      gap: 6,
    },
    heroTitle: { fontFamily: Fonts.heading, fontSize: FontSize.xxxl, fontWeight: FontWeight.bold, color: colors.textOnPrimary },
    heroTagline: { fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.textOnPrimary, opacity: 0.85 },
    heroStat: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
    heroStatText: { fontFamily: Fonts.body, fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: colors.textOnPrimary },
    section: { padding: Spacing.md, gap: 8 },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    sectionTitle: { fontFamily: Fonts.body, fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: colors.text },
    venueCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.bgAlt,
      borderRadius: Radius.md,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    venueName: { flex: 1, fontFamily: Fonts.body, fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: colors.text },
    venueRating: { fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.accent, marginLeft: 8 },
    eventCard: {
      backgroundColor: colors.bgAlt,
      borderRadius: Radius.md,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: colors.borderLight,
      gap: 2,
    },
    eventTitle: { fontFamily: Fonts.body, fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: colors.text },
    eventMeta: { fontFamily: Fonts.body, fontSize: FontSize.sm, color: colors.textMuted },
  });
}
