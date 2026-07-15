import React, { useMemo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useTheme } from '../../hooks/useTheme';
import type { ThemeColors } from '../../theme';
import { Radius, Shadows } from '../../theme';
import type { AddressPickerMapProps, ParentScrollRef } from '../../hooks/useAddressPicker';

// This file is the Android + web map layer ('react-native-maps' resolves to
// the MapLibre shim on Android and the Leaflet shim on web via metro.config).
// iOS resolves to AddressPickerMap.ios.tsx (real react-native-maps → Apple
// Maps) via platform-extension resolution. Do not add iOS branches here.

// Toggle the parent ScrollView's scrollEnabled imperatively. Under Fabric
// some ScrollView refs throw `_viewConfig of undefined` from setNativeProps,
// which would crash the screen on a single tap. Swallow that — we lose the
// gesture-handoff optimization but the map remains usable.
function setParentScrollEnabled(ref: ParentScrollRef | undefined, enabled: boolean) {
  const fn = ref?.current?.setNativeProps;
  if (typeof fn !== 'function') return;
  try {
    fn({ scrollEnabled: enabled });
  } catch {
    // ignore — best-effort optimization
  }
}

/**
 * Android/web map layer of AddressPickerField: mini-map with a draggable
 * custom pin, tap-to-place, and (Android only) parent-ScrollView freezing
 * while the user touches the map. All address/geocode logic lives in
 * useAddressPicker — this component only renders and forwards gestures.
 */
export function AddressPickerMap({
  lat,
  lng,
  mapRef,
  onMapPress,
  onMarkerDragEnd,
  parentScrollRef,
}: AddressPickerMapProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    /* The responder-capture / touch-end pair below disables the parent
       ScrollView mid-touch so single-finger pan gestures reach MapLibre's
       MoveGestureDetector before being intercepted by the parent's
       onInterceptTouchEvent. setNativeProps bypasses the React reconciler
       so the change is committed before the next ACTION_MOVE arrives.
       Android-only: web Leaflet handles its own gestures, and iOS lives in
       the .ios.tsx variant which never reaches this code.
       Best-effort: under the new architecture (Fabric) some ScrollView refs
       throw `_viewConfig of undefined` from setNativeProps. We catch that —
       losing the parent-freeze optimization but keeping the screen alive,
       since the map's own gesture detector can usually claim the touch
       unaided. */
    <View
      style={styles.mapWrap}
      {...(Platform.OS === 'android'
        ? {
            onStartShouldSetResponderCapture: () => {
              setParentScrollEnabled(parentScrollRef, false);
              return false;
            },
            onTouchEnd: () => {
              setParentScrollEnabled(parentScrollRef, true);
            },
            onTouchCancel: () => {
              setParentScrollEnabled(parentScrollRef, true);
            },
          }
        : null)}
    >
      <MapView
        ref={(instance) => { mapRef.current = instance; }}
        style={styles.map}
        initialRegion={{
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }}
        onPress={onMapPress}
      >
        <Marker
          identifier="address-picker"
          coordinate={{ latitude: lat, longitude: lng }}
          draggable
          onDragEnd={onMarkerDragEnd}
        >
          <View style={styles.markerPinShadow} />
          <View style={styles.markerPinDot} />
        </Marker>
      </MapView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    mapWrap: {
      borderRadius: Radius.md,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
      ...Shadows.sm,
    },
    map: {
      width: '100%',
      height: 180,
    },
    markerPinDot: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.red,
      borderWidth: 2,
      borderColor: '#ffffff',
      ...Shadows.sm,
    },
    markerPinShadow: {
      width: 6,
      height: 3,
      borderRadius: 3,
      backgroundColor: 'rgba(0,0,0,0.25)',
      marginTop: 2,
    },
  });
}
