// F013: the venue-screen "weather hero" — a playability banner + forecast
// timeline. Weather (wind + rain) is the #1 play/no-play decision factor for
// outdoor venues, so this is the screen's hero block. Richer sibling of
// WeatherChip (which stays for compact/event use). Self-contained: fetches via
// useWeatherQuery and renders nothing until data is in (never blocks the screen).
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Lucide } from './Icon';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../hooks/useI18n';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Radius, Spacing } from '../theme';
import { useWeatherQuery } from '../features/weather';
import { rainHourLabel, isWindy, weatherCodeIcon, weatherCodeIsWet } from '../lib/weatherDisplay';

interface Props {
  lat: number | null | undefined;
  lng: number | null | undefined;
  /** Gate on the surface being outdoor — the caller decides. */
  enabled?: boolean;
}

const FORECAST_COLS = 6;
const WET_PCT = 50; // precip probability at/above which an hour reads "wet"
const hourLabel = (iso: string) => iso.slice(11, 16); // "..T15:00" -> "15:00"

type Verdict = 'good' | 'windy' | 'wet';

export function WeatherHero({ lat, lng, enabled = true }: Props) {
  const { colors } = useTheme();
  const { s } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data } = useWeatherQuery(lat, lng, enabled);

  const hours = useMemo(() => (data?.hourly ?? []).slice(0, FORECAST_COLS), [data]);

  // Leading run of dry, low-precip hours = the "good window" (highlighted).
  const goodWindow = useMemo(() => {
    let n = 0;
    for (const h of hours) {
      const wet = weatherCodeIsWet(h.weather_code) || (h.precipitation_probability ?? 0) >= WET_PCT;
      if (wet) break;
      n++;
    }
    return n;
  }, [hours]);

  if (!data || data.temp_c == null) return null;

  const windy = isWindy(data.wind_kmh);
  const wetNow = data.raining_now || weatherCodeIsWet(data.weather_code);
  const verdict: Verdict = wetNow ? 'wet' : windy ? 'windy' : 'good';

  const tone =
    verdict === 'good' ? colors.primaryLight : verdict === 'windy' ? colors.amber : colors.blue;
  const tonePale =
    verdict === 'good' ? colors.primaryPale : verdict === 'windy' ? colors.amberPale : colors.bluePale;

  const kicker =
    verdict === 'good'
      ? s('weatherHeroGoodKicker')
      : verdict === 'windy'
        ? s('weatherHeroWindyKicker')
        : s('weatherHeroWetKicker');
  const headline =
    verdict === 'good'
      ? s('weatherHeroGood')
      : verdict === 'windy'
        ? s('weatherHeroWindy')
        : s('weatherHeroWet');

  const rainLabel = rainHourLabel(data.rain_at);
  const sub =
    verdict === 'wet'
      ? s('weatherHeroWetSub')
      : verdict === 'windy'
        ? s('weatherHeroWindySub')
        : rainLabel
          ? `${s('weatherHeroDryCalm')} · ${s('weatherHeroRainBy', rainLabel)}`
          : s('weatherHeroDryCalm');

  const windChipSuffix = windy ? s('weatherHeroBreezy') : s('weatherHeroCalm');
  const bestWindow =
    goodWindow > 0
      ? s('weatherHeroBest', hourLabel(hours[goodWindow - 1].time))
      : s('weatherHeroRainSoon');

  return (
    <View style={styles.card} testID="weather-hero">
      {/* ── Banner: verdict (left) · current readout (right) ── */}
      <View style={styles.banner}>
        <View style={[styles.orb, { backgroundColor: tonePale, borderColor: tone }]}>
          <Lucide name={weatherCodeIcon(data.weather_code)} size={24} color={tone} />
        </View>
        <View style={styles.verdict}>
          <View style={styles.kickerRow}>
            <View style={[styles.dot, { backgroundColor: tone }]} />
            <Text style={[styles.kicker, { color: tone }]} numberOfLines={1}>{kicker}</Text>
          </View>
          <Text style={styles.headline} numberOfLines={1} adjustsFontSizeToFit>{headline}</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {verdict === 'wet' || verdict === 'windy' ? sub : (
              <>
                {s('weatherHeroDryCalm')}
                {rainLabel ? <> · <Text style={styles.subAmber}>{s('weatherHeroRainBy', rainLabel)}</Text></> : null}
              </>
            )}
          </Text>
        </View>
        <View style={styles.read}>
          <Text style={styles.temp}>{`${Math.round(data.temp_c)}°`}</Text>
          {data.wind_kmh != null ? (
            <View style={[styles.windChip, { backgroundColor: tonePale, borderColor: tone }]}>
              <Lucide name="wind" size={12} color={tone} />
              <Text style={[styles.windText, { color: tone }]}>{Math.round(data.wind_kmh)}</Text>
              <Text style={styles.windUnit}>{`km/h · ${windChipSuffix}`}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* ── Forecast timeline ── */}
      {hours.length > 0 ? (
        <View style={styles.fore}>
          <View style={styles.foreHead}>
            <Text style={styles.foreTitle}>{s('weatherHeroNext')}</Text>
            <View style={styles.bestChip}>
              <Lucide name="check" size={11} color={colors.primaryLight} />
              <Text style={styles.bestText}>{bestWindow}</Text>
            </View>
          </View>
          <View style={styles.timeline}>
            {hours.map((h, i) => {
              const pct = Math.max(0, Math.min(100, h.precipitation_probability ?? 0));
              const wet = weatherCodeIsWet(h.weather_code) || pct >= WET_PCT;
              const inWindow = i < goodWindow;
              return (
                <View key={h.time} style={styles.hour} testID={`weather-hour-${hourLabel(h.time)}`}>
                  {inWindow ? <View style={styles.hourTint} pointerEvents="none" /> : null}
                  <Text style={[styles.hTime, i === 0 && { color: colors.primaryLight, fontWeight: FontWeight.bold }]} numberOfLines={1}>
                    {i === 0 ? s('weatherHeroNow') : hourLabel(h.time)}
                  </Text>
                  <Lucide
                    name={weatherCodeIcon(h.weather_code)}
                    size={15}
                    color={wet ? colors.blue : h.weather_code != null && h.weather_code <= 2 ? colors.accentBright : colors.textMuted}
                  />
                  <Text style={styles.hTemp}>{h.temp_c != null ? `${Math.round(h.temp_c)}°` : '—'}</Text>
                  <View style={styles.hBar}>
                    <View style={[styles.hBarFill, { height: `${pct}%` }]} />
                  </View>
                  <Text style={[styles.hPct, wet && { color: colors.blue }]}>{`${pct}%`}</Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      alignSelf: 'stretch',
      borderRadius: Radius.lg,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.bgAlt,
    },
    // banner
    banner: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, padding: 12 },
    orb: {
      width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, alignSelf: 'center',
    },
    verdict: { flex: 1, minWidth: 0 },
    kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
    dot: { width: 6, height: 6, borderRadius: 3 },
    kicker: {
      fontFamily: Fonts.body, fontSize: 10, fontWeight: FontWeight.bold,
      letterSpacing: 0.6, textTransform: 'uppercase', flexShrink: 1,
    },
    headline: { fontFamily: Fonts.heading, fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: colors.text },
    sub: { fontFamily: Fonts.body, fontSize: FontSize.sm, color: colors.textMuted, marginTop: 3 },
    subAmber: { color: colors.amber, fontWeight: FontWeight.bold },
    read: { alignItems: 'flex-end' },
    temp: { fontFamily: Fonts.heading, fontSize: 23, fontWeight: FontWeight.bold, color: colors.text },
    windChip: {
      flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 7,
      paddingVertical: 4, paddingHorizontal: 8, borderRadius: 9, borderWidth: 1,
    },
    windText: { fontFamily: Fonts.body, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
    windUnit: { fontFamily: Fonts.body, fontSize: 10, fontWeight: FontWeight.semibold, color: colors.textMuted },
    // forecast
    fore: { borderTopWidth: 1, borderTopColor: colors.borderLight, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 11 },
    foreHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 },
    foreTitle: {
      fontFamily: Fonts.body, fontSize: 10, fontWeight: FontWeight.bold,
      letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textFaint,
    },
    bestChip: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: colors.primaryPale, borderWidth: 1, borderColor: colors.primaryDim,
      borderRadius: 8, paddingVertical: 3, paddingHorizontal: 8,
    },
    bestText: { fontFamily: Fonts.body, fontSize: 10, fontWeight: FontWeight.bold, color: colors.primaryLight },
    timeline: { flexDirection: 'row', alignItems: 'flex-end' },
    hour: { flex: 1, alignItems: 'center', gap: 5, paddingTop: 2 },
    hourTint: {
      position: 'absolute', top: -3, bottom: -4, left: 1, right: 1, borderRadius: 8,
      backgroundColor: colors.primaryPale, borderWidth: 1, borderColor: colors.primaryDim,
    },
    hTime: { fontFamily: Fonts.body, fontSize: 10, fontWeight: FontWeight.semibold, color: colors.textFaint },
    hTemp: { fontFamily: Fonts.body, fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: colors.text },
    hBar: {
      width: 22, height: 20, borderRadius: 4, overflow: 'hidden',
      backgroundColor: colors.bgMuted, borderWidth: 1, borderColor: colors.borderLight,
      justifyContent: 'flex-end',
    },
    hBarFill: { width: '100%', backgroundColor: colors.blue, borderRadius: 3 },
    hPct: { fontFamily: Fonts.body, fontSize: 9, fontWeight: FontWeight.bold, color: colors.textFaint },
  });
}
