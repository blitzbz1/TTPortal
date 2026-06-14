// F013: dismissible map banner that offers a one-tap switch to indoor venues
// when rain is imminent in the selected city. Self-contained: fetches the
// city-center weather and manages its own session dismissal.
import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Lucide } from './Icon';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../hooks/useI18n';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Radius, Spacing } from '../theme';
import { useWeatherQuery } from '../features/weather';
import { isRainImminent, rainHourLabel } from '../lib/weatherDisplay';

interface Props {
  lat: number | null | undefined;
  lng: number | null | undefined;
  /** Hide the banner when the indoor filter is already active. */
  indoorActive: boolean;
  /** Apply the indoor filter (and the banner dismisses itself). */
  onShowIndoor: () => void;
}

export function MapRainBanner({ lat, lng, indoorActive, onShowIndoor }: Props) {
  const { colors } = useTheme();
  const { s } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [dismissed, setDismissed] = useState(false);
  const { data } = useWeatherQuery(lat, lng, lat != null && lng != null);

  if (dismissed || indoorActive || !isRainImminent(data)) return null;

  const hour = rainHourLabel(data?.rain_at ?? null);
  const text = hour ? s('weatherRainBanner', hour) : s('weatherRainBannerNow');

  return (
    <View style={styles.banner} testID="map-rain-banner">
      <Lucide name="cloud-rain" size={16} color={colors.blue} />
      <Text style={styles.text} numberOfLines={2}>{text}</Text>
      <TouchableOpacity
        style={styles.cta}
        onPress={() => {
          onShowIndoor();
          setDismissed(true);
        }}
        accessibilityRole="button"
        testID="map-rain-show-indoor"
      >
        <Text style={styles.ctaText}>{s('weatherShowIndoor')}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => setDismissed(true)}
        accessibilityRole="button"
        accessibilityLabel={s('close')}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        testID="map-rain-dismiss"
      >
        <Lucide name="x" size={16} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: Spacing.sm,
      marginTop: Spacing.xs,
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: colors.bluePale,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.blue,
    },
    text: { flex: 1, fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.text },
    cta: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: Radius.sm,
      backgroundColor: colors.blue,
    },
    ctaText: { fontFamily: Fonts.body, fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: colors.textOnPrimary },
  });
}
