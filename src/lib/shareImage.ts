// F030/F033: capture an on-screen card (ShareCard) to a PNG and hand it to the
// OS share sheet. react-native-view-shot is the only capture dep installed;
// expo-sharing/file-system are NOT, so we share through RN's built-in Share.
import type { RefObject } from 'react';
import { Platform, Share, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { logger } from './logger';

export async function shareCardImage(ref: RefObject<View | null>, message: string): Promise<void> {
  if (!ref.current) return;
  try {
    const uri = await captureRef(ref as RefObject<View>, { format: 'png', quality: 1, result: 'tmpfile' });
    await Share.share(
      Platform.OS === 'ios' ? { url: uri, message } : { message, url: uri },
    );
  } catch (e) {
    // User-cancelled share or a capture failure — non-fatal.
    logger.warn('shareCardImage failed', e as Record<string, unknown>);
  }
}
