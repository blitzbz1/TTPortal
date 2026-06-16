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
  /** F010: anonymous active check-in count per venue (counts only, no ids). */
  liveCounts?: Map<number, number>;
  /** F020: venues with an active open-play broadcast the viewer can see. */
  openPlayVenueIds?: Set<number>;
  /** F051: venues in this city the viewer has NEVER checked into ("new to you"). */
  unvisitedVenueIds?: Set<number>;
  onVenuePress: (venueId: number) => void;
  conditionLabel: (condition: any) => { label: string; color: string };
  typeLabel: (type: string) => string;
  friendsActiveLabel: string;
  /** F010: "{0} here now" — interpolated by the caller's i18n. */
  liveHereLabel?: (count: number) => string;
  /** F020: "Playing now — join them" for the callout. */
  openPlayLabel?: string;
  /** F051: "New to you" callout suffix for never-visited venues. */
  newToYouLabel?: string;
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
    <Marker
      coordinate={coordinate}
      tracksViewChanges={track}
      testID={testID}
      // Keep the annotation views out of the accessibility tree: MKMapView
      // exposes every pin as a default "Map pin" element — 1000+ of them
      // bloat the snapshot to MBs, drown VoiceOver, and stall UI testing.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
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
  liveCounts,
  openPlayVenueIds,
  unvisitedVenueIds,
  onVenuePress,
  conditionLabel,
  typeLabel,
  friendsActiveLabel,
  liveHereLabel,
  openPlayLabel,
  newToYouLabel,
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
        const liveCount = liveCounts?.get(venue.id) ?? 0;
        const isOpenPlay = openPlayVenueIds?.has(venue.id) ?? false;
        const isNewToYou = unvisitedVenueIds?.has(venue.id) ?? false;
        return (
          <TrackedMarker
            key={`v-${venue.id}`}
            contentSig={`${venue.condition}:${hasFriend}:${isIndoor}:live${liveCount}:play${isOpenPlay}:new${isNewToYou}`}
            coordinate={{ latitude: venue.lat, longitude: venue.lng }}
          >
            <View
              style={pinStyles.outer}
              // With 1000+ pins, exposing each to the accessibility tree
              // saturates iOS's snapshot (VoiceOver becomes a 1054-stop
              // tour and the subtrees BELOW the map get truncated — the
              // sheet/list disappeared from AT and UI tests entirely).
              // The venue LIST is the accessible alternative (T066 row
              // labels carry name/type/condition/rating).
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {isOpenPlay && (
                // F020: a halo marks a venue with an active "looking for
                // players" broadcast (markers snapshot, so a static ring, not
                // a continuous pulse — consistent with the F010 live badge).
                <View style={extraStyles.openPlayRing} />
              )}
              <View style={[pinStyles.wrap, { backgroundColor: condInfo.color }]}>
                <Lucide name={isIndoor ? 'building-2' : 'activity'} size={14} color={colors.textOnPrimary} />
              </View>
              {hasFriend && (
                <View style={pinStyles.friendBadge}>
                  <Lucide name="users" size={8} color={colors.textOnPrimary} />
                </View>
              )}
              {liveCount > 0 && (
                // F010: anonymous "who's here now" count. Distinct from the
                // friend badge (which means a *known* friend is present).
                <View style={extraStyles.liveBadge}>
                  <Text style={extraStyles.liveBadgeText}>{String(liveCount)}</Text>
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
              {isNewToYou && (
                // F051: "new to you" — a small sparkle on a venue the viewer
                // has never checked into, nudging exploration.
                <View style={extraStyles.newBadge} testID={`venue-new-${venue.id}`}>
                  <Lucide name="sparkles" size={8} color={colors.textOnPrimary} />
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
                  {liveCount > 0 && liveHereLabel ? ` · ${liveHereLabel(liveCount)}` : ''}
                  {isOpenPlay && openPlayLabel ? ` · ${openPlayLabel}` : ''}
                  {isNewToYou && newToYouLabel ? ` · ✨ ${newToYouLabel}` : ''}
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
    // F010: anonymous live-count pill, top-left of the pin.
    liveBadge: {
      position: 'absolute',
      top: -4,
      left: -6,
      minWidth: 15,
      height: 15,
      paddingHorizontal: 3,
      borderRadius: 8,
      backgroundColor: colors.primary,
      borderWidth: 1.5,
      borderColor: colors.bgAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    liveBadgeText: {
      color: colors.textOnPrimary,
      fontSize: 9,
      fontWeight: '700',
    },
    // F020: halo behind the pin marking an active open-play broadcast.
    openPlayRing: {
      position: 'absolute',
      top: -5,
      left: 0,
      width: 38,
      height: 38,
      borderRadius: 19,
      borderWidth: 2.5,
      borderColor: colors.primary,
      backgroundColor: 'transparent',
    },
    // F051: "new to you" sparkle, top-right of a never-visited pin.
    newBadge: {
      position: 'absolute',
      top: -4,
      right: -6,
      width: 15,
      height: 15,
      borderRadius: 8,
      backgroundColor: colors.purpleMid,
      borderWidth: 1.5,
      borderColor: colors.bgAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}

export const VenueMarkers = memo(VenueMarkersImpl);
