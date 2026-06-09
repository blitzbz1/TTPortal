import React from 'react';
import { Modal, Pressable, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Lucide } from './Icon';

export type FullscreenImageViewerProps = {
  /** Image URL to display full-screen, or null to keep the viewer closed. */
  url: string | null;
  onClose: () => void;
};

/**
 * Full-screen, tap-to-dismiss image viewer. Renders nothing when `url` is null.
 * Shared by venue photos and change-request evidence photos so both enlarge
 * images the same way. Colours are literal (always a dark overlay), so it needs
 * no theme.
 */
export function FullscreenImageViewer({ url, onClose }: FullscreenImageViewerProps) {
  return (
    <Modal visible={url !== null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} testID="image-viewer">
        {url ? (
          <Image source={{ uri: url }} style={styles.image} resizeMode="contain" />
        ) : null}
        <TouchableOpacity
          style={styles.close}
          onPress={onClose}
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          testID="image-viewer-close"
        >
          <Lucide name="x" size={24} color="#fff" />
        </TouchableOpacity>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  close: {
    position: 'absolute',
    top: 48,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
