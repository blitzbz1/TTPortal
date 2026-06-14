import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { showAlert } from '../lib/dialogs';
import {
  Modal,
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import * as ImagePicker from 'expo-image-picker';
import { Lucide } from './Icon';
import { PhotoPickerButton } from './PhotoPickerButton';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius } from '../theme';
import { useI18n } from '../hooks/useI18n';
import { useVenueForm, parseTablesCount } from '../hooks/useVenueForm';
import type { VenueChangeRequestInput } from '../services/venueChangeRequests';
import {
  AMENITY_KEYS,
  AMENITY_LABEL_KEYS,
  ENTRY_FEE_VALUES,
  ENTRY_FEE_LABEL_KEYS,
  type EntryFee,
  type VenueAmenities,
} from '../lib/amenities';

type TriValue = boolean | null;

export type SelectedImage = {
  uri: string;
  width: number | null;
  height: number | null;
};

export type VenueChangeRequestModalProps = {
  visible: boolean;
  submitting?: boolean;
  /** Current venue values, shown as context next to each field. */
  current?: {
    nets?: boolean | null;
    night_lighting?: boolean | null;
    tables_count?: number | null;
    amenities?: VenueAmenities | null;
  };
  onClose: () => void;
  onSubmit: (payload: VenueChangeRequestInput, image: SelectedImage | null) => void;
};

const MAX_TABLES = 200;

