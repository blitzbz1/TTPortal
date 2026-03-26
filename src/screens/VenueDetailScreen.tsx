import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
import { Lucide } from '../components/Icon';
import { Colors, Fonts, Radius } from '../theme';

export function VenueDetailScreen() {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn}>
          <Lucide name="arrow-left" size={20} color={Colors.ink} />
          <Text style={styles.backText}>&#206;napoi</Text>
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <Lucide name="pencil" size={20} color={Colors.inkFaint} />
          <Lucide name="share-2" size={20} color={Colors.inkFaint} />
        </View>
      </View>

      <ScrollView style={styles.scroll}>
        {/* Photo Strip */}
        <View style={styles.photoStrip}>
          <View style={styles.photoPlaceholder} />
          <View style={styles.photoCount}>
            <Lucide name="image" size={12} color={Colors.white} />
            <Text style={styles.photoCountText}>3 poze</Text>
          </View>
        </View>

        {/* Venue Info */}
        <View style={styles.venueInfo}>
          <View style={styles.infoTop}>
            <View style={styles.infoTitleGroup}>
              <Text style={styles.infoTitle}>Parcul Na&#539;ional</Text>
              <View style={styles.infoBadges}>
                <View style={styles.badgeVerified}>
                  <Lucide name="check" size={10} color={Colors.greenMid} />
                  <Text style={styles.badgeVerifiedText}>Verificat</Text>
                </View>
                <View style={styles.badgeFree}>
                  <Text style={styles.badgeFreeText}>Gratuit</Text>
                </View>
              </View>
            </View>
            <View style={styles.infoRating}>
              <Text style={styles.ratingStars}>{'\u2605\u2605\u2605\u2605\u2605'}</Text>
              <Text style={styles.ratingCount}>4.5 (12)</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoGrid}>
            <View style={styles.infoRow}>
              <Lucide name="map-pin" size={16} color={Colors.inkFaint} />
              <Text style={styles.infoRowText}>Bd. Mihail Kog&#259;lniceanu, Sector 5</Text>
            </View>
            <View style={styles.infoRow}>
              <Lucide name="table-2" size={16} color={Colors.inkFaint} />
              <Text style={styles.infoRowText}>4 mese &#183; Stare: Bun&#259;</Text>
            </View>
            <View style={styles.infoRow}>
              <Lucide name="clock" size={16} color={Colors.inkFaint} />
              <Text style={styles.infoRowText}>Acces liber &#183; 24/7</Text>
            </View>
            <View style={styles.infoRow}>
              <Lucide name="lamp-floor" size={16} color={Colors.inkFaint} />
              <Text style={styles.infoRowText}>Iluminare nocturn&#259; &#183; Fileuri prezente</Text>
            </View>
          </View>

          {/* Evaluate Condition */}
          <TouchableOpacity style={styles.evalBtn}>
            <Lucide name="vote" size={16} color={Colors.greenMid} />
            <Text style={styles.evalText}>Evalueaz&#259; starea mesei</Text>
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
          <TouchableOpacity style={styles.checkinBtn}>
            <Lucide name="map-pin" size={16} color={Colors.white} />
            <Text style={styles.checkinBtnText}>Check-in aici</Text>
          </TouchableOpacity>
        </View>

        {/* Directions */}
        <View style={styles.directionsSection}>
          <Text style={styles.directionsTitle}>Navigare</Text>
          <View style={styles.directionsRow}>
            <TouchableOpacity style={styles.dirGoogle}>
              <Lucide name="navigation" size={14} color={Colors.greenMid} />
              <Text style={styles.dirGoogleText}>Google</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dirOther}>
              <Text style={styles.dirOtherText}>Apple</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dirOther}>
              <Text style={styles.dirOtherText}>Waze</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Reviews */}
        <View style={styles.reviewsSection}>
          <View style={styles.reviewsHeader}>
            <Text style={styles.reviewsTitle}>Recenzii (12)</Text>
            <TouchableOpacity style={styles.writeReviewBtn}>
              <Lucide name="pen-line" size={12} color={Colors.greenMid} />
              <Text style={styles.writeReviewText}>Scrie</Text>
            </TouchableOpacity>
          </View>

          {/* Review 1 */}
          <View style={styles.reviewCard}>
            <View style={styles.reviewTop}>
              <Text style={styles.reviewAuthor}>Andrei M.</Text>
              <Text style={styles.reviewStars}>{'\u2605\u2605\u2605\u2605\u2605'}</Text>
            </View>
            <Text style={styles.reviewText}>
              Mese &#238;n stare foarte bun&#259;, loc umbrit vara. Recomand!
            </Text>
            <Text style={styles.reviewDate}>acum 3 zile</Text>
          </View>

          {/* Review 2 */}
          <View style={styles.reviewCard}>
            <View style={styles.reviewTop}>
              <Text style={styles.reviewAuthor}>Maria P.</Text>
              <Text style={styles.reviewStars}>{'\u2605\u2605\u2605\u2605\u2606'}</Text>
            </View>
            <Text style={styles.reviewText}>
              Bine &#238;ntre&#539;inut dar fileurile lipsesc. Am adus noi de acas&#259;.
            </Text>
            <Text style={styles.reviewDate}>acum 1 s&#259;pt&#259;m&#226;n&#259;</Text>
          </View>
        </View>
      </ScrollView>
    </View>
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
