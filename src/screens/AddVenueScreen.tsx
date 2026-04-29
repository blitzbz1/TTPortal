import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { AddressPickerField } from '../components/AddressPickerField';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius, Shadows } from '../theme';
import { useI18n } from '../hooks/useI18n';
import { createVenue } from '../services/venues';
import { upsertCity } from '../services/cities';
import { useCitiesQuery } from '../hooks/queries/useCitiesQuery';
import { safeErrorMessage } from '../lib/auth-utils';
import { rateLimitMessageFor } from '../lib/rateLimit';
import type { VenueType } from '../types/database';

/** Strip diacritics and lowercase for fuzzy city matching. */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Shape of the `address` object returned by Nominatim /search and /reverse. */
export interface NominatimAddressDetails {
  house_number?: string;
  road?: string;
  pedestrian?: string;
  footway?: string;
  neighbourhood?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
}

/** Extract city name from Nominatim address details. */
export function extractNominatimCity(address?: NominatimAddressDetails): string | null {
  return address?.city || address?.town || address?.village || address?.municipality || null;
}

/**
 * English exonym → Romanian canonical name for cities that Nominatim commonly
 * returns under their international form. Keys are normalized (lowercased,
 * diacritic-stripped) so lookups are case-insensitive.
 */
export const CITY_ALIASES_RO: Readonly<Record<string, string>> = {
  bucharest: 'București',
  jassy: 'Iași',
  kronstadt: 'Brașov',
  temeschwar: 'Timișoara',
  hermannstadt: 'Sibiu',
  klausenburg: 'Cluj-Napoca',
};

/**
 * Match a city name against a list of known cities (case & diacritic
 * insensitive). If the name is a known English exonym (e.g., "Bucharest"),
 * matches it to the Romanian canonical ("București") first.
 * Returns the canonical DB name or null.
 */
export function matchCity(nominatimCity: string, knownCities: string[]): string | null {
  const norm = normalize(nominatimCity);
  const direct = knownCities.find((c) => normalize(c) === norm);
  if (direct) return direct;
  const canonical = CITY_ALIASES_RO[norm];
  if (canonical) {
    const aliased = knownCities.find((c) => normalize(c) === normalize(canonical));
    if (aliased) return aliased;
  }
  return null;
}

/**
 * Build a human-readable street address from Nominatim's structured `address`
 * object, preserving the house number whenever Nominatim returned one.
 * Falls back to the first three comma-separated segments of `displayName`
 * only if the structured object lacks a road.
 */
export function buildNominatimAddress(
  address: NominatimAddressDetails | undefined,
  displayName?: string,
): string {
  const road = address?.road || address?.pedestrian || address?.footway;
  if (road) {
    const streetLine = address?.house_number ? `${road} ${address.house_number}` : road;
    const area = address?.neighbourhood || address?.suburb;
    const city = address?.city || address?.town || address?.village || address?.municipality;
    const parts = [streetLine, area, city].filter((p): p is string => typeof p === 'string' && p.length > 0);
    return parts.join(', ');
  }
  if (displayName) {
    const parts = displayName.split(', ');
    return parts.slice(0, Math.min(3, parts.length)).join(', ');
  }
  return '';
}

export function AddVenueScreen() {
  const router = useRouter();
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
  const [knownCities, setKnownCities] = useState<string[]>([]);
  // Ref to the form's ScrollView so AddressPickerField can disable parent
  // scrolling while the user pans the map.
  const formScrollRef = useRef<any>(null);

  // Read from the delta-synced cities cache (see useCitiesQuery): warm
  // starts paint instantly and the network call only ships changed rows.
  const { data: citiesList } = useCitiesQuery();
  useEffect(() => {
    if (citiesList) setKnownCities(citiesList.map((c) => c.name));
  }, [citiesList]);

  const handleAddressPatch = useCallback((patch: { address?: string; city?: string; lat?: number | null; lng?: number | null }) => {
    if (patch.address !== undefined) setAddress(patch.address);
    if (patch.city !== undefined) setCity(patch.city);
    if (patch.lat !== undefined) setGeoLat(patch.lat);
    if (patch.lng !== undefined) setGeoLng(patch.lng);
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
      approved: false,
    });
    setLoading(false);
    if (error) {
      const rateMsg = rateLimitMessageFor(error, s);
      // Postgres unique_violation (idx_venues_name_city / venues_name_key) →
      // surface a meaningful "already exists" message instead of the generic
      // fallback so the user knows to change the name.
      const isDuplicate = (error as { code?: string }).code === '23505';
      const msg = rateMsg
        ?? (isDuplicate ? s('venueAlreadyExists') : safeErrorMessage(error, 'genericError', s));
      Alert.alert(s('error'), msg);
      return;
    }
    Alert.alert(s('success'), s('venueSubmitted'));
    router.back();
  }, [name, address, type, city, tablesCount, notes, router, geoLat, geoLng, s]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.header}>{s('addVenueTitle')}</Text>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={formScrollRef} style={styles.formScroll} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
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

          {/* Address field (with typeahead, geocode button, map) */}
          <View style={[styles.field, { zIndex: 10 }]}>
            <Text style={styles.fieldLabel}>{s('fieldAddress')}</Text>
            <AddressPickerField
              address={address}
              city={city}
              lat={geoLat}
              lng={geoLng}
              knownCities={knownCities}
              onChange={handleAddressPatch}
              parentScrollRef={formScrollRef}
            />
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
