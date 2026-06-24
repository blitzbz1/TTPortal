import React, { useCallback, useMemo, useRef } from 'react';
import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import type { ThemeColors } from '../theme';
import type { MarkerVenue } from './VenueMarkers';

/**
 * Android venue layer — GPU-rendered points with native clustering.
 *
 * Why this exists (Android only): the cross-platform `<Marker>` path renders one
 * native React-Native view per pin. MapLibre's own guidance ranks point
 * rendering GeoJSON + Circle/Symbol layers (GPU) ≫ PointAnnotation ≫
 * Marker/MarkerView, and a dense city pushed 1000+ Markers onto the map, pinning
 * the UI thread (~130% CPU) until the app froze. A single GeoJSON source with
 * `cluster` (supercluster, off-thread) draws clusters + a count and the
 * individual dots entirely on the GPU, staying at 60fps for tens of thousands of
 * points. iOS keeps the rich `<Marker>` views (Apple Maps handles them fine).
 *
 * The pin signals are carried as data-driven style: condition → fill colour,
 * friend present → ring stroke, open-play broadcast → halo, live count → number.
 */
interface Props {
  venues: MarkerVenue[];
  friendVenueIds: Set<number>;
  liveCounts?: Map<number, number>;
  openPlayVenueIds?: Set<number>;
  unvisitedVenueIds?: Set<number>;
  onVenuePress: (venueId: number) => void;
  /** Expand a tapped cluster: center [lng, lat] + the zoom that splits it. */
  onClusterPress: (center: [number, number], expansionZoom: number) => void;
  conditionLabel: (condition: any) => { label: string; color: string };
  colors: ThemeColors;
}

const SOURCE_ID = 'venue-source';
const NOT_CLUSTER = ['!', ['has', 'point_count']];

export function VenueClusterLayer({
  venues,
  friendVenueIds,
  liveCounts,
  openPlayVenueIds,
  unvisitedVenueIds,
  onVenuePress,
  onClusterPress,
  conditionLabel,
  colors,
}: Props) {
  const sourceRef = useRef<{ getClusterExpansionZoom?: (id: number) => Promise<number> } | null>(null);

  // FeatureCollection rebuilt only when the venue set or its overlays change —
  // never on pan/zoom (clustering re-buckets natively on the worker thread).
  const data = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: venues.flatMap((v) => {
        if (v.lat == null || v.lng == null) return [];
        return [
          {
            type: 'Feature' as const,
            id: v.id,
            geometry: { type: 'Point' as const, coordinates: [v.lng, v.lat] },
            properties: {
              id: v.id,
              color: conditionLabel(v.condition).color,
              friend: friendVenueIds.has(v.id),
              live: liveCounts?.get(v.id) ?? 0,
              openPlay: openPlayVenueIds?.has(v.id) ?? false,
              newToYou: unvisitedVenueIds?.has(v.id) ?? false,
            },
          },
        ];
      }),
    }),
    [venues, friendVenueIds, liveCounts, openPlayVenueIds, unvisitedVenueIds, conditionLabel],
  );

  const handlePress = useCallback(
    async (event: any) => {
      // onPress is a native bubbling event → the payload lives under nativeEvent.
      const payload = event?.nativeEvent ?? event ?? {};
      const feature = payload.features?.[0];
      if (!feature) return;
      const props = feature.properties ?? {};
      if (props.cluster) {
        try {
          const zoom = await sourceRef.current?.getClusterExpansionZoom?.(Number(props.cluster_id));
          const coords = feature.geometry?.coordinates;
          if (coords && coords.length >= 2 && typeof zoom === 'number') {
            onClusterPress([coords[0], coords[1]], zoom);
          }
        } catch {
          // Expansion-zoom lookup can fail mid-gesture; ignore and let the user retap.
        }
      } else if (props.id != null) {
        onVenuePress(Number(props.id));
      }
    },
    [onClusterPress, onVenuePress],
  );

  return (
    <GeoJSONSource
      id={SOURCE_ID}
      ref={sourceRef as never}
      data={data as never}
      cluster
      clusterRadius={60}
      clusterMaxZoom={14}
      onPress={handlePress as never}
    >
      {/* Cluster bubble: grows with the number of pins it holds. */}
      <Layer
        id="venue-clusters"
        type="circle"
        filter={['has', 'point_count'] as never}
        paint={{
          'circle-color': colors.primary,
          'circle-opacity': 0.92,
          'circle-stroke-color': colors.bgAlt,
          'circle-stroke-width': 2,
          'circle-radius': ['step', ['get', 'point_count'], 16, 25, 22, 100, 30],
        } as never}
      />
      {/* Cluster count (no halo — text halos are the main MapLibre text cost). */}
      <Layer
        id="venue-cluster-count"
        type="symbol"
        filter={['has', 'point_count'] as never}
        layout={{
          'text-field': ['get', 'point_count_abbreviated'],
          // OpenFreeMap only serves the Noto Sans stack; the MapLibre default
          // (Open Sans / Arial Unicode) 404s and retries forever, pinning CPU.
          'text-font': ['Noto Sans Regular'],
          'text-size': 12,
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        } as never}
        paint={{ 'text-color': colors.textOnPrimary } as never}
      />
      {/* F020 open-play halo, drawn under the dot. */}
      <Layer
        id="venue-openplay-ring"
        type="circle"
        filter={['all', NOT_CLUSTER, ['==', ['get', 'openPlay'], true]] as never}
        paint={{
          'circle-color': colors.primary,
          'circle-opacity': 0,
          'circle-radius': 12,
          'circle-stroke-color': colors.primary,
          'circle-stroke-width': 2.5,
        } as never}
      />
      {/* Individual venue dot: condition colour, friend → primary ring. */}
      <Layer
        id="venue-points"
        type="circle"
        filter={NOT_CLUSTER as never}
        paint={{
          'circle-color': ['get', 'color'],
          'circle-radius': 7,
          'circle-stroke-width': 2,
          'circle-stroke-color': ['case', ['==', ['get', 'friend'], true], colors.primary, colors.bgAlt],
        } as never}
      />
      {/* F010 live "here now" count on busy venues. */}
      <Layer
        id="venue-live-count"
        type="symbol"
        filter={['all', NOT_CLUSTER, ['>', ['get', 'live'], 0]] as never}
        layout={{
          'text-field': ['to-string', ['get', 'live']],
          'text-font': ['Noto Sans Regular'],
          'text-size': 9,
          'text-offset': [0, -1.4],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        } as never}
        paint={{ 'text-color': colors.textOnPrimary } as never}
      />
    </GeoJSONSource>
  );
}
