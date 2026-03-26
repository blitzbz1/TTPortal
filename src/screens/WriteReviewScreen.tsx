import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Lucide } from '../components/Icon';
import { Colors, Fonts, Radius } from '../theme';

export function WriteReviewScreen() {
  const [rating, setRating] = useState(4);

  return (
    <View style={styles.container}>
      {/* Dim background */}
      <View style={styles.dimBg} />

      {/* Review Sheet */}
      <View style={styles.sheet}>
        {/* Handle */}
        <View style={styles.handleWrap}>
          <View style={styles.handleBar} />
        </View>

        {/* Header */}
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Scrie o recenzie</Text>
          <TouchableOpacity style={styles.closeBtn}>
            <Lucide name="x" size={16} color={Colors.inkFaint} />
          </TouchableOpacity>
        </View>

        {/* Venue Name */}
        <View style={styles.venueName}>
          <Lucide name="map-pin" size={14} color={Colors.inkFaint} />
          <Text style={styles.venueNameText}>Parcul Na&#539;ional</Text>
        </View>

        <ScrollView style={styles.formScroll}>
          {/* Name Field */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>NUMELE T&#258;U</Text>
            <View style={styles.input}>
              <Text style={styles.inputPlaceholder}>Anonim</Text>
            </View>
          </View>

          {/* Rating */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>RATING</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  style={[styles.starBtn, star <= rating ? styles.starBtnActive : styles.starBtnInactive]}
                  onPress={() => setRating(star)}
                >
                  <Text style={[styles.starText, star <= rating ? styles.starTextActive : styles.starTextInactive]}>
                    {'\u2605'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Review Text */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>RECENZIA TA</Text>
            <View style={styles.textarea}>
              <Text style={styles.inputPlaceholder}>Cum a fost experien&#539;a ta?</Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Anuleaz&#259;</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitBtn}>
              <Lucide name="send" size={16} color={Colors.white} />
              <Text style={styles.submitText}>Public&#259;</Text>
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
  },
  dimBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a140a55',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 464,
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
    backgroundColor: Colors.bgDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  venueName: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 6,
  },
  venueNameText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.inkMuted,
  },
  formScroll: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
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
  inputPlaceholder: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.inkFaint,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  starBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starBtnActive: {
    backgroundColor: Colors.green,
  },
  starBtnInactive: {
    backgroundColor: Colors.bgDark,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  starText: {
    fontSize: 20,
  },
  starTextActive: {
    color: Colors.white,
  },
  starTextInactive: {
    color: Colors.inkFaint,
  },
  textarea: {
    backgroundColor: Colors.bg,
    borderRadius: 8,
    height: 90,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 8,
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
