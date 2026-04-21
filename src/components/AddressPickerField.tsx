import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Lucide } from './Icon';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../hooks/useI18n';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Radius, Shadows, Spacing } from '../theme';
import {
  buildNominatimAddress,
  extractNominatimCity,
  matchCity,
  type NominatimAddressDetails,
} from '../screens/AddVenueScreen';

interface NominatimSuggestion {
  display_name: string;
  lat: string;
  lon: string;
  address?: NominatimAddressDetails;
}

export interface AddressPickerChange {
  address?: string;
  city?: string;
  lat?: number | null;
  lng?: number | null;
}

interface AddressPickerFieldProps {
  address: string;
  city: string;
  lat: number | null;
  lng: number | null;
  knownCities: string[];
  onChange: (patch: AddressPickerChange) => void;
  disabled?: boolean;
}

/**
 * Shared address picker: typeahead + geocode button + conditional mini-map
 * with draggable marker + reverse geocoding on drag.
 * Used by AddVenueScreen and the admin edit-venue modal.
 */
export function AddressPickerField({
  address,
  city,
  lat,
  lng,
  knownCities,
  onChange,
  disabled,
}: AddressPickerFieldProps) {
  const { colors } = useTheme();
  const { s } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const mapRef = useRef<MapView>(null);

  const [suggestions, setSuggestions] = useState<NominatimSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [reverseGeocoding, setReverseGeocoding] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueryRef = useRef(address);

  const closeSuggestions = useCallback(() => {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    setSuggestions([]);
    setShowSuggestions(false);
    setSearching(false);
  }, []);

  const maybeSetCity = useCallback((addr: NominatimAddressDetails | undefined) => {
    const nominatimCity = extractNominatimCity(addr);
    if (!nominatimCity) return;
    // Prefer the canonical casing from our known cities list; otherwise use
    // Nominatim's value as-is so new cities still flow through.
    const match = knownCities.length > 0 ? matchCity(nominatimCity, knownCities) : null;
    onChange({ city: match ?? nominatimCity });
  }, [knownCities, onChange]);

  const handleAddressChange = useCallback((text: string) => {
    onChange({ address: text });
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (text.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const trimmed = text.trim();
      if (trimmed === lastQueryRef.current) { setSearching(false); return; }
      lastQueryRef.current = trimmed;

      try {
        const query = encodeURIComponent(trimmed);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(
          'https://nominatim.openstreetmap.org/search?format=json&limit=5&dedupe=1&addressdetails=1&countrycodes=ro&q=' + query,
          { headers: { 'User-Agent': 'TTPortal/1.0' }, signal: controller.signal },
        );
        clearTimeout(timeout);
        if (!res.ok) { setSearching(false); return; }
        const data: NominatimSuggestion[] = await res.json();
        setSuggestions(data);
        setShowSuggestions(data.length > 0);
      } catch { /* timeout / abort — ignore */ }
      setSearching(false);
    }, 800);
  }, [onChange]);

  const handleSuggestionSelect = useCallback((item: NominatimSuggestion) => {
    const nextLat = parseFloat(item.lat);
    const nextLng = parseFloat(item.lon);
    const short = buildNominatimAddress(item.address, item.display_name);
    onChange({ address: short, lat: nextLat, lng: nextLng });
    closeSuggestions();
    lastQueryRef.current = short;
    mapRef.current?.animateToRegion({ latitude: nextLat, longitude: nextLng, latitudeDelta: 0.005, longitudeDelta: 0.005 }, 500);
    maybeSetCity(item.address);
  }, [onChange, closeSuggestions, maybeSetCity]);

  const handleGeocode = useCallback(async () => {
    if (!address.trim()) return;
    setGeocoding(true);
    try {
      const query = encodeURIComponent(address.trim());
      const res = await fetch(
        'https://nominatim.openstreetmap.org/search?format=json&countrycodes=ro&addressdetails=1&q=' + query,
        { headers: { 'User-Agent': 'TTPortal/1.0' } },
      );
      const results: (NominatimSuggestion & { address?: NominatimAddressDetails })[] = await res.json();
      if (results && results.length > 0) {
        const nextLat = parseFloat(results[0].lat);
        const nextLng = parseFloat(results[0].lon);
        const normalized = buildNominatimAddress(results[0].address, results[0].display_name);
        const patch: AddressPickerChange = { lat: nextLat, lng: nextLng };
        if (normalized) { patch.address = normalized; lastQueryRef.current = normalized; }
        onChange(patch);
        closeSuggestions();
        mapRef.current?.animateToRegion({ latitude: nextLat, longitude: nextLng, latitudeDelta: 0.005, longitudeDelta: 0.005 }, 500);
        maybeSetCity(results[0].address);
      }
    } catch { /* ignore */ }
    setGeocoding(false);
  }, [address, onChange, closeSuggestions, maybeSetCity]);

  const handleMarkerDrag = useCallback(async (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
    const nextLat = e.nativeEvent.coordinate.latitude;
    const nextLng = e.nativeEvent.coordinate.longitude;
    onChange({ lat: nextLat, lng: nextLng });
    closeSuggestions();
    setReverseGeocoding(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat=${nextLat}&lon=${nextLng}`,
        { headers: { 'User-Agent': 'TTPortal/1.0' }, signal: controller.signal },
      );
      clearTimeout(timeout);
      if (res.ok) {
        const data: { display_name?: string; address?: NominatimAddressDetails } = await res.json();
        const short = buildNominatimAddress(data.address, data.display_name);
        if (short) {
          onChange({ address: short });
          lastQueryRef.current = short;
        }
        maybeSetCity(data.address);
      }
    } catch { /* ignore */ }
    setReverseGeocoding(false);
  }, [onChange, closeSuggestions, maybeSetCity]);

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
                {hasLocation ? '\u2713' : s('pinOnMap')}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {(showSuggestions || searching) && (
        <View style={styles.suggestionsWrap}>
          {searching && suggestions.length === 0 ? (
            <View style={styles.suggestionLoading}>
              <ActivityIndicator size="small" color={colors.primaryMid} />
              <Text style={styles.suggestionLoadingText}>{s('searching') || 'Searching...'}</Text>
            </View>
          ) : (
            suggestions.map((item, idx) => (
              <Pressable
                key={`${item.lat}-${item.lon}`}
                style={({ pressed }) => [
                  styles.suggestionItem,
                  pressed && styles.suggestionItemPressed,
                  idx < suggestions.length - 1 && styles.suggestionBorder,
                ]}
                onPress={() => handleSuggestionSelect(item)}
              >
                <View style={{ marginTop: 2 }}>
                  <Lucide name="map-pin" size={14} color={colors.primaryMid} />
                </View>
                <Text style={styles.suggestionText} numberOfLines={2}>{item.display_name}</Text>
              </Pressable>
            ))
          )}
        </View>
      )}

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
          <View style={styles.mapWrap}>
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={{
                latitude: lat!,
                longitude: lng!,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              }}
            >
              <Marker
                coordinate={{ latitude: lat!, longitude: lng! }}
                draggable
                onDragEnd={handleMarkerDrag}
              />
            </MapView>
          </View>
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
    suggestionsWrap: {
      backgroundColor: colors.bgAlt,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      maxHeight: 200,
      overflow: 'hidden',
      marginTop: 6,
      ...Shadows.md,
    },
    suggestionItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    suggestionItemPressed: {
      backgroundColor: colors.bgMuted,
    },
    suggestionBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    suggestionText: {
      flex: 1,
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      color: colors.textMuted,
    },
    suggestionLoading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    suggestionLoadingText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      color: colors.textFaint,
    },
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
