import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, TextInput, Modal, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { FeedbackReplyModal } from '../components/FeedbackReplyModal';
import { AddressPickerField } from '../components/AddressPickerField';
import { upsertCity } from '../services/cities';
import { canonicalizeCityName } from '../lib/cityCatalog';
import { citiesQueryKey, useCitiesQuery } from '../hooks/queries/useCitiesQuery';
import { useTheme } from '../hooks/useTheme';
import { Fonts, Radius } from '../theme';
import { createStyles } from './AdminModerationScreen.styles';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import type { VenueCondition } from '../types/database';
import {
  getPendingVenues,
  searchVenuesAdmin,
  approveVenue,
  rejectVenue,
  deleteVenue,
  updateVenue,
  getFlaggedReviews,
  keepReview,
  deleteReview,
  getUserFeedback,
  deleteUserFeedback,
} from '../services/admin';
import { getProfile } from '../services/profiles';
import {
  getUnresolvedReports,
  resolveReport,
  type ContentReport,
} from '../services/moderation';
import {
  loadCachedPendingVenues,
  saveCachedPendingVenues,
  loadCachedFlaggedReviews,
  saveCachedFlaggedReviews,
  loadCachedUserFeedback,
  saveCachedUserFeedback,
} from '../lib/adminListsCache';

// Cached at module scope so each per-row format call doesn't construct a fresh
// Intl.DateTimeFormat. Use lazy access to keep startup cheap.
const _roDateFmt: { current: Intl.DateTimeFormat | null } = { current: null };
function formatRoDate(iso: string) {
  if (!_roDateFmt.current) _roDateFmt.current = new Intl.DateTimeFormat('ro-RO');
  return _roDateFmt.current.format(new Date(iso));
}
const _localizedDateTimeFmt: { current: Intl.DateTimeFormat | null } = { current: null };
function formatLocalizedDateTime(iso: string) {
  if (!_localizedDateTimeFmt.current) {
    _localizedDateTimeFmt.current = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  }
  return _localizedDateTimeFmt.current.format(new Date(iso));
}

