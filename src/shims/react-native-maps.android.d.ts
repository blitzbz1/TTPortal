// Type declarations for the Android MapLibre shim. Mirror only the subset of
// the react-native-maps API that the app actually uses, so consumers keep the
// same import site and TypeScript sees compatible shapes.
import type { ComponentType, ReactNode, Ref } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface MapViewRef {
  animateToRegion: (region: Region, duration?: number) => void;
}

export interface MapViewProps {
  ref?: Ref<MapViewRef>;
  style?: StyleProp<ViewStyle>;
  initialRegion?: Region;
  showsUserLocation?: boolean;
  scrollEnabled?: boolean;
  zoomEnabled?: boolean;
  rotateEnabled?: boolean;
  pitchEnabled?: boolean;
  children?: ReactNode;
  [key: string]: unknown;
}

declare const MapView: ComponentType<MapViewProps>;
export default MapView;

export interface MarkerDragEvent {
  nativeEvent: { coordinate: LatLng };
}

export interface MarkerProps {
  coordinate: LatLng;
  title?: string;
  description?: string;
  draggable?: boolean;
  onDragEnd?: (e: MarkerDragEvent) => void;
  tracksViewChanges?: boolean;
  children?: ReactNode;
  [key: string]: unknown;
}

export const Marker: ComponentType<MarkerProps>;

export interface CalloutProps {
  tooltip?: boolean;
  onPress?: () => void;
  children?: ReactNode;
}

export const Callout: ComponentType<CalloutProps>;

// Pure helpers exported for unit tests.
export function deltaToZoom(latitudeDelta: number): number;
export function regionToCenter(region: { latitude: number; longitude: number }): [number, number];
export function maplibreDragToRnMaps(feature: {
  geometry?: { coordinates?: [number, number] };
}): MarkerDragEvent;
