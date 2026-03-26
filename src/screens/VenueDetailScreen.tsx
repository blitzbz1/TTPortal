import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Linking, Share, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { Colors, Fonts, Radius } from '../theme';
import { useSession } from '../hooks/useSession';
import { getVenueById } from '../services/venues';
import { getReviewsForVenue } from '../services/reviews';
import { checkin } from '../services/checkins';
import { isFavorite, addFavorite, removeFavorite } from '../services/favorites';
import type { Venue, Review, VenueStats } from '../types/database';

interface Props {
  venueId?: string;
}

export function VenueDetailScreen({ venueId }: Props) {
  const router = useRouter();
  const { user } = useSession();
  const [venue, setVenue] = useState<(Venue & { venue_stats: VenueStats | null }) | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [favorited, setFavorited] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkinLoading, setCheckinLoading] = useState(false);

  useEffect(() => {
    if (!venueId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      const [venueRes, reviewsRes] = await Promise.all([
        getVenueById(Number(venueId)),
        getReviewsForVenue(Number(venueId)),
      ]);
      if (cancelled) return;
      if (venueRes.data) setVenue(venueRes.data as any);
      if (reviewsRes.data) setReviews(reviewsRes.data as Review[]);

      if (user) {
        const favRes = await isFavorite(user.id, Number(venueId));
        if (!cancelled && favRes.data !== undefined) setFavorited(favRes.data);
      }
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [venueId, user]);

  const handleShare = useCallback(() => {
    if (!venue) return;
    Share.share({ message: venue.name + ' - ' + (venue.address || '') });
  }, [venue]);

  const handleCheckin = useCallback(async () => {
    if (!user || !venueId) return;
    setCheckinLoading(true);
    const { error } = await checkin({ user_id: user.id, venue_id: Number(venueId), table_number: null, started_at: new Date().toISOString(), ended_at: null, friends: null });
    setCheckinLoading(false);
    if (error) { Alert.alert('Eroare', error.message); return; }
    Alert.alert('Succes', 'Check-in realizat cu succes!');
  }, [user, venueId]);

  const handleToggleFavorite = useCallback(async () => {
    if (!user || !venueId) return;
    if (favorited) {
      const { error } = await removeFavorite(user.id, Number(venueId));
      if (error) { Alert.alert('Eroare', error.message); return; }
      setFavorited(false);
    } else {
      const { error } = await addFavorite(user.id, Number(venueId));
      if (error) { Alert.alert('Eroare', error.message); return; }
      setFavorited(true);
    }
  }, [user, venueId, favorited]);

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
        <ActivityIndicator size="large" color={Colors.green} />
      </View>
    );
  }

  if (!venue) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: Colors.inkMuted }}>Locatia nu a fost gasita.</Text>
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
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Lucide name="arrow-left" size={20} color={Colors.ink} />
          <Text style={styles.backText}>{'Înapoi'}</Text>
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleToggleFavorite}>
            <Lucide name={favorited ? 'heart' : 'heart'} size={20} color={favorited ? Colors.red : Colors.inkFaint} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShare}>
            <Lucide name="share-2" size={20} color={Colors.inkFaint} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll}>
        {/* Photo Strip */}
        <View style={styles.photoStrip}>
          <View style={styles.photoPlaceholder} />
          <View style={styles.photoCount}>
            <Lucide name="image" size={12} color={Colors.white} />
            <Text style={styles.photoCountText}>{(venue.photos?.length ?? 0) + ' poze'}</Text>
          </View>
        </View>

        {/* Venue Info */}
        <View style={styles.venueInfo}>
          <View style={styles.infoTop}>
            <View style={styles.infoTitleGroup}>
              <Text style={styles.infoTitle}>{venue.name}</Text>
              <View style={styles.infoBadges}>
                {venue.verified && (
                  <View style={styles.badgeVerified}>
                    <Lucide name="check" size={10} color={Colors.greenMid} />
                    <Text style={styles.badgeVerifiedText}>Verificat</Text>
                  </View>
                )}
                {venue.free_access && (
                  <View style={styles.badgeFree}>
                    <Text style={styles.badgeFreeText}>Gratuit</Text>
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
              <Lucide name="map-pin" size={16} color={Colors.inkFaint} />
              <Text style={styles.infoRowText}>{venue.address || 'Adresa necunoscuta'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Lucide name="table-2" size={16} color={Colors.inkFaint} />
              <Text style={styles.infoRowText}>{(venue.tables_count ?? '?') + ' mese \u00B7 Stare: ' + (venue.condition ?? 'Necunoscută')}</Text>
            </View>
            <View style={styles.infoRow}>
              <Lucide name="clock" size={16} color={Colors.inkFaint} />
              <Text style={styles.infoRowText}>{venue.hours || 'Acces liber \u00B7 24/7'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Lucide name="lamp-floor" size={16} color={Colors.inkFaint} />
              <Text style={styles.infoRowText}>
                {(venue.night_lighting ? 'Iluminare nocturnă' : 'Fără iluminare') + ' \u00B7 ' + (venue.nets ? 'Fileuri prezente' : 'Fără fileuri')}
              </Text>
            </View>
          </View>

          {/* Evaluate Condition */}
          <TouchableOpacity style={styles.evalBtn} onPress={() => router.push(`/(protected)/condition-vote/${venueId}` as any)}>
            <Lucide name="vote" size={16} color={Colors.greenMid} />
            <Text style={styles.evalText}>{'Evaluează starea mesei'}</Text>
            <Lucide name="chevron-right" size={14} color={Colors.greenMid} />
          </TouchableOpacity>
        </View>

        {/* Friends Here */}
        <View style={styles.friendsSection}>
          <View style={styles.friendsTitle}>
            <Lucide name="users" size={14} color={Colors.purple} />
            <Text style={styles.friendsTitleText}>Prieteni aici acum</Text>
          </View>
          <View style={styles.checkinRow}>
            <View style={styles.checkinAvatar}>
              <Text style={styles.checkinInitials}>A</Text>
            </View>
            <View style={styles.checkinInfo}>
              <Text style={styles.checkinName}>Andrei M.</Text>
              <Text style={styles.checkinTime}>Check-in acum 15 min</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.checkinBtn} onPress={handleCheckin} disabled={checkinLoading}>
            {checkinLoading ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <>
                <Lucide name="map-pin" size={16} color={Colors.white} />
                <Text style={styles.checkinBtnText}>Check-in aici</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Directions */}
        <View style={styles.directionsSection}>
          <Text style={styles.directionsTitle}>Navigare</Text>
          <View style={styles.directionsRow}>
            <TouchableOpacity style={styles.dirGoogle} onPress={handleDirectionGoogle}>
              <Lucide name="navigation" size={14} color={Colors.greenMid} />
              <Text style={styles.dirGoogleText}>Google</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dirOther} onPress={handleDirectionApple}>
              <Text style={styles.dirOtherText}>Apple</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dirOther} onPress={handleDirectionWaze}>
              <Text style={styles.dirOtherText}>Waze</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Reviews */}
        <View style={styles.reviewsSection}>
          <View style={styles.reviewsHeader}>
            <Text style={styles.reviewsTitle}>{'Recenzii (' + reviews.length + ')'}</Text>
            <TouchableOpacity style={styles.writeReviewBtn} onPress={() => router.push(`/(protected)/review/${venueId}` as any)}>
              <Lucide name="pen-line" size={12} color={Colors.greenMid} />
              <Text style={styles.writeReviewText}>Scrie</Text>
            </TouchableOpacity>
          </View>

          {reviews.length === 0 && (
            <Text style={styles.reviewText}>{'Nicio recenzie încă. Fii primul care scrie una!'}</Text>
          )}

          {reviews.map((review) => (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewTop}>
                <Text style={styles.reviewAuthor}>{review.reviewer_name || 'Anonim'}</Text>
                <Text style={styles.reviewStars}>{renderStars(review.rating)}</Text>
              </View>
              <Text style={styles.reviewText}>{review.body || ''}</Text>
              <Text style={styles.reviewDate}>{new Date(review.created_at).toLocaleDateString('ro-RO')}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    height: 52,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.inkMuted,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  scroll: {
    flex: 1,
  },
  photoStrip: {
    height: 200,
    backgroundColor: Colors.bgMid,
    position: 'relative',
  },
  photoPlaceholder: {
    flex: 1,
    backgroundColor: Colors.bgDark,
  },
  photoCount: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00000088',
    borderRadius: 100,
    paddingVertical: 4,
    paddingHorizontal: 10,
    gap: 4,
  },
  photoCountText: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.white,
  },
  venueInfo: {
    backgroundColor: Colors.white,
    padding: 16,
    gap: 14,
  },
  infoTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoTitleGroup: {
    flex: 1,
    gap: 6,
  },
  infoTitle: {
    fontFamily: Fonts.heading,
    fontSize: 20,
    fontWeight: '700',
    color: Colors.ink,
  },
  infoBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  badgeVerified: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.greenPale,
    borderRadius: 100,
    paddingVertical: 2,
    paddingHorizontal: 8,
    gap: 4,
  },
  badgeVerifiedText: {
    fontFamily: Fonts.body,
    fontSize: 10,
    fontWeight: '600',
    color: Colors.greenMid,
  },
  badgeFree: {
    backgroundColor: Colors.bluePale,
    borderRadius: 100,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  badgeFreeText: {
    fontFamily: Fonts.body,
    fontSize: 10,
    fontWeight: '600',
    color: Colors.blue,
  },
  infoRating: {
    alignItems: 'flex-end',
    gap: 2,
  },
  ratingStars: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.orange,
  },
  ratingCount: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.inkFaint,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.bgMid,
  },
  infoGrid: {
    gap: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoRowText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.inkMuted,
  },
  evalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.greenPale,
    borderRadius: Radius.md,
    height: 38,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.greenDim,
  },
  evalText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.greenMid,
  },
  friendsSection: {
    backgroundColor: Colors.purplePale,
    padding: 16,
    gap: 10,
  },
  friendsTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  friendsTitleText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.purple,
  },
  checkinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkinAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.purpleMid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkinInitials: {
    fontFamily: Fonts.body,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
  },
  checkinInfo: {
    gap: 1,
  },
  checkinName: {
    fontFamily: Fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.ink,
  },
  checkinTime: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.inkFaint,
  },
  checkinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.purple,
    borderRadius: Radius.md,
    height: 40,
    gap: 8,
  },
  checkinBtnText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
  },
  directionsSection: {
    backgroundColor: Colors.white,
    padding: 16,
    gap: 10,
  },
  directionsTitle: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ink,
  },
  directionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dirGoogle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.greenPale,
    borderRadius: Radius.md,
    height: 40,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.greenDim,
  },
  dirGoogleText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.greenMid,
  },
  dirOther: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    height: 40,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dirOtherText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.inkMuted,
  },
  reviewsSection: {
    backgroundColor: Colors.white,
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  reviewsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewsTitle: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ink,
  },
  writeReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.greenPale,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.greenDim,
  },
  writeReviewText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.greenMid,
  },
  reviewCard: {
    borderRadius: Radius.md,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  reviewTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewAuthor: {
    fontFamily: Fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.ink,
  },
  reviewStars: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.orange,
  },
  reviewText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.inkMuted,
    lineHeight: 13 * 1.45,
  },
  reviewDate: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.inkFaint,
  },
});
