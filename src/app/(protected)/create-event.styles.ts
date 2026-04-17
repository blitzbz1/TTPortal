import { StyleSheet } from 'react-native';
import type { ThemeColors } from '../../theme';
import { Fonts, Radius, Shadows } from '../../theme';

export function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1 },
    content: { padding: 24, gap: 14 },
    header: { fontFamily: Fonts.heading, fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 4 },

    /* inputs */
    inputWrap: { ...Shadows.sm, borderRadius: Radius.md },
    input: {
      backgroundColor: colors.bgAlt, borderRadius: Radius.md,
      padding: 14, fontFamily: Fonts.body, fontSize: 14, color: colors.text,
    },
    textArea: { height: 70, textAlignVertical: 'top' },

    /* date/time */
    dateTimeRow: { flexDirection: 'row', gap: 10 },
    dateBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: colors.bgAlt, borderRadius: Radius.md,
      padding: 14,
      ...Shadows.sm,
    },
    dateBtnActive: { borderColor: colors.accentBright, borderWidth: 1, backgroundColor: colors.amberPale },
    dateBtnText: { fontFamily: Fonts.body, fontSize: 14, color: colors.text, fontWeight: '500' },

    /* collapsible sections */
    section: {
      backgroundColor: colors.bgAlt, borderRadius: Radius.lg,
      overflow: 'hidden',
      ...Shadows.sm,
    },
    sectionHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 14, paddingHorizontal: 16,
    },
    sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    sectionTitle: { fontFamily: Fonts.body, fontSize: 14, fontWeight: '600', color: colors.text },
    sectionSummary: { fontFamily: Fonts.body, fontSize: 12, color: colors.textFaint, marginTop: 2 },
    sectionBody: {
      paddingHorizontal: 16, paddingBottom: 16, gap: 12,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight,
    },

    /* field labels inside sections */
    fieldLabel: {
      fontFamily: Fonts.body, fontSize: 12, fontWeight: '600',
      color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4,
    },

    /* event type toggle */
    typeRow: { flexDirection: 'row', gap: 10 },
    typeBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      paddingVertical: 12, borderRadius: Radius.md,
      backgroundColor: colors.bgMuted,
      ...Shadows.sm,
    },
    typeBtnSelected: { backgroundColor: colors.primary, ...Shadows.md },
    typeBtnText: { fontFamily: Fonts.body, fontSize: 14, fontWeight: '600', color: colors.text },
    typeBtnTextSelected: { color: colors.textOnPrimary },

    /* dropdown */
    dropdown: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: colors.bgMuted, borderRadius: Radius.md, padding: 14,
      ...Shadows.sm,
    },
    dropdownText: { fontFamily: Fonts.body, fontSize: 14, color: colors.text, fontWeight: '500' },
    dropdownMenu: {
      backgroundColor: colors.bgAlt, borderRadius: Radius.md,
      overflow: 'hidden',
      ...Shadows.md,
    },
    dropdownItem: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 12, paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderLight,
    },
    dropdownItemActive: { backgroundColor: colors.bgMuted },
    dropdownItemText: { fontFamily: Fonts.body, fontSize: 14, color: colors.text },
    dropdownItemTextActive: { fontWeight: '600', color: colors.primary },

    /* hint */
    hint: { fontFamily: Fonts.body, fontSize: 12, color: colors.textFaint, fontStyle: 'italic' },

    /* challenge attachment */
    challengePreview: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      borderRadius: Radius.md, borderWidth: 1, borderColor: colors.borderLight,
      backgroundColor: colors.bg, padding: 12,
    },
    challengePreviewActive: {
      borderColor: colors.primary,
      backgroundColor: colors.bgMuted,
    },
    challengeModeIntro: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: Radius.md,
      backgroundColor: colors.bgMuted,
      padding: 12,
    },
    challengeModeIcon: {
      width: 32,
      height: 32,
      borderRadius: Radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bgAlt,
    },
    challengeModeCopy: { flex: 1, gap: 2 },
    challengeModeTitle: {
      fontFamily: Fonts.heading,
      fontSize: 15,
      fontWeight: '800',
      color: colors.text,
    },
    challengeModeText: {
      fontFamily: Fonts.body,
      fontSize: 12,
      color: colors.textMuted,
      lineHeight: 17,
    },
    challengePreviewIcon: {
      width: 38, height: 38, borderRadius: Radius.sm,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.primaryPale,
    },
    challengePreviewCopy: { flex: 1, gap: 4 },
    challengeChoiceTitle: {
      flex: 1,
      fontFamily: Fonts.heading, fontSize: 15, fontWeight: '800', color: colors.text,
      lineHeight: 20,
    },
    challengeChoiceMeta: {
      fontFamily: Fonts.body, fontSize: 12, fontWeight: '700', color: colors.textMuted,
    },
    challengeChoiceList: {
      gap: 8,
    },
    challengeChoiceCard: {
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.bg,
      padding: 12,
      gap: 7,
    },
    challengeChoiceTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    challengeChoiceBadge: {
      borderRadius: Radius.sm,
      backgroundColor: colors.bgMuted,
      paddingHorizontal: 7,
      paddingVertical: 4,
    },
    challengeChoiceBadgeText: {
      fontFamily: Fonts.body,
      fontSize: 11,
      fontWeight: '800',
      color: colors.textMuted,
    },
    challengeChoiceCta: {
      fontFamily: Fonts.body,
      fontSize: 13,
      fontWeight: '800',
      color: colors.primary,
    },
    challengeTrackGrid: {
      gap: 8,
    },
    challengeTrackRow: {
      flexDirection: 'row',
      gap: 8,
    },
    challengeTrackChip: {
      flex: 1,
      minHeight: 58,
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.bg,
      paddingHorizontal: 4,
      paddingVertical: 8,
      ...Shadows.sm,
    },
    challengeTrackIcon: {
      width: 24,
      height: 24,
      borderRadius: Radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    challengeTrackText: {
      fontFamily: Fonts.body,
      fontSize: 11,
      fontWeight: '800',
      color: colors.textMuted,
      textAlign: 'center',
      width: '100%',
    },
    challengeAttachBtn: {
      height: 46, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.primary,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: colors.bg,
    },
    challengeAttachBtnActive: {
      backgroundColor: colors.primary,
    },
    challengeAttachText: {
      fontFamily: Fonts.body, fontSize: 14, fontWeight: '800', color: colors.primary,
    },
    challengeAttachTextActive: {
      color: colors.textOnPrimary,
    },

    /* venue picker */
    venuePicker: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: colors.bgMuted, borderRadius: Radius.md, padding: 14, marginTop: 4,
      ...Shadows.sm,
    },
    venuePickerContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    venuePickerText: { fontFamily: Fonts.body, fontSize: 14, color: colors.textFaint },
    venuePickerTextSelected: { color: colors.text, fontWeight: '500' },

    /* buttons */
    btn: { backgroundColor: colors.primaryLight, borderRadius: 12, height: 50, alignItems: 'center', justifyContent: 'center', ...Shadows.md },
    btnText: { fontFamily: Fonts.body, fontSize: 16, fontWeight: '700', color: colors.textOnPrimary },
    cancelBtn: { alignItems: 'center', justifyContent: 'center', borderRadius: 12, height: 46, backgroundColor: colors.bgAlt, ...Shadows.sm },
    cancelText: { fontFamily: Fonts.body, fontSize: 14, fontWeight: '600', color: colors.textMuted },
  });
}
