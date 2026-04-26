import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert, Linking, Share, ActivityIndicator, Platform, FlatList, Dimensions, Animated } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { useTheme } from '../hooks/useTheme';
import { Fonts, Radius } from '../theme';
import { createStyles } from './VenueDetailScreen.styles';
import { CheckinDurationModal } from './VenueDetailScreen/CheckinDurationModal';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import { getVenueById, uploadVenuePhoto, addPhotoToVenue } from '../services/venues';
import {
  loadCachedVenueMeta,
  saveCachedVenueMeta,
  loadCachedVenueReviews,
  saveCachedVenueReviews,
} from '../lib/venueDetailCache';
import { venueImageUrl } from '../lib/imageTransforms';
import { getProfile } from '../services/profiles';
import * as ImagePicker from 'expo-image-picker';
import { getReviewsForVenue } from '../services/reviews';
import { checkin, checkout, getUserActiveCheckin, getUserAnyActiveCheckin, getActiveFriendCheckins, getVenueChampion } from '../services/checkins';
import { getUpcomingEventsByVenue } from '../services/events';
import { getFriendIds } from '../services/friends';
import { isFavorite, addFavorite, removeFavorite } from '../services/favorites';
import type { Venue, Review, VenueStats } from '../types/database';
import { Card } from '../components/Card';
import { safeErrorMessage } from '../lib/auth-utils';
import { VenueActionRow } from '../components/VenueActionRow';
import { CheckinSuccessSheet } from '../components/CheckinSuccessSheet';
import { EmptyState } from '../components/EmptyState';
import { hapticLight } from '../lib/haptics';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';

// Lazy-load ImageManipulator to avoid crash when native module is missing
let ImageManipulator: typeof import('expo-image-manipulator') | null = null;
try { ImageManipulator = require('expo-image-manipulator'); } catch {}

interface Props {
  venueId?: string;
}

