import React, { useRef, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Share, Platform } from 'react-native';
import { Lucide } from './Icon';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius, Shadows } from '../theme';
import { useI18n } from '../hooks/useI18n';

interface ShareCardProps {
  title: string;
  subtitle?: string;
  icon: string;
  stat?: string;
  onClose: () => void;
}

export function ShareCard({ title, subtitle, icon, stat, onClose }: ShareCardProps) {
  const { colors } = useTheme();
  const { s } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const cardRef = useRef<View>(null);

  const handleShare = useCallback(async () => {
    // Capture the card as image if view-shot is available
    let imageUri: string | undefined;
    if (Platform.OS !== 'web' && cardRef.current) {
      try {
        const ViewShot = require('react-native-view-shot');
        imageUri = await ViewShot.captureRef(cardRef.current, {
          format: 'png',
          quality: 1,
        });
      } catch {
        // view-shot not available, share text instead
      }
    }

    const message = `${title}${subtitle ? ' - ' + subtitle : ''} | TT Portal`;
    if (imageUri) {
      Share.share({ message, url: imageUri });
    } else {
      Share.share({ message });
    }
  }, [title, subtitle]);

  return (
    <View style={styles.container}>
      {/* Capturable card */}
      <View ref={cardRef} style={styles.card} testID="share-card" collapsable={false}>
        <View style={styles.brand}>
          <Text style={styles.brandEmoji}>{'\uD83C\uDFD3'}</Text>
          <Text style={styles.brandText}>TT PORTAL</Text>
        </View>
        <View style={styles.iconCircle}>
          <Lucide name={icon} size={32} color={colors.textOnPrimary} />
        </View>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        {stat && <Text style={styles.stat}>{stat}</Text>}
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare} testID="share-card-share">
          <Lucide name="share-2" size={16} color={colors.textOnPrimary} />
          <Text style={styles.shareBtnText}>{s('shareCard')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} testID="share-card-close">
          <Text style={styles.closeBtnText}>{s('close')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      alignItems: 'center',
      gap: Spacing.md,
    },
    card: {
      width: 280,
      backgroundColor: colors.primary,
      borderRadius: 20,
      padding: Spacing.xl,
      alignItems: 'center',
      gap: Spacing.sm,
      ...Shadows.lg,
    },
    brand: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    brandEmoji: {
      fontSize: FontSize.lg,
    },
    brandText: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.base,
      fontWeight: FontWeight.extrabold,
      color: colors.textOnPrimary,
      opacity: 0.7,
      letterSpacing: 1,
    },
    iconCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxxl,
      fontWeight: FontWeight.bold,
      color: colors.textOnPrimary,
      textAlign: 'center',
    },
    subtitle: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.textOnPrimary,
      opacity: 0.8,
      textAlign: 'center',
    },
    stat: {
      fontFamily: Fonts.heading,
      fontSize: 28,
      fontWeight: FontWeight.extrabold,
      color: colors.textOnPrimary,
    },
    actions: {
      flexDirection: 'row',
      gap: 10,
    },
    shareBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: Radius.lg,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.xl,
      gap: Spacing.xs,
      ...Shadows.md,
    },
    shareBtnText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.semibold,
      color: colors.textOnPrimary,
    },
    closeBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.lg,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.xl,
      borderWidth: 1,
      borderColor: colors.border,
    },
    closeBtnText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.semibold,
      color: colors.textMuted,
    },
  });
}
