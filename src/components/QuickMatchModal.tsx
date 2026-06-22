// F034: Quick Match pairing. Shows the player's own QR (opponents scan it) and
// a button to scan an opponent's QR → opens their profile with the Log Match
// sheet pre-targeted (the opponent still confirms the result, per F002).
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useRouter, type Href } from 'expo-router';
import { Lucide } from './Icon';
import { QrScanModal } from './QrScanModal';
import { playerLogMatchUrl, parseQuickMatchUserId } from '../lib/shareLinks';
import { useI18n } from '../hooks/useI18n';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Radius, Shadows, Spacing } from '../theme';

interface Props {
  visible: boolean;
  userId: string;
  onClose: () => void;
}

export function QuickMatchModal({ visible, userId, onClose }: Props) {
  const router = useRouter();
  const { colors } = useTheme();
  const { s } = useI18n();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [scanning, setScanning] = useState(false);

  const handleScanned = (data: string) => {
    const opponentId = parseQuickMatchUserId(data);
    setScanning(false);
    if (!opponentId || opponentId === userId) return;
    onClose();
    // Opponent paired → go set up the match (names pre-fill from both profiles).
    router.push(`/(protected)/quick-match/setup?opponentId=${opponentId}` as Href);
  };

  return (
    <>
      <Modal visible={visible && !scanning} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.title}>{s('quickMatchTitle')}</Text>
            <Text style={styles.desc}>{s('quickMatchDesc')}</Text>
            <View style={styles.qrWrap} testID="quick-match-qr">
              <QRCode value={playerLogMatchUrl(userId)} size={210} backgroundColor={colors.bgAlt} color={colors.text} />
            </View>
            <TouchableOpacity
              style={styles.scanBtn}
              onPress={() => setScanning(true)}
              accessibilityRole="button"
              testID="quick-match-scan-btn"
            >
              <Lucide name="scan-line" size={18} color={colors.textOnPrimary} />
              <Text style={styles.scanText}>{s('quickMatchScanTitle')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} accessibilityRole="button">
              <Text style={styles.closeText}>{s('close')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <QrScanModal visible={scanning} onClose={() => setScanning(false)} onScanned={handleScanned} />
    </>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
    sheet: { backgroundColor: colors.bgAlt, borderRadius: Radius.xl, padding: Spacing.xl, alignItems: 'center', gap: Spacing.md, maxWidth: 360, width: '100%', ...Shadows.lg },
    title: { fontFamily: Fonts.heading, fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: colors.text },
    desc: { fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.textMuted, textAlign: 'center' },
    qrWrap: { padding: Spacing.md, backgroundColor: colors.bgAlt, borderRadius: Radius.lg },
    scanBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: Radius.lg, paddingVertical: 12, paddingHorizontal: 24 },
    scanText: { fontFamily: Fonts.body, fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: colors.textOnPrimary },
    closeBtn: { paddingVertical: 8, paddingHorizontal: 24 },
    closeText: { fontFamily: Fonts.body, fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: colors.textMuted },
  });
}