function formatVenueCoordinates(lat: number | null | undefined, lng: number | null | undefined): string | null {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function formatVenueCountry(venue: any): string | null {
  const countryName = venue.cities?.country_name;
  const countryCode = venue.cities?.country_code;
  if (countryName && countryCode) return `${countryName} (${countryCode})`;
  return countryName ?? countryCode ?? null;
}

const CONDITION_OPTIONS: { value: VenueCondition; labelKey: string }[] = [
  { value: 'buna', labelKey: 'conditionGood' },
  { value: 'acceptabila', labelKey: 'conditionAcceptable' },
  { value: 'deteriorata', labelKey: 'conditionDegraded' },
  { value: 'profesionala', labelKey: 'conditionPro' },
  { value: 'necunoscuta', labelKey: 'conditionUnknown' },
];

const BOOLEAN_OPTIONS: { value: boolean | null; labelKey: string }[] = [
  { value: true, labelKey: 'yes' },
  { value: false, labelKey: 'no' },
  { value: null, labelKey: 'conditionUnknown' },
];

const REQUIRED_BOOLEAN_OPTIONS: { value: boolean; labelKey: string }[] = [
  { value: true, labelKey: 'yes' },
  { value: false, labelKey: 'no' },
];

interface PendingVenueCardProps {
  venue: any;
  styles: any;
  colors: any;
  s: (key: string) => string;
  onApprove: (id: number) => void;
  onEdit: (venue: any) => void;
  onReject: (venue: any) => void;
}
const PendingVenueCard = React.memo(function PendingVenueCard({
  venue, styles, colors, s, onApprove, onEdit, onReject,
}: PendingVenueCardProps) {
  return (
    <View style={styles.modCard}>
      <View style={styles.modTop}>
        <Text style={styles.modTitle}>{venue.name}</Text>
        <View style={styles.modBadge}>
          <Text style={styles.modBadgeText}>{s('newBadge')}</Text>
        </View>
      </View>
      <Text style={styles.modMeta}>
        {s('addedBy')}{venue.profiles?.full_name ?? s('user').toLowerCase()} {'·'}{' '}
        {formatRoDate(venue.created_at)} {'·'}{' '}
        {venue.city ?? ''}{venue.address ? `, ${venue.address}` : ''}
      </Text>
      <Text style={styles.modMeta}>
        {[formatVenueCountry(venue), formatVenueCoordinates(venue.lat, venue.lng)]
          .filter(Boolean)
          .join(' / ')}
      </Text>
      <View style={styles.modActions}>
        <TouchableOpacity style={styles.approveBtn} onPress={() => onApprove(venue.id)}>
          <Lucide name="check" size={14} color={colors.textOnPrimary} />
          <Text style={styles.approveBtnText}>{s('approve')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.editBtn} onPress={() => onEdit(venue)}>
          <Lucide name="pencil" size={14} color={colors.textMuted} />
          <Text style={styles.editBtnText}>{s('edit')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.rejectBtn} onPress={() => onReject(venue)}>
          <Lucide name="x" size={14} color={colors.red} />
          <Text style={styles.rejectBtnText}>{s('reject')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

interface FlaggedReviewCardProps {
  review: any;
  styles: any;
  colors: any;
  s: (key: string) => string;
  onKeep: (id: number) => void;
  onDelete: (id: number) => void;
}
const FlaggedReviewCard = React.memo(function FlaggedReviewCard({
  review, styles, colors, s, onKeep, onDelete,
}: FlaggedReviewCardProps) {
  return (
    <View style={styles.flagCard}>
      <View style={styles.flagTop}>
        <View style={styles.flagInfo}>
          <Text style={styles.flagAuthor}>{review.profiles?.full_name ?? s('user')}</Text>
          <Text style={styles.flagMeta}>
            {review.venues?.name ?? s('venue')} {'·'}{' '}
            {formatRoDate(review.created_at)}
          </Text>
        </View>
        <View style={styles.flagBadge}>
          <Text style={styles.flagBadgeText}>{review.flag_count ?? 0} {s('reports')}</Text>
        </View>
      </View>
      <Text style={styles.flagText}>{`"${review.body ?? review.text ?? ''}"`}</Text>
      <View style={styles.flagActions}>
        <TouchableOpacity style={styles.keepBtn} onPress={() => onKeep(review.id)}>
          <Lucide name="check" size={14} color={colors.textMuted} />
          <Text style={styles.keepBtnText}>{s('keep')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(review.id)}>
          <Lucide name="trash-2" size={14} color={colors.textOnPrimary} />
          <Text style={styles.deleteBtnText}>{s('deleteBtn')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

interface FeedbackCardProps {
  item: any;
  styles: any;
  colors: any;
  s: (key: string) => string;
  onReply: (item: any) => void;
  onDelete: (id: any) => void;
}
const FeedbackCard = React.memo(function FeedbackCard({
  item, styles, colors, s, onReply, onDelete,
}: FeedbackCardProps) {
  const authorName = item.profiles?.full_name || item.profiles?.email || s('anon');
  const iconName = item.category === 'bug' ? 'bug' : 'message-square';
  const categoryLabel = item.category === 'bug' ? s('feedbackCategoryBug') : s('feedbackCategoryGeneral');
  return (
    <View style={styles.flagCard} testID={`feedback-row-${item.id}`}>
      <View style={styles.flagTop}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
          <Lucide name={iconName} size={14} color={colors.textMuted} />
          <Text style={styles.flagAuthor} numberOfLines={1}>{authorName}</Text>
        </View>
        <View style={styles.flagBadge}>
          <Text style={styles.flagBadgeText}>{categoryLabel}</Text>
        </View>
      </View>
      <Text style={styles.flagText}>{item.message}</Text>
      <Text style={styles.flagMeta}>
        {item.page}
        {' · '}
        {formatLocalizedDateTime(item.created_at)}
      </Text>
      <View style={styles.modActions}>
        <TouchableOpacity
          style={styles.keepBtn}
          onPress={() => onReply(item)}
          testID={`feedback-reply-${item.id}`}
        >
          <Lucide name="message-circle" size={14} color={colors.primary} />
          <Text style={styles.keepBtnText}>{s('feedbackReply')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => onDelete(item.id)}
          testID={`feedback-delete-${item.id}`}
        >
          <Lucide name="trash-2" size={14} color={colors.textOnPrimary} />
          <Text style={styles.deleteBtnText}>{s('deleteBtn')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

export function AdminModerationScreen() {
  const [pendingVenues, setPendingVenues] = useState<any[]>([]);
  const [venueResults, setVenueResults] = useState<any[]>([]);
  const [venueQuery, setVenueQuery] = useState('');
  const [venuesSearching, setVenuesSearching] = useState(false);
  const venueDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [flaggedReviews, setFlaggedReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [userFeedback, setUserFeedback] = useState<any[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackLoaded, setFeedbackLoaded] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'reviews' | 'venues' | 'feedback' | 'reports'>('reviews');
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsLoaded, setReportsLoaded] = useState(false);
  const [resolvingReportId, setResolvingReportId] = useState<number | null>(null);
  const [replyTarget, setReplyTarget] = useState<any | null>(null);
  // Edit modal state
  const [editVenue, setEditVenue] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editCountryCode, setEditCountryCode] = useState<string | null>(null);
  const [editCountryName, setEditCountryName] = useState<string | null>(null);
  const [editCityCenterLat, setEditCityCenterLat] = useState<number | null>(null);
  const [editCityCenterLng, setEditCityCenterLng] = useState<number | null>(null);
  const [editCityZoom, setEditCityZoom] = useState<number | null>(null);
  const [editLat, setEditLat] = useState<number | null>(null);
  const [editLng, setEditLng] = useState<number | null>(null);
  const [editType, setEditType] = useState('');
  const [editTables, setEditTables] = useState('');
  const [editCondition, setEditCondition] = useState<VenueCondition>('necunoscuta');
  const [editNightLighting, setEditNightLighting] = useState<boolean | null>(null);
  const [editNets, setEditNets] = useState<boolean | null>(null);
  const [editVerified, setEditVerified] = useState(false);
  const [editPhotos, setEditPhotos] = useState<string[]>([]);
  const [editDescription, setEditDescription] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [knownCities, setKnownCities] = useState<string[]>([]);
  // Reject confirmation bottom sheet — set to a venue to open, null to close.
  const [rejectTarget, setRejectTarget] = useState<any | null>(null);
  const [rejectSubmitting, setRejectSubmitting] = useState(false);
  // Delete (approved) venue confirmation — Alert.alert's button callbacks
  // don't fire on react-native-web, so we use the same bottom sheet here.
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  // Ref to the modal's scroll view so AddressPickerField can disable parent
  // scrolling while the user pans the map. Without this, single-finger pan
  // gestures get stolen by the ScrollView before MapLibre claims them.
  const editScrollRef = useRef<any>(null);
  const router = useRouter();
  const { user } = useSession();
  const { s } = useI18n();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useLayoutEffect(() => {
    if (!user) return;
    getProfile(user.id).then(({ data }) => {
      setIsAdmin(data?.is_admin === true);
      setAdminLoading(false);
    });
  }, [user]);

  // Read from the delta-synced cities cache: instant render after the
  // first sync, only fetches added/changed/removed rows on each open.
  const { data: citiesList } = useCitiesQuery();
  useEffect(() => {
    if (citiesList) setKnownCities(citiesList.map((c) => c.name));
  }, [citiesList]);

  const fetchReviewsData = useCallback(async () => {
    // Stale-while-revalidate: paint cached rows immediately so a tab
    // switch is instant, then fire the network refresh in the background.
    // Only show the spinner when we have nothing to render at all.
    const cachedVenues = loadCachedPendingVenues<any>();
    const cachedReviews = loadCachedFlaggedReviews<any>();
    if (cachedVenues?.data) setPendingVenues(cachedVenues.data);
    if (cachedReviews?.data) setFlaggedReviews(cachedReviews.data);
    if (cachedVenues?.fresh && cachedReviews?.fresh) return;

    if (!cachedVenues?.data && !cachedReviews?.data) setReviewsLoading(true);
    try {
      const [venuesRes, reviewsRes] = await Promise.all([
        getPendingVenues(),
        getFlaggedReviews(),
      ]);
      if (venuesRes.data) {
        setPendingVenues(venuesRes.data);
        saveCachedPendingVenues(venuesRes.data);
      }
      if (reviewsRes.data) {
        setFlaggedReviews(reviewsRes.data);
        saveCachedFlaggedReviews(reviewsRes.data);
      }
    } finally {
      setReviewsLoading(false);
    }
  }, []);

  const handleVenueSearch = useCallback((text: string) => {
    setVenueQuery(text);
    if (venueDebounceRef.current) clearTimeout(venueDebounceRef.current);

    if (text.trim().length < 3) {
      setVenueResults([]);
      setVenuesSearching(false);
      return;
    }

    setVenuesSearching(true);
    venueDebounceRef.current = setTimeout(async () => {
      const { data } = await searchVenuesAdmin(text.trim());
      if (data) setVenueResults(data);
      setVenuesSearching(false);
    }, 400);
  }, []);

  useEffect(() => {
    fetchReviewsData();
    return () => { if (venueDebounceRef.current) clearTimeout(venueDebounceRef.current); };
  }, [fetchReviewsData]);

  const handleApprove = useCallback(async (id: number) => {
    const { error } = await approveVenue(id, user!.id);
    if (error) {
      Alert.alert(s('error'), s('approveError'));
      return;
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['venues'], exact: false }),
      queryClient.invalidateQueries({ queryKey: citiesQueryKey }),
    ]);
    setPendingVenues((prev) => prev.filter((v) => v.id !== id));
  }, [queryClient, user, s]);

  const handleReject = useCallback((venue: any) => {
    setRejectTarget(venue);
  }, []);

  const confirmReject = useCallback(async () => {
    if (!rejectTarget || !user) return;
    setRejectSubmitting(true);
    const { error } = await rejectVenue(rejectTarget.id, user.id);
    setRejectSubmitting(false);
    if (error) {
      Alert.alert(s('error'), s('rejectError'));
      return;
    }
    const rejectedId = rejectTarget.id;
    setPendingVenues((prev) => prev.filter((v) => v.id !== rejectedId));
    setRejectTarget(null);
  }, [rejectTarget, user, s]);

  const handleDeleteVenue = useCallback((venue: any) => {
    setDeleteTarget(venue);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget || !user) return;
    setDeleteSubmitting(true);
    const { error } = await deleteVenue(deleteTarget.id, user.id);
    setDeleteSubmitting(false);
    if (error) {
      Alert.alert(s('error'), s('deleteVenueError'));
      return;
    }
    const deletedId = deleteTarget.id;
    setVenueResults((prev) => prev.filter((v) => v.id !== deletedId));
    setDeleteTarget(null);
  }, [deleteTarget, user, s]);

  const openEditModal = useCallback((venue: any) => {
    setEditVenue(venue);
    setEditName(venue.name ?? '');
    setEditAddress(venue.address ?? '');
    setEditCity(venue.city ?? '');
    setEditCountryCode(venue.cities?.country_code ?? null);
    setEditCountryName(venue.cities?.country_name ?? null);
    setEditCityCenterLat(typeof venue.cities?.lat === 'number' ? venue.cities.lat : null);
    setEditCityCenterLng(typeof venue.cities?.lng === 'number' ? venue.cities.lng : null);
    setEditCityZoom(typeof venue.cities?.zoom === 'number' ? venue.cities.zoom : null);
    setEditLat(typeof venue.lat === 'number' ? venue.lat : null);
    setEditLng(typeof venue.lng === 'number' ? venue.lng : null);
    setEditType(venue.type ?? 'parc_exterior');
    setEditTables(venue.tables_count != null ? String(venue.tables_count) : '');
    setEditCondition(venue.condition ?? 'necunoscuta');
    setEditNightLighting(typeof venue.night_lighting === 'boolean' ? venue.night_lighting : null);
    setEditNets(typeof venue.nets === 'boolean' ? venue.nets : null);
    setEditVerified(venue.verified === true);
    setEditPhotos(Array.isArray(venue.photos) ? venue.photos.filter((url: unknown): url is string => typeof url === 'string' && url.length > 0) : []);
    setEditDescription(venue.description ?? '');
  }, []);

  const handleRemoveEditPhoto = useCallback((photoUrl: string) => {
    setEditPhotos((prev) => prev.filter((url) => url !== photoUrl));
  }, []);

  const handleEditAddressPatch = useCallback((patch: {
    address?: string;
    city?: string;
    lat?: number | null;
    lng?: number | null;
    countryCode?: string | null;
    countryName?: string | null;
    cityCenterLat?: number | null;
    cityCenterLng?: number | null;
    cityZoom?: number | null;
  }) => {
    if (patch.address !== undefined) setEditAddress(patch.address);
    if (patch.city !== undefined) setEditCity(patch.city);
    if (patch.lat !== undefined) setEditLat(patch.lat);
    if (patch.lng !== undefined) setEditLng(patch.lng);
    if (patch.countryCode !== undefined) setEditCountryCode(patch.countryCode);
    if (patch.countryName !== undefined) setEditCountryName(patch.countryName);
    if (patch.cityCenterLat !== undefined) setEditCityCenterLat(patch.cityCenterLat);
    if (patch.cityCenterLng !== undefined) setEditCityCenterLng(patch.cityCenterLng);
    if (patch.cityZoom !== undefined) setEditCityZoom(patch.cityZoom);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editVenue || !editName.trim()) return;
    setEditSaving(true);

    const trimmedCity = editCity.trim();
    const canonicalCity = canonicalizeCityName(trimmedCity);
    let cityIdUpdate: number | undefined;
    const hasEnoughCityMetadata = !!editCountryCode && editCityCenterLat != null && editCityCenterLng != null;
    const shouldUpsertEditedCity = canonicalCity && (
      canonicalCity !== (editVenue.city ?? '').trim() ||
      (!editVenue.city_id && hasEnoughCityMetadata)
    );
    if (shouldUpsertEditedCity) {
      const { id: upsertedId, error: cityError } = await upsertCity(canonicalCity, {
        countryCode: editCountryCode ?? editVenue.cities?.country_code,
        countryName: editCountryName ?? editVenue.cities?.country_name,
        lat: editCityCenterLat ?? editLat,
        lng: editCityCenterLng ?? editLng,
        zoom: editCityZoom ?? 12,
      });
      if (cityError || !upsertedId) {
        setEditSaving(false);
        Alert.alert(s('error'), s('genericError'));
        return;
      }
      cityIdUpdate = upsertedId;
    }

    const { data, error } = await updateVenue(editVenue.id, user!.id, {
      name: editName.trim(),
      address: editAddress.trim(),
      city: canonicalCity,
      ...(cityIdUpdate !== undefined ? { city_id: cityIdUpdate } : {}),
      type: editType,
      tables_count: editTables ? Number(editTables) : null,
      condition: editCondition,
      night_lighting: editNightLighting,
      nets: editNets,
      verified: editVerified,
      photos: editPhotos,
      description: editDescription.trim() || null,
      lat: editLat,
      lng: editLng,
    });
    setEditSaving(false);
    if (error) { Alert.alert(s('error'), s('genericError')); return; }
    // Update in search results
    setVenueResults((prev) => prev.map((v) => v.id === editVenue.id ? { ...v, ...data } : v));
    // Update in pending list too
    setPendingVenues((prev) => prev.map((v) => v.id === editVenue.id ? { ...v, ...data } : v));
    setEditVenue(null);
  }, [editVenue, editName, editAddress, editCity, editCountryCode, editCountryName, editCityCenterLat, editCityCenterLng, editCityZoom, editLat, editLng, editType, editTables, editCondition, editNightLighting, editNets, editVerified, editPhotos, editDescription, user, s]);

  const handleKeep = useCallback(async (id: number) => {
    const { error } = await keepReview(id, user!.id);
    if (error) {
      Alert.alert(s('error'), s('keepError'));
      return;
    }
    setFlaggedReviews((prev) => prev.filter((r) => r.id !== id));
  }, [user, s]);

  const handleDelete = useCallback(async (id: number) => {
    const { error } = await deleteReview(id, user!.id);
    if (error) {
      Alert.alert(s('error'), s('deleteError'));
      return;
    }
    setFlaggedReviews((prev) => prev.filter((r) => r.id !== id));
  }, [user, s]);

  const fetchFeedback = useCallback(async () => {
    const cached = loadCachedUserFeedback<any>(100);
    if (cached?.data) {
      setUserFeedback(cached.data);
      setFeedbackLoaded(true);
      if (cached.fresh) return;
    } else {
      setFeedbackLoading(true);
    }
    try {
      const { data } = await getUserFeedback();
      if (data) {
        setUserFeedback(data);
        saveCachedUserFeedback(100, data);
      }
      setFeedbackLoaded(true);
    } finally {
      setFeedbackLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'feedback' && !feedbackLoaded) {
      fetchFeedback();
    }
  }, [activeTab, feedbackLoaded, fetchFeedback]);

  const fetchReports = useCallback(async () => {
    setReportsLoading(true);
    try {
      const { data } = await getUnresolvedReports();
      setReports(data);
      setReportsLoaded(true);
    } finally {
      setReportsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'reports' && !reportsLoaded) {
      void fetchReports();
    }
  }, [activeTab, reportsLoaded, fetchReports]);

  const handleResolveReport = useCallback(async (reportId: number) => {
    setResolvingReportId(reportId);
    const { error } = await resolveReport(reportId, 'reviewed');
    setResolvingReportId(null);
    if (error) {
      Alert.alert(s('error'), error.message);
      return;
    }
    setReports((prev) => prev.filter((r) => r.id !== reportId));
  }, [s]);

  const handleDeleteFeedback = useCallback((id: string) => {
    Alert.alert(s('confirmDeleteFeedback'), '', [
      { text: s('cancel'), style: 'cancel' },
      {
        text: s('deleteBtn'),
        style: 'destructive',
        onPress: async () => {
          const { error } = await deleteUserFeedback(id, user!.id);
          if (error) { Alert.alert(s('error'), s('deleteError')); return; }
          setUserFeedback((prev) => prev.filter((f) => f.id !== id));
        },
      },
    ]);
  }, [user, s]);

  if (adminLoading) return <ActivityIndicator />;
  if (!isAdmin) {
    router.back();
    return null;
  }

  const stats = [
    { value: String(pendingVenues.length), label: s('pendingStat'), bg: colors.amberPale, color: colors.accent },
    { value: '—', label: s('approvedStat'), bg: colors.primaryPale, color: colors.greenDeep },
    { value: String(flaggedReviews.length), label: s('reportedStat'), bg: colors.redPale, color: colors.redDeep },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Lucide name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{s('adminModeration')}</Text>
        <View style={styles.adminBadge}>
          <Text style={styles.adminBadgeText}>{s('admin')}</Text>
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
        <TouchableOpacity
          style={[styles.tab, activeTab === 'venues' && styles.tabActive]}
          onPress={() => setActiveTab('venues')}
        >
          <Text style={[styles.tabText, activeTab === 'venues' && styles.tabTextActive]}>{s('tabVenues')}</Text>
        </TouchableOpacity>
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
      </View>

      {activeTab === 'reviews' && reviewsLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ flex: 1, marginTop: 40 }} />
      ) : activeTab === 'reviews' ? (
        <ScrollView style={styles.scroll}>
          {/* Stats */}
          <View style={styles.statsRow}>
            {stats.map((stat) => (
              <View key={stat.label} style={[styles.statCard, { backgroundColor: stat.bg }]}>
                <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>

          {/* Pending Venues */}
          <View style={styles.secLabel}>
            <Text style={styles.secLabelText}>{s('pendingVenues')}</Text>
          </View>
          <View style={styles.modList}>
            {pendingVenues.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <Text style={{ fontFamily: Fonts.body, fontSize: 13, color: colors.textFaint }}>
                  {s('noPendingVenues')}
                </Text>
              </View>
            ) : (
              pendingVenues.map((venue) => (
                <PendingVenueCard
                  key={venue.id}
                  venue={venue}
                  styles={styles}
                  colors={colors}
                  s={s}
                  onApprove={handleApprove}
                  onEdit={openEditModal}
                  onReject={handleReject}
                />
              ))
            )}
          </View>

          {/* Flagged Reviews */}
          <View style={styles.secLabel}>
            <Text style={styles.secLabelText}>{s('reportedReviews')}</Text>
          </View>
          <View style={styles.flagList}>
            {flaggedReviews.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <Text style={{ fontFamily: Fonts.body, fontSize: 13, color: colors.textFaint }}>
                  {s('noReportedReviews')}
                </Text>
              </View>
            ) : (
              flaggedReviews.map((review) => (
                <FlaggedReviewCard
                  key={review.id}
                  review={review}
                  styles={styles}
                  colors={colors}
                  s={s}
                  onKeep={handleKeep}
                  onDelete={handleDelete}
                />
              ))
            )}
          </View>
        </ScrollView>
      ) : activeTab === 'venues' ? (
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
              <TouchableOpacity onPress={() => { setVenueQuery(''); setVenueResults([]); }}>
                <Lucide name="x" size={16} color={colors.textFaint} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.venueList}>
            {venueQuery.trim().length < 3 ? (
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
                      onPress={() => openEditModal(venue)}
                      testID={`venue-edit-${venue.id}`}
                    >
                      <Lucide name="pencil" size={14} color={colors.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.venueDeleteBtn} onPress={() => handleDeleteVenue(venue)}>
                      <Lucide name="trash-2" size={14} color={colors.red} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      ) : activeTab === 'feedback' ? (
        <ScrollView style={styles.scroll}>
          <View style={styles.secLabel}>
            <Text style={styles.secLabelText}>{s('userFeedbackSection')}</Text>
          </View>
          {feedbackLoading ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ paddingVertical: 24 }} />
          ) : userFeedback.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <Lucide name="clipboard-pen-line" size={32} color={colors.border} />
              <Text style={{ fontFamily: Fonts.body, fontSize: 13, color: colors.textFaint, marginTop: 8 }}>
                {s('noUserFeedback')}
              </Text>
            </View>
          ) : (
            userFeedback.map((item) => (
              <FeedbackCard
                key={item.id}
                item={item}
                styles={styles}
                colors={colors}
                s={s}
                onReply={setReplyTarget}
                onDelete={handleDeleteFeedback}
              />
            ))
          )}
        </ScrollView>
      ) : (
        <ScrollView style={styles.scroll}>
          <View style={styles.secLabel}>
            <Text style={styles.secLabelText}>{s('adminReportsHeader')}</Text>
          </View>
          {reportsLoading ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ paddingVertical: 24 }} />
          ) : reports.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <Lucide name="shield-check" size={32} color={colors.border} />
              <Text style={{ fontFamily: Fonts.body, fontSize: 13, color: colors.textFaint, marginTop: 8 }}>
                {s('noReports')}
              </Text>
            </View>
          ) : (
            <View style={styles.modList}>
              {reports.map((report) => {
                const resolving = resolvingReportId === report.id;
                return (
                  <View key={report.id} style={[styles.modCard]} testID={`report-card-${report.id}`}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <Text style={{ fontFamily: Fonts.body, fontSize: 12, color: colors.textFaint, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                        {report.content_type} · #{report.content_id}
                      </Text>
                      <Text style={{ fontFamily: Fonts.body, fontSize: 11, color: colors.textFaint }}>
                        {new Date(report.created_at).toLocaleString()}
                      </Text>
                    </View>
                    <Text style={{ fontFamily: Fonts.body, fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 4 }}>
                      {s(`reportReason${report.reason
                        .split('_')
                        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
                        .join('')}`)}
                    </Text>
                    {report.notes ? (
                      <Text style={{ fontFamily: Fonts.body, fontSize: 13, color: colors.textMuted, marginBottom: 8 }}>
                        {report.notes}
                      </Text>
                    ) : null}
                    <Text style={{ fontFamily: Fonts.body, fontSize: 11, color: colors.textFaint, marginBottom: 10 }}>
                      {s('adminReportedBy')}: {report.reporter_id.slice(0, 8)}…
                    </Text>
                    <TouchableOpacity
                      onPress={() => void handleResolveReport(report.id)}
                      disabled={resolving}
                      style={{
                        alignSelf: 'flex-start',
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: Radius.md,
                        backgroundColor: colors.primary,
                        opacity: resolving ? 0.5 : 1,
                      }}
                      testID={`resolve-report-${report.id}`}
                    >
                      {resolving ? (
                        <ActivityIndicator size="small" color={colors.textOnPrimary} />
                      ) : (
                        <Text style={{ fontFamily: Fonts.body, fontSize: 13, fontWeight: '600', color: colors.textOnPrimary }}>
                          {s('adminMarkResolved')}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
      <FeedbackReplyModal feedback={replyTarget} onClose={() => setReplyTarget(null)} />
      {/* Edit Venue Modal */}
      <Modal visible={editVenue !== null} transparent animationType="slide" onRequestClose={() => setEditVenue(null)}>
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
                {/* Name */}
                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>{s('fieldName')}</Text>
                  <TextInput style={styles.modalInput} value={editName} onChangeText={setEditName} maxLength={100} />
                </View>

                {/* Type */}
                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>{s('fieldType')}</Text>
                  <View style={styles.modalTypeRow}>
                    <TouchableOpacity
                      style={[styles.modalTypeBtn, editType === 'parc_exterior' && styles.modalTypeBtnActive]}
                      onPress={() => setEditType('parc_exterior')}
                    >
                      <Text style={[styles.modalTypeBtnText, editType === 'parc_exterior' && styles.modalTypeBtnTextActive]}>
                        {s('typeParcExterior')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalTypeBtn, editType === 'sala_indoor' && styles.modalTypeBtnActive]}
                      onPress={() => setEditType('sala_indoor')}
                    >
                      <Text style={[styles.modalTypeBtnText, editType === 'sala_indoor' && styles.modalTypeBtnTextActive]}>
                        {s('typeSalaIndoor')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Address (with typeahead, geocode, map) */}
                <View style={[styles.modalField, { zIndex: 10 }]}>
                  <Text style={styles.modalLabel}>{s('fieldAddress')}</Text>
                  <AddressPickerField
                    address={editAddress}
                    city={editCity}
                    lat={editLat}
                    lng={editLng}
                    knownCities={knownCities}
                    knownCityRecords={citiesList ?? []}
                    countryCode={editCountryCode}
                    countryName={editCountryName}
                    cityCenterLat={editCityCenterLat}
                    cityCenterLng={editCityCenterLng}
                    cityZoom={editCityZoom}
                    onChange={handleEditAddressPatch}
                    parentScrollRef={editScrollRef}
                  />
                </View>

                {/* City — read-only display; filled from AddressPickerField */}
                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>{s('fieldCity')}</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editCity}
                    onChangeText={setEditCity}
                    maxLength={100}
                  />
                </View>

                {/* Tables */}
                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>{s('fieldTables')}</Text>
                  <TextInput style={styles.modalInput} value={editTables} onChangeText={setEditTables} keyboardType="numeric" />
                </View>

                {/* Condition */}
                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>{s('fieldCondition')}</Text>
                  <View style={styles.modalChoiceGrid}>
                    {CONDITION_OPTIONS.map((option) => {
                      const active = editCondition === option.value;
                      return (
                        <TouchableOpacity
                          key={option.value}
                          style={[styles.modalChoiceBtn, active && styles.modalChoiceBtnActive]}
                          onPress={() => setEditCondition(option.value)}
                          testID={`condition-${option.value}`}
                        >
                          <Text style={[styles.modalChoiceText, active && styles.modalChoiceTextActive]}>
                            {s(option.labelKey)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Lighting and nets */}
                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>{s('fieldLighting')}</Text>
                  <View style={styles.modalChoiceGrid}>
                    {BOOLEAN_OPTIONS.map((option) => {
                      const active = editNightLighting === option.value;
                      return (
                        <TouchableOpacity
                          key={`lighting-${String(option.value)}`}
                          style={[styles.modalChoiceBtn, active && styles.modalChoiceBtnActive]}
                          onPress={() => setEditNightLighting(option.value)}
                          testID={`lighting-${String(option.value)}`}
                        >
                          <Text style={[styles.modalChoiceText, active && styles.modalChoiceTextActive]}>
                            {s(option.labelKey)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>{s('fieldNets')}</Text>
                  <View style={styles.modalChoiceGrid}>
                    {BOOLEAN_OPTIONS.map((option) => {
                      const active = editNets === option.value;
                      return (
                        <TouchableOpacity
                          key={`nets-${String(option.value)}`}
                          style={[styles.modalChoiceBtn, active && styles.modalChoiceBtnActive]}
                          onPress={() => setEditNets(option.value)}
                          testID={`nets-${String(option.value)}`}
                        >
                          <Text style={[styles.modalChoiceText, active && styles.modalChoiceTextActive]}>
                            {s(option.labelKey)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>{s('verified').toUpperCase()}</Text>
                  <View style={styles.modalChoiceGrid}>
                    {REQUIRED_BOOLEAN_OPTIONS.map((option) => {
                      const active = editVerified === option.value;
                      return (
                        <TouchableOpacity
                          key={`verified-${String(option.value)}`}
                          style={[styles.modalChoiceBtn, active && styles.modalChoiceBtnActive]}
                          onPress={() => setEditVerified(option.value)}
                          testID={`verified-${String(option.value)}`}
                        >
                          <Text style={[styles.modalChoiceText, active && styles.modalChoiceTextActive]}>
                            {s(option.labelKey)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>{s('photos').toUpperCase()}</Text>
                  {editPhotos.length === 0 ? (
                    <Text style={styles.modalEmptyText}>{s('noPhotosYet')}</Text>
                  ) : (
                    <View style={styles.modalPhotoGrid}>
                      {editPhotos.map((photoUrl, index) => (
                        <View key={photoUrl} style={styles.modalPhotoItem}>
                          <Image source={{ uri: photoUrl }} style={styles.modalPhotoImage} />
                          <TouchableOpacity
                            style={styles.modalPhotoRemoveBtn}
                            onPress={() => handleRemoveEditPhoto(photoUrl)}
                            testID={`remove-photo-${index}`}
                          >
                            <Lucide name="trash-2" size={14} color={colors.textOnPrimary} />
                            <Text style={styles.modalPhotoRemoveText}>{s('deleteBtn')}</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* Description */}
                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>{s('fieldNotes')}</Text>
                  <TextInput
                    style={[styles.modalInput, { height: 70, textAlignVertical: 'top' }]}
                    value={editDescription}
                    onChangeText={setEditDescription}
                    testID="edit-description"
                    multiline
                    maxLength={500}
                  />
                </View>
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setEditVenue(null)}>
                  <Text style={styles.modalCancelText}>{s('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSaveBtn, editSaving && { opacity: 0.6 }]}
                  onPress={handleSaveEdit}
                  disabled={editSaving}
                >
                  {editSaving ? (
                    <ActivityIndicator size="small" color={colors.textOnPrimary} />
                  ) : (
                    <Text style={styles.modalSaveText}>{s('save')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
      </Modal>

      {/* Reject confirmation bottom sheet. Reject is a hard delete (no
          rejected_at flag, no submitter notification), so we surface the
          consequence and require an explicit confirmation tap. */}
      <Modal
        visible={rejectTarget !== null}
        transparent
        animationType="slide"
        onRequestClose={() => !rejectSubmitting && setRejectTarget(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => !rejectSubmitting && setRejectTarget(null)}>
          <Pressable style={styles.confirmSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle}><View style={styles.modalHandleBar} /></View>
            <Text style={styles.modalTitle}>{s('confirmRejectTitle')}</Text>
            <View style={styles.confirmBody}>
              {rejectTarget?.name ? (
                <Text style={styles.confirmVenueName}>{rejectTarget.name}</Text>
              ) : null}
              <Text style={styles.confirmMessage}>{s('confirmRejectMessage')}</Text>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setRejectTarget(null)}
                disabled={rejectSubmitting}
              >
                <Text style={styles.modalCancelText}>{s('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmRejectBtn, rejectSubmitting && { opacity: 0.6 }]}
                onPress={confirmReject}
                disabled={rejectSubmitting}
              >
                {rejectSubmitting ? (
                  <ActivityIndicator size="small" color={colors.textOnPrimary} />
                ) : (
                  <Text style={styles.confirmRejectText}>{s('reject')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
    </SafeAreaView>
  );
}
