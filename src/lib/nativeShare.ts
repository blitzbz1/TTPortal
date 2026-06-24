import { Alert, Platform, Share, type ShareContent, type ShareOptions, type ShareAction } from 'react-native';

type WebShareData = {
  title?: string;
  text?: string;
  url?: string;
};

type WebNavigatorWithShare = Navigator & {
  share?: (data: WebShareData) => Promise<void>;
  canShare?: (data: WebShareData) => boolean;
};

function webShareData(content: ShareContent): WebShareData {
  return {
    title: content.title,
    text: content.message,
    url: content.url,
  };
}

export function canUseNativeShare(content: ShareContent): boolean {
  if (Platform.OS !== 'web') return true;
  const nav = globalThis.navigator as WebNavigatorWithShare | undefined;
  const data = webShareData(content);
  try {
    return typeof nav?.share === 'function' && (typeof nav.canShare !== 'function' || nav.canShare(data));
  } catch {
    return false;
  }
}

function fallbackText(content: ShareContent): string | null {
  if (content.url && content.message) return `${content.message}\n${content.url}`;
  return content.url ?? content.message ?? null;
}

export async function shareContent(content: ShareContent, options?: ShareOptions): Promise<ShareAction | { action: 'copied' | 'dismissed' | 'unavailable' }> {
  if (Platform.OS !== 'web') {
    return Share.share(content, options);
  }

  const nav = globalThis.navigator as WebNavigatorWithShare | undefined;
  const data = webShareData(content);

  if (canUseNativeShare(content)) {
    try {
      await nav?.share?.(data);
      return { action: Share.sharedAction };
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') {
        return { action: 'dismissed' };
      }
    }
  }

  const text = fallbackText(content);
  if (text && typeof nav?.clipboard?.writeText === 'function') {
    try {
      await nav.clipboard.writeText(text);
      Alert.alert('Link copied', 'Native sharing is not available in this browser, so the link was copied instead.');
      return { action: 'copied' };
    } catch {
      // Fall through to the explicit unavailable message below.
    }
  }

  Alert.alert('Sharing unavailable', 'Native sharing is not available in this browser.');
  return { action: 'unavailable' };
}
