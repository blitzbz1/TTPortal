import { useEffect } from 'react';
import { usePathname, useRouter , type Href } from 'expo-router';
import { Platform } from 'react-native';
import { recoverRouteFromUnmatchedPath, recoverSharedRoute } from '../lib/routeRecovery';

export default function NotFoundRoute() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const recoveredFromBrowserPath =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? recoverSharedRoute(window.location.pathname)
        : null;
    const browserSearch =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.search ?? ''
        : '';
    const target = recoveredFromBrowserPath
      ? `${recoveredFromBrowserPath}${browserSearch}`
      : recoverRouteFromUnmatchedPath(pathname);
    router.replace(target as Href);
  }, [pathname, router]);

  return null;
}
