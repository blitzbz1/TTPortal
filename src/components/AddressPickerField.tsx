import React, { useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Lucide } from './Icon';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../hooks/useI18n';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Radius, Shadows, Spacing } from '../theme';
import {
  useAddressPicker,
  type AddressPickerChange,
  type KnownCityRecord,
  type ParentScrollRef,
} from '../hooks/useAddressPicker';
import { SuggestionsList } from './AddressPicker/SuggestionsList';
// Platform split happens here: Metro resolves AddressPickerMap.ios.tsx on
// iOS (real react-native-maps → Apple Maps) and AddressPickerMap.tsx
// everywhere else (MapLibre shim on Android, Leaflet shim on web).
import { AddressPickerMap } from './AddressPicker/AddressPickerMap';

export type { AddressPickerChange } from '../hooks/useAddressPicker';

interface AddressPickerFieldProps {
  address: string;
  city: string;
  lat: number | null;
  lng: number | null;
  knownCities: string[];
  knownCityRecords?: KnownCityRecord[];
  countryCode?: string | null;
  countryName?: string | null;
  cityCenterLat?: number | null;
  cityCenterLng?: number | null;
  cityZoom?: number | null;
  onChange: (patch: AddressPickerChange) => void;
  disabled?: boolean;
  // Ref to a wrapping ScrollView. On Android, while the user is touching the
  // map we imperatively disable parent scrolling so single-finger pan
  // gestures aren't intercepted by the parent before MapLibre can claim
  // them (see AddressPickerMap.tsx). Ignored on iOS and web.
  parentScrollRef?: ParentScrollRef;
}

/**
 * Shared address picker: typeahead + geocode button + conditional mini-map
 * with draggable pin, tap-to-place, and reverse geocoding on pin moves.
 * Used by AddVenueScreen and the admin edit-venue modal.
 *
 * All geocode/search/city-match logic lives in useAddressPicker; the map
 * rendering + platform-specific gesture handling lives in
 * AddressPicker/AddressPickerMap(.ios).tsx.
 */
export function AddressPickerField({
  address,
  city,
  lat,
  lng,
  knownCities,
  knownCityRecords = [],
  countryCode,
  countryName,
  cityCenterLat,
  cityCenterLng,
  cityZoom,
  onChange,
  disabled,
  parentScrollRef,
}: AddressPickerFieldProps) {
  const { colors } = useTheme();
  const { s } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const {
    mapRef,
    suggestions,
    showSuggestions,
    searching,
    geocoding,
    reverseGeocoding,
    handleAddressChange,
    handleSuggestionSelect,
    handleGeocode,
    handleMapPress,
    handleMarkerDragEnd,
  } = useAddressPicker({
    address,
    city,
    knownCities,
    knownCityRecords,
    countryCode,
    countryName,
    cityCenterLat,
    cityCenterLng,
    cityZoom,
    onChange,
  });

  const hasLocation = lat !== null && lng !== null;

  return (
    <>
      <View style={styles.addressRow}>
        <TextInput
          style={[styles.input, styles.inputText, { flex: 1 }]}
          placeholder={s('addressPlaceholder')}
          placeholderTextColor={colors.textFaint}
          value={address}
          onChangeText={handleAddressChange}
          maxLength={200}
          editable={!disabled}
          testID="address-input"
        />
        <TouchableOpacity
          style={[styles.geocodeBtn, hasLocation && { backgroundColor: colors.primaryLight }]}
          onPress={handleGeocode}
          disabled={geocoding || disabled}
          testID="address-geocode-btn"
        >
          {geocoding ? (
            <ActivityIndicator size="small" color={colors.textOnPrimary} />
          ) : (
            <>
              <Lucide name="map-pin" size={14} color={colors.textOnPrimary} />
              <Text style={styles.geocodeBtnText}>
                {hasLocation ? '✓' : s('pinOnMap')}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <SuggestionsList
        visible={showSuggestions || searching}
        searching={searching}
        suggestions={suggestions}
        onSelect={handleSuggestionSelect}
      />

      {hasLocation && (
        <View style={{ marginTop: Spacing.sm }}>
          <View style={styles.mapLabelRow}>
            <Text style={styles.fieldLabel}>{s('pinOnMap')}</Text>
            {reverseGeocoding && (
              <View style={styles.mapLabelSpinner} testID="reverse-geocoding-spinner">
                <ActivityIndicator size="small" color={colors.primaryMid} />
                <Text style={styles.mapLabelSpinnerText}>{s('updatingAddress')}</Text>
              </View>
            )}
          </View>
          <AddressPickerMap
            lat={lat!}
            lng={lng!}
            mapRef={mapRef}
            onMapPress={handleMapPress}
            onMarkerDragEnd={handleMarkerDragEnd}
            parentScrollRef={parentScrollRef}
          />
          <Text style={styles.mapHint}>{s('dragPinHint')}</Text>
        </View>
      )}
    </>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    input: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgAlt,
      borderRadius: Radius.md,
      height: 46,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    inputText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.text,
    },
    addressRow: {
      flexDirection: 'row',
      gap: Spacing.xs,
      ...Shadows.sm,
      borderRadius: Radius.md,
    },
    geocodeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primaryLight,
      borderRadius: Radius.md,
      height: 46,
      paddingHorizontal: 14,
      gap: 6,
      ...Shadows.md,
    },
    geocodeBtnText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.base,
      fontWeight: FontWeight.semibold,
      color: colors.textOnPrimary,
    },
    mapHint: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      color: colors.textFaint,
      marginTop: 4,
    },
    mapLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    mapLabelSpinner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    mapLabelSpinnerText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      color: colors.primaryMid,
    },
    fieldLabel: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.semibold,
      color: colors.textFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.7,
    },
  });
}
