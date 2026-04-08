import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius, Shadows } from '../theme';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import { createVenue } from '../services/venues';
import { getCities, upsertCity } from '../services/cities';
import { safeErrorMessage } from '../lib/auth-utils';
import type { VenueType } from '../types/database';

/** Strip diacritics and lowercase for fuzzy city matching. */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Extract city name from Nominatim address details. */
export function extractNominatimCity(address?: { city?: string; town?: string; village?: string; municipality?: string }): string | null {
  return address?.city || address?.town || address?.village || address?.municipality || null;
}

/** Match a city name against a list of known cities (case & diacritic insensitive). Returns the canonical DB name or null. */
export function matchCity(nominatimCity: string, knownCities: string[]): string | null {
  const norm = normalize(nominatimCity);
  return knownCities.find((c) => normalize(c) === norm) ?? null;
}

export function AddVenueScreen() {
  const router = useRouter();
  const { user } = useSession();
  const { s } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [type, setType] = useState<VenueType>('parc_exterior');
  const [tablesCount, setTablesCount] = useState('');
  const [city, setCity] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [geoLat, setGeoLat] = useState<number | null>(null);
  const [geoLng, setGeoLng] = useState<number | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const mapRef = useRef<MapView>(null);

  // Typeahead state
  interface NominatimAddress { city?: string; town?: string; village?: string; municipality?: string }
  interface NominatimSuggestion { display_name: string; lat: string; lon: string; address?: NominatimAddress }
  const [suggestions, setSuggestions] = useState<NominatimSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueryRef = useRef('');
  const [knownCities, setKnownCities] = useState<string[]>([]);

  useEffect(() => {
    getCities().then(({ data }) => {
      if (data) setKnownCities(data.map((c: { name: string }) => c.name));
    });
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const handleAddressChange = useCallback((text: string) => {
    setAddress(text);
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
  }, []);

  const handleSuggestionSelect = useCallback((item: NominatimSuggestion) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    // Extract short address (first part before the country-level detail)
    const parts = item.display_name.split(', ');
    const short = parts.slice(0, Math.min(3, parts.length)).join(', ');
    setAddress(short);
    setGeoLat(lat);
    setGeoLng(lng);
    setSuggestions([]);
    setShowSuggestions(false);
    lastQueryRef.current = short;
    mapRef.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.005, longitudeDelta: 0.005 }, 500);

    // Extract city from Nominatim address details and match against known cities
    const nominatimCity = extractNominatimCity(item.address);
    if (nominatimCity && knownCities.length > 0) {
      const match = matchCity(nominatimCity, knownCities);
      if (match) setCity(match);
    }
  }, [knownCities]);

  const handleMarkerDrag = useCallback((e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
    setGeoLat(e.nativeEvent.coordinate.latitude);
    setGeoLng(e.nativeEvent.coordinate.longitude);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) { Alert.alert(s('error'), s('nameRequired')); return; }
    if (!address.trim()) { Alert.alert(s('error'), s('addressRequired')); return; }
    if (tablesCount) {
      const count = parseInt(tablesCount, 10);
      if (isNaN(count) || count < 1 || count > 100) {
        Alert.alert(s('error'), s('genericError'));
        return;
      }
    }
    if (!city) { Alert.alert(s('error'), s('cityRequired')); return; }
    setLoading(true);

    // Upsert city to get its id (city name extracted from Nominatim)
    const { id: cityId, error: cityError } = await upsertCity(city);
    if (cityError || !cityId) { setLoading(false); Alert.alert(s('error'), safeErrorMessage(cityError ?? 'genericError', 'genericError', s)); return; }

    const { error } = await createVenue({
      name: name.trim(),
      type,
      city,
      city_id: cityId,
      county: null,
      sector: null,
      address: address.trim(),
      lat: geoLat ?? 44.43,
      lng: geoLng ?? 26.10,
      tables_count: tablesCount ? Number(tablesCount) : null,
      condition: null,
      hours: null,
      description: notes.trim() || null,
      tags: null,
      photos: null,
      free_access: null,
      night_lighting: null,
      nets: null,
      tariff: null,
      website: null,
      submitted_by: user?.id ?? null,
      approved: false,
    });
    setLoading(false);
    if (error) { Alert.alert(s('error'), safeErrorMessage(error, 'genericError', s)); return; }
    Alert.alert(s('success'), s('venueSubmitted'));
    router.back();
  }, [name, address, type, city, tablesCount, notes, user, router, geoLat, geoLng, s]);

  const handleGeocode = useCallback(async () => {
    if (!address.trim()) {
      Alert.alert(s('error'), s('addressRequired'));
      return;
    }
    setGeocoding(true);
    try {
      const query = encodeURIComponent(address.trim());
      const res = await fetch(
        'https://nominatim.openstreetmap.org/search?format=json&countrycodes=ro&addressdetails=1&q=' + query,
        { headers: { 'User-Agent': 'TTPortal/1.0' } },
      );
      const results = await res.json();
      if (results && results.length > 0) {
        const lat = parseFloat(results[0].lat);
        const lng = parseFloat(results[0].lon);
        setGeoLat(lat);
        setGeoLng(lng);
        mapRef.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.005, longitudeDelta: 0.005 }, 500);
        const nominatimCity = extractNominatimCity(results[0].address);
        if (nominatimCity && knownCities.length > 0) {
          const match = matchCity(nominatimCity, knownCities);
          if (match) setCity(match);
        }
      } else {
        Alert.alert(s('error'), s('geocodeNotFound') || 'Address not found');
      }
    } catch {
      Alert.alert(s('error'), s('geocodeNotFound') || 'Geocoding failed');
    } finally {
      setGeocoding(false);
    }
  }, [address, knownCities, s]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.header}>{s('addVenueTitle')}</Text>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.formScroll} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
          {/* Name Field */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{s('fieldName')}</Text>
            <TextInput
              style={[styles.input, styles.inputText]}
              placeholder={s('fieldNamePlaceholder')}
              placeholderTextColor={colors.textFaint}
              value={name}
              onChangeText={setName}
              maxLength={100}
            />
          </View>

          {/* Type Field */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{s('fieldType')}</Text>
            <View style={styles.typeRow}>
              <TouchableOpacity
                style={[styles.typeBtn, type === 'parc_exterior' && styles.typeBtnActive]}
                onPress={() => setType('parc_exterior')}
              >
                <Text style={[styles.typeBtnText, type === 'parc_exterior' && styles.typeBtnTextActive]}>
                  {s('typeParcExterior')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeBtn, type === 'sala_indoor' && styles.typeBtnActive]}
                onPress={() => setType('sala_indoor')}
              >
                <Text style={[styles.typeBtnText, type === 'sala_indoor' && styles.typeBtnTextActive]}>
                  {s('typeSalaIndoor')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Nr Mese */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{s('fieldTables')}</Text>
            <TextInput
              style={[styles.input, styles.inputText]}
              placeholder="2"
              placeholderTextColor={colors.textFaint}
              value={tablesCount}
              onChangeText={setTablesCount}
              keyboardType="numeric"
            />
          </View>

          {/* Address Field */}
          <View style={[styles.field, { zIndex: 10 }]}>
            <Text style={styles.fieldLabel}>{s('fieldAddress')}</Text>
            <View style={styles.addressRow}>
              <TextInput
                style={[styles.input, styles.inputText, { flex: 1 }]}
                placeholder={s('addressPlaceholder')}
                placeholderTextColor={colors.textFaint}
                value={address}
                onChangeText={handleAddressChange}
                maxLength={200}
              />
              <TouchableOpacity
                style={[styles.geocodeBtn, geoLat !== null && { backgroundColor: colors.primaryLight }]}
                onPress={handleGeocode}
                disabled={geocoding}
              >
                {geocoding ? (
                  <ActivityIndicator size="small" color={colors.textOnPrimary} />
                ) : (
                  <>
                    <Lucide name="map-pin" size={14} color={colors.textOnPrimary} />
                    <Text style={styles.geocodeBtnText}>
                      {geoLat !== null ? '\u2713' : s('pinOnMap')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            {/* Typeahead dropdown */}
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
                      style={({ pressed }) => [styles.suggestionItem, pressed && styles.suggestionItemPressed, idx < suggestions.length - 1 && styles.suggestionBorder]}
                      onPress={() => handleSuggestionSelect(item)}
                    >
                      <View style={{ marginTop: 2 }}><Lucide name="map-pin" size={14} color={colors.primaryMid} /></View>
                      <Text style={styles.suggestionText} numberOfLines={2}>{item.display_name}</Text>
                    </Pressable>
                  ))
                )}
              </View>
            )}
          </View>

          {/* Map Preview */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{s('pinOnMap')}</Text>
            <View style={styles.mapWrap}>
              <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={{
                  latitude: geoLat ?? 44.43,
                  longitude: geoLng ?? 26.10,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
              >
                <Marker
                  coordinate={{ latitude: geoLat ?? 44.43, longitude: geoLng ?? 26.10 }}
                  draggable
                  onDragEnd={handleMarkerDrag}
                />
              </MapView>
            </View>
            <Text style={styles.mapHint}>{s('dragPinHint')}</Text>
          </View>

          {/* Notes Field */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{s('fieldNotes')}</Text>
            <TextInput
              style={[styles.textarea, styles.textareaInput]}
              placeholder={s('notesPlaceholder')}
              placeholderTextColor={colors.textFaint}
              value={notes}
              onChangeText={setNotes}
              maxLength={500}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
              <Text style={styles.cancelText}>{s('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.submitBtn, loading && { opacity: 0.6 }]} onPress={handleSubmit} disabled={loading}>
              {loading ? (
                <ActivityIndicator size="small" color={colors.textOnPrimary} />
              ) : (
                <>
                  <Lucide name="plus" size={16} color={colors.textOnPrimary} />
                  <Text style={styles.submitText}>{s('addBtn')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
      </ScrollView>
      </KeyboardAvoidingView>

    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    header: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.display,
      fontWeight: FontWeight.extrabold,
      color: colors.text,
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.xs,
    },
    formScroll: {
      flex: 1,
    },
    formContent: {
      padding: Spacing.xl,
      paddingTop: Spacing.xs,
      gap: 0,
    },
    field: {
      gap: 6,
      marginBottom: Spacing.md,
    },
    fieldLabel: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.semibold,
      color: colors.textFaint,
      letterSpacing: 0.7,
    },
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
    typeRow: {
      flexDirection: 'row',
      gap: Spacing.xs,
    },
    typeBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bgAlt,
      borderRadius: Radius.md,
      height: 46,
      borderWidth: 1,
      borderColor: colors.border,
      ...Shadows.sm,
    },
    typeBtnActive: {
      backgroundColor: colors.primaryPale,
      borderColor: colors.primaryDim,
      ...Shadows.md,
    },
    typeBtnText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.textMuted,
    },
    typeBtnTextActive: {
      color: colors.primaryMid,
      fontWeight: FontWeight.semibold,
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
    textarea: {
      backgroundColor: colors.bgAlt,
      borderRadius: Radius.md,
      height: 70,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    textareaInput: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.text,
      textAlignVertical: 'top',
    },
    actions: {
      flexDirection: 'row',
      gap: Spacing.sm,
      paddingVertical: Spacing.xs,
      paddingBottom: Spacing.md,
    },
    cancelBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      height: 50,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgAlt,
      ...Shadows.sm,
    },
    cancelText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.semibold,
      color: colors.textMuted,
    },
    submitBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryLight,
      borderRadius: 12,
      height: 50,
      gap: Spacing.xs,
      ...Shadows.md,
    },
    submitText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.semibold,
      color: colors.textOnPrimary,
    },
  });
}