export function VenueChangeRequestModal({
  visible,
  submitting,
  current,
  onClose,
  onSubmit,
}: VenueChangeRequestModalProps) {
  const { s } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // T052: nets / lighting / tables / note ride on the shared venue form
  // (note maps to `description`); the proposal-only bits stay local.
  const form = useVenueForm();
  const { values, set: setForm, reset: resetForm } = form;
  const [markUnavailable, setMarkUnavailable] = useState(false);
  const [image, setImage] = useState<SelectedImage | null>(null);
  // F012: amenity proposals — null = "no change" per key; entryFee likewise.
  const [amenitySel, setAmenitySel] = useState<Record<string, TriValue>>({});
  const [entryFeeSel, setEntryFeeSel] = useState<EntryFee | null>(null);

  const reset = useCallback(() => {
    resetForm();
    setMarkUnavailable(false);
    setImage(null);
    setAmenitySel({});
    setEntryFeeSel(null);
  }, [resetForm]);

  // Start each open with a fresh form. The parent closes the sheet by flipping
  // `visible` (not via handleClose) on success, so reset here rather than on submit.
  useEffect(() => {
    if (visible) reset();
  }, [visible, reset]);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handlePickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert(s('error'), s('photoPermissionDenied'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) {
      showAlert(s('error'), s('photoTooLarge'));
      return;
    }
    const allowed = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];
    if (asset.mimeType && !allowed.includes(asset.mimeType)) {
      showAlert(s('error'), s('photoUploadError'));
      return;
    }
    setImage({ uri: asset.uri, width: asset.width ?? null, height: asset.height ?? null });
  }, [s]);

  const tablesCheck = parseTablesCount(values.tables, { min: 0, max: MAX_TABLES, integerOnly: true });
  const tablesProvided = tablesCheck.provided && tablesCheck.valid;

  const buildAmenities = useCallback((): VenueAmenities | null => {
    const proposed: VenueAmenities = {};
    for (const key of AMENITY_KEYS) {
      const v = amenitySel[key];
      if (v === true || v === false) proposed[key] = v;
    }
    if (entryFeeSel) proposed.entry_fee = entryFeeSel;
    return Object.keys(proposed).length > 0 ? proposed : null;
  }, [amenitySel, entryFeeSel]);

  const amenityChanged = buildAmenities() !== null;

  const hasChange =
    values.nets !== null || values.nightLighting !== null || tablesProvided ||
    markUnavailable || amenityChanged;

  const handleSubmit = useCallback(() => {
    if (!hasChange) return;
    onSubmit({
      nets: values.nets,
      nightLighting: values.nightLighting,
      tablesCount: tablesProvided ? tablesCheck.value : null,
      markUnavailable,
      note: values.description.trim() ? values.description.trim() : null,
      amenities: buildAmenities(),
    }, image);
  }, [hasChange, values, tablesProvided, tablesCheck.value, markUnavailable, buildAmenities, image, onSubmit]);

  const renderTriState = (
    field: string,
    label: string,
    currentValue: boolean | null | undefined,
    value: TriValue,
    onChange: (v: TriValue) => void,
  ) => {
    const options: { v: TriValue; label: string }[] = [
      { v: null, label: s('vcrNoChange') },
      { v: true, label: s('yes') },
      { v: false, label: s('no') },
    ];
    return (
      <View style={styles.field}>
        <Text style={styles.label}>
          {label}
          {currentValue != null ? (
            <Text style={styles.labelHint}>
              {'  ·  '}
              {s('vcrCurrent')}: {currentValue ? s('yes') : s('no')}
            </Text>
          ) : null}
        </Text>
        <View style={styles.choiceRow}>
          {options.map((o) => {
            const active = value === o.v;
            return (
              <Pressable
                key={String(o.v)}
                onPress={() => onChange(o.v)}
                style={[styles.choiceBtn, active && styles.choiceBtnActive]}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                testID={`vcr-${field}-${String(o.v)}`}
              >
                <Text style={[styles.choiceText, active && styles.choiceTextActive]}>
                  {o.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <Pressable
        style={styles.overlay}
        onPress={handleClose}
        accessibilityRole="button"
        accessibilityLabel={s('cancel')}
      >
        <Pressable style={styles.sheet} onPress={() => {}}>
        <View style={styles.header}>
          <Text style={styles.title}>{s('vcrTitle')}</Text>
          <Pressable
            onPress={handleClose}
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
            testID="vcr-modal-close"
          >
            <Lucide name="x" size={22} color={colors.textMuted} />
          </Pressable>
        </View>

        <Text style={styles.subtitle}>{s('vcrSubtitle')}</Text>

        <KeyboardAwareScrollView
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          bottomOffset={20}
          showsVerticalScrollIndicator={false}
        >
          {renderTriState('nets', s('vcrFieldNets'), current?.nets, values.nets, (v) => setForm({ nets: v }))}
          {renderTriState('lighting', s('vcrFieldLighting'), current?.night_lighting, values.nightLighting, (v) => setForm({ nightLighting: v }))}

          <View style={styles.field}>
            <Text style={styles.label}>
              {s('vcrFieldTables')}
              {current?.tables_count != null ? (
                <Text style={styles.labelHint}>
                  {'  ·  '}
                  {s('vcrCurrent')}: {current.tables_count}
                </Text>
              ) : null}
            </Text>
            <TextInput
              style={styles.input}
              value={values.tables}
              onChangeText={(text) => setForm({ tables: text })}
              placeholder={s('vcrNoChange')}
              placeholderTextColor={colors.textFaint}
              keyboardType="number-pad"
              maxLength={3}
              testID="vcr-tables-input"
            />
          </View>

          {/* F012: amenity proposals (all optional). */}
          <Text style={[styles.label, styles.amenityHeader]}>{s('vcrFieldAmenities')}</Text>
          {AMENITY_KEYS.map((key) =>
            renderTriState(
              `amenity-${key}`,
              s(AMENITY_LABEL_KEYS[key]),
              current?.amenities?.[key],
              amenitySel[key] ?? null,
              (v) => setAmenitySel((prev) => ({ ...prev, [key]: v })),
            ),
          )}
          <View style={styles.field}>
            <Text style={styles.label}>
              {s('vcrFieldEntryFee')}
              {current?.amenities?.entry_fee ? (
                <Text style={styles.labelHint}>
                  {'  ·  '}
                  {s('vcrCurrent')}: {s(ENTRY_FEE_LABEL_KEYS[current.amenities.entry_fee])}
                </Text>
              ) : null}
            </Text>
            <View style={[styles.choiceRow, styles.choiceRowWrap]}>
              {([{ v: null as EntryFee | null, label: s('vcrNoChange') }] as { v: EntryFee | null; label: string }[])
                .concat(ENTRY_FEE_VALUES.map((f) => ({ v: f, label: s(ENTRY_FEE_LABEL_KEYS[f]) })))
                .map((o) => {
                  const active = entryFeeSel === o.v;
                  return (
                    <Pressable
                      key={String(o.v)}
                      onPress={() => setEntryFeeSel(o.v)}
                      style={[styles.choiceBtn, styles.choiceBtnWrap, active && styles.choiceBtnActive]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      testID={`vcr-entryfee-${String(o.v)}`}
                    >
                      <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{o.label}</Text>
                    </Pressable>
                  );
                })}
            </View>
          </View>

          <Pressable
            onPress={() => setMarkUnavailable((v) => !v)}
            style={[styles.unavailRow, markUnavailable && styles.unavailRowActive]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: markUnavailable }}
            testID="vcr-unavailable"
          >
            <View style={[styles.checkbox, markUnavailable && styles.checkboxActive]}>
              {markUnavailable && <Lucide name="check" size={14} color={colors.textOnPrimary} />}
            </View>
            <Text style={styles.unavailText}>{s('vcrUnavailableToggle')}</Text>
          </Pressable>

          <TextInput
            style={styles.notes}
            value={values.description}
            onChangeText={(text) => setForm({ description: text })}
            placeholder={s('vcrNotePlaceholder')}
            placeholderTextColor={colors.textFaint}
            multiline
            maxLength={500}
            testID="vcr-note-input"
          />

          <View style={styles.field}>
            <Text style={styles.label}>{s('addPhotoOptional')}</Text>
            <PhotoPickerButton
              photoUri={image?.uri ?? null}
              onPress={handlePickImage}
              addLabel={s('vcrAddPhoto')}
              changeLabel={s('changePhoto')}
              testID="vcr-photo-pick"
            />
          </View>
          <Pressable
            onPress={handleSubmit}
            disabled={!hasChange || submitting}
            style={[styles.submitBtn, (!hasChange || submitting) && styles.submitBtnDisabled]}
            testID="vcr-submit"
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.textOnPrimary} />
            ) : (
              <Text style={styles.submitText}>{s('vcrSubmit')}</Text>
            )}
          </Pressable>
        </KeyboardAwareScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.xl,
      maxHeight: '85%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      marginBottom: 4,
    },
    title: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xl,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    subtitle: {
      paddingHorizontal: Spacing.md,
      fontFamily: Fonts.body,
      fontSize: 14,
      color: colors.textMuted,
      marginBottom: Spacing.md,
    },
    bodyContent: {
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.md,
    },
    field: {
      gap: 8,
      marginBottom: Spacing.md,
    },
    label: {
      fontFamily: Fonts.body,
      fontSize: 12,
      fontWeight: FontWeight.semibold,
      color: colors.textMuted,
      letterSpacing: 1.1,
      textTransform: 'uppercase',
    },
    labelHint: {
      fontWeight: FontWeight.medium,
      color: colors.textFaint,
      letterSpacing: 0.4,
      textTransform: 'none',
    },
    choiceRow: {
      flexDirection: 'row',
      gap: Spacing.xs,
    },
    choiceRowWrap: {
      flexWrap: 'wrap',
    },
    amenityHeader: {
      marginBottom: Spacing.xs,
    },
    choiceBtnWrap: {
      flex: 0,
      flexBasis: '47%',
    },
    choiceBtn: {
      flex: 1,
      minHeight: 40,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bgAlt,
      borderRadius: Radius.md,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    choiceBtnActive: {
      backgroundColor: colors.primaryPale,
      borderColor: colors.primary,
    },
    choiceText: {
      fontFamily: Fonts.body,
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
    },
    choiceTextActive: {
      color: colors.primaryMid,
      fontWeight: FontWeight.semibold,
    },
    input: {
      backgroundColor: colors.bgAlt,
      borderRadius: Radius.md,
      height: 44,
      paddingHorizontal: 12,
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    },
    unavailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.md,
      marginBottom: Spacing.md,
      backgroundColor: colors.bgAlt,
    },
    unavailRowActive: {
      borderColor: colors.red,
      backgroundColor: colors.redPale,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxActive: {
      borderColor: colors.red,
      backgroundColor: colors.red,
    },
    unavailText: {
      flex: 1,
      fontFamily: Fonts.body,
      fontSize: 15,
      color: colors.text,
    },
    notes: {
      backgroundColor: colors.bgAlt,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.md,
      padding: 12,
      minHeight: 80,
      fontFamily: Fonts.body,
      fontSize: 14,
      color: colors.text,
      textAlignVertical: 'top',
    },
    submitBtn: {
      marginTop: Spacing.sm,
      backgroundColor: colors.primary,
      borderRadius: Radius.lg,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitBtnDisabled: {
      opacity: 0.5,
    },
    submitText: {
      fontFamily: Fonts.body,
      fontSize: 16,
      fontWeight: '700',
      color: colors.textOnPrimary,
    },
  });
}
