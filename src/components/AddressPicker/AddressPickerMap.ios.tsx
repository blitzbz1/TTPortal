import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useTheme } from '../../hooks/useTheme';
import type { ThemeColors } from '../../theme';
import { Radius, Shadows } from '../../theme';
import type { AddressPickerMapProps } from '../../hooks/useAddressPicker';

/**
 * iOS map layer of AddressPickerField: real react-native-maps → Apple Maps.
 * All address/geocode logic lives in useAddressPicker — this component only
 * renders and forwards gestures.
 *
 * Intentional platform differences vs AddressPickerMap.tsx:
 * - Stock red Marker (no custom child views): Apple Maps' native draggable
 *   pin keeps the lift/drop animation, and custom marker children have
 *   historically interfered with dragging on iOS.
 * - `parentScrollRef` is accepted (same props contract) but ignored: Apple
 *   Maps' native gesture handling does not need the parent ScrollView to be
 *   frozen mid-pan, and adding responder logic here crashed the screen on
 *   tap in a previous session.
 */
export function AddressPickerMap({ lat, lng, mapRef, onMapPress, onMarkerDragEnd }: AddressPickerMapProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.mapWrap}>
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
        />
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
  });
}
