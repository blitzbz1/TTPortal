import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius, Shadows } from '../theme';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import { createVenue } from '../services/venues';
import { safeErrorMessage } from '../lib/auth-utils';
import { CityPickerModal } from '../components/CityPickerModal';
import type { VenueType } from '../types/database';

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
  const [city, setCity] = useState('București');
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [geoLat, setGeoLat] = useState<number | null>(null);
  const [geoLng, setGeoLng] = useState<number | null>(null);
  const [geocoding, setGeocoding] = useState(false);

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
    setLoading(true);
    const { error } = await createVenue({
      name: name.trim(),
      type,
      city,
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
      const query = encodeURIComponent(address.trim() + ', ' + city);
      const res = await fetch(
        'https://nominatim.openstreetmap.org/search?format=json&q=' + query,
        { headers: { 'User-Agent': 'TTPortal/1.0' } },
      );
      const results = await res.json();
      if (results && results.length > 0) {
        const lat = parseFloat(results[0].lat);
        const lng = parseFloat(results[0].lon);
        setGeoLat(lat);
        setGeoLng(lng);
        Alert.alert(s('success'), s('geocodeSuccess'));
      } else {
        Alert.alert(s('error'), s('geocodeNotFound') || 'Address not found');
      }
    } catch {
      Alert.alert(s('error'), s('geocodeNotFound') || 'Geocoding failed');
    } finally {
      setGeocoding(false);
    }
  }, [address, city, s]);

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

          {/* Nr Mese / Oras */}
          <View style={styles.fieldRow}>
            <View style={[styles.field, { flex: 1 }]}>
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
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>{s('fieldCity')}</Text>
              <TouchableOpacity style={[styles.input, styles.inputSelect]} onPress={() => setCityModalVisible(true)}>
                <Text style={styles.inputValue}>{city}</Text>
                <Lucide name="chevron-down" size={16} color={colors.textFaint} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Address Field */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{s('fieldAddress')}</Text>
            <View style={styles.addressRow}>
              <TextInput
                style={[styles.input, styles.inputText, { flex: 1 }]}
                placeholder={s('addressPlaceholder')}
                placeholderTextColor={colors.textFaint}
                value={address}
                onChangeText={setAddress}
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

      <CityPickerModal
        visible={cityModalVisible}
        selectedCity={city}
        onSelect={(c) => { if (c) setCity(c); setCityModalVisible(false); }}
        onClose={() => setCityModalVisible(false)}
      />
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
    inputSelect: {
      justifyContent: 'space-between',
    },
    inputPlaceholder: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.textFaint,
    },
    inputValue: {
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
    fieldRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
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
