import React, { useState, useCallback, useMemo, useRef } from 'react';
// eslint-disable-next-line no-restricted-imports -- dynamic review action sheet keeps Alert; it has an explicit web fallback
import { View, Text, TouchableOpacity, Alert, Linking, Share, ActivityIndicator, Platform, FlatList, Dimensions, Animated } from 'react-native';
import { showAlert, showConfirm } from '../lib/dialogs';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { useTheme } from '../hooks/useTheme';
import { Fonts, Radius } from '../theme';
import { createStyles } from './VenueDetailScreen.styles';
import { CheckinDurationModal } from './VenueDetailScreen/CheckinDurationModal';
import { VenueOpenPlaySection } from './VenueDetailScreen/VenueOpenPlaySection';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import { getDateLocale } from '../contexts/I18nProvider';
import { uploadVenuePhoto, addPhotoToVenue } from '../services/venues';
import { venueImageUrl } from '../lib/imageTransforms';
import { prepareImageForUpload, ImageProcessingUnavailableError } from '../lib/imageUpload';
import * as ImagePicker from 'expo-image-picker';
import { checkin, checkout, getUserAnyActiveCheckin } from '../services/checkins';
import { createPlayIntent } from '../services/openplay';
import { useToggleFavoriteMutation } from '../hooks/queries/useFavoritesQuery';
import { useOfflineQueue } from '../contexts/OfflineQueueProvider';
import { useQueryClient } from '@tanstack/react-query';
import { useVenueDetailQuery, useInvalidateVenueDetail } from '../hooks/queries/useVenueDetailQuery';
import { useFriendsAtVenueQuery } from '../hooks/queries/useFriendsAtVenueQuery';
import { useIsAdminQuery } from '../hooks/queries/useIsAdminQuery';
import { useVenueReviewsQuery, venueReviewsQueryKey } from '../hooks/queries/useVenueReviewsQuery';
import type { Venue, Review, VenueStats } from '../types/database';
import { Card } from '../components/Card';
import { safeErrorMessage } from '../lib/auth-utils';
import { rateLimitMessageFor } from '../lib/rateLimit';
import { VenueActionRow } from '../components/VenueActionRow';
import { LogMatchModal } from '../components/LogMatchModal';
import { CheckinSuccessSheet } from '../components/CheckinSuccessSheet';
import { VenueBusynessBlock } from '../components/VenueBusynessBlock';
import { VenueFreeTablesBlock } from '../components/VenueFreeTablesBlock';
import { VenueAmenitiesGrid } from '../components/VenueAmenitiesGrid';
import { venueSupportsAmenities } from '../lib/amenities';
import { WeatherChip } from '../components/WeatherChip';
import { VenueRegularsRow } from '../components/VenueRegularsRow';
import { VenueCoachesRow } from '../components/VenueCoachesRow';
import { useVenueCoachesQuery } from '../features/coaches';
import { VenueBoardSection } from '../components/VenueBoardSection';
import { VenueMomentsStrip } from '../components/VenueMomentsStrip';
import { venueMomentsQueryKey } from '../features/checkinMoments';
import { reportFreeTables, useVenueIntelQuery, venueIntelQueryKey, invalidateVenueIntelCache } from '../features/venueIntel';
import { useVenueOpenPlayQuery, useMyPlayIntentQuery, useInvalidateOpenPlay, useRespondToOpenPlayMutation, useConvertPlayIntentMutation, useCancelPlayIntentMutation, type WhenSlot } from '../features/openplay';
import { useProfileQuery, profileQueryKey, profileStatsQueryKey } from '../hooks/queries/useProfileQuery';
import { getUserMilestones } from '../features/milestones';
import { MilestoneCelebrationSheet } from '../components/MilestoneCelebrationSheet';
import { updateProfile } from '../services/profiles';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { ReportReasonModal } from '../components/ReportReasonModal';
import { VenueChangeRequestModal } from '../components/VenueChangeRequestModal';
import type { SelectedImage } from '../components/VenueChangeRequestModal';
import { FullscreenImageViewer } from '../components/FullscreenImageViewer';
import { submitVenueChangeRequest, uploadChangeRequestImage } from '../services/venueChangeRequests';
import type { VenueChangeRequestInput } from '../services/venueChangeRequests';
import { submitVote, uploadConditionVotePhoto, CONDITION_MAP, type ConditionChoice } from '../services/conditions';
import { reportContent, blockUser, type ReportReason } from '../services/moderation';
import { skillLevelKey, type SkillLevel } from '../lib/playerAttributes';
import { conditionLabel, venueHoursLabel } from '../lib/venueLabels';
import { hapticLight } from '../lib/haptics';
import { sharePayload, venueUrl } from '../lib/shareLinks';
import { ProductEvents, trackProductEvent } from '../lib/analytics';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';

interface Props {
  venueId?: string;
}

