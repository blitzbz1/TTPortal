import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, TextInput, Modal, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius, Shadows } from '../theme';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
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
} from '../services/admin';
import { getProfile } from '../services/profiles';

export function AdminModerationScreen() {
  const [pendingVenues, setPendingVenues] = useState<any[]>([]);
  const [venueResults, setVenueResults] = useState<any[]>([]);
  const [venueQuery, setVenueQuery] = useState('');
  const [venuesSearching, setVenuesSearching] = useState(false);
  const venueDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [flaggedReviews, setFlaggedReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'reviews' | 'venues'>('reviews');
  // Edit modal state
  const [editVenue, setEditVenue] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editType, setEditType] = useState('');
  const [editTables, setEditTables] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const router = useRouter();
  const { user } = useSession();
  const { s } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    if (!user) return;
    getProfile(user.id).then(({ data }) => {
      setIsAdmin(data?.is_admin === true);
      setAdminLoading(false);
    });
  }, [user]);

  const fetchReviewsData = useCallback(async () => {
    setReviewsLoading(true);
    try {
      const [venuesRes, reviewsRes] = await Promise.all([
        getPendingVenues(),
        getFlaggedReviews(),
      ]);
      if (venuesRes.data) setPendingVenues(venuesRes.data);
      if (reviewsRes.data) setFlaggedReviews(reviewsRes.data);
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
    setPendingVenues((prev) => prev.filter((v) => v.id !== id));
  }, [user, s]);

  const handleReject = useCallback(async (id: number) => {
    const { error } = await rejectVenue(id, user!.id);
    if (error) {
      Alert.alert(s('error'), s('rejectError'));
      return;
    }
    setPendingVenues((prev) => prev.filter((v) => v.id !== id));
  }, [user, s]);

  const handleDeleteVenue = useCallback((id: number) => {
    Alert.alert(s('confirmDeleteVenue'), '', [
      { text: s('cancel'), style: 'cancel' },
      {
        text: s('deleteBtn'),
        style: 'destructive',
        onPress: async () => {
          const { error } = await deleteVenue(id, user!.id);
          if (error) { Alert.alert(s('error'), s('deleteVenueError')); return; }
          setVenueResults((prev) => prev.filter((v) => v.id !== id));
        },
      },
    ]);
  }, [user, s]);

  const openEditModal = useCallback((venue: any) => {
    setEditVenue(venue);
    setEditName(venue.name ?? '');
    setEditAddress(venue.address ?? '');
    setEditCity(venue.city ?? '');
    setEditType(venue.type ?? 'parc_exterior');
    setEditTables(venue.tables_count != null ? String(venue.tables_count) : '');
    setEditDescription(venue.description ?? '');
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editVenue || !editName.trim()) return;
    setEditSaving(true);
    const { data, error } = await updateVenue(editVenue.id, user!.id, {
      name: editName.trim(),
      address: editAddress.trim(),
      city: editCity.trim(),
      type: editType,
      tables_count: editTables ? Number(editTables) : null,
      description: editDescription.trim() || null,
    });
    setEditSaving(false);
    if (error) { Alert.alert(s('error'), s('genericError')); return; }
    // Update in search results
    setVenueResults((prev) => prev.map((v) => v.id === editVenue.id ? { ...v, ...data } : v));
    // Update in pending list too
    setPendingVenues((prev) => prev.map((v) => v.id === editVenue.id ? { ...v, ...data } : v));
    setEditVenue(null);
  }, [editVenue, editName, editAddress, editCity, editType, editTables, editDescription, user, s]);

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
                <View key={venue.id} style={styles.modCard}>
                  <View style={styles.modTop}>
                    <Text style={styles.modTitle}>{venue.name}</Text>
                    <View style={styles.modBadge}>
                      <Text style={styles.modBadgeText}>{s('newBadge')}</Text>
                    </View>
                  </View>
                  <Text style={styles.modMeta}>
                    {s('addedBy')}{venue.profiles?.full_name ?? s('user').toLowerCase()} {'\u00B7'}{' '}
                    {new Date(venue.created_at).toLocaleDateString('ro-RO')} {'\u00B7'}{' '}
                    {venue.city ?? ''}{venue.address ? `, ${venue.address}` : ''}
                  </Text>
                  <View style={styles.modActions}>
                    <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(venue.id)}>
                      <Lucide name="check" size={14} color={colors.textOnPrimary} />
                      <Text style={styles.approveBtnText}>{s('approve')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.editBtn} onPress={() => openEditModal(venue)}>
                      <Lucide name="pencil" size={14} color={colors.textMuted} />
                      <Text style={styles.editBtnText}>{s('edit')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(venue.id)}>
                      <Lucide name="x" size={14} color={colors.red} />
                      <Text style={styles.rejectBtnText}>{s('reject')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
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
                <View key={review.id} style={styles.flagCard}>
                  <View style={styles.flagTop}>
                    <View style={styles.flagInfo}>
                      <Text style={styles.flagAuthor}>{review.profiles?.full_name ?? s('user')}</Text>
                      <Text style={styles.flagMeta}>
                        {review.venues?.name ?? s('venue')} {'\u00B7'}{' '}
                        {new Date(review.created_at).toLocaleDateString('ro-RO')}
                      </Text>
                    </View>
                    <View style={styles.flagBadge}>
                      <Text style={styles.flagBadgeText}>{review.flag_count ?? 0} {s('reports')}</Text>
                    </View>
                  </View>
                  <Text style={styles.flagText}>{`"${review.body ?? review.text ?? ''}"`}</Text>
                  <View style={styles.flagActions}>
                    <TouchableOpacity style={styles.keepBtn} onPress={() => handleKeep(review.id)}>
                      <Lucide name="check" size={14} color={colors.textMuted} />
                      <Text style={styles.keepBtnText}>{s('keep')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(review.id)}>
                      <Lucide name="trash-2" size={14} color={colors.textOnPrimary} />
                      <Text style={styles.deleteBtnText}>{s('deleteBtn')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      ) : (
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
                    <TouchableOpacity style={styles.venueEditBtn} onPress={() => openEditModal(venue)}>
                      <Lucide name="pencil" size={14} color={colors.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.venueDeleteBtn} onPress={() => handleDeleteVenue(venue.id)}>
                      <Lucide name="trash-2" size={14} color={colors.red} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
      {/* Edit Venue Modal */}
      <Modal visible={editVenue !== null} transparent animationType="slide" onRequestClose={() => setEditVenue(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.modalOverlay} onPress={() => setEditVenue(null)}>
            <Pressable style={styles.modalSheet} onPress={() => {}}>
              <View style={styles.modalHandle}><View style={styles.modalHandleBar} /></View>
              <Text style={styles.modalTitle}>{s('editVenue')}</Text>

              <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
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

                {/* Address */}
                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>{s('fieldAddress')}</Text>
                  <TextInput style={styles.modalInput} value={editAddress} onChangeText={setEditAddress} maxLength={200} />
                </View>

                {/* City */}
                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>{s('fieldCity')}</Text>
                  <TextInput style={styles.modalInput} value={editCity} onChangeText={setEditCity} maxLength={100} />
                </View>

                {/* Tables */}
                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>{s('fieldTables')}</Text>
                  <TextInput style={styles.modalInput} value={editTables} onChangeText={setEditTables} keyboardType="numeric" />
                </View>

                {/* Description */}
                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>{s('fieldNotes')}</Text>
                  <TextInput
                    style={[styles.modalInput, { height: 70, textAlignVertical: 'top' }]}
                    value={editDescription}
                    onChangeText={setEditDescription}
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
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.bgAlt,
      height: 52,
      paddingHorizontal: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      ...Shadows.bar,
    },
    headerTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    adminBadge: {
      backgroundColor: colors.primaryPale,
      borderRadius: 8,
      paddingVertical: 2,
      paddingHorizontal: 6,
    },
    adminBadgeText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.bold,
      color: colors.primaryMid,
    },
    tabBar: {
      flexDirection: 'row',
      backgroundColor: colors.bgAlt,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      gap: 6,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabActive: {
      borderBottomColor: colors.primary,
    },
    tabText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
      color: colors.textFaint,
    },
    tabTextActive: {
      color: colors.text,
    },
    tabBadge: {
      backgroundColor: colors.redDeep,
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
    },
    tabBadgeText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.bold,
      color: colors.textOnPrimary,
    },
    scroll: {
      flex: 1,
    },
    statsRow: {
      flexDirection: 'row',
      gap: Spacing.xs,
      padding: Spacing.md,
      paddingBottom: Spacing.sm,
    },
    statCard: {
      flex: 1,
      alignItems: 'center',
      borderRadius: Radius.md,
      padding: 10,
      gap: 2,
      ...Shadows.sm,
    },
    statValue: {
      fontFamily: Fonts.heading,
      fontSize: 22,
      fontWeight: FontWeight.extrabold,
    },
    statLabel: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.medium,
      color: colors.textMuted,
    },
    secLabel: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      paddingBottom: Spacing.xs,
    },
    secLabelText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.bold,
      color: colors.textFaint,
      letterSpacing: 1,
    },
    modList: {
      paddingHorizontal: Spacing.md,
      gap: 10,
    },
    modCard: {
      backgroundColor: colors.bgAlt,
      borderRadius: 12,
      padding: 14,
      gap: 10,
      borderWidth: 1.5,
      borderColor: colors.amber,
      ...Shadows.sm,
    },
    modTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    modTitle: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.semibold,
      color: colors.text,
      flex: 1,
    },
    modBadge: {
      backgroundColor: colors.amberPale,
      borderRadius: 8,
      paddingVertical: 2,
      paddingHorizontal: Spacing.xs,
    },
    modBadgeText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.semibold,
      color: colors.accent,
    },
    modMeta: {
      fontFamily: Fonts.body,
      fontSize: FontSize.base,
      color: colors.textFaint,
    },
    modActions: {
      flexDirection: 'row',
      gap: Spacing.xs,
    },
    approveBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderRadius: 8,
      height: 36,
      gap: 6,
      ...Shadows.md,
    },
    approveBtnText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.base,
      fontWeight: FontWeight.semibold,
      color: colors.textOnPrimary,
    },
    editBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      height: 36,
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    editBtnText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.base,
      fontWeight: FontWeight.semibold,
      color: colors.textMuted,
    },
    rejectBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      height: 36,
      gap: 6,
      borderWidth: 1,
      borderColor: colors.redBorder,
      ...Shadows.md,
    },
    rejectBtnText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.base,
      fontWeight: FontWeight.semibold,
      color: colors.red,
    },
    venueSearchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgAlt,
      borderRadius: Radius.md,
      marginHorizontal: Spacing.md,
      marginTop: Spacing.md,
      paddingHorizontal: 12,
      height: 42,
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    venueSearchInput: {
      flex: 1,
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.text,
      padding: 0,
    },
    venueList: {
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.sm,
      gap: 8,
      paddingBottom: Spacing.md,
    },
    venueCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgAlt,
      borderRadius: Radius.md,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      ...Shadows.sm,
    },
    venueInfo: {
      flex: 1,
      gap: 2,
    },
    venueName: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
      color: colors.text,
    },
    venueMeta: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      color: colors.textFaint,
    },
    venueActions: {
      flexDirection: 'row',
      gap: Spacing.xs,
    },
    venueEditBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    venueDeleteBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.redBorder,
    },
    flagList: {
      paddingHorizontal: Spacing.md,
      gap: 10,
    },
    flagCard: {
      backgroundColor: colors.bgAlt,
      borderRadius: 12,
      padding: 14,
      gap: 10,
      borderWidth: 1.5,
      borderColor: colors.red,
      ...Shadows.sm,
    },
    flagTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    flagInfo: {
      gap: 2,
    },
    flagAuthor: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.semibold,
      color: colors.text,
    },
    flagMeta: {
      fontFamily: Fonts.body,
      fontSize: FontSize.base,
      color: colors.textFaint,
    },
    flagBadge: {
      backgroundColor: colors.redPale,
      borderRadius: 8,
      paddingVertical: 2,
      paddingHorizontal: 8,
    },
    flagBadgeText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.semibold,
      color: colors.red,
    },
    flagText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontStyle: 'italic',
      color: colors.textMuted,
    },
    flagActions: {
      flexDirection: 'row',
      gap: Spacing.xs,
    },
    keepBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      height: 36,
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
      ...Shadows.md,
    },
    keepBtnText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.base,
      fontWeight: FontWeight.semibold,
      color: colors.textMuted,
    },
    deleteBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.redDeep,
      borderRadius: 8,
      height: 36,
      gap: 6,
      ...Shadows.md,
    },
    deleteBtnText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.base,
      fontWeight: FontWeight.semibold,
      color: colors.textOnPrimary,
    },
    // Edit modal
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    modalSheet: {
      backgroundColor: colors.bgAlt,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      width: '100%',
      maxWidth: 430,
      maxHeight: '85%',
      paddingBottom: Spacing.xl,
      ...Shadows.lg,
    },
    modalHandle: {
      alignItems: 'center',
      paddingVertical: 10,
    },
    modalHandleBar: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
    },
    modalTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      color: colors.text,
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.md,
    },
    modalScroll: {
      paddingHorizontal: Spacing.lg,
    },
    modalField: {
      gap: 6,
      marginBottom: Spacing.md,
    },
    modalLabel: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.semibold,
      color: colors.textFaint,
      letterSpacing: 0.7,
    },
    modalInput: {
      backgroundColor: colors.bg,
      borderRadius: Radius.md,
      height: 44,
      paddingHorizontal: 12,
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalTypeRow: {
      flexDirection: 'row',
      gap: Spacing.xs,
    },
    modalTypeBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bg,
      borderRadius: Radius.md,
      height: 44,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalTypeBtnActive: {
      backgroundColor: colors.primaryPale,
      borderColor: colors.primaryDim,
    },
    modalTypeBtnText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.textMuted,
    },
    modalTypeBtnTextActive: {
      color: colors.primaryMid,
      fontWeight: FontWeight.semibold,
    },
    modalActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
    },
    modalCancelBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      height: 48,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalCancelText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.semibold,
      color: colors.textMuted,
    },
    modalSaveBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderRadius: 12,
      height: 48,
      ...Shadows.md,
    },
    modalSaveText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.bold,
      color: colors.textOnPrimary,
    },
  });
}
