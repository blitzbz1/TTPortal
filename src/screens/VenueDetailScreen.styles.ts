import { StyleSheet } from 'react-native';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Radius, Shadows, Spacing } from '../theme';

export function createStyles(colors: ThemeColors) {
  const cm = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: colors.overlayHeavy, justifyContent: 'flex-end', alignItems: 'center' },
    sheet: { backgroundColor: colors.bgAlt, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingBottom: 32, width: '100%', maxWidth: 430, ...Shadows.lg },
    handleWrap: { alignItems: 'center', paddingVertical: 10 },
    handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border },
    title: { fontFamily: Fonts.heading, fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: colors.text, marginBottom: Spacing.md },
    options: { gap: Spacing.xs },
    optionBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: colors.bg, borderRadius: Radius.md, padding: 14, borderWidth: 1, borderColor: colors.borderLight, ...Shadows.sm },
    optionText: { fontFamily: Fonts.body, fontSize: 15, fontWeight: FontWeight.medium, color: colors.text },
    customSection: { gap: 12 },
    customLabel: { fontFamily: Fonts.body, fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: colors.textMuted },
    input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: Radius.md, padding: Spacing.sm, fontFamily: Fonts.body, fontSize: FontSize.xl, color: colors.text, backgroundColor: colors.bgAlt },
    timeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    timeInput: { flex: 1, textAlign: 'center' },
    timeSep: { fontFamily: Fonts.heading, fontSize: 22, fontWeight: FontWeight.bold, color: colors.text },
    customActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
    backBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.lg, paddingVertical: 14, borderWidth: 1, borderColor: colors.border },
    backBtnText: { fontFamily: Fonts.body, fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: colors.textMuted },
    confirmBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.lg, paddingVertical: 14, backgroundColor: colors.primary, ...Shadows.md },
    confirmBtnText: { fontFamily: Fonts.body, fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: colors.textOnPrimary },
  });

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    scroll: {
      flex: 1,
    },
    photoStrip: {
      backgroundColor: colors.bgMid,
      position: 'relative',
      overflow: 'hidden',
    },
    photoPlaceholder: {
      flex: 1,
      backgroundColor: colors.bgMuted,
    },
    dotsRow: {
      position: 'absolute',
      bottom: 12,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 6,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.textOnPrimary,
      opacity: 0.4,
    },
    dotActive: {
      opacity: 1,
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    addPhotoBtn: {
      position: 'absolute',
      bottom: 12,
      right: 12,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...Shadows.lg,
    },
    photoCount: {
      position: 'absolute',
      bottom: 12,
      left: 12,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.overlayHeavy,
      borderRadius: 100,
      paddingVertical: 4,
      paddingHorizontal: 10,
      gap: 4,
    },
    photoCountText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      color: colors.textOnPrimary,
    },
    evalBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryPale,
      borderRadius: Radius.md,
      height: 38,
      gap: 8,
      borderWidth: 1,
      borderColor: colors.primaryDim,
      ...Shadows.sm,
    },
    evalText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
      color: colors.primaryMid,
    },
    friendsSection: {
      backgroundColor: colors.bgAlt,
      padding: Spacing.md,
      gap: 10,
    },
    friendsTitle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    friendsTitleText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
      color: colors.purple,
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
      backgroundColor: colors.purpleMid,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkinInitials: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.bold,
      color: colors.textOnPrimary,
    },
    checkinInfo: {
      gap: 1,
    },
    checkinName: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
      color: colors.text,
    },
    checkinTime: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      color: colors.textFaint,
    },
    navSection: {
      backgroundColor: colors.bgAlt,
      marginHorizontal: Spacing.md,
      marginTop: 10,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.sm,
      gap: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    navRowLast: {
      borderBottomWidth: 0,
    },
    navIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    navLabel: {
      flex: 1,
      fontFamily: Fonts.body,
      fontSize: 15,
      fontWeight: FontWeight.medium,
      color: colors.text,
    },
    navCountPill: {
      backgroundColor: colors.amberPale,
      borderRadius: 10,
      paddingVertical: 2,
      paddingHorizontal: 8,
      marginRight: 4,
    },
    navCountText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.bold,
      color: colors.accent,
    },
    reviewsSection: {
      backgroundColor: colors.bgAlt,
      marginHorizontal: Spacing.md,
      padding: Spacing.md,
      gap: Spacing.sm,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    reviewsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    reviewsTitle: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.semibold,
      color: colors.text,
    },
    writeReviewBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primaryPale,
      borderRadius: 8,
      paddingVertical: 6,
      paddingHorizontal: Spacing.sm,
      gap: Spacing.xxs,
      borderWidth: 1,
      borderColor: colors.primaryDim,
      ...Shadows.sm,
    },
    writeReviewText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.base,
      fontWeight: FontWeight.semibold,
      color: colors.primaryMid,
    },
    reviewCard: {
      paddingVertical: Spacing.sm,
      gap: Spacing.xs,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    reviewTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    reviewTopRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    reviewAuthor: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
      color: colors.text,
    },
    reviewStars: {
      fontFamily: Fonts.body,
      fontSize: FontSize.base,
      color: colors.accent,
    },
    reviewText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.textMuted,
      lineHeight: 13 * 1.45,
    },
    reviewDate: {
      fontFamily: Fonts.body,
      fontSize: 11,
      color: colors.textFaint,
    },

    // ───────────────────────── Redesign (v4-playbanner-bar) ─────────────────
    // Overlay topbar (floats on the hero photo)
    topbar: {
      position: 'absolute', left: 0, right: 0, zIndex: 20,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 12,
    },
    topbarGroup: { flexDirection: 'row', gap: 8 },
    topbarBtn: {
      width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.overlayHeavy, borderWidth: 1, borderColor: colors.overlayLight,
    },
    topbarBtnFav: { backgroundColor: colors.amberPale, borderColor: colors.accentBright },

    // Identity zone
    identity: { paddingHorizontal: Spacing.md, paddingTop: 14 },
    idKicker: {
      fontFamily: Fonts.body, fontSize: FontSize.sm, fontWeight: FontWeight.semibold,
      letterSpacing: 1, textTransform: 'uppercase', color: colors.primaryLight, marginBottom: 6,
    },
    idName: {
      fontFamily: Fonts.heading, fontSize: FontSize.display, fontWeight: FontWeight.bold,
      color: colors.text, lineHeight: FontSize.display * 1.08,
    },
    idAddress: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
    idAddressText: { flex: 1, fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.textMuted },
    idBadges: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7, marginTop: 11 },
    idChip: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: colors.bgAlt, borderWidth: 1, borderColor: colors.borderLight,
      borderRadius: 11, paddingVertical: 5, paddingHorizontal: 10,
    },
    idChipStar: { fontFamily: Fonts.body, fontSize: FontSize.base, color: colors.amber },
    idChipText: { fontFamily: Fonts.body, fontSize: FontSize.base, fontWeight: FontWeight.bold, color: colors.text },
    idChipMuted: { fontFamily: Fonts.body, fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: colors.textMuted },
    idChipPrice: { backgroundColor: colors.primaryPale, borderColor: colors.primaryDim },
    idChipPriceText: { fontFamily: Fonts.body, fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: colors.primaryLight },

    // Hero slot wrapper
    heroWrap: { marginHorizontal: Spacing.md, marginTop: 14 },

    // Indoor status hero

    // Action bar (Check in · Share · Route)
    actionBar: {
      marginHorizontal: Spacing.md, marginTop: 13, padding: 8, borderRadius: Radius.lg,
      backgroundColor: colors.bgMid, borderWidth: 1, borderColor: colors.border,
      flexDirection: 'row', alignItems: 'stretch', gap: 14, ...Shadows.sm,
    },
    abCta: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
      paddingVertical: 12, paddingHorizontal: 14, borderRadius: Radius.md, backgroundColor: colors.primary, borderWidth: 1, borderColor: colors.primaryLight, ...Shadows.sm,
    },
    abCtaCheckout: { backgroundColor: colors.redPale, borderWidth: 1.5, borderColor: colors.red },
    abCtaTitle: { fontFamily: Fonts.body, fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: colors.textOnPrimary },
    abCtaTitleCheckout: { color: colors.red },
    abCtaSub: { fontFamily: Fonts.body, fontSize: 10, fontWeight: FontWeight.medium, color: colors.textOnPrimary, opacity: 0.85, marginTop: 2 },
    abQuiet: { flexDirection: 'row', gap: 7 },
    qbtn: {
      width: 54, alignItems: 'center', justifyContent: 'center', gap: 5,
      borderRadius: Radius.md, backgroundColor: colors.bgMuted, borderWidth: 1, borderColor: colors.borderLight,
    },
    qbtnText: { fontFamily: Fonts.body, fontSize: 10, fontWeight: FontWeight.bold, color: colors.text },
    barnote: { flexDirection: 'row', alignItems: 'center', gap: 7, marginHorizontal: Spacing.md + 6, marginTop: 10 },
    barnoteText: { flex: 1, fontFamily: Fonts.body, fontSize: FontSize.sm, color: colors.textMuted },

    // Section group header
    group: { paddingHorizontal: Spacing.md, marginTop: 22, marginBottom: 10 },
    groupKicker: {
      fontFamily: Fonts.body, fontSize: FontSize.sm, fontWeight: FontWeight.bold,
      letterSpacing: 1, textTransform: 'uppercase', color: colors.primaryLight,
    },
    groupTitle: { fontFamily: Fonts.heading, fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: colors.text, marginTop: 2 },

    // Generic floating card
    cardFloat: {
      marginHorizontal: Spacing.md, backgroundColor: colors.bgAlt,
      borderWidth: 1, borderColor: colors.borderLight, borderRadius: Radius.lg, overflow: 'hidden',
    },
    // "Right now" live card — orange accent border (matches the design .now card)
    liveAccent: { borderColor: colors.accent },

    // Facts grid (2-col)
    facts: {
      marginHorizontal: Spacing.md, flexDirection: 'row', flexWrap: 'wrap',
      borderRadius: Radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.borderLight, backgroundColor: colors.bgAlt,
    },
    fact: { width: '50%', paddingVertical: 13, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
    factDivRight: { borderRightWidth: 1, borderRightColor: colors.borderLight },
    factDivTop: { borderTopWidth: 1, borderTopColor: colors.borderLight },
    factLabel: {
      fontFamily: Fonts.body, fontSize: 10, fontWeight: FontWeight.semibold,
      letterSpacing: 0.4, textTransform: 'uppercase', color: colors.textFaint,
    },
    factValue: { fontFamily: Fonts.body, fontSize: FontSize.md, fontWeight: FontWeight.bold, color: colors.text, marginTop: 2 },
    factValueWarn: { color: colors.amber },

    // People (champion / mix) compact rows inside a floating card
    peopleRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12, paddingHorizontal: 14 },
    peopleRowDiv: { borderTopWidth: 1, borderTopColor: colors.borderLight },
    peopleText: { flex: 1, fontFamily: Fonts.body, fontSize: FontSize.md, fontWeight: FontWeight.medium, color: colors.text },
    peopleName: { fontFamily: Fonts.body, fontSize: FontSize.md, fontWeight: FontWeight.bold, color: colors.text },
    peopleMeta: { fontFamily: Fonts.body, fontSize: FontSize.sm, color: colors.textMuted, marginTop: 1 },
    champAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.amber, alignItems: 'center', justifyContent: 'center' },
    champInitials: { fontFamily: Fonts.body, fontSize: FontSize.md, fontWeight: FontWeight.bold, color: colors.bg },
    champTag: { paddingVertical: 4, paddingHorizontal: 9, borderRadius: 8, backgroundColor: colors.amberPale, borderWidth: 1, borderColor: colors.amber },
    champTagText: { fontFamily: Fonts.body, fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: colors.amber },

    // Contribute panel
    contrib: { flexDirection: 'row', flexWrap: 'wrap' },
    cbtn: { width: '50%', paddingVertical: 13, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 11 },
    cbtnIcon: {
      width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: colors.borderLight, backgroundColor: colors.bgMuted,
    },
    cbtnTitle: { fontFamily: Fonts.body, fontSize: FontSize.base, fontWeight: FontWeight.bold, color: colors.text },
    cbtnSub: { fontFamily: Fonts.body, fontSize: 10, fontWeight: FontWeight.medium, color: colors.textFaint, marginTop: 2 },
    chomeIcon: {
      width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: colors.primaryDim, backgroundColor: colors.primaryPale,
    },
    chome: {
      flexDirection: 'row', alignItems: 'center', gap: 11,
      paddingVertical: 13, paddingHorizontal: 14,
      borderTopWidth: 1, borderTopColor: colors.borderLight,
    },
    chomeSet: {
      paddingVertical: 7, paddingHorizontal: 14, borderRadius: Radius.md,
      backgroundColor: colors.primaryMid, borderWidth: 1, borderColor: colors.primary,
    },
    chomeSetText: { fontFamily: Fonts.body, fontSize: FontSize.base, fontWeight: FontWeight.bold, color: colors.textOnPrimary },
  });

  return { cm, styles };
}