export function VenueDetailScreen({ venueId }: Props) {
  const router = useRouter();
  const { user } = useSession();
  const { s, lang } = useI18n();
  const { colors } = useTheme();
  const dateLocale = getDateLocale(lang);
  const { styles } = useMemo(() => createStyles(colors), [colors]);

  const vIdNum = venueId && !isNaN(Number(venueId)) ? Number(venueId) : undefined;

  // ── Phase 1 (critical, single RPC): venue + stats + is_favorited
  //    + active checkin + upcoming-event count + champion + top-5 reviews.
  const {
    data: bundle,
    isLoading: bundleLoading,
    isError: bundleError,
    refetch: refetchBundle,
  } = useVenueDetailQuery(vIdNum, user?.id);
  const fromCache = !!bundle?.fromCache;

  // ── Phase 2 (lazy): full reviews (top-N comes from bundle).
  const [showAllReviews, setShowAllReviews] = useState(false);
  const REVIEW_INITIAL_LIMIT = 10;
  const fullReviewsEnabled = showAllReviews || (bundle?.recent_reviews?.length ?? 0) >= 5;
  const { data: fullReviews } = useVenueReviewsQuery(vIdNum, fullReviewsEnabled);

  // ── Phase 3 (deferred): friends-at-venue (own RPC).
  const { data: friendsHereRaw } = useFriendsAtVenueQuery(vIdNum, user?.id);

  // ── F063: approved coaches at this venue (lazy, off the critical path).
  const { data: venueCoaches } = useVenueCoachesQuery(vIdNum);

  // ── Phase 4 (one-time, infinite cache): admin gate.
  const { data: isAdminFlag } = useIsAdminQuery(user?.id);
  const isAdmin = !!isAdminFlag;

  const invalidateVenueDetail = useInvalidateVenueDetail();
  const queryClient = useQueryClient();
  const toggleFavoriteMutation = useToggleFavoriteMutation(user?.id);

  // ── F020: Open Play broadcasts at this venue.
  const { data: venueOpenPlay = [] } = useVenueOpenPlayQuery(vIdNum);
  const { data: myPlayIntent } = useMyPlayIntentQuery(user?.id);
  const invalidateOpenPlay = useInvalidateOpenPlay();
  const respondOpenPlay = useRespondToOpenPlayMutation();
  const convertOpenPlay = useConvertPlayIntentMutation();
  const cancelOpenPlay = useCancelPlayIntentMutation();
  const [planningSession, setPlanningSession] = useState(false);

  const venue = useMemo(
    () =>
      (bundle?.venue
        ? { ...bundle.venue, venue_stats: bundle.stats ?? null }
        : null) as (Venue & { venue_stats: VenueStats | null }) | null,
    [bundle],
  );
  const reviews = useMemo(
    () => (fullReviews ?? bundle?.recent_reviews ?? []) as Review[],
    [fullReviews, bundle],
  );
  const favorited = !!bundle?.is_favorited;
  const activeCheckin = bundle?.user_active_checkin ?? null;
  const upcomingEventCount = bundle?.upcoming_event_count ?? 0;
  const champion = bundle?.champion
    ? {
        userId: bundle.champion.user_id,
        fullName: bundle.champion.full_name ?? '?',
        dayCount: Number(bundle.champion.day_count),
      }
    : null;
  const playerMix = bundle?.player_mix ?? null;
  // F010/F011/F012/F014 live-intelligence — a SEPARATE, best-effort query that
  // cannot affect the core venue load (its failure never errors the screen).
  const { data: intel } = useVenueIntelQuery(vIdNum);
  const busyness = intel?.busyness ?? null;
  const freeTables = intel?.freeTables ?? null;
  const amenities = intel?.amenities ?? null;
  const regulars = intel?.regulars ?? null;
  const { data: myProfile } = useProfileQuery(user?.id);
  const isHomeVenue = !!vIdNum && myProfile?.home_venue_id === vIdNum;
  const friendsHere = useMemo(
    () =>
      (friendsHereRaw ?? []).map((f) => ({
        user_id: f.user_id,
        profiles: { full_name: f.full_name, avatar_url: f.avatar_url },
        _source: f.source,
        _eventTitle: f.event_title,
      })),
    [friendsHereRaw],
  );
  const loading = bundleLoading && !bundle;

  const [checkinLoading, setCheckinLoading] = useState(false);
  const [logMatchVisible, setLogMatchVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [viewerPhotoUrl, setViewerPhotoUrl] = useState<string | null>(null);
  const screenWidth = Dimensions.get('window').width;
  const photoWidth = Platform.OS === 'web' ? Math.min(screenWidth, 430) : screenWidth;
  const photoHeight = Math.round(photoWidth * 9 / 16);
  const [checkinModalVisible, setCheckinModalVisible] = useState(false);
  const [customMode, setCustomMode] = useState<'none' | 'minutes' | 'until'>('none');
  const [customMinutes, setCustomMinutes] = useState('');
  const [untilHour, setUntilHour] = useState('');
  const [untilMinute, setUntilMinute] = useState('');
  const [lookingForPlayers, setLookingForPlayers] = useState(false);
  const [sessionNote, setSessionNote] = useState('');
  const [openPlayBusyId, setOpenPlayBusyId] = useState<number | null>(null);
  const [successSheetVisible, setSuccessSheetVisible] = useState(false);
  const [lastCheckinEndTime, setLastCheckinEndTime] = useState<string | undefined>();
  const [checkinQueuedOffline, setCheckinQueuedOffline] = useState(false);
  // F042: the just-created check-in id, threaded to CheckinSuccessSheet so the
  // "Add a moment" action can attach a photo to it. Null for offline check-ins.
  const [lastCheckinId, setLastCheckinId] = useState<number | null>(null);
  // F053: a milestone the check-in just crossed (server-awarded by the AFTER
  // INSERT trigger). Held until the success sheet dismisses, then shown STACKED.
  const [pendingMilestoneKey, setPendingMilestoneKey] = useState<string | null>(null);
  const [milestoneCelebrationVisible, setMilestoneCelebrationVisible] = useState(false);
  const { isOnline, enqueue } = useOfflineQueue();
  const [reportingReview, setReportingReview] = useState<Review | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [vcrVisible, setVcrVisible] = useState(false);
  const [vcrSubmitting, setVcrSubmitting] = useState(false);
  // Caches a successfully uploaded change-request/vote photo so retries after a
  // mid-submit failure don't re-upload (which would burn the daily image cap and
  // orphan storage objects). Keyed by the picked image uri; cleared on each open.
  const uploadedPhotoRef = useRef<{ uri: string; url: string } | null>(null);
  const visibleReviews = useMemo(
    () => (showAllReviews ? reviews : reviews.slice(0, REVIEW_INITIAL_LIMIT)),
    [reviews, showAllReviews],
  );

  const heartScale = useRef(new Animated.Value(1)).current;

  // Scroll-driven collapsing header animation
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });
  // Scroll-driven collapsing header. The strip is animated with a
  // top-anchored scaleY (transformOrigin) so the work runs entirely on
  // the UI thread — animating `height` would force a layout pass per
  // frame on the JS thread.
  const photoAnimStyle = useAnimatedStyle(() => {
    const targetHeight = interpolate(scrollY.value, [0, 150], [photoHeight, 100], Extrapolation.CLAMP);
    return {
      transform: [{ scaleY: targetHeight / photoHeight }],
      transformOrigin: 'top' as const,
      opacity: interpolate(scrollY.value, [0, 120], [1, 0.6], Extrapolation.CLAMP),
    };
  });


  const handleReview = useCallback(() => {
    router.push({ pathname: '/(protected)/review/[venueId]', params: { venueId: String(venueId) } });
  }, [router, venueId]);

  const handleShare = useCallback(() => {
    if (!venue || !vIdNum) return;
    // T061: share an openable link, not just text — the web build renders
    // /venue/[id] publicly, so the link works for everyone.
    trackProductEvent(ProductEvents.shareInitiated, { surface: 'venue', venueId: vIdNum });
    Share.share(sharePayload(venue.name + ' - ' + (venue.address || ''), venueUrl(vIdNum)));
  }, [venue, vIdNum]);

  const handleSuggestEdit = useCallback(() => {
    // Submitting requires a session; bounce to sign-in if signed out.
    if (!user) {
      router.push('/sign-in');
      return;
    }
    uploadedPhotoRef.current = null;
    setVcrVisible(true);
  }, [user, router]);

  const handleSubmitChangeRequest = useCallback(async (
    payload: VenueChangeRequestInput,
    image: SelectedImage | null,
    condition: ConditionChoice | null,
  ) => {
    if (!user) { router.push('/sign-in'); return; }
    setVcrSubmitting(true);

    // The modal can carry an edit proposal, a condition vote, or both. The
    // edit-vs-vote split decides which bucket the single photo lands in.
    const hasEdit =
      payload.nets !== null || payload.nightLighting !== null ||
      payload.tablesCount != null || payload.markUnavailable === true ||
      payload.amenities != null;

    let photoUrl: string | null = null;
    if (image) {
      // Reuse an already-uploaded photo across retries (same picked image).
      if (uploadedPhotoRef.current?.uri === image.uri) {
        photoUrl = uploadedPhotoRef.current.url;
      } else {
        const res = hasEdit
          ? await uploadChangeRequestImage(Number(venueId), image)
          : await uploadConditionVotePhoto(Number(venueId), image);
        if (!res.ok) {
          setVcrSubmitting(false);
          if (res.reason === 'rate_limited') {
            showAlert(s('error'), rateLimitMessageFor(res.error, s) ?? s('vcrSubmitError'));
          } else if (res.reason === 'processing_unavailable') {
            showAlert(s('error'), s('photoProcessingUnavailable'));
          } else {
            showAlert(s('error'), s('photoUploadError'));
          }
          return;
        }
        photoUrl = res.url;
        uploadedPhotoRef.current = { uri: image.uri, url: res.url };
      }
    }

    // Record the condition vote first (its own table), then the change request.
    if (condition) {
      const { error } = await submitVote({
        user_id: user.id,
        venue_id: Number(venueId),
        condition: CONDITION_MAP[condition],
        photo_url: photoUrl,
        // When there's also an edit the note rides with the change request; on a
        // condition-only submit the note has no other home, so keep it on the vote.
        note: hasEdit ? null : (payload.note ?? null),
      });
      if (error) {
        setVcrSubmitting(false);
        showAlert(s('error'), s('vcrSubmitError'));
        return;
      }
      // The vote feeds the venue-detail condition summary; refresh now so it's
      // reflected even if the change-request leg below later fails.
      invalidateVenueDetail(Number(venueId));
    }

    if (hasEdit) {
      const { error } = await submitVenueChangeRequest(Number(venueId), { ...payload, photoUrl });
      if (error) {
        setVcrSubmitting(false);
        showAlert(s('error'), s('vcrSubmitError'));
        return;
      }
    }

    setVcrSubmitting(false);
    uploadedPhotoRef.current = null;
    setVcrVisible(false);
    // A condition-only submit (no edit proposal) records a vote, not a moderated
    // change request — word the confirmation accordingly.
    if (hasEdit) {
      showAlert(s('vcrSubmittedTitle'), s('vcrSubmittedMessage'));
    } else {
      showAlert(s('success'), s('voteRecorded'));
    }
  }, [venueId, s, user, router, invalidateVenueDetail]);

  const performBlockUser = useCallback(async (targetUserId: string) => {
    const { error } = await blockUser(targetUserId);
    if (error) {
      const isStaff = String((error as { message?: string })?.message ?? '').includes('cannot_block_staff');
      showAlert(s('error'), isStaff ? s('blockStaffError') : s('blockUserError'));
      return;
    }
    showAlert(s('blockedToastTitle'), s('blockedToastBody'));
    invalidateVenueDetail(Number(venueId));
    queryClient.invalidateQueries({ queryKey: venueReviewsQueryKey(Number(venueId)) });
  }, [s, invalidateVenueDetail, venueId, queryClient]);

  const openReviewActions = useCallback((review: Review) => {
    if (!user) return;
    const isOwn = review.user_id === user.id;
    const targetId = review.user_id;

    const buttons: { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }[] = [
      { text: s('reportReviewAction'), onPress: () => setReportingReview(review) },
    ];
    if (!isOwn && targetId) {
      buttons.push({
        text: s('blockUserAction'),
        style: 'destructive',
        onPress: async () => {
          if (await showConfirm(s('blockUserAction'), s('blockUserConfirm'), { confirmLabel: s('blockUserAction'), cancelLabel: s('cancel'), destructive: true })) {
            void performBlockUser(targetId);
          }
        },
      });
    }
    buttons.push({ text: s('cancel'), style: 'cancel' });

    if (Platform.OS === 'web') {
      // Web fallback: simple chained prompts.
      const choices = buttons.filter((b) => b.style !== 'cancel');
      const label = choices.map((c, i) => `${i + 1}. ${c.text}`).join('\n');
      const choice = window.prompt(`${s('reviewActions')}\n\n${label}\n\n${s('reviewActionsHint')}`);
      const idx = Number(choice);
      if (Number.isInteger(idx) && idx >= 1 && idx <= choices.length) {
        choices[idx - 1].onPress?.();
      }
    } else {
      Alert.alert(s('reviewActions'), undefined, buttons);
    }
  }, [user, s, performBlockUser]);

  const handleSubmitReport = useCallback(
    async (reason: ReportReason, notes: string | undefined) => {
      if (!reportingReview) return;
      setReportSubmitting(true);
      const { error } = await reportContent('review', reportingReview.id, reason, notes);
      setReportSubmitting(false);
      setReportingReview(null);
      if (error) {
        showAlert(s('error'), s('reportError'));
        return;
      }
      showAlert(s('reportedToastTitle'), s('reportedToastBody'));
    },
    [reportingReview, s],
  );

  const showDurationModal = useCallback(() => {
    setCustomMode('none');
    setCustomMinutes('');
    setUntilHour('');
    setUntilMinute('');
    setLookingForPlayers(false);
    setSessionNote('');
    setCheckinModalVisible(true);
  }, []);

  // Note: check-ins stay ENABLED when serving a cached bundle — offline
  // check-ins queue with their own messaging (T031). Only the favorite
  // toggle is blocked: its semantics flip on is_favorited, which a cached
  // bundle doesn't know.
  const openCheckinModal = useCallback(async () => {
    if (!user) return;
    // Check if user has an active checkin at a DIFFERENT venue
    const { data: existing } = await getUserAnyActiveCheckin(user.id);
    if (existing && existing.venue_id !== Number(venueId)) {
      const venueName = existing.venues?.name ?? '';
      if (!(await showConfirm(`${s('alreadyCheckedIn')} ${venueName}`, s('checkoutAndContinue'), { confirmLabel: s('yes'), cancelLabel: s('cancel') }))) {
        return;
      }
      await checkout(existing.id, user.id);
    }
    showDurationModal();
  }, [user, venueId, showDurationModal, s]);

  const doCheckin = useCallback(async (durationMinutes: number) => {
    if (!user || !venueId) return;
    setCheckinModalVisible(false);
    const now = new Date();
    const endedAt = new Date(now.getTime() + durationMinutes * 60_000);
    const endTimeStr = endedAt.toLocaleTimeString(getDateLocale(lang), { hour: '2-digit', minute: '2-digit' });
    const note = lookingForPlayers ? (sessionNote.trim() || null) : null;
    const payload = {
      user_id: user.id,
      venue_id: Number(venueId),
      table_number: null,
      started_at: now.toISOString(),
      ended_at: endedAt.toISOString(),
      friends: [],
      open_to_play: lookingForPlayers,
      session_note: note,
    };

    // Offline: queue the check-in with its original timestamps (the
    // 'checkin' handler in lib/offlineHandlers replays it) and confirm
    // optimistically with a "will sync" note. Gyms and basements are
    // exactly where signal dies — dropping the action loses real sessions.
    if (!isOnline) {
      enqueue({
        entityType: 'checkin',
        // Timestamped entityId: multiple offline check-ins (different
        // venues/times) must not dedupe each other away.
        entityId: `${user.id}:${venueId}:${now.getTime()}`,
        operation: 'create',
        payload,
      });
      setLastCheckinEndTime(endTimeStr);
      setCheckinQueuedOffline(true);
      setLastCheckinId(null);
      setSuccessSheetVisible(true);
      trackProductEvent(ProductEvents.checkinQueuedOffline, { venueId: vIdNum });
      return;
    }

    // F053: snapshot the earned milestones BEFORE the check-in so we can detect
    // a freshly-crossed threshold (awarded by the AFTER INSERT trigger) and
    // stack its celebration after the success sheet.
    const beforeMilestones = await getUserMilestones();
    const beforeKeys = new Set((beforeMilestones.data ?? []).map((m) => m.milestone_key));

    setCheckinLoading(true);
    const { data: createdCheckin, error } = await checkin(payload);
    setCheckinLoading(false);
    if (error) {
      const rateMsg = rateLimitMessageFor(error, s);
      showAlert(s('error'), rateMsg ?? safeErrorMessage(error, 'genericError', s));
      return;
    }
    if (vIdNum) invalidateVenueDetail(vIdNum);
    // F020: a "looking for players" check-in starts a joinable "now" broadcast
    // that fans out to in-city friends. Failure (e.g. one-active guard) is
    // non-fatal — the check-in itself already succeeded.
    if (lookingForPlayers && vIdNum) {
      try {
        await createPlayIntent({ venueId: vIdNum, whenSlot: 'now', note, isPublic: true });
        invalidateOpenPlay();
      } catch {
        /* ignore — check-in still counts */
      }
    }
    setLastCheckinEndTime(endTimeStr);
    setCheckinQueuedOffline(false);
    setLastCheckinId((createdCheckin as { id?: number } | null)?.id ?? null);
    setSuccessSheetVisible(true);
    trackProductEvent(ProductEvents.checkinCompleted, { venueId: vIdNum });

    // F053: re-read milestones now the trigger has run; the lifetime counters
    // changed, so refresh the profile-stats cache (drives the strip ghosts).
    queryClient.invalidateQueries({ queryKey: profileStatsQueryKey(user.id) });
    const afterMilestones = await getUserMilestones();
    const newKey = (afterMilestones.data ?? [])
      .map((m) => m.milestone_key)
      .find((k) => !beforeKeys.has(k));
    if (newKey) setPendingMilestoneKey(newKey);
  }, [user, venueId, vIdNum, invalidateVenueDetail, s, lang, isOnline, enqueue, lookingForPlayers, sessionNote, invalidateOpenPlay, queryClient]);

  const handleCustomConfirm = useCallback(() => {
    if (customMode === 'minutes') {
      const mins = parseInt(customMinutes, 10);
      if (!mins || mins < 1) return;
      doCheckin(mins);
    } else if (customMode === 'until') {
      const h = parseInt(untilHour, 10);
      const m = parseInt(untilMinute || '0', 10);
      if (isNaN(h) || h < 0 || h > 23) return;
      const now = new Date();
      const target = new Date(now);
      target.setHours(h, m, 0, 0);
      if (target <= now) {
        showAlert(s('error'), s('endTimeInPast'));
        return;
      }
      const diffMin = Math.round((target.getTime() - now.getTime()) / 60_000);
      doCheckin(diffMin);
    }
  }, [customMode, customMinutes, untilHour, untilMinute, doCheckin, s]);

  // ── F020: Open Play join / leave / convert / cancel handlers.
  const handleJoinOpenPlay = useCallback((intentId: number) => {
    setOpenPlayBusyId(intentId);
    respondOpenPlay.mutate({ intentId, action: 'join' }, {
      onError: () => showAlert(s('error'), s('genericError')),
      onSettled: () => setOpenPlayBusyId(null),
    });
  }, [respondOpenPlay, s]);

  const handleLeaveOpenPlay = useCallback((intentId: number) => {
    setOpenPlayBusyId(intentId);
    respondOpenPlay.mutate({ intentId, action: 'leave' }, {
      onSettled: () => setOpenPlayBusyId(null),
    });
  }, [respondOpenPlay]);

  const handleConvertOpenPlay = useCallback((intentId: number) => {
    setOpenPlayBusyId(intentId);
    convertOpenPlay.mutate({ intentId }, {
      onSuccess: (eventId) => {
        if (eventId) router.push({ pathname: '/(protected)/event/[eventId]', params: { eventId: String(eventId) } });
      },
      onError: () => showAlert(s('error'), s('genericError')),
      onSettled: () => setOpenPlayBusyId(null),
    });
  }, [convertOpenPlay, router, s]);

  const handleCancelOpenPlay = useCallback((intentId: number) => {
    setOpenPlayBusyId(intentId);
    cancelOpenPlay.mutate(intentId, { onSettled: () => setOpenPlayBusyId(null) });
  }, [cancelOpenPlay]);

  const handlePlanSession = useCallback(async (whenSlot: WhenSlot) => {
    if (!vIdNum || planningSession) return;
    setPlanningSession(true);
    const { error } = await createPlayIntent({ venueId: vIdNum, whenSlot, isPublic: true });
    setPlanningSession(false);
    if (error) { showAlert(s('error'), s('genericError')); return; }
    invalidateOpenPlay();
  }, [vIdNum, planningSession, invalidateOpenPlay, s]);

  const handleCheckout = useCallback(async () => {
    if (!activeCheckin || !user) return;
    setCheckinLoading(true);
    const { error } = await checkout(activeCheckin.id, user.id);
    setCheckinLoading(false);
    if (error) { showAlert(s('error'), safeErrorMessage(error, 'genericError', s)); return; }
    if (vIdNum) invalidateVenueDetail(vIdNum);
  }, [activeCheckin, vIdNum, invalidateVenueDetail, user, s]);

  // F011: report how many tables are free. Throws on failure so the prompt
  // (VenueFreeTablesBlock) stays open for a retry; we surface the reason here.
  const handleReportFreeTables = useCallback(async (freeCount: number, groupSize: number | null) => {
    if (!vIdNum) return;
    const { error } = await reportFreeTables(vIdNum, freeCount, groupSize);
    if (error) {
      const rateMsg = rateLimitMessageFor(error as any, s);
      showAlert(s('error'), rateMsg ?? s('freeTablesReportError'));
      throw error;
    }
    invalidateVenueIntelCache(vIdNum);
    queryClient.invalidateQueries({ queryKey: venueIntelQueryKey(vIdNum) });
  }, [vIdNum, queryClient, s]);

  // F014: toggle this venue as the user's home venue (and Regulars membership).
  const handleToggleHomeVenue = useCallback(async () => {
    if (!user || !vIdNum) return;
    const { error } = await updateProfile(user.id, { home_venue_id: isHomeVenue ? null : vIdNum });
    if (error) { showAlert(s('error'), safeErrorMessage(error, 'genericError', s)); return; }
    queryClient.invalidateQueries({ queryKey: profileQueryKey(user.id) });
    invalidateVenueIntelCache(vIdNum); // the venue's Regulars list changed
    queryClient.invalidateQueries({ queryKey: venueIntelQueryKey(vIdNum) });
  }, [user, vIdNum, isHomeVenue, queryClient, s]);

  const handleAddPhoto = useCallback(async () => {
    if (!venue || !venueId) return;
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

    setUploading(true);
    try {
      const asset = result.assets[0];
      // Validate file size (max 10MB)
      if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) {
        showAlert(s('error'), s('photoTooLarge'));
        return;
      }
      // Validate MIME type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];
      if (asset.mimeType && !allowedTypes.includes(asset.mimeType)) {
        showAlert(s('error'), s('photoUploadError'));
        return;
      }
      // Shared resize + re-encode pipeline (see lib/imageUpload). Refuses
      // the upload if the native ImageManipulator module is missing —
      // shipping a 3 MB original would silently inflate storage egress
      // with no signal to the user.
      let uploadUri: string;
      try {
        uploadUri = await prepareImageForUpload({
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
        });
      } catch (err) {
        if (err instanceof ImageProcessingUnavailableError) {
          showAlert(s('error'), s('photoProcessingUnavailable'));
        } else {
          showAlert(s('error'), s('photoUploadError'));
        }
        return;
      }

      const { url, error: uploadErr } = await uploadVenuePhoto(Number(venueId), uploadUri);
      if (uploadErr || !url) {
        showAlert(s('error'), s('photoUploadError'));
        return;
      }

      const currentPhotos = venue.photos ?? [];
      const { error: updateErr } = await addPhotoToVenue(Number(venueId), currentPhotos, url);
      if (updateErr) {
        showAlert(s('error'), s('photoUploadError'));
        return;
      }

      if (vIdNum) invalidateVenueDetail(vIdNum);
      showAlert(s('success'), s('photoUploaded'));
    } catch {
      showAlert(s('error'), s('photoUploadError'));
    } finally {
      setUploading(false);
    }
  }, [venue, venueId, vIdNum, invalidateVenueDetail, s]);

  const animateHeart = useCallback(() => {
    Animated.sequence([
      Animated.timing(heartScale, { toValue: 1.4, duration: 150, useNativeDriver: true }),
      Animated.timing(heartScale, { toValue: 1.0, duration: 150, useNativeDriver: true }),
    ]).start();
  }, [heartScale]);

  const handleToggleFavorite = useCallback(async () => {
    if (!user || !vIdNum) return;
    // A cached bundle doesn't know is_favorited, so the toggle direction
    // would be a guess — block with honest messaging instead.
    if (fromCache) {
      showAlert(s('error'), s('offlineActionError'));
      return;
    }
    hapticLight();
    try {
      // The mutation hook owns optimistic updates, ['favorites', userId]
      // invalidation, and offline queueing — the previous direct service
      // calls bypassed all three (§5.2).
      await toggleFavoriteMutation.mutateAsync({ venueId: vIdNum, isFav: favorited });
    } catch (error) {
      showAlert(s('error'), safeErrorMessage(error, 'genericError', s));
      return;
    }
    invalidateVenueDetail(vIdNum);
    animateHeart();
  }, [user, vIdNum, favorited, fromCache, toggleFavoriteMutation, invalidateVenueDetail, animateHeart, s]);

  const handleDirectionGoogle = useCallback(() => {
    if (!venue) return;
    Linking.openURL('https://maps.google.com/?q=' + venue.lat + ',' + venue.lng);
  }, [venue]);

  const handleDirectionApple = useCallback(() => {
    if (!venue) return;
    Linking.openURL('https://maps.apple.com/?q=' + venue.lat + ',' + venue.lng);
  }, [venue]);

  const handleDirectionWaze = useCallback(() => {
    if (!venue) return;
    Linking.openURL('https://waze.com/ul?ll=' + venue.lat + ',' + venue.lng + '&navigate=yes');
  }, [venue]);

  const renderStars = (rating: number) => {
    const full = Math.floor(rating);
    const empty = 5 - full;
    return '\u2605'.repeat(full) + '\u2606'.repeat(empty);
  };

  if (loading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Network failure with no cache to fall back on (the queryFn rethrows in
  // that case) — offer Retry + Back instead of mislabeling it "not found".
  if (bundleError && !venue) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ErrorState
          title={s('venueLoadError')}
          description={s('venueLoadErrorDesc')}
          ctaLabel={s('retry')}
          onRetry={() => void refetchBundle()}
        />
        <TouchableOpacity
          style={{ alignSelf: 'center', padding: 12 }}
          onPress={() => router.back()}
          accessibilityRole="button"
          testID="venue-detail-error-back"
        >
          <Text style={{ color: colors.textMuted }}>{s('back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // The RPC answered and the venue genuinely doesn't exist.
  if (!venue) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: colors.textMuted }}>{s('notFound')}</Text>
      </View>
    );
  }

  const stats = venue.venue_stats;
  const avgRating = stats?.avg_rating ?? 0;
  const reviewCount = stats?.review_count ?? 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <Lucide name="arrow-left" size={20} color={colors.text} />
          <Text style={styles.backText}>{s('back')}</Text>
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleToggleFavorite} accessibilityLabel={favorited ? s('favRemove') : s('favAdd')} accessibilityRole="button" hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <Animated.View style={{ transform: [{ scale: heartScale }] }}>
              <Lucide name="heart" size={20} color={favorited ? colors.red : colors.textFaint} />
            </Animated.View>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShare} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <Lucide name="share-2" size={20} color={colors.textFaint} />
          </TouchableOpacity>
        </View>
      </View>

      <Reanimated.ScrollView style={styles.scroll} onScroll={scrollHandler} scrollEventThrottle={16}>
        {/* Photo Strip — pin the height so the placeholder branch renders
            at the same size as a photo, instead of collapsing. */}
        <Reanimated.View style={[styles.photoStrip, { height: photoHeight }, photoAnimStyle]}>
          {venue.photos && venue.photos.length > 0 ? (
            <>
              <FlatList
                data={venue.photos}
                keyExtractor={(item, i) => `${item}-${i}`}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                  const index = Math.round(e.nativeEvent.contentOffset.x / photoWidth);
                  setActivePhotoIndex(index);
                }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setViewerPhotoUrl(item)}
                    style={{ width: photoWidth, height: photoHeight }}
                    testID="venue-photo"
                  >
                    <Image
                      source={venueImageUrl(item, { width: Math.round(photoWidth * 2), quality: 75 })}
                      style={{ width: photoWidth, height: photoHeight }}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      transition={150}
                    />
                  </TouchableOpacity>
                )}
                getItemLayout={(_, index) => ({ length: photoWidth, offset: photoWidth * index, index })}
              />
              {venue.photos.length > 1 && (
                <View style={styles.dotsRow}>
                  {venue.photos.map((_, i) => (
                    <View
                      key={i}
                      style={[styles.dot, i === activePhotoIndex && styles.dotActive]}
                    />
                  ))}
                </View>
              )}
              <View style={styles.photoCount}>
                <Lucide name="image" size={12} color={colors.textOnPrimary} />
                <Text style={styles.photoCountText}>{(activePhotoIndex + 1) + '/' + venue.photos.length}</Text>
              </View>
            </>
          ) : (
            <View style={[styles.photoPlaceholder, { alignItems: 'center', justifyContent: 'center', gap: 6 }]}>
              <Lucide name="camera" size={28} color={colors.textFaint} />
              <Text style={{ fontFamily: Fonts.body, fontSize: 13, color: colors.textFaint }}>{s('noPhotosYet')}</Text>
            </View>
          )}
          {isAdmin && (
            <TouchableOpacity
              style={styles.addPhotoBtn}
              onPress={handleAddPhoto}
              disabled={uploading}
              accessibilityLabel={s('addPhoto')}
              testID="admin-add-photo"
            >
              {uploading ? (
                <ActivityIndicator size="small" color={colors.textOnPrimary} />
              ) : (
                <Lucide name="plus" size={20} color={colors.textOnPrimary} />
              )}
            </TouchableOpacity>
          )}
        </Reanimated.View>

        {/* Recent moments (F042) — lazy strip under the photo carousel */}
        {vIdNum ? <VenueMomentsStrip venueId={vIdNum} currentUserId={user?.id} /> : null}

        {/* Weather — outdoor venues only (F013) */}
        {venue.type === 'parc_exterior' && venue.lat != null && venue.lng != null ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <WeatherChip lat={venue.lat} lng={venue.lng} enabled />
          </View>
        ) : null}

        {/* Action Row */}
        <VenueActionRow
          favorited={favorited}
          checkedIn={!!activeCheckin}
          checkinLoading={checkinLoading}
          onCheckin={activeCheckin ? handleCheckout : openCheckinModal}
          onReview={handleReview}
          onFavorite={handleToggleFavorite}
          onShare={handleShare}
        />

        {/* Venue Info */}
        <Card shadow="sm" borderRadius={0} style={styles.venueInfo}>
          <View style={styles.infoTop}>
            <View style={styles.infoTitleGroup}>
              <Text style={styles.infoTitle}>{venue.name}</Text>
              <View style={styles.infoBadges}>
                {venue.verified && (
                  <View style={styles.badgeVerified}>
                    <Lucide name="check" size={10} color={colors.primaryMid} />
                    <Text style={styles.badgeVerifiedText}>{s('verified')}</Text>
                  </View>
                )}
                {venue.free_access && (
                  <View style={styles.badgeFree}>
                    <Text style={styles.badgeFreeText}>{s('freeLabel')}</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.infoRating}>
              <Text style={styles.ratingStars}>{renderStars(avgRating)}</Text>
              <Text style={styles.ratingCount}>{avgRating.toFixed(1) + ' (' + reviewCount + ')'}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoGrid}>
            <View style={styles.infoRow}>
              <Lucide name="map-pin" size={16} color={colors.textFaint} />
              <Text style={styles.infoRowText}>{venue.address || s('addressUnknown')}</Text>
            </View>
            <View style={styles.infoRow}>
              <Lucide name="table-2" size={16} color={colors.textFaint} />
              <Text style={styles.infoRowText}>{(venue.tables_count ?? '?') + ' ' + s('tablesState') + ' ' + conditionLabel(venue.condition, s)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Lucide name="clock" size={16} color={colors.textFaint} />
              <Text style={styles.infoRowText}>{venueHoursLabel(venue.hours, s)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Lucide name="lamp-floor" size={16} color={colors.textFaint} />
              <Text style={styles.infoRowText}>
                {(venue.night_lighting ? s('nightLighting') + ' \u00B7 ' : '') + (venue.nets ? s('netsPresent') : s('noNets'))}
              </Text>
            </View>
          </View>

          {champion && (
            <View style={styles.championRow}>
              <Lucide name="crown" size={16} color={colors.amber} />
              <Text style={styles.championText}>
                {s('venueChampion')}: {champion.fullName} ({champion.dayCount} {s('daysPlayed')})
              </Text>
            </View>
          )}

          {playerMix?.top && (
            <View style={[styles.championRow, { backgroundColor: colors.primaryPale, borderColor: colors.primaryDim }]}>
              <Lucide name="users" size={16} color={colors.primaryMid} />
              <Text style={[styles.championText, { color: colors.primaryMid }]}>
                {s('venuePlayerMixMostly', s(skillLevelKey(playerMix.top as SkillLevel)))}
              </Text>
            </View>
          )}

          {/* Log a match — when checked in, against a friend who's here (F002) */}
          {activeCheckin && user?.id && (
            <>
              <TouchableOpacity style={[styles.evalBtn, { marginTop: 8 }]} onPress={() => setLogMatchVisible(true)} testID="venue-log-match-btn">
                <Lucide name="swords" size={16} color={colors.primaryMid} />
                <Text style={styles.evalText}>{s('logMatchTitle')}</Text>
                <Lucide name="chevron-right" size={14} color={colors.primaryMid} />
              </TouchableOpacity>
              <LogMatchModal
                visible={logMatchVisible}
                currentUserId={user.id}
                opponentOptions={friendsHere.map((f) => ({ id: f.user_id, name: f.profiles.full_name ?? s('player') }))}
                venueId={venueId ? Number(venueId) : null}
                onClose={() => setLogMatchVisible(false)}
                onLogged={() => showAlert(s('success'), s('matchLoggedPending'))}
              />
            </>
          )}

          {/* Home venue toggle (F014) */}
          {user && !fromCache && (
            <TouchableOpacity style={[styles.evalBtn, { marginTop: 8 }]} onPress={handleToggleHomeVenue} testID="home-venue-toggle">
              <Lucide name="home" size={16} color={colors.primaryMid} />
              <Text style={styles.evalText}>{isHomeVenue ? s('homeVenueYours') : s('homeVenueSet')}</Text>
              {isHomeVenue ? <Lucide name="check" size={14} color={colors.primaryMid} /> : null}
            </TouchableOpacity>
          )}

          {/* Suggest an edit / report an issue — also hosts table-condition voting */}
          <TouchableOpacity style={styles.evalBtn} onPress={handleSuggestEdit} testID="suggest-edit-btn">
            <Lucide name="pencil" size={16} color={colors.primaryMid} />
            <Text style={styles.evalText}>{s('requestChangesCta')}</Text>
          </TouchableOpacity>
        </Card>

        {/* Amenities, fees & access (F012) — indoor halls only; parks don't have them. */}
        {venueSupportsAmenities(venue.type) && (
          <VenueAmenitiesGrid amenities={amenities} onSuggestEdit={handleSuggestEdit} />
        )}

        {/* Busyness — live count + typical-hours histogram (F010) */}
        <VenueBusynessBlock busyness={busyness} tablesCount={venue.tables_count} />

        {/* Free tables — latest report + on-site report prompt (F011) */}
        <VenueFreeTablesBlock
          freeTables={freeTables}
          tablesCount={venue.tables_count}
          canReport={!!activeCheckin && !fromCache}
          onReport={handleReportFreeTables}
        />

        {/* Regulars — opt-in home-venue members (F014) */}
        <VenueRegularsRow regulars={regulars} />

        {/* Coaches here — approved coaches teaching at this venue (F063) */}
        <VenueCoachesRow coaches={venueCoaches} />

        {/* Friends Here */}
        <View style={styles.friendsSection}>
          <View style={styles.friendsTitle}>
            <Lucide name="users" size={14} color={colors.purple} />
            <Text style={styles.friendsTitleText}>{s('friendsHereNow')}</Text>
          </View>
          {friendsHere.length === 0 && !activeCheckin && (
            <Text style={styles.checkinTime}>{s('noFriendsHere')}</Text>
          )}
          {friendsHere.map((fc: any) => {
            const name = fc.profiles?.full_name || fc.user_id?.slice(0, 6) || '?';
            const initial = name.charAt(0).toUpperCase();
            const ago = fc.started_at
              ? Math.max(1, Math.round((Date.now() - new Date(fc.started_at).getTime()) / 60_000))
              : null;
            return (
              <TouchableOpacity
                key={fc.id || fc.user_id}
                style={styles.checkinRow}
                onPress={() => router.push({ pathname: '/(protected)/player/[userId]', params: { userId: fc.user_id } })}
                accessibilityRole="button"
                accessibilityLabel={name}
                testID={`friends-here-${fc.user_id}`}
              >
                <View style={styles.checkinAvatar}>
                  <Text style={styles.checkinInitials}>{initial}</Text>
                </View>
                <View style={styles.checkinInfo}>
                  <Text style={styles.checkinName}>{name}</Text>
                  {fc._source === 'event' ? (
                    <Text style={styles.checkinTime} numberOfLines={1}>
                      {fc._eventTitle ? `· ${fc._eventTitle}` : '·'}
                    </Text>
                  ) : ago != null ? (
                    <Text style={styles.checkinTime}>{`${ago}m`}</Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
          {activeCheckin ? (
            <View style={styles.activeCheckinWrap}>
              <View style={styles.activeCheckinInfo}>
                <Lucide name="check-circle" size={16} color={colors.primaryLight} />
                <Text style={styles.activeCheckinText}>
                  {s('checkinSuccess').replace('!', '')} {activeCheckin.ended_at
                    ? `· ${s('untilTime')} ${new Date(activeCheckin.ended_at).toLocaleTimeString(getDateLocale(lang), { hour: '2-digit', minute: '2-digit' })}`
                    : ''}
                </Text>
              </View>
              <TouchableOpacity style={styles.checkoutBtn} onPress={handleCheckout} disabled={checkinLoading}>
                {checkinLoading ? (
                  <ActivityIndicator size="small" color={colors.red} />
                ) : (
                  <Text style={styles.checkoutBtnText}>{s('checkout')}</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.checkinBtn} onPress={openCheckinModal} disabled={checkinLoading}>
              {checkinLoading ? (
                <ActivityIndicator size="small" color={colors.textOnPrimary} />
              ) : (
                <>
                  <Lucide name="map-pin" size={16} color={colors.textOnPrimary} />
                  <Text style={styles.checkinBtnText}>{s('checkinHere')}</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Open Play — looking-for-players broadcasts here (F020) */}
        <VenueOpenPlaySection
          items={venueOpenPlay}
          busyId={openPlayBusyId}
          canPlan={!!user && !myPlayIntent}
          planning={planningSession}
          onJoin={handleJoinOpenPlay}
          onLeave={handleLeaveOpenPlay}
          onConvert={handleConvertOpenPlay}
          onCancel={handleCancelOpenPlay}
          onPlan={handlePlanSession}
        />

        {/* Venue Links */}
        <View style={styles.navSection}>
          <TouchableOpacity
            style={[styles.navRow, styles.navRowLast]}
            onPress={() => router.push({ pathname: '/(protected)/venue-events/[venueId]', params: { venueId: String(venueId) } })}
            testID="venue-events-nav"
          >
            <View style={[styles.navIcon, { backgroundColor: colors.amberPale }]}>
              <Lucide name="calendar" size={18} color={colors.accent} />
            </View>
            <Text style={styles.navLabel}>{s('eventsAtVenue')}</Text>
            {upcomingEventCount > 0 && (
              <View style={styles.navCountPill}>
                <Text style={styles.navCountText}>{upcomingEventCount}</Text>
              </View>
            )}
            <Lucide name="chevron-right" size={16} color={colors.textFaint} />
          </TouchableOpacity>
        </View>

        {/* Directions */}
        <Card shadow="sm" borderRadius={0} style={styles.directionsSection}>
          <Text style={styles.directionsTitle}>{s('navigation')}</Text>
          <View style={styles.directionsRow}>
            <TouchableOpacity style={styles.dirGoogle} onPress={handleDirectionGoogle}>
              <Lucide name="navigation" size={14} color={colors.textMuted} />
              <Text style={styles.dirGoogleText}>Google</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dirOther} onPress={handleDirectionApple}>
              <Lucide name="navigation" size={14} color={colors.textMuted} />
              <Text style={styles.dirOtherText}>Apple</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dirOther} onPress={handleDirectionWaze}>
              <Lucide name="navigation" size={14} color={colors.textMuted} />
              <Text style={styles.dirOtherText}>Waze</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Reviews */}
        <View style={styles.reviewsSection}>
          <View style={styles.reviewsHeader}>
            <Text style={styles.reviewsTitle}>{s('reviewsCount') + ' (' + reviews.length + ')'}</Text>
            <TouchableOpacity style={styles.writeReviewBtn} onPress={() => router.push({ pathname: '/(protected)/review/[venueId]', params: { venueId: String(venueId) } })} testID="write-review-btn" accessibilityLabel={s('writeBtn')}>
              <Lucide name="pen-line" size={12} color={colors.primaryMid} />
              <Text style={styles.writeReviewText}>{s('writeBtn')}</Text>
            </TouchableOpacity>
          </View>

          {reviews.length === 0 && (
            <EmptyState
              icon="pen-line"
              title={s('emptyReviewsTitle')}
              description={s('emptyReviewsDesc')}
              ctaLabel={s('emptyReviewsCta')}
              onCtaPress={() => router.push({ pathname: '/(protected)/review/[venueId]', params: { venueId: String(venueId) } })}
              iconColor={colors.primaryMid}
              iconBg={colors.primaryPale}
            />
          )}

          {visibleReviews.map((review) => (
            <Card key={review.id} shadow="sm" borderRadius={Radius.md} style={styles.reviewCard}>
              <View style={styles.reviewTop}>
                <Text style={styles.reviewAuthor}>{review.reviewer_name || s('anon')}</Text>
                <View style={styles.reviewTopRight}>
                  <Text style={styles.reviewStars}>{renderStars(review.rating)}</Text>
                  {user && (
                    <TouchableOpacity
                      onPress={() => openReviewActions(review)}
                      hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                      accessibilityRole="button"
                      accessibilityLabel={s('reviewActions')}
                      testID={`review-actions-${review.id}`}
                    >
                      <Lucide name="more-horizontal" size={18} color={colors.textFaint} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              <Text style={styles.reviewText}>{review.body || ''}</Text>
              <Text style={styles.reviewDate}>{new Date(review.created_at).toLocaleDateString(dateLocale)}</Text>
            </Card>
          ))}
          {!showAllReviews && reviews.length > REVIEW_INITIAL_LIMIT && (
            <TouchableOpacity
              onPress={() => setShowAllReviews(true)}
              style={styles.writeReviewBtn}
              accessibilityRole="button"
            >
              <Text style={styles.writeReviewText}>
                {`+ ${reviews.length - REVIEW_INITIAL_LIMIT}`}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Board & Q&A (F016) */}
        {vIdNum ? <VenueBoardSection venueId={vIdNum} currentUserId={user?.id} /> : null}
      </Reanimated.ScrollView>

      {/* Check-in Success Sheet */}
      <CheckinSuccessSheet
        visible={successSheetVisible}
        venueName={venue?.name ?? ''}
        venueId={vIdNum ?? null}
        checkinId={lastCheckinId}
        endTime={lastCheckinEndTime}
        queuedOffline={checkinQueuedOffline}
        tablesCount={venue?.tables_count ?? null}
        onReportFreeTables={handleReportFreeTables}
        onMomentPosted={() => {
          if (vIdNum) queryClient.invalidateQueries({ queryKey: venueMomentsQueryKey(vIdNum) });
        }}
        onDismiss={() => {
          setSuccessSheetVisible(false);
          // F053: stack the milestone celebration AFTER the success sheet when
          // both fire from the same check-in.
          if (pendingMilestoneKey) setMilestoneCelebrationVisible(true);
        }}
      />

      {/* F053: stacked milestone celebration (shown after the success sheet). */}
      <MilestoneCelebrationSheet
        visible={milestoneCelebrationVisible}
        milestoneKey={pendingMilestoneKey}
        onClose={() => {
          setMilestoneCelebrationVisible(false);
          setPendingMilestoneKey(null);
        }}
      />

      <CheckinDurationModal
        visible={checkinModalVisible}
        customMode={customMode}
        setCustomMode={setCustomMode}
        customMinutes={customMinutes}
        setCustomMinutes={setCustomMinutes}
        untilHour={untilHour}
        setUntilHour={setUntilHour}
        untilMinute={untilMinute}
        setUntilMinute={setUntilMinute}
        lookingForPlayers={lookingForPlayers}
        setLookingForPlayers={setLookingForPlayers}
        sessionNote={sessionNote}
        setSessionNote={setSessionNote}
        onDismiss={() => setCheckinModalVisible(false)}
        onPickDuration={doCheckin}
        onConfirmCustom={handleCustomConfirm}
      />

      <ReportReasonModal
        visible={reportingReview !== null}
        submitting={reportSubmitting}
        onClose={() => setReportingReview(null)}
        onSubmit={handleSubmitReport}
      />

      <VenueChangeRequestModal
        visible={vcrVisible}
        submitting={vcrSubmitting}
        showAmenities={venueSupportsAmenities(venue?.type)}
        current={venue ? { nets: venue.nets, night_lighting: venue.night_lighting, tables_count: venue.tables_count, amenities } : undefined}
        onClose={() => setVcrVisible(false)}
        onSubmit={handleSubmitChangeRequest}
      />

      <FullscreenImageViewer url={viewerPhotoUrl} onClose={() => setViewerPhotoUrl(null)} />
    </SafeAreaView>
  );
}
