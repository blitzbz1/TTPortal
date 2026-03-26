import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Lucide } from '../components/Icon';
import { Colors, Fonts, Radius } from '../theme';

export function AddVenueScreen() {
  return (
    <View style={styles.container}>
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
          <Text style={styles.sheetTitle}>Adaug&#259; loca&#539;ie</Text>
          <TouchableOpacity style={styles.closeBtn}>
            <Lucide name="x" size={16} color={Colors.inkFaint} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.formScroll}>
          {/* Name Field */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>NUME LOCA&#538;IE *</Text>
            <View style={styles.input}>
              <Text style={styles.inputPlaceholder}>ex: Parcul Tineretului</Text>
            </View>
          </View>

          {/* Type Field */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>TIP</Text>
            <View style={[styles.input, styles.inputSelect]}>
              <Text style={styles.inputValue}>{'\uD83C\uDF33'} Parc exterior</Text>
              <Lucide name="chevron-down" size={16} color={Colors.inkFaint} />
            </View>
          </View>

          {/* Nr Mese / Oras */}
          <View style={styles.fieldRow}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>NR. MESE</Text>
              <View style={styles.input}>
                <Text style={styles.inputPlaceholder}>2</Text>
              </View>
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>ORA&#536; *</Text>
              <View style={[styles.input, styles.inputSelect]}>
                <Text style={styles.inputValue}>Bucure&#537;ti</Text>
                <Lucide name="chevron-down" size={16} color={Colors.inkFaint} />
              </View>
            </View>
          </View>

          {/* Address Field */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>ADRES&#258; *</Text>
            <View style={styles.addressRow}>
              <View style={[styles.input, { flex: 1 }]}>
                <Text style={styles.inputPlaceholder}>Strada, nr&#8230;</Text>
              </View>
              <TouchableOpacity style={styles.geocodeBtn}>
                <Lucide name="map-pin" size={14} color={Colors.white} />
                <Text style={styles.geocodeBtnText}>Pin pe hart&#259;</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Notes Field */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>NOTE</Text>
            <View style={styles.textarea}>
              <Text style={styles.inputPlaceholder}>Detalii adi&#539;ionale...</Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Anuleaz&#259;</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitBtn}>
              <Lucide name="plus" size={16} color={Colors.white} />
              <Text style={styles.submitText}>Adaug&#259;</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </View>
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