export function VenueDetailScreen({ venueId }: Props) {
  const router = useRouter();
  const { user } = useSession();
  const { s, lang } = useI18n();
  const { colors } = useTheme();
  const dateLocale = lang === 'en' ? 'en-GB' : 'ro-RO';
  const { styles } = useMemo(() => createStyles(colors), [colors]);

  const [venue, setVenue] = useState<(Venue & { venue_stats: VenueStats | null }) | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [favorited, setFavorited] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [activeCheckin, setActiveCheckin] = useState<any>(null);
  const [friendsHere, setFriendsHere] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const screenWidth = Dimensions.get('window').width;
  const photoWidth = Platform.OS === 'web' ? Math.min(screenWidth, 430) : screenWidth;
  const photoHeight = Math.round(photoWidth * 9 / 16);
  const [checkinModalVisible, setCheckinModalVisible] = useState(false);
  const [customMode, setCustomMode] = useState<'none' | 'minutes' | 'until'>('none');
  const [customMinutes, setCustomMinutes] = useState('');
  const [untilHour, setUntilHour] = useState('');
  const [untilMinute, setUntilMinute] = useState('');
  const [successSheetVisible, setSuccessSheetVisible] = useState(false);
  const [lastCheckinEndTime, setLastCheckinEndTime] = useState<string | undefined>();
  const [champion, setChampion] = useState<{ userId: string; fullName: string; dayCount: number } | null>(null);
  const [upcomingEventCount, setUpcomingEventCount] = useState(0);
  const REVIEW_INITIAL_LIMIT = 10;
  const [showAllReviews, setShowAllReviews] = useState(false);
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

  useEffect(() => {
    if (!venueId || isNaN(Number(venueId)) || Number(venueId) < 1) return;
    let cancelled = false;

    async function load() {
      const vId = Number(venueId);
      // Cache-first: paint venue meta + reviews from cache while the network
      // refreshes them. Live data (active checkins, champion, friends here)
      // is always fetched fresh below.
      const cachedMeta = loadCachedVenueMeta<any>(vId);
      const cachedReviews = loadCachedVenueReviews<Review>(vId);
      if (cachedMeta) setVenue(cachedMeta.data);
      if (cachedReviews) setReviews(cachedReviews.data);
      if (!cachedMeta) setLoading(true);

      const [venueRes, reviewsRes] = await Promise.all([
        getVenueById(vId),
        getReviewsForVenue(vId),
      ]);
      if (cancelled) return;
      if (venueRes.data) {
        setVenue(venueRes.data as any);
        saveCachedVenueMeta(vId, venueRes.data);
      }
      if (reviewsRes.data) {
        setReviews(reviewsRes.data as Review[]);
        saveCachedVenueReviews(vId, reviewsRes.data);
      }

      if (user) {
        const [favRes, checkinRes] = await Promise.all([
          isFavorite(user.id, Number(venueId)),
          getUserActiveCheckin(user.id, Number(venueId)),
        ]);
        if (!cancelled) {
          if (favRes.data !== undefined) setFavorited(favRes.data);
          setActiveCheckin(checkinRes.data ?? null);
        }

        // Fetch friends currently checked in at this venue
        try {
          const fIds = await getFriendIds(user.id);
          if (fIds.length > 0 && !cancelled) {
            const { data: friendCheckins } = await getActiveFriendCheckins(fIds);
            if (!cancelled) {
              const here = (friendCheckins ?? []).filter((c: any) => c.venue_id === Number(venueId));
              setFriendsHere(here);
            }
          }
        } catch {
          // non-critical, ignore
        }

        // Check admin status
        try {
          const { data: profileData } = await getProfile(user.id);
          if (!cancelled && profileData) setIsAdmin(profileData.is_admin === true);
        } catch {
          // non-critical
        }
      }

      // Load venue champion
      try {
        const { data: champ } = await getVenueChampion(Number(venueId));
        if (!cancelled) setChampion(champ);
      } catch {}

      // Load upcoming-events count for this venue
      try {
        const { data: evs } = await getUpcomingEventsByVenue(Number(venueId));
        if (!cancelled) setUpcomingEventCount(evs?.length ?? 0);
      } catch {}

      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [venueId, user]);

  const handleReview = useCallback(() => {
    router.push(`/(protected)/review/${venueId}` as any);
  }, [router, venueId]);

  const handleShare = useCallback(() => {
    if (!venue) return;
    Share.share({ message: venue.name + ' - ' + (venue.address || '') });
  }, [venue]);

  const showAlert = useCallback((title: string, msg: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  }, []);

  const showDurationModal = useCallback(() => {
    setCustomMode('none');
    setCustomMinutes('');
    setUntilHour('');
    setUntilMinute('');
    setCheckinModalVisible(true);
  }, []);

  const openCheckinModal = useCallback(async () => {
    if (!user) return;
    // Check if user has an active checkin at a DIFFERENT venue
    const { data: existing } = await getUserAnyActiveCheckin(user.id);
    if (existing && existing.venue_id !== Number(venueId)) {
      const venueName = existing.venues?.name ?? '';
      const msg = `${s('alreadyCheckedIn')} ${venueName}. ${s('checkoutAndContinue')}`;
      if (Platform.OS === 'web') {
        if (!window.confirm(msg)) return;
        await checkout(existing.id, user.id);
      } else {
        return new Promise<void>((resolve) => {
          Alert.alert(s('alreadyCheckedIn') + ' ' + venueName, s('checkoutAndContinue'), [
            { text: s('cancel'), style: 'cancel', onPress: () => resolve() },
            { text: s('yes'), onPress: async () => { await checkout(existing.id, user.id); showDurationModal(); resolve(); } },
          ]);
        });
      }
    }
    showDurationModal();
  }, [user, venueId, showDurationModal, s]);

  const doCheckin = useCallback(async (durationMinutes: number) => {
    if (!user || !venueId) return;
    setCheckinModalVisible(false);
    setCheckinLoading(true);
    const now = new Date();
    const endedAt = new Date(now.getTime() + durationMinutes * 60_000);
    const { error } = await checkin({
      user_id: user.id,
      venue_id: Number(venueId),
      table_number: null,
      started_at: now.toISOString(),
      ended_at: endedAt.toISOString(),
      friends: [],
    });
    setCheckinLoading(false);
    if (error) { showAlert(s('error'), safeErrorMessage(error, 'genericError', s)); return; }
    // Refresh active checkin state
    const { data: active } = await getUserActiveCheckin(user.id, Number(venueId));
    setActiveCheckin(active ?? null);
    const endTimeStr = endedAt.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
    setLastCheckinEndTime(endTimeStr);
    setSuccessSheetVisible(true);
  }, [user, venueId, showAlert, s]);

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
  }, [customMode, customMinutes, untilHour, untilMinute, doCheckin, showAlert, s]);

  const handleCheckout = useCallback(async () => {
    if (!activeCheckin || !user) return;
    setCheckinLoading(true);
    const { error } = await checkout(activeCheckin.id, user.id);
    setCheckinLoading(false);
    if (error) { showAlert(s('error'), safeErrorMessage(error, 'genericError', s)); return; }
    setActiveCheckin(null);
  }, [activeCheckin, showAlert, user, s]);

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
      // Resize to max 1024px on longest side and convert to JPEG
      const isLandscape = (asset.width ?? 0) >= (asset.height ?? 0);
      const needsResize = (asset.width ?? 0) > 1024 || (asset.height ?? 0) > 1024;
      const actions = needsResize
        ? [{ resize: isLandscape ? { width: 1024 } : { height: 1024 } }]
        : [];
      let uploadUri = asset.uri;
      if (ImageManipulator) {
        const manipulated = await ImageManipulator.manipulateAsync(
          asset.uri,
          actions,
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
        );
        uploadUri = manipulated.uri;
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

      // Update local state to show new photo immediately
      setVenue((prev) => prev ? { ...prev, photos: [...(prev.photos ?? []), url] } : prev);
      showAlert(s('success'), s('photoUploaded'));
    } catch {
      showAlert(s('error'), s('photoUploadError'));
    } finally {
      setUploading(false);
    }
  }, [venue, venueId, showAlert, s]);

  const animateHeart = useCallback(() => {
    Animated.sequence([
      Animated.timing(heartScale, { toValue: 1.4, duration: 150, useNativeDriver: true }),
      Animated.timing(heartScale, { toValue: 1.0, duration: 150, useNativeDriver: true }),
    ]).start();
  }, [heartScale]);

  const handleToggleFavorite = useCallback(async () => {
    if (!user || !venueId) return;
    hapticLight();
    if (favorited) {
      const { error } = await removeFavorite(user.id, Number(venueId));
      if (error) { Alert.alert(s('error'), safeErrorMessage(error, 'genericError', s)); return; }
      setFavorited(false);
      animateHeart();
    } else {
      const { error } = await addFavorite(user.id, Number(venueId));
      if (error) { Alert.alert(s('error'), safeErrorMessage(error, 'genericError', s)); return; }
      setFavorited(true);
      animateHeart();
    }
  }, [user, venueId, favorited, animateHeart, s]);

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
                  <Image
                    source={venueImageUrl(item, { width: Math.round(photoWidth * 2), quality: 75 })}
                    style={{ width: photoWidth, height: photoHeight }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={150}
                  />
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
              <Text style={styles.infoRowText}>{(venue.tables_count ?? '?') + ' ' + s('tablesState') + ' ' + (venue.condition ?? s('conditionUnknown'))}</Text>
            </View>
            <View style={styles.infoRow}>
              <Lucide name="clock" size={16} color={colors.textFaint} />
              <Text style={styles.infoRowText}>{venue.hours || s('freeAccess247')}</Text>
            </View>
            <View style={styles.infoRow}>
              <Lucide name="lamp-floor" size={16} color={colors.textFaint} />
              <Text style={styles.infoRowText}>
                {(venue.night_lighting ? s('nightLighting') : s('noLighting')) + ' \u00B7 ' + (venue.nets ? s('netsPresent') : s('noNets'))}
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

          {/* Evaluate Condition */}
          <TouchableOpacity style={styles.evalBtn} onPress={() => router.push(`/(protected)/condition-vote/${venueId}` as any)}>
            <Lucide name="vote" size={16} color={colors.primaryMid} />
            <Text style={styles.evalText}>{s('evaluateCondition')}</Text>
            <Lucide name="chevron-right" size={14} color={colors.primaryMid} />
          </TouchableOpacity>
        </Card>

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
                onPress={() => router.push(`/(protected)/player/${fc.user_id}` as any)}
                accessibilityRole="button"
                accessibilityLabel={name}
                testID={`friends-here-${fc.user_id}`}
              >
                <View style={styles.checkinAvatar}>
                  <Text style={styles.checkinInitials}>{initial}</Text>
                </View>
                <View style={styles.checkinInfo}>
                  <Text style={styles.checkinName}>{name}</Text>
                  {ago != null && <Text style={styles.checkinTime}>{`${ago}m`}</Text>}
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
                    ? `· ${s('untilTime')} ${new Date(activeCheckin.ended_at).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}`
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

        {/* Venue Links */}
        <View style={styles.navSection}>
          <TouchableOpacity
            style={[styles.navRow, styles.navRowLast]}
            onPress={() => router.push(`/(protected)/venue-events/${venueId}` as any)}
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
            <TouchableOpacity style={styles.writeReviewBtn} onPress={() => router.push(`/(protected)/review/${venueId}` as any)} testID="write-review-btn" accessibilityLabel={s('writeBtn')}>
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
              onCtaPress={() => router.push(`/(protected)/review/${venueId}` as any)}
              iconColor={colors.primaryMid}
              iconBg={colors.primaryPale}
            />
          )}

          {visibleReviews.map((review) => (
            <Card key={review.id} shadow="sm" borderRadius={Radius.md} style={styles.reviewCard}>
              <View style={styles.reviewTop}>
                <Text style={styles.reviewAuthor}>{review.reviewer_name || s('anon')}</Text>
                <Text style={styles.reviewStars}>{renderStars(review.rating)}</Text>
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
      </Reanimated.ScrollView>

      {/* Check-in Success Sheet */}
      <CheckinSuccessSheet
        visible={successSheetVisible}
        venueName={venue?.name ?? ''}
        endTime={lastCheckinEndTime}
        onDismiss={() => setSuccessSheetVisible(false)}
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
        onDismiss={() => setCheckinModalVisible(false)}
        onPickDuration={doCheckin}
        onConfirmCustom={handleCustomConfirm}
      />
    </SafeAreaView>
  );
}
