// T052: venue change-request tab. The resolve/dismiss RPCs (migration 098)
// do the auditing DB-side — call shapes must stay exactly as they were.
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { showAlert } from '../../lib/dialogs';
import { Lucide } from '../../components/Icon';
import { FullscreenImageViewer } from '../../components/FullscreenImageViewer';
import { Fonts } from '../../theme';
import { useTheme } from '../../hooks/useTheme';
import { useI18n } from '../../hooks/useI18n';
import { useSession } from '../../hooks/useSession';
import {
  adminChangeRequestsKey,
  useAdminChangeRequestsQuery,
} from '../../hooks/queries/useAdminListsQuery';
import {
  resolveVenueChangeRequest,
  dismissVenueChangeRequest,
  type VenueChangeRequestDecision,
} from '../../services/admin';
import { VenueChangeRequestCard } from './cards';
import type { AdminModerationStyles } from '../AdminModerationScreen.styles';

interface ChangesTabProps {
  isAdmin: boolean;
  styles: AdminModerationStyles;
}

export function ChangesTab({ isAdmin, styles }: ChangesTabProps) {
  const { user } = useSession();
  const { s } = useI18n();
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const { data: changeRequests = [], isLoading: changeRequestsLoading } = useAdminChangeRequestsQuery();
  const [photoViewerUrl, setPhotoViewerUrl] = useState<string | null>(null);

  const removeChangeRequest = useCallback((id: number) => {
    queryClient.setQueryData<any[]>(adminChangeRequestsKey, (prev) =>
      prev?.filter((r) => r.id !== id),
    );
  }, [queryClient]);

  const handleApplyChangeRequest = useCallback(async (request: any, decision: VenueChangeRequestDecision) => {
    const { error } = await resolveVenueChangeRequest(request.id, request.venue_id, user!.id, decision);
    if (error) {
      showAlert(s('error'), s('vcrApplyError'));
      return false;
    }
    // Refresh the list/map AND the affected venue's detail + intelligence
    // (amenities) queries so the venue screen reflects the approved changes.
    // Previously only ['venues'] was invalidated, so an already-loaded venue
    // detail kept showing the stale, pre-approval values.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['venues'], exact: false }),
      queryClient.invalidateQueries({ queryKey: ['venue-detail', request.venue_id], exact: false }),
      queryClient.invalidateQueries({ queryKey: ['venue-intel', request.venue_id], exact: false }),
    ]);
    removeChangeRequest(request.id);
    return true;
  }, [queryClient, removeChangeRequest, user, s]);

  const handleDismissChangeRequest = useCallback(async (id: number) => {
    const { error } = await dismissVenueChangeRequest(id, user!.id);
    if (error) {
      showAlert(s('error'), s('vcrDismissError'));
      return false;
    }
    removeChangeRequest(id);
    return true;
  }, [removeChangeRequest, user, s]);

  return (
    <>
      <ScrollView style={styles.scroll}>
        <View style={styles.secLabel}>
          <Text style={styles.secLabelText}>{s('venueChangeRequestsSection')}</Text>
        </View>
        {changeRequestsLoading ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ paddingVertical: 24 }} />
        ) : changeRequests.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <Lucide name="clipboard-pen-line" size={32} color={colors.border} />
            <Text style={{ fontFamily: Fonts.body, fontSize: 13, color: colors.textFaint, marginTop: 8 }}>
              {s('noChangeRequests')}
            </Text>
          </View>
        ) : (
          <View style={styles.modList}>
            {changeRequests.map((request) => (
              <VenueChangeRequestCard
                key={request.id}
                request={request}
                styles={styles}
                colors={colors}
                s={s}
                canRemove={isAdmin}
                onApply={handleApplyChangeRequest}
                onDismiss={handleDismissChangeRequest}
                onViewPhoto={setPhotoViewerUrl}
              />
            ))}
          </View>
        )}
      </ScrollView>
      <FullscreenImageViewer url={photoViewerUrl} onClose={() => setPhotoViewerUrl(null)} />
    </>
  );
}
