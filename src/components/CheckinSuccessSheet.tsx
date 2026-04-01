import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, Animated, Share } from 'react-native';
import { Lucide } from './Icon';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius, Shadows } from '../theme';
import { useI18n } from '../hooks/useI18n';
import { hapticSuccess } from '../lib/haptics';

interface CheckinSuccessSheetProps {
  visible: boolean;
  venueName: string;
  endTime?: string;
  onDismiss: () => void;
}

export function CheckinSuccessSheet({
  visible,
  venueName,
  endTime,
  onDismiss,
}: CheckinSuccessSheetProps) {
  const { colors } = useTheme();
  const { s } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const scale = useRef(new Animated.Value(0)).current;
  const xpOpacity = useRef(new Animated.Value(0)).current;
  const xpTranslate = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (visible) {
      hapticSuccess();
      scale.setValue(0);
      xpOpacity.setValue(0);
      xpTranslate.setValue(20);

      Animated.sequence([
        Animated.spring(scale, {
          toValue: 1,
          friction: 4,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.parallel([
          Animated.timing(xpOpacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(xpTranslate, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }
  }, [visible, scale, xpOpacity, xpTranslate]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>

          {/* Animated checkmark */}
          <Animated.View style={[styles.checkCircle, { transform: [{ scale }] }]}>
            <Lucide name="check" size={36} color={colors.textOnPrimary} />
          </Animated.View>

          <Text style={styles.title}>{s('checkinSuccess')}</Text>
          <Text style={styles.venue}>{venueName}</Text>

          {endTime && (
            <View style={styles.timeRow}>
              <Lucide name="clock" size={14} color={colors.textFaint} />
              <Text style={styles.timeText}>{s('untilTime')} {endTime}</Text>
            </View>
          )}

          {/* XP animation */}
          <Animated.View style={[styles.xpRow, { opacity: xpOpacity, transform: [{ translateY: xpTranslate }] }]}>
            <Text style={styles.xpText}>+10 XP</Text>
          </Animated.View>

          <TouchableOpacity style={styles.shareBtn} onPress={() => {
            Share.share({ message: `${s('checkinSuccess')} ${venueName} | TT Portal` });
          }} testID="checkin-success-share">
            <Lucide name="share-2" size={16} color={colors.textOnPrimary} />
            <Text style={styles.shareBtnText}>{s('shareCard')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss} testID="checkin-success-dismiss">
            <Text style={styles.dismissText}>{s('close')}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlayHeavy,
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    sheet: {
      backgroundColor: colors.bgAlt,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: Spacing.xl,
      paddingBottom: Spacing.xxl,
      width: '100%',
      maxWidth: 430,
      alignItems: 'center',
      ...Shadows.lg,
    },
    handleWrap: {
      alignItems: 'center',
      paddingVertical: 10,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
    },
    checkCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: Spacing.md,
      marginBottom: Spacing.md,
      ...Shadows.md,
    },
    title: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxxl,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    venue: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      color: colors.textMuted,
      marginTop: 4,
    },
    timeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: Spacing.xs,
    },
    timeText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.textFaint,
    },
    xpRow: {
      marginTop: Spacing.md,
      backgroundColor: colors.primaryPale,
      borderRadius: Radius.md,
      paddingVertical: Spacing.xs,
      paddingHorizontal: Spacing.lg,
      borderWidth: 1,
      borderColor: colors.primaryDim,
    },
    xpText: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      color: colors.primaryLight,
    },
    shareBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderRadius: Radius.lg,
      paddingVertical: 14,
      paddingHorizontal: Spacing.xxl,
      gap: Spacing.xs,
      marginTop: Spacing.lg,
      ...Shadows.md,
    },
    shareBtnText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.semibold,
      color: colors.textOnPrimary,
    },
    dismissBtn: {
      marginTop: Spacing.sm,
      borderRadius: Radius.lg,
      paddingVertical: 14,
      paddingHorizontal: 48,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dismissText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.semibold,
      color: colors.textMuted,
    },
  });
}
