import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, Radius } from '../theme';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import { createVenue } from '../services/venues';
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
  const [city] = useState('București');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [geoLat, setGeoLat] = useState<number | null>(null);
  const [geoLng, setGeoLng] = useState<number | null>(null);
  const [geocoding, setGeocoding] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) { Alert.alert(s('error'), s('nameRequired')); return; }
    if (!address.trim()) { Alert.alert(s('error'), s('addressRequired')); return; }
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
      verified: false,
      tariff: null,
      website: null,
      submitted_by: user?.id ?? null,
      approved: false,
    });
    setLoading(false);
    if (error) { Alert.alert(s('error'), error.message); return; }
    Alert.alert(s('success'), s('venueSubmitted'));
    router.back();
  }, [name, address, type, city, tablesCount, notes, user, router, geoLat, geoLng]);

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
        Alert.alert(s('success'), `${s('pinOnMap')}: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
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
    <SafeAreaView style={styles.container}>
      {/* Map background placeholder */}
      <View style={styles.mapBg} />

      {/* Bottom Sheet */}
      <View style={styles.sheet}>
        {/* Handle */}
        <View style={styles.handleWrap}>
          <View style={styles.handleBar} />
        </View>

        {/* Header */}
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{s('addVenueTitle')}</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
            <Lucide name="x" size={16} color={colors.textFaint} />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.formScroll} keyboardShouldPersistTaps="handled">
          {/* Name Field */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{s('fieldName')}</Text>
            <TextInput
              style={[styles.input, styles.inputText]}
              placeholder={s('fieldNamePlaceholder')}
              placeholderTextColor={colors.textFaint}
              value={name}
              onChangeText={setName}
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
              <View style={[styles.input, styles.inputSelect]}>
                <Text style={styles.inputValue}>{city}</Text>
                <Lucide name="chevron-down" size={16} color={colors.textFaint} />
              </View>
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
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.overlay,
    },
    mapBg: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.mapBg,
    },
    sheet: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 684,
      backgroundColor: colors.bgAlt,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: -8 },
      shadowOpacity: 0.08,
      shadowRadius: 32,
      elevation: 10,
    },
    handleWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 28,
    },
    handleBar: {
      width: 36,
      height: 4,
      borderRadius: 100,
      backgroundColor: colors.border,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingBottom: 12,
    },
    sheetTitle: {
      fontFamily: Fonts.heading,
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    formScroll: {
      flex: 1,
      paddingHorizontal: 20,
    },
    field: {
      gap: 6,
      marginBottom: 16,
    },
    fieldLabel: {
      fontFamily: Fonts.body,
      fontSize: 11,
      fontWeight: '600',
      color: colors.textFaint,
      letterSpacing: 0.7,
    },
    input: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bg,
      borderRadius: 8,
      height: 42,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    inputText: {
      fontFamily: Fonts.body,
      fontSize: 13,
      color: colors.text,
    },
    inputSelect: {
      justifyContent: 'space-between',
    },
    inputPlaceholder: {
      fontFamily: Fonts.body,
      fontSize: 13,
      color: colors.textFaint,
    },
    inputValue: {
      fontFamily: Fonts.body,
      fontSize: 13,
      color: colors.text,
    },
    typeRow: {
      flexDirection: 'row',
      gap: 8,
    },
    typeBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bg,
      borderRadius: 8,
      height: 42,
      borderWidth: 1,
      borderColor: colors.border,
    },
    typeBtnActive: {
      backgroundColor: colors.primaryPale,
      borderColor: colors.primaryDim,
    },
    typeBtnText: {
      fontFamily: Fonts.body,
      fontSize: 13,
      color: colors.textMuted,
    },
    typeBtnTextActive: {
      color: colors.primaryMid,
      fontWeight: '600',
    },
    fieldRow: {
      flexDirection: 'row',
      gap: 12,
    },
    addressRow: {
      flexDirection: 'row',
      gap: 8,
    },
    geocodeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 8,
      height: 42,
      paddingHorizontal: 14,
      gap: 6,
    },
    geocodeBtnText: {
      fontFamily: Fonts.body,
      fontSize: 12,
      fontWeight: '600',
      color: colors.textOnPrimary,
    },
    textarea: {
      backgroundColor: colors.bg,
      borderRadius: 8,
      height: 70,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    textareaInput: {
      fontFamily: Fonts.body,
      fontSize: 13,
      color: colors.text,
      textAlignVertical: 'top',
    },
    actions: {
      flexDirection: 'row',
      gap: 12,
      paddingVertical: 8,
      paddingBottom: 16,
    },
    cancelBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.md,
      height: 46,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelText: {
      fontFamily: Fonts.body,
      fontSize: 14,
      fontWeight: '600',
      color: colors.textMuted,
    },
    submitBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderRadius: Radius.md,
      height: 46,
      gap: 8,
    },
    submitText: {
      fontFamily: Fonts.body,
      fontSize: 14,
      fontWeight: '600',
      color: colors.textOnPrimary,
    },
  });
}
