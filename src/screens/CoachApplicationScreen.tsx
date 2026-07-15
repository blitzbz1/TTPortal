// F063: the "I coach" application screen. A form (bio, experience, levels,
// languages, price range, contact, up to 3 venues) → apply_to_coach. When the
// user has already applied, the current status (pending / approved / rejected)
// is shown above the form; submitting again re-applies and resets to pending.
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { showAlert } from '../lib/dialogs';
import { Lucide } from '../components/Icon';
import { VenuePickerModal } from '../components/VenuePickerModal';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius, Shadows } from '../theme';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import { applyToCoach, getCoachVenues } from '../services/coaches';
import { useCoachProfileQuery, coachProfileQueryKey } from '../features/coaches';

// Stored values (locale-stable); the label is translated for display.
const LEVEL_OPTIONS = ['beginner', 'intermediate', 'advanced', 'competitive', 'youth'] as const;
const LANGUAGE_OPTIONS = ['en', 'ro', 'de', 'it', 'fr', 'es', 'pl', 'cs'] as const;
const MAX_VENUES = 3;

interface PickedVenue {
  id: number;
  name: string;
}

export function CoachApplicationScreen() {
  const router = useRouter();
  const { user } = useSession();
  const { s } = useI18n();
  const { colors, isDark } = useTheme();
  const headerFg = isDark ? colors.text : colors.textOnPrimary;
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const queryClient = useQueryClient();

  const { data: existing, isLoading: existingLoading } = useCoachProfileQuery(user?.id);

  const [bio, setBio] = useState('');
  const [experience, setExperience] = useState('');
  const [levels, setLevels] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState('');
  const [contact, setContact] = useState('');
  const [venues, setVenues] = useState<PickedVenue[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Prefill the form from a prior application (so re-applying edits in place).
  useEffect(() => {
    if (hydrated || !existing) return;
    setBio(existing.bio ?? '');
    setExperience(existing.experience ?? '');
    setLevels(existing.levels ?? []);
    setLanguages(existing.languages ?? []);
    setPriceRange(existing.price_range ?? '');
    setContact(existing.contact ?? '');
    setHydrated(true);
    // Prefill the venue set too: apply_to_coach REPLACES coach_venues, so
    // re-applying without these would silently wipe the coach's listed venues.
    let cancelled = false;
    getCoachVenues(existing.id).then(({ data }) => {
      if (!cancelled && data && data.length) setVenues(data);
    });
    return () => {
      cancelled = true;
    };
  }, [existing, hydrated]);

  const toggle = useCallback((list: string[], value: string, set: (next: string[]) => void) => {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }, []);

  const addVenue = useCallback((venue: { id: number; name: string } | null) => {
    setPickerVisible(false);
    if (!venue) return;
    setVenues((prev) => {
      if (prev.some((v) => v.id === venue.id) || prev.length >= MAX_VENUES) return prev;
      return [...prev, { id: venue.id, name: venue.name }];
    });
  }, []);

  const removeVenue = useCallback((id: number) => {
    setVenues((prev) => prev.filter((v) => v.id !== id));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!user) return;
    if (!bio.trim()) {
      showAlert(s('error'), s('coachBioRequired'));
      return;
    }
    setSubmitting(true);
    const { error } = await applyToCoach(user.id, {
      bio: bio.trim(),
      experience: experience.trim() || null,
      levels,
      languages,
      priceRange: priceRange.trim() || null,
      contact: contact.trim() || null,
      venueIds: venues.map((v) => v.id),
    });
    setSubmitting(false);
    if (error) {
      showAlert(s('error'), error.message ?? s('genericError'));
      return;
    }
    queryClient.invalidateQueries({ queryKey: coachProfileQueryKey(user.id) });
    showAlert(s('coachApplySuccessTitle'), s('coachApplySuccessMessage'));
    router.back();
  }, [user, bio, experience, levels, languages, priceRange, contact, venues, queryClient, router, s]);

  const statusBanner = existing ? (
    <View
      style={[
        styles.statusBanner,
        existing.status === 'approved' && { backgroundColor: colors.primaryPale, borderColor: colors.primary },
        existing.status === 'rejected' && { backgroundColor: colors.redPale, borderColor: colors.red },
      ]}
      testID="coach-status-banner"
    >
      <Text style={styles.statusText}>
        {existing.status === 'approved'
          ? s('coachStatusApproved')
          : existing.status === 'rejected'
            ? s('coachStatusRejected')
            : s('coachStatusPending')}
      </Text>
    </View>
  ) : null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Lucide name="arrow-left" size={24} color={headerFg} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{s('coachApplyTitle')}</Text>
        <View style={{ width: 24 }} />
      </View>

      {existingLoading && !existing ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ flex: 1, marginTop: 40 }} />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView style={styles.scroll} contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md }}>
            {statusBanner}
            <Text style={styles.intro}>{s('coachApplyIntro')}</Text>

            {/* Bio */}
            <View style={styles.field}>
              <Text style={styles.label}>{s('coachBioLabel')}</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={bio}
                onChangeText={setBio}
                placeholder={s('coachBioPlaceholder')}
                placeholderTextColor={colors.textFaint}
                multiline
                maxLength={1000}
                testID="coach-bio-input"
              />
            </View>

            {/* Experience */}
            <View style={styles.field}>
              <Text style={styles.label}>{s('coachExperienceLabel')}</Text>
              <TextInput
                style={styles.input}
                value={experience}
                onChangeText={setExperience}
                placeholder={s('coachExperiencePlaceholder')}
                placeholderTextColor={colors.textFaint}
                testID="coach-experience-input"
              />
            </View>

            {/* Levels */}
            <View style={styles.field}>
              <Text style={styles.label}>{s('coachLevelsLabel')}</Text>
              <View style={styles.chipGrid}>
                {LEVEL_OPTIONS.map((lvl) => {
                  const active = levels.includes(lvl);
                  return (
                    <TouchableOpacity
                      key={lvl}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => toggle(levels, lvl, setLevels)}
                      testID={`coach-level-${lvl}`}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{s(`coachLevel_${lvl}`)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Languages */}
            <View style={styles.field}>
              <Text style={styles.label}>{s('coachLanguagesLabel')}</Text>
              <View style={styles.chipGrid}>
                {LANGUAGE_OPTIONS.map((lng) => {
                  const active = languages.includes(lng);
                  return (
                    <TouchableOpacity
                      key={lng}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => toggle(languages, lng, setLanguages)}
                      testID={`coach-language-${lng}`}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{s(`coachLanguage_${lng}`)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Price range */}
            <View style={styles.field}>
              <Text style={styles.label}>{s('coachPriceLabel')}</Text>
              <TextInput
                style={styles.input}
                value={priceRange}
                onChangeText={setPriceRange}
                placeholder={s('coachPricePlaceholder')}
                placeholderTextColor={colors.textFaint}
                testID="coach-price-input"
              />
            </View>

            {/* Contact */}
            <View style={styles.field}>
              <Text style={styles.label}>{s('coachContactLabel')}</Text>
              <TextInput
                style={styles.input}
                value={contact}
                onChangeText={setContact}
                placeholder={s('coachContactPlaceholder')}
                placeholderTextColor={colors.textFaint}
                testID="coach-contact-input"
              />
            </View>

            {/* Venues (≤3) */}
            <View style={styles.field}>
              <Text style={styles.label}>{s('coachVenuesLabel', String(MAX_VENUES))}</Text>
              {venues.map((v) => (
                <View key={v.id} style={styles.venueRow}>
                  <Text style={styles.venueName} numberOfLines={1}>{v.name}</Text>
                  <TouchableOpacity onPress={() => removeVenue(v.id)} testID={`coach-venue-remove-${v.id}`}>
                    <Lucide name="x" size={18} color={colors.red} />
                  </TouchableOpacity>
                </View>
              ))}
              {venues.length < MAX_VENUES && (
                <TouchableOpacity
                  style={styles.addVenueBtn}
                  onPress={() => setPickerVisible(true)}
                  testID="coach-add-venue"
                >
                  <Lucide name="plus" size={16} color={colors.primary} />
                  <Text style={styles.addVenueText}>{s('coachAddVenue')}</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={submitting}
              testID="coach-submit"
            >
              {submitting ? (
                <ActivityIndicator size="small" color={colors.textOnPrimary} />
              ) : (
                <Text style={styles.submitText}>
                  {existing ? s('coachReapplyButton') : s('coachApplyButton')}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      <VenuePickerModal
        visible={pickerVisible}
        selectedVenueId={null}
        onSelect={addVenue}
        onClose={() => setPickerVisible(false)}
      />
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDark ? colors.bgAlt : colors.primary,
      paddingVertical: 10,
      paddingHorizontal: Spacing.md,
      minHeight: 52,
      ...Shadows.bar,
    },
    headerTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      color: isDark ? colors.text : colors.textOnPrimary,
    },
    scroll: { flex: 1 },
    intro: { fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.textMuted },
    statusBanner: {
      borderWidth: 1,
      borderColor: colors.amber,
      backgroundColor: colors.amberPale,
      borderRadius: Radius.md,
      padding: Spacing.sm,
    },
    statusText: { fontFamily: Fonts.body, fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: colors.text },
    field: { gap: Spacing.xs },
    label: { fontFamily: Fonts.body, fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: colors.text },
    input: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.text,
      backgroundColor: colors.bgAlt,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 10,
    },
    multiline: { minHeight: 90, textAlignVertical: 'top' },
    chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
    chip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.full,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: colors.bgAlt,
    },
    chipActive: { borderColor: colors.primary, backgroundColor: colors.primaryPale },
    chipText: { fontFamily: Fonts.body, fontSize: FontSize.sm, color: colors.textMuted },
    chipTextActive: { color: colors.primary, fontWeight: FontWeight.semibold },
    venueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.bgMuted,
      borderRadius: Radius.sm,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 10,
    },
    venueName: { flex: 1, fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.text, marginRight: Spacing.sm },
    addVenueBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 10,
    },
    addVenueText: { fontFamily: Fonts.body, fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: colors.primary },
    submitBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderRadius: Radius.md,
      paddingVertical: 14,
      marginTop: Spacing.sm,
      ...Shadows.md,
    },
    submitText: { fontFamily: Fonts.body, fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: colors.textOnPrimary },
  });
}
