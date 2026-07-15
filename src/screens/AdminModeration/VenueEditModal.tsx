// T052: admin venue edit modal. Form state/rendering now comes from the
// shared useVenueForm + VenueFormFields (also used by AddVenueScreen). The
// modal stays mounted in the shell and shows when `venue` is non-null; it is
// opened from both the pending list (Reviews tab) and venue search (Venues
// tab), so saves write to both react-query caches.
import React, { useMemo, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Modal } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { showAlert } from '../../lib/dialogs';
import { useTheme } from '../../hooks/useTheme';
import { useI18n } from '../../hooks/useI18n';
import { useSession } from '../../hooks/useSession';
import { useCitiesQuery } from '../../hooks/queries/useCitiesQuery';
import {
  adminPendingVenuesKey,
  adminVenueSearchKeyPrefix,
} from '../../hooks/queries/useAdminListsQuery';
import { useVenueForm } from '../../hooks/useVenueForm';
import { VenueFormFields, type VenueFormFieldStyles } from '../../components/VenueFormFields';
import { upsertCity } from '../../services/cities';
import { canonicalizeCityName } from '../../lib/cityCatalog';
import { updateVenue } from '../../services/admin';
import type { AdminModerationStyles } from '../AdminModerationScreen.styles';

interface VenueEditModalProps {
  venue: any | null;
  styles: AdminModerationStyles;
  onClose: () => void;
}

export function VenueEditModal({ venue, styles, onClose }: VenueEditModalProps) {
  const { user } = useSession();
  const { s } = useI18n();
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const form = useVenueForm();
  const { initFromVenue } = form;
  const [saving, setSaving] = useState(false);

  // Ref to the modal's scroll view so AddressPickerField can disable parent
  // scrolling while the user pans the map. Without this, single-finger pan
  // gestures get stolen by the ScrollView before MapLibre claims them.
  const editScrollRef = useRef<any>(null);

  // Re-init the form whenever a venue is opened (layout effect: before paint,
  // so the previous venue's values never flash).
  useLayoutEffect(() => {
    if (venue) initFromVenue(venue);
  }, [venue, initFromVenue]);

  // Read from the delta-synced cities cache: instant render after the
  // first sync, only fetches added/changed/removed rows on each open.
  const { data: citiesList } = useCitiesQuery();
  const knownCities = useMemo(() => (citiesList ?? []).map((c) => c.name), [citiesList]);

  const fieldStyles = useMemo<VenueFormFieldStyles>(() => ({
    field: styles.modalField,
    label: styles.modalLabel,
    input: styles.modalInput,
    textarea: [styles.modalInput, { height: 70, textAlignVertical: 'top' as const }],
    typeRow: styles.modalTypeRow,
    typeBtn: styles.modalTypeBtn,
    typeBtnActive: styles.modalTypeBtnActive,
    typeBtnText: styles.modalTypeBtnText,
    typeBtnTextActive: styles.modalTypeBtnTextActive,
    choiceGrid: styles.modalChoiceGrid,
    choiceBtn: styles.modalChoiceBtn,
    choiceBtnActive: styles.modalChoiceBtnActive,
    choiceText: styles.modalChoiceText,
    choiceTextActive: styles.modalChoiceTextActive,
    photoGrid: styles.modalPhotoGrid,
    photoItem: styles.modalPhotoItem,
    photoImage: styles.modalPhotoImage,
    photoRemoveBtn: styles.modalPhotoRemoveBtn,
    photoRemoveText: styles.modalPhotoRemoveText,
    emptyText: styles.modalEmptyText,
  }), [styles]);

  const handleSaveEdit = useCallback(async () => {
    const { values } = form;
    if (!venue || !values.name.trim()) return;
    setSaving(true);

    const trimmedCity = values.city.trim();
    const canonicalCity = canonicalizeCityName(trimmedCity);
    let cityIdUpdate: number | undefined;
    const hasEnoughCityMetadata = !!values.countryCode && values.cityCenterLat != null && values.cityCenterLng != null;
    const shouldUpsertEditedCity = canonicalCity && (
      canonicalCity !== (venue.city ?? '').trim() ||
      (!venue.city_id && hasEnoughCityMetadata)
    );
    if (shouldUpsertEditedCity) {
      const { id: upsertedId, error: cityError } = await upsertCity(canonicalCity, {
        countryCode: values.countryCode ?? venue.cities?.country_code,
        countryName: values.countryName ?? venue.cities?.country_name,
        lat: values.cityCenterLat ?? values.lat,
        lng: values.cityCenterLng ?? values.lng,
        zoom: values.cityZoom ?? 12,
      });
      if (cityError || !upsertedId) {
        setSaving(false);
        showAlert(s('error'), s('genericError'));
        return;
      }
      cityIdUpdate = upsertedId;
    }

    const { data, error } = await updateVenue(venue.id, user!.id, {
      name: values.name.trim(),
      address: values.address.trim(),
      city: canonicalCity,
      ...(cityIdUpdate !== undefined ? { city_id: cityIdUpdate } : {}),
      type: values.type,
      tables_count: values.tables ? Number(values.tables) : null,
      condition: values.condition,
      night_lighting: values.nightLighting,
      nets: values.nets,
      verified: values.verified,
      photos: values.photos,
      description: values.description.trim() || null,
      lat: values.lat,
      lng: values.lng,
    });
    setSaving(false);
    if (error) { showAlert(s('error'), s('genericError')); return; }
    // Update in venue search results (any cached term)
    queryClient.setQueriesData<any[]>({ queryKey: adminVenueSearchKeyPrefix }, (prev) =>
      prev?.map((v) => (v.id === venue.id ? { ...v, ...data } : v)),
    );
    // Update in pending list too
    queryClient.setQueryData<any[]>(adminPendingVenuesKey, (prev) =>
      prev?.map((v) => (v.id === venue.id ? { ...v, ...data } : v)),
    );
    onClose();
  }, [venue, form, queryClient, onClose, user, s]);

  return (
    <Modal visible={venue !== null} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle}><View style={styles.modalHandleBar} /></View>
          <Text style={styles.modalTitle}>{s('editVenue')}</Text>

          <ScrollView
            ref={editScrollRef}
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <VenueFormFields
              form={form}
              fields={['name', 'type', 'address', 'city', 'tables', 'condition', 'lighting', 'nets', 'verified', 'photos', 'description']}
              styles={fieldStyles}
              knownCities={knownCities}
              knownCityRecords={citiesList ?? []}
              parentScrollRef={editScrollRef}
              testIDs={{ description: 'edit-description' }}
            />
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose}>
              <Text style={styles.modalCancelText}>{s('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalSaveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSaveEdit}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.textOnPrimary} />
              ) : (
                <Text style={styles.modalSaveText}>{s('save')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
