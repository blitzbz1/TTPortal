import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { Colors, Fonts, Radius } from '../theme';
import { useSession } from '../hooks/useSession';
import { getVenueById } from '../services/venues';
import { createReview } from '../services/reviews';

interface Props {
  venueId?: string;
}

export function WriteReviewScreen({ venueId }: Props) {
  const router = useRouter();
  const { user } = useSession();
  const [rating, setRating] = useState(4);
  const [reviewText, setReviewText] = useState('');
  const [venueName, setVenueName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!venueId) return;
    let cancelled = false;
    async function load() {
      const { data } = await getVenueById(Number(venueId));
      if (!cancelled && data) setVenueName(data.name);
    }
    load();
    return () => { cancelled = true; };
  }, [venueId]);

  const handleSubmit = useCallback(async () => {
    if (rating < 1) { Alert.alert('Eroare', 'Te rugăm să selectezi un rating.'); return; }
    if (!reviewText.trim()) { Alert.alert('Eroare', 'Te rugăm să scrii o recenzie.'); return; }
    if (!user || !venueId) return;
    setLoading(true);
    const { error } = await createReview({
      venue_id: Number(venueId),
      user_id: user.id,
      reviewer_name: user?.user_metadata?.full_name || 'Anonim',
      rating,
      body: reviewText.trim(),
      flagged: false,
      flag_count: 0,
    });
    setLoading(false);
    if (error) { Alert.alert('Eroare', error.message); return; }
    Alert.alert('Succes', 'Recenzia a fost publicată.');
    router.back();
  }, [rating, reviewText, user, venueId, router]);

  return (
    <SafeAreaView style={styles.container}>
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
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
            <Lucide name="x" size={16} color={Colors.inkFaint} />
          </TouchableOpacity>
        </View>

        {/* Venue Name */}
        <View style={styles.venueName}>
          <Lucide name="map-pin" size={14} color={Colors.inkFaint} />
          <Text style={styles.venueNameText}>{venueName || 'Se încarcă...'}</Text>
        </View>

        <ScrollView style={styles.formScroll}>
          {/* Name Field */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{'NUMELE TĂU'}</Text>
            <View style={styles.input}>
              <Text style={styles.inputValue}>{user?.user_metadata?.full_name || 'Anonim'}</Text>
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
            <TextInput
              style={[styles.textarea, styles.textareaInput]}
              placeholder={'Cum a fost experiența ta?'}
              placeholderTextColor={Colors.inkFaint}
              value={reviewText}
              onChangeText={setReviewText}
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
                  <Lucide name="send" size={16} color={Colors.white} />
                  <Text style={styles.submitText}>{'Publică'}</Text>
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
  inputValue: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.ink,
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
