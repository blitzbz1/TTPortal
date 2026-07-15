// F034: camera QR scanner (first camera surface in the app). Requires a dev
// rebuild after `expo install expo-camera` — typechecks/jest-mocks without it.
import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Lucide } from './Icon';
import { useI18n } from '../hooks/useI18n';
import { useTheme } from '../hooks/useTheme';
import { Fonts, FontSize, FontWeight, Radius, Spacing } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onScanned: (data: string) => void;
}

export function QrScanModal({ visible, onClose, onScanned }: Props) {
  const { colors } = useTheme();
  const { s } = useI18n();
  const [permission, requestPermission] = useCameraPermissions();
  const [handled, setHandled] = useState(false);

  // Reset the one-shot guard each time the scanner is opened.
  React.useEffect(() => {
    if (visible) setHandled(false);
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>{s('quickMatchScanTitle')}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel={s('close')}>
            <Lucide name="x" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {!permission ? (
          <View style={styles.center} />
        ) : !permission.granted ? (
          <View style={styles.center}>
            <Lucide name="camera-off" size={40} color={colors.textFaint} />
            <Text style={[styles.permText, { color: colors.textMuted }]}>{s('quickMatchCameraNeeded')}</Text>
            <TouchableOpacity style={[styles.permBtn, { backgroundColor: colors.primary }]} onPress={requestPermission}>
              <Text style={[styles.permBtnText, { color: colors.textOnPrimary }]}>{s('quickMatchGrantCamera')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.cameraWrap}>
            <CameraView
              style={StyleSheet.absoluteFillObject}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={({ data }) => {
                if (handled || !data) return;
                setHandled(true);
                onScanned(data);
              }}
            />
            <View style={styles.reticle} pointerEvents="none" />
            <Text style={styles.hint}>{s('quickMatchScanHint')}</Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md, paddingTop: Spacing.xl },
  title: { fontFamily: Fonts.heading, fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl },
  permText: { fontFamily: Fonts.body, fontSize: FontSize.md, textAlign: 'center' },
  permBtn: { borderRadius: Radius.lg, paddingVertical: 12, paddingHorizontal: 24 },
  permBtnText: { fontFamily: Fonts.body, fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  cameraWrap: { flex: 1 },
  reticle: {
    position: 'absolute', alignSelf: 'center', top: '30%',
    width: 220, height: 220, borderRadius: 20, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)',
  },
  hint: { position: 'absolute', bottom: 60, alignSelf: 'center', color: '#fff', fontFamily: Fonts.body, fontSize: FontSize.md, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 },
});
