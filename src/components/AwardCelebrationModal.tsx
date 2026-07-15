import React, { type ReactNode, type RefObject, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Lucide } from './Icon';
import { hapticSuccess } from '../lib/haptics';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Radius, Shadows, Spacing } from '../theme';

interface Props {
  visible: boolean;
  title: string;
  awardName: string;
  description: string;
  accent: string;
  accentSurface: string;
  accentBorder: string;
  visual: ReactNode;
  details?: ReactNode;
  dismissLabel: string;
  shareLabel: string;
  onDismiss: () => void;
  onShare: () => void | Promise<void>;
  testID?: string;
  dismissTestID?: string;
  shareTestID?: string;
  captureRef?: RefObject<View | null>;
}

/** Shared presentation and interaction contract for every earned award modal. */
export function AwardCelebrationModal({
  visible,
  title,
  awardName,
  description,
  accent,
  accentSurface,
  accentBorder,
  visual,
  details,
  dismissLabel,
  shareLabel,
  onDismiss,
  onShare,
  testID,
  dismissTestID,
  shareTestID,
  captureRef,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (visible) hapticSuccess();
  }, [visible]);

  const handleShare = useCallback(async () => {
    if (sharing) return;
    setSharing(true);
    try {
      await onShare();
    } finally {
      setSharing(false);
    }
  }, [onShare, sharing]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.sheet} testID={testID}>
          <View
            ref={captureRef}
            collapsable={false}
            style={[styles.awardBody, { backgroundColor: accentSurface, borderColor: accentBorder }]}
          >
            <View style={[styles.visual, { backgroundColor: accent }]}>
              <View style={styles.visualHalo} />
              {visual}
              <View style={[styles.seal, { backgroundColor: accentSurface, borderColor: accentBorder }]}>
                <Lucide name="trophy" size={17} color={accent} />
              </View>
            </View>
            <Text style={[styles.title, { color: accent }]}>{title}</Text>
            <Text style={styles.awardName}>{awardName}</Text>
            <Text style={styles.description}>{description}</Text>
            {details}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.secondary}
              onPress={onDismiss}
              accessibilityRole="button"
              testID={dismissTestID}
            >
              <Text style={styles.secondaryText}>{dismissLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primary, { backgroundColor: accent }]}
              onPress={handleShare}
              disabled={sharing}
              accessibilityRole="button"
              accessibilityState={{ busy: sharing, disabled: sharing }}
              testID={shareTestID}
            >
              {sharing ? (
                <ActivityIndicator size="small" color={colors.textOnPrimary} />
              ) : (
                <Lucide name="share-2" size={16} color={colors.textOnPrimary} />
              )}
              <Text style={styles.primaryText}>{shareLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.overlayHeavy,
      padding: Spacing.lg,
    },
    sheet: {
      width: '100%',
      maxWidth: 420,
      gap: Spacing.lg,
      borderRadius: Radius.xl,
      backgroundColor: colors.bgAlt,
      padding: Spacing.xl,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...Shadows.lg,
    },
    awardBody: {
      alignItems: 'center',
      gap: Spacing.xs,
      borderRadius: Radius.lg,
      borderWidth: 1,
      paddingVertical: Spacing.xl,
      paddingHorizontal: Spacing.lg,
    },
    visual: {
      width: 96,
      height: 96,
      borderRadius: Radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.sm,
      ...Shadows.md,
    },
    visualHalo: {
      position: 'absolute',
      width: 72,
      height: 72,
      borderRadius: 36,
      borderWidth: 1,
      borderColor: '#FFFFFF55',
    },
    seal: {
      position: 'absolute',
      right: -8,
      bottom: -8,
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      ...Shadows.sm,
    },
    title: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.display,
      fontWeight: FontWeight.bold,
      textAlign: 'center',
    },
    awardName: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      color: colors.text,
      textAlign: 'center',
    },
    description: {
      maxWidth: 300,
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      lineHeight: 20,
      color: colors.textMuted,
      textAlign: 'center',
    },
    actions: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    secondary: {
      flex: 1,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: Spacing.sm,
    },
    secondaryText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.bold,
      color: colors.text,
      textAlign: 'center',
    },
    primary: {
      flex: 1,
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.sm,
      ...Shadows.sm,
    },
    primaryText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.bold,
      color: colors.textOnPrimary,
      textAlign: 'center',
    },
  });
}
