// T052: shell only — admin/moderator gate, tab bar, and shared chrome. Tab
// content, modals, and their react-query data live in ./AdminModeration/*.
import React, { useState, useLayoutEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { useTheme } from '../hooks/useTheme';
import { createStyles } from './AdminModerationScreen.styles';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import type { Profile } from '../types/database';
import { getProfile } from '../services/profiles';
import { loadCachedProfile, saveCachedProfile } from '../lib/profileCache';
import {
  useAdminPendingVenuesQuery,
  useAdminFlaggedReviewsQuery,
  useAdminFeedbackQuery,
  useAdminReportsQuery,
  useAdminChangeRequestsQuery,
} from '../hooks/queries/useAdminListsQuery';
import { ReviewsTab } from './AdminModeration/ReviewsTab';
import { VenuesTab } from './AdminModeration/VenuesTab';
import { FeedbackTab } from './AdminModeration/FeedbackTab';
import { ReportsTab } from './AdminModeration/ReportsTab';
import { ChangesTab } from './AdminModeration/ChangesTab';
import { ModeratorsModal } from './AdminModeration/ModeratorsModal';
import { VenueEditModal } from './AdminModeration/VenueEditModal';

type AdminTab = 'reviews' | 'venues' | 'feedback' | 'reports' | 'changes';

export function AdminModerationScreen() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>('reviews');
  // Lives here (not in VenuesTab) so the search text survives tab switches.
  const [venueQuery, setVenueQuery] = useState('');
  // Edit modal target — opened from both the Reviews and Venues tabs.
  const [editVenue, setEditVenue] = useState<any | null>(null);
  // Moderator-management modal (admin-only)
  const [moderatorsModalVisible, setModeratorsModalVisible] = useState(false);
  const router = useRouter();
  const { user } = useSession();
  const { s } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Badge counts. Reviews data is fetched on mount (it's the default tab);
  // the lazy tabs subscribe disabled here — counts stay at zero until the
  // tab is first opened and its own enabled query populates the cache.
  const { data: pendingVenues = [] } = useAdminPendingVenuesQuery();
  const { data: flaggedReviews = [] } = useAdminFlaggedReviewsQuery();
  const { data: userFeedback = [] } = useAdminFeedbackQuery(false);
  const { data: reports = [] } = useAdminReportsQuery(false);
  const { data: changeRequests = [] } = useAdminChangeRequestsQuery(false);

  useLayoutEffect(() => {
    if (!user) return;
    // Cache-first: ProfileScreen (the only entry point here) populates the
    // persistent profile cache, so on the common path we already know the role
    // and can paint immediately instead of blocking on a network round-trip
    // (which showed a blank loading screen for a few seconds). We only skip the
    // loader optimistically for an *authorized* cached role — an unauthorized or
    // stale cache still waits for the network, so a freshly-granted moderator is
    // never bounced and a revoked one is never trusted.
    const cached = loadCachedProfile<Profile>(user.id);
    if (cached?.data && (cached.data.is_admin || cached.data.is_moderator)) {
      setIsAdmin(cached.data.is_admin === true);
      setIsModerator(cached.data.is_moderator === true);
      setAdminLoading(false);
    }
    getProfile(user.id).then(({ data }) => {
      setIsAdmin(data?.is_admin === true);
      setIsModerator(data?.is_moderator === true);
      if (data) saveCachedProfile(user.id, data);
      setAdminLoading(false);
    });
  }, [user]);

  if (adminLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }
  const canModerate = isAdmin || isModerator;
  if (!canModerate) {
    router.back();
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Lucide name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{s('adminModeration')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {isAdmin && (
            <TouchableOpacity onPress={() => setModeratorsModalVisible(true)} testID="manage-moderators-btn">
              <Lucide name="users" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}
          <View style={styles.adminBadge}>
            <Text style={styles.adminBadgeText}>{s(isAdmin ? 'admin' : 'moderator')}</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'reviews' && styles.tabActive]}
          onPress={() => setActiveTab('reviews')}
        >
          <Text style={[styles.tabText, activeTab === 'reviews' && styles.tabTextActive]}>{s('tabReviews')}</Text>
          {(pendingVenues.length + flaggedReviews.length) > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{pendingVenues.length + flaggedReviews.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        {isAdmin && (
        <TouchableOpacity
          style={[styles.tab, activeTab === 'venues' && styles.tabActive]}
          onPress={() => setActiveTab('venues')}
        >
          <Text style={[styles.tabText, activeTab === 'venues' && styles.tabTextActive]}>{s('tabVenues')}</Text>
        </TouchableOpacity>
        )}
        {isAdmin && (
        <TouchableOpacity
          style={[styles.tab, activeTab === 'feedback' && styles.tabActive]}
          onPress={() => setActiveTab('feedback')}
          testID="admin-tab-feedback"
        >
          <Text style={[styles.tabText, activeTab === 'feedback' && styles.tabTextActive]}>{s('tabFeedback')}</Text>
          {userFeedback.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{userFeedback.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.tab, activeTab === 'reports' && styles.tabActive]}
          onPress={() => setActiveTab('reports')}
          testID="admin-tab-reports"
        >
          <Text style={[styles.tabText, activeTab === 'reports' && styles.tabTextActive]}>{s('tabReports')}</Text>
          {reports.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{reports.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'changes' && styles.tabActive]}
          onPress={() => setActiveTab('changes')}
          testID="admin-tab-changes"
        >
          <Text style={[styles.tabText, activeTab === 'changes' && styles.tabTextActive]}>{s('tabChanges')}</Text>
          {changeRequests.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{changeRequests.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {activeTab === 'reviews' ? (
        <ReviewsTab isAdmin={isAdmin} styles={styles} onEditVenue={setEditVenue} />
      ) : activeTab === 'venues' ? (
        <VenuesTab
          styles={styles}
          venueQuery={venueQuery}
          onChangeVenueQuery={setVenueQuery}
          onEditVenue={setEditVenue}
        />
      ) : activeTab === 'feedback' ? (
        <FeedbackTab styles={styles} />
      ) : activeTab === 'reports' ? (
        <ReportsTab styles={styles} />
      ) : (
        <ChangesTab isAdmin={isAdmin} styles={styles} />
      )}

      <ModeratorsModal
        visible={moderatorsModalVisible}
        styles={styles}
        onClose={() => setModeratorsModalVisible(false)}
      />
      <VenueEditModal venue={editVenue} styles={styles} onClose={() => setEditVenue(null)} />
    </SafeAreaView>
  );
}
