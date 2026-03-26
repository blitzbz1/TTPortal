import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { Colors, Fonts, Radius } from '../theme';
import { useSession } from '../hooks/useSession';
import { createVenue } from '../services/venues';
import type { VenueType } from '../types/database';

export function AddVenueScreen() {
  const router = useRouter();
  const { user } = useSession();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [type, setType] = useState<VenueType>('parc_exterior');
  const [tablesCount, setTablesCount] = useState('');
  const [city, setCity] = useState('București');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) { Alert.alert('Eroare', 'Numele locației este obligatoriu.'); return; }
    if (!address.trim()) { Alert.alert('Eroare', 'Adresa este obligatorie.'); return; }
    setLoading(true);
    const { error } = await createVenue({
      name: name.trim(),
      type,
      city,
      county: null,
      sector: null,
      address: address.trim(),
      lat: 44.43,
      lng: 26.10,
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
    if (error) { Alert.alert('Eroare', error.message); return; }
    Alert.alert('Succes', 'Locația a fost trimisă spre aprobare.');
    router.back();
  }, [name, address, type, city, tablesCount, notes, user, router]);

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
          <Text style={styles.sheetTitle}>{'Adaugă locație'}</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
            <Lucide name="x" size={16} color={Colors.inkFaint} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.formScroll}>
          {/* Name Field */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{'NUME LOCAȚIE *'}</Text>
            <TextInput
              style={[styles.input, styles.inputText]}
              placeholder="ex: Parcul Tineretului"
              placeholderTextColor={Colors.inkFaint}
              value={name}
              onChangeText={setName}
            />
          </View>

          {/* Type Field */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>TIP</Text>
            <View style={styles.typeRow}>
              <TouchableOpacity
                style={[styles.typeBtn, type === 'parc_exterior' && styles.typeBtnActive]}
                onPress={() => setType('parc_exterior')}
              >
                <Text style={[styles.typeBtnText, type === 'parc_exterior' && styles.typeBtnTextActive]}>
                  {'\uD83C\uDF33 Parc exterior'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeBtn, type === 'sala_indoor' && styles.typeBtnActive]}
                onPress={() => setType('sala_indoor')}
              >
                <Text style={[styles.typeBtnText, type === 'sala_indoor' && styles.typeBtnTextActive]}>
                  {'\uD83C\uDFE2 Sală indoor'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Nr Mese / Oras */}
          <View style={styles.fieldRow}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>NR. MESE</Text>
              <TextInput
                style={[styles.input, styles.inputText]}
                placeholder="2"
                placeholderTextColor={Colors.inkFaint}
                value={tablesCount}
                onChangeText={setTablesCount}
                keyboardType="numeric"
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>{'ORAȘ *'}</Text>
              <View style={[styles.input, styles.inputSelect]}>
                <Text style={styles.inputValue}>{city}</Text>
                <Lucide name="chevron-down" size={16} color={Colors.inkFaint} />
              </View>
            </View>
          </View>

          {/* Address Field */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{'ADRESĂ *'}</Text>
            <View style={styles.addressRow}>
              <TextInput
                style={[styles.input, styles.inputText, { flex: 1 }]}
                placeholder={'Strada, nr\u2026'}
                placeholderTextColor={Colors.inkFaint}
                value={address}
                onChangeText={setAddress}
              />
              <TouchableOpacity style={styles.geocodeBtn} onPress={() => Alert.alert('În curând', 'Această funcție va fi disponibilă în curând.')}>
                <Lucide name="map-pin" size={14} color={Colors.white} />
                <Text style={styles.geocodeBtnText}>{'Pin pe hartă'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Notes Field */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>NOTE</Text>
            <TextInput
              style={[styles.textarea, styles.textareaInput]}
              placeholder={'Detalii adiționale...'}
              placeholderTextColor={Colors.inkFaint}
              value={notes}
              onChangeText={setNotes}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
              <Text style={styles.cancelText}>{'Anulează'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.submitBtn, loading && { opacity: 0.6 }]} onPress={handleSubmit} disabled={loading}>
              {loading ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <>
                  <Lucide name="plus" size={16} color={Colors.white} />
                  <Text style={styles.submitText}>{'Adaugă'}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a140a88',
  },
  mapBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#d4e4d0',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 684,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
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
    backgroundColor: Colors.border,
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
    color: Colors.ink,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.bg,
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
    color: Colors.inkFaint,
    letterSpacing: 0.7,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg,
    borderRadius: 8,
    height: 42,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.ink,
  },
  inputSelect: {
    justifyContent: 'space-between',
  },
  inputPlaceholder: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.inkFaint,
  },
  inputValue: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.ink,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg,
    borderRadius: 8,
    height: 42,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeBtnActive: {
    backgroundColor: Colors.greenPale,
    borderColor: Colors.greenDim,
  },
  typeBtnText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.inkMuted,
  },
  typeBtnTextActive: {
    color: Colors.greenMid,
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
    backgroundColor: Colors.green,
    borderRadius: 8,
    height: 42,
    paddingHorizontal: 14,
    gap: 6,
  },
  geocodeBtnText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.white,
  },
  textarea: {
    backgroundColor: Colors.bg,
    borderRadius: 8,
    height: 70,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textareaInput: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.ink,
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
    borderColor: Colors.border,
  },
  cancelText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.inkMuted,
  },
  submitBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.green,
    borderRadius: Radius.md,
    height: 46,
    gap: 8,
  },
  submitText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
});
