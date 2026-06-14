// F013: weather card for outdoor venues (and outdoor events). Shows the current
// conditions (temp · dry/rain · wind) plus a next-hours forecast strip. Self-
// contained — fetches via useWeatherQuery and renders nothing until data is in
// (weather is decorative, never blocking).
import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Lucide } from './Icon';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../hooks/useI18n';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Radius } from '../theme';
import { useWeatherQuery } from '../features/weather';
import { rainHourLabel, isWindy, weatherCodeIcon, weatherCodeIsWet } from '../lib/weatherDisplay';

interface Props {
  lat: number | null | undefined;
  lng: number | null | undefined;
  /** Gate on the surface being outdoor — the caller decides. */
  enabled?: boolean;
}

const FORECAST_COLS = 6;
const hourLabel = (iso: string) => iso.slice(11, 16); // "..T15:00" -> "15:00"

export function WeatherChip({ lat, lng, enabled = true }: Props) {
  const { colors } = useTheme();
  const { s } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data } = useWeatherQuery(lat, lng, enabled);

  if (!data || data.temp_c == null) return null;

  const temp = `${Math.round(data.temp_c)}°`;
  const rainLabel = rainHourLabel(data.rain_at);
  const condition = data.raining_now
    ? s('weatherRainingNow')
    : rainLabel
      ? s('weatherDryUntil', rainLabel)
      : s('weatherDry');
  const windy = isWindy(data.wind_kmh);
  const hours = (data.hourly ?? []).slice(0, FORECAST_COLS);

  return (
    <View style={styles.card} testID="weather-chip">
      {/* Current */}
      <View style={styles.currentRow}>
        <Lucide
          name={weatherCodeIcon(data.weather_code)}
          size={16}
          color={weatherCodeIsWet(data.weather_code) ? colors.blue : colors.amber}
        />
        <Text style={styles.text}>{`${temp} · ${condition}`}</Text>
        {data.wind_kmh != null ? (
          <View style={styles.windRow} testID="weather-wind">
            <Lucide name="wind" size={13} color={windy ? colors.amberDeep : colors.textMuted} />
            <Text style={[styles.windText, windy && styles.windWarn]}>
              {s('weatherWind', String(Math.round(data.wind_kmh)))}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Next-hours forecast strip */}
      {hours.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.strip}
          contentContainerStyle={styles.stripContent}
          testID="weather-forecast"
        >
          {hours.map((h) => (
            <View key={h.time} style={styles.hour} testID={`weather-hour-${hourLabel(h.time)}`}>
              <Text style={styles.hourTime}>{hourLabel(h.time)}</Text>
              <Lucide
                name={weatherCodeIcon(h.weather_code)}
                size={15}
                color={weatherCodeIsWet(h.weather_code) ? colors.blue : colors.amber}
              />
              <Text style={styles.hourTemp}>{h.temp_c != null ? `${Math.round(h.temp_c)}°` : '—'}</Text>
            </View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      alignSelf: 'stretch',
      backgroundColor: colors.bluePale,
      borderRadius: Radius.md,
      paddingVertical: 8,
      paddingHorizontal: 12,
      gap: 8,
    },
    currentRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    text: { fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.text, flexShrink: 1 },
    windRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 'auto' },
    windText: { fontFamily: Fonts.body, fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: colors.textMuted },
    windWarn: { color: colors.amberDeep, fontWeight: FontWeight.bold },
    strip: { marginHorizontal: -2 },
    stripContent: { gap: 14, paddingHorizontal: 2 },
    hour: { alignItems: 'center', gap: 3, minWidth: 34 },
    hourTime: { fontFamily: Fonts.body, fontSize: FontSize.xs, color: colors.textMuted },
    hourTemp: { fontFamily: Fonts.body, fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: colors.text },
  });
}
