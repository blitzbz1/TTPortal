import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Marker, Callout } from 'react-native-maps';
import { Lucide } from './Icon';
import type { ThemeColors } from '../theme';

/** Minimal venue shape the marker layer needs. */
export interface MarkerVenue {
  id: number;
  name: string;
  type: string;
  condition: string | null;
  lat: number | null;
  lng: number | null;
}

interface VenueMarkersProps {
  /** Chip-filtered venues — deliberately NOT filtered by search text (T041). */
  venues: MarkerVenue[];
  friendVenueIds: Set<number>;
  onVenuePress: (venueId: number) => void;
  conditionLabel: (condition: any) => { label: string; color: string };
  typeLabel: (type: string) => string;
  friendsActiveLabel: string;
  pinStyles: any;
  colors: ThemeColors;
}

/**
 * Redundant condition cue (T066): one distinct glyph per tier, so
 * good/degraded isn't green-vs-red only. The legend in MapViewScreen
 * mirrors these.
 */
export const CONDITION_GLYPHS: Record<string, string> = {
  buna: 'check',
  profesionala: 'check',
  acceptabila: 'minus',
  deteriorata: 'alert-triangle',
};

interface TrackedMarkerProps {
  /** Signature of the marker's visual content. When it changes,
   *  tracksViewChanges flips on for one repaint window so iOS refreshes
   *  the annotation snapshot, then back off (snapshots are cheap to keep,
   *  expensive to track continuously). */
  contentSig: string;
  coordinate: { latitude: number; longitude: number };
  testID?: string;
  children: React.ReactNode;
}

/**
 * Marker with managed `tracksViewChanges`: paints reliably on mount and
 * repaints only when its content actually changes (friend badge appearing,
 * condition update) — never because the map moved.
 */
function TrackedMarker({ contentSig, coordinate, testID, children }: TrackedMarkerProps) {
  const [track, setTrack] = useState(true);
  const sigRef = useRef(contentSig);
  useEffect(() => {
    if (sigRef.current !== contentSig) {
      sigRef.current = contentSig;
      setTrack(true);
    }
    if (track) {
      const t = setTimeout(() => setTrack(false), 350);
      return () => clearTimeout(t);
    }
  }, [contentSig, track]);
  return (
    <Marker coordinate={coordinate} tracksViewChanges={track} testID={testID}>
      {children}
    </Marker>
  );
}

/**
 * All venue pins, individually, no clustering (clustering was removed
 * 2026-06: the cluster↔pin swaps remounted markers on every zoom step,
 * which faded pins and crashed react-native-maps' Fabric-interop path).
 *
 * Redraw guarantees:
 * - Pins are keyed by venue id and NEVER depend on the map region — pan
 *   and zoom don't re-render this layer at all (no prop changes).
 * - React.memo + referentially stable props (T041): search keystrokes and
 *   unrelated parent state leave the marker tree untouched.
 * - Each pin repaints only when its own content signature changes.
 * The venue set itself changes only on chip-filter switches and real data
 * updates (react-query structural sharing keeps refetched-identical data
 * referentially stable).
 */
function VenueMarkersImpl({
  venues,
  friendVenueIds,
  onVenuePress,
  conditionLabel,
  typeLabel,
  friendsActiveLabel,
  pinStyles,
  colors,
}: VenueMarkersProps) {
  const extraStyles = useMemo(() => createExtraStyles(colors), [colors]);

  return (
    <>
      {venues.map((venue) => {
        if (venue.lat == null || venue.lng == null) return null;
        const condInfo = conditionLabel(venue.condition);
        const conditionGlyph = CONDITION_GLYPHS[venue.condition ?? ''] ?? null;
        const isIndoor = venue.type === 'sala_indoor';
        const hasFriend = friendVenueIds.has(venue.id);
        return (
          <TrackedMarker
            key={`v-${venue.id}`}
            contentSig={`${venue.condition}:${hasFriend}:${isIndoor}`}
            coordinate={{ latitude: venue.lat, longitude: venue.lng }}
          >
            <View
              style={pinStyles.outer}
              // T066: custom markers announce nothing without an explicit label.
              accessibilityLabel={`${venue.name}, ${typeLabel(venue.type)}, ${condInfo.label}`}
            >
              <View style={[pinStyles.wrap, { backgroundColor: condInfo.color }]}>
                <Lucide name={isIndoor ? 'building-2' : 'activity'} size={14} color={colors.textOnPrimary} />
              </View>
              {hasFriend && (
                <View style={pinStyles.friendBadge}>
                  <Lucide name="users" size={8} color={colors.textOnPrimary} />
                </View>
              )}
              {conditionGlyph && (
                // T066: redundant visual cue — condition was encoded by the
                // pin color only (green vs red), invisible to ~8% of men in
                // a male-skewed sport.
                <View style={[extraStyles.conditionBadge, { backgroundColor: condInfo.color }]}>
                  <Lucide name={conditionGlyph} size={7} color={colors.textOnPrimary} />
                </View>
              )}
              <View style={pinStyles.arrow} />
            </View>
            <Callout tooltip onPress={() => onVenuePress(venue.id)}>
              <View style={pinStyles.callout}>
                <Text style={pinStyles.calloutTitle} numberOfLines={1}>{venue.name}</Text>
                <Text style={pinStyles.calloutSub}>
                  {typeLabel(venue.type)} · {condInfo.label}
                  {hasFriend ? ` · 👋 ${friendsActiveLabel}` : ''}
                </Text>
              </View>
            </Callout>
          </TrackedMarker>
        );
      })}
    </>
  );
}

function createExtraStyles(colors: ThemeColors) {
  return StyleSheet.create({
    conditionBadge: {
      position: 'absolute',
      bottom: 6,
      left: -3,
      width: 13,
      height: 13,
      borderRadius: 7,
      borderWidth: 1.5,
      borderColor: colors.bgAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}

export const VenueMarkers = memo(VenueMarkersImpl);
