import type { ThemeColors } from '../theme';
import type { MarkerVenue } from './VenueMarkers';

/**
 * Non-Android stub. iOS/web render the rich `<VenueMarkers>` (Apple Maps /
 * Leaflet handle their per-pin views fine); only Android needs the GPU
 * clustered layer (see VenueClusterLayer.android.tsx). This stub keeps the
 * import resolvable on those platforms without bundling MapLibre.
 */
export interface VenueClusterLayerProps {
  venues: MarkerVenue[];
  friendVenueIds: Set<number>;
  liveCounts?: Map<number, number>;
  openPlayVenueIds?: Set<number>;
  unvisitedVenueIds?: Set<number>;
  onVenuePress: (venueId: number) => void;
  onClusterPress: (center: [number, number], expansionZoom: number) => void;
  conditionLabel: (condition: any) => { label: string; color: string };
  colors: ThemeColors;
}

export function VenueClusterLayer(_props: VenueClusterLayerProps): null {
  return null;
}
