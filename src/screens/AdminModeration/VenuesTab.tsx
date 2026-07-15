// T052: admin venue search tab. The query text lives in the shell so it
// survives tab switches (the old screen kept it in screen-level state);
// results live in the react-query cache keyed by the debounced term, so the
// edit modal can update them from outside via adminVenueSearchKeyPrefix.
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, TextInput, Modal, Pressable } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { showAlert } from '../../lib/dialogs';
import { Lucide } from '../../components/Icon';
import { Fonts } from '../../theme';
import { useTheme } from '../../hooks/useTheme';
import { useI18n } from '../../hooks/useI18n';
import { useSession } from '../../hooks/useSession';
import {
  adminVenueSearchKeyPrefix,
  useAdminVenueSearchQuery,
} from '../../hooks/queries/useAdminListsQuery';
import { deleteVenue } from '../../services/admin';
import type { AdminModerationStyles } from '../AdminModerationScreen.styles';

interface VenuesTabProps {
  styles: AdminModerationStyles;
  venueQuery: string;
  onChangeVenueQuery: (text: string) => void;
  onEditVenue: (venue: any) => void;
}

export function VenuesTab({ styles, venueQuery, onChangeVenueQuery, onEditVenue }: VenuesTabProps) {
  const { user } = useSession();
  const { s } = useI18n();
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const [debouncedQuery, setDebouncedQuery] = useState(() =>
    venueQuery.trim().length >= 3 ? venueQuery.trim() : '',
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Delete (approved) venue confirmation — the dialog's button callbacks
  // don't fire on react-native-web, so we use a bottom sheet here.
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const { data: venueResults = [], isFetching } = useAdminVenueSearchQuery(debouncedQuery);
  const trimmedQuery = venueQuery.trim();
  const venuesSearching = trimmedQuery.length >= 3 && (debouncedQuery !== trimmedQuery || isFetching);

  const handleVenueSearch = useCallback((text: string) => {
    onChangeVenueQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 3) {
      setDebouncedQuery('');
      return;
    }
    debounceRef.current = setTimeout(() => setDebouncedQuery(text.trim()), 400);
  }, [onChangeVenueQuery]);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget || !user) return;
    setDeleteSubmitting(true);
    const { error } = await deleteVenue(deleteTarget.id, user.id);
    setDeleteSubmitting(false);
    if (error) {
      showAlert(s('error'), s('deleteVenueError'));
      return;
    }
    const deletedId = deleteTarget.id;
    queryClient.setQueriesData<any[]>({ queryKey: adminVenueSearchKeyPrefix }, (prev) =>
      prev?.filter((v) => v.id !== deletedId),
    );
    setDeleteTarget(null);
  }, [deleteTarget, queryClient, user, s]);

  return (
    <>
      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Search */}
        <View style={styles.venueSearchWrap}>
          <Lucide name="search" size={16} color={colors.textFaint} />
          <TextInput
            style={styles.venueSearchInput}
            placeholder={s('searchVenues')}
            placeholderTextColor={colors.textFaint}
            value={venueQuery}
            onChangeText={handleVenueSearch}
          />
          {venueQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleVenueSearch('')}>
              <Lucide name="x" size={16} color={colors.textFaint} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.venueList}>
          {trimmedQuery.length < 3 ? (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <Lucide name="search" size={32} color={colors.border} />
              <Text style={{ fontFamily: Fonts.body, fontSize: 13, color: colors.textFaint, marginTop: 8 }}>
                {s('searchVenuesHint')}
              </Text>
            </View>
          ) : venuesSearching ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ paddingVertical: 24 }} />
          ) : venueResults.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <Text style={{ fontFamily: Fonts.body, fontSize: 13, color: colors.textFaint }}>
                {s('noVenues')}
              </Text>
            </View>
          ) : (
            venueResults.map((venue) => (
              <View key={venue.id} style={styles.venueCard}>
                <View style={styles.venueInfo}>
                  <Text style={styles.venueName}>{venue.name}</Text>
                  <Text style={styles.venueMeta}>
                    {venue.city ?? ''}{venue.address ? ` · ${venue.address}` : ''}
                  </Text>
                </View>
                <View style={styles.venueActions}>
                  <TouchableOpacity
                    style={styles.venueEditBtn}
                    onPress={() => onEditVenue(venue)}
                    testID={`venue-edit-${venue.id}`}
                  >
                    <Lucide name="pencil" size={14} color={colors.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.venueDeleteBtn} onPress={() => setDeleteTarget(venue)}>
                    <Lucide name="trash-2" size={14} color={colors.red} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Delete approved-venue confirmation bottom sheet. Same shape as
          reject — duplicated rather than abstracted because the copy and
          the action differ and there are only two of them. */}
      <Modal
        visible={deleteTarget !== null}
        transparent
        animationType="slide"
        onRequestClose={() => !deleteSubmitting && setDeleteTarget(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => !deleteSubmitting && setDeleteTarget(null)}>
          <Pressable style={styles.confirmSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle}><View style={styles.modalHandleBar} /></View>
            <Text style={styles.modalTitle}>{s('confirmDeleteVenue')}</Text>
            <View style={styles.confirmBody}>
              {deleteTarget?.name ? (
                <Text style={styles.confirmVenueName}>{deleteTarget.name}</Text>
              ) : null}
              <Text style={styles.confirmMessage}>{s('confirmDeleteVenueMessage')}</Text>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setDeleteTarget(null)}
                disabled={deleteSubmitting}
              >
                <Text style={styles.modalCancelText}>{s('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmRejectBtn, deleteSubmitting && { opacity: 0.6 }]}
                onPress={confirmDelete}
                disabled={deleteSubmitting}
              >
                {deleteSubmitting ? (
                  <ActivityIndicator size="small" color={colors.textOnPrimary} />
                ) : (
                  <Text style={styles.confirmRejectText}>{s('deleteBtn')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
