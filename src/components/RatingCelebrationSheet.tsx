// F030: a celebration sheet shown when the player's rating goes up after a
// match is confirmed. Renders a shareable ShareCard.
import React, { useRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Lucide } from './Icon';
import { ShareCard } from './ShareCard';
import { shareCardImage } from '../lib/shareImage';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../hooks/useI18n';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Radius, Spacing } from '../theme';

interface Props {
  visible: boolean;
  rating: number;
  delta: number;
  peak: number;
  matches: number;
  onClose: () => void;
}

export function RatingCelebrationSheet({ visible, rating, delta, peak, matches, onClose }: Props) {
  const { colors } = useTheme();
  const { s } = useI18n();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const cardRef = useRef<View>(null);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.wrap} onPress={() => {}}>
          <ShareCard
            ref={cardRef}
            icon="trending-up"
            headline={String(Math.round(rating))}
            title={s('ratingCelebrationTitle')}
            subtitle={delta > 0 ? s('ratingCelebrationUp', `+${delta}`) : undefined}
            stats={[
              { label: s('ratingPeak'), value: Math.round(peak) },
              { label: s('ratingMatches'), value: matches },
            ]}
          />
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.shareBtn}
              onPress={() => shareCardImage(cardRef, s('ratingCelebrationShareMessage'))}
              accessibilityRole="button"
            >
              <Lucide name="share-2" size={16} color={colors.textOnPrimary} />
              <Text style={styles.shareText}>{s('shareCard')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} accessibilityRole="button">
              <Text style={styles.closeText}>{s('close')}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
    wrap: { alignItems: 'center', gap: Spacing.md },
    actions: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
    shareBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: colors.primary, borderRadius: Radius.lg, paddingVertical: 12, paddingHorizontal: 22,
    },
    shareText: { fontFamily: Fonts.body, fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: colors.textOnPrimary },
    closeBtn: { borderRadius: Radius.lg, paddingVertical: 12, paddingHorizontal: 22, borderWidth: 1, borderColor: colors.border },
    closeText: { fontFamily: Fonts.body, fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: colors.textMuted },
  });
}
