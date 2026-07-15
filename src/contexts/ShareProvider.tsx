import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Platform, type ShareAction, type ShareContent, type ShareOptions } from 'react-native';
import { WebShareSheet } from '../components/WebShareSheet';
import { canUseNativeShare, shareContent } from '../lib/nativeShare';

type ShareResult = ShareAction | { action: 'copied' | 'dismissed' | 'sheet' | 'unavailable' };

interface ShareRequest {
  title: string;
  message: string;
  url: string;
}

interface ShareContextValue {
  share: (content: ShareContent, options?: ShareOptions) => Promise<ShareResult>;
}

const ShareContext = createContext<ShareContextValue>({
  share: shareContent,
});

function isOpenableWebUrl(url?: string): url is string {
  return !!url && /^https?:\/\//i.test(url);
}

function requestFromContent(content: ShareContent): ShareRequest | null {
  if (!isOpenableWebUrl(content.url)) return null;
  const message = content.message ?? content.url;
  return {
    title: content.title ?? content.message?.split('\n')[0] ?? content.url,
    message,
    url: content.url,
  };
}

export function ShareProvider({ children }: { children: React.ReactNode }) {
  const [webShare, setWebShare] = useState<ShareRequest | null>(null);

  const share = useCallback(async (content: ShareContent, options?: ShareOptions): Promise<ShareResult> => {
    if (Platform.OS === 'web' && !canUseNativeShare(content)) {
      const request = requestFromContent(content);
      if (request) {
        setWebShare(request);
        return { action: 'sheet' };
      }
    }
    return shareContent(content, options);
  }, []);

  const value = useMemo(() => ({ share }), [share]);

  return (
    <ShareContext.Provider value={value}>
      {children}
      {webShare ? (
        <WebShareSheet
          visible
          title={webShare.title}
          message={webShare.message}
          url={webShare.url}
          onClose={() => setWebShare(null)}
        />
      ) : null}
    </ShareContext.Provider>
  );
}

export function useAppShare(): ShareContextValue {
  return useContext(ShareContext);
}
