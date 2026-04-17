import React from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { Lucide } from '../../components/Icon';
import type { ThemeColors } from '../../theme';
import type { BadgeTier, BadgeTrack } from '../../lib/badgeChallenges';
import type { createStyles } from '../ChallengeScreen.styles';

interface Props {
  data: { badge: BadgeTrack; tier: BadgeTier } | null;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
  tierLabel: (tier: BadgeTier) => string;
  trackName: (badge: BadgeTrack) => string;
  s: (key: string, ...args: string[]) => string;
  onDismiss: () => void;
  onShare: () => void;
}

export function EarnedBadgeModal({
  data,
  styles,
  colors,
  tierLabel,
  trackName,
  s,
  onDismiss,
  onShare,
}: Props) {
  return (
    <Modal visible={!!data} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.modalOverlay}>
        <View style={styles.badgeEarnedSheet}>
          {data ? (
            <>
              <View style={[styles.badgeEarnedIcon, { backgroundColor: data.badge.color }]}>
                <Lucide name={data.badge.icon} size={34} color={colors.textOnPrimary} />
              </View>
              <Text style={styles.badgeEarnedTitle}>{s('challengeBadgeUnlocked')}</Text>
              <Text style={styles.badgeEarnedName}>
                {tierLabel(data.tier)} {trackName(data.badge)}
              </Text>
              <Text style={styles.badgeEarnedCopy}>{s('challengeBadgeUnlockedDesc')}</Text>
              <View style={styles.badgeEarnedActions}>
                <TouchableOpacity style={styles.badgeEarnedSecondary} onPress={onDismiss}>
                  <Text style={styles.badgeEarnedSecondaryText}>{s('challengeKeepPlaying')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.badgeEarnedPrimary, { backgroundColor: data.badge.color }]}
                  onPress={onShare}
                >
                  <Lucide name="share-2" size={16} color={colors.textOnPrimary} />
                  <Text style={styles.badgeEarnedPrimaryText}>{s('challengeShareBadge')}</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
