import type { RefObject } from 'react';
import { Platform, type ShareContent, type View } from 'react-native';
import { shareCardImage } from './shareImage';
import { sharePayload } from './shareLinks';

type AppShare = (content: ShareContent) => Promise<unknown>;

interface ShareAwardOptions {
  cardRef: RefObject<View | null>;
  message: string;
  title: string;
  url: string;
  share: AppShare;
}

/**
 * Award sharing contract:
 * - web uses the app share sheet with a durable, openable link;
 * - native prefers the rendered award image;
 * - failed/unavailable native capture falls back to the same link payload.
 */
export async function shareAward({ cardRef, message, title, url, share }: ShareAwardOptions): Promise<void> {
  if (Platform.OS !== 'web') {
    const imageShared = await shareCardImage(cardRef, message);
    if (imageShared) return;
  }

  await share({ ...sharePayload(message, url), title });
}
