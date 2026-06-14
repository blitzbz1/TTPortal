// F013: compact weather chip for outdoor venues (and outdoor events). Self-
// contained — fetches via useWeatherQuery and renders nothing until data is in
// (weather is decorative, never blocking).
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Lucide } from './Icon';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../hooks/useI18n';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Radius } from '../theme';
import { useWeatherQuery } from '../features/weather';
import { rainHourLabel, isWindy } from '../lib/weatherDisplay';

interface Props {
  lat: number | null | undefined;
  lng: number | null | undefined;
  /** Gate on the surface being outdoor — the caller decides. */
  enabled?: boolean;
}

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

  return (
    <View style={styles.chip} testID="weather-chip">
      <Lucide
        name={data.raining_now ? 'cloud-rain' : 'sun'}
        size={14}
        color={data.raining_now ? colors.blue : colors.amber}
      />
      <Text style={styles.text}>{`${temp} · ${condition}`}</Text>
      {windy ? (
        <View style={styles.windRow} testID="weather-wind-warning">
          <Lucide name="wind" size={12} color={colors.textMuted} />
          <Text style={styles.windText}>{s('weatherWindy', String(Math.round(data.wind_kmh!)))}</Text>
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      backgroundColor: colors.bluePale,
      borderRadius: Radius.full,
      paddingVertical: 5,
      paddingHorizontal: 10,
    },
    text: { fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.text },
    windRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 2 },
    windText: { fontFamily: Fonts.body, fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: colors.textMuted },
  });
}
