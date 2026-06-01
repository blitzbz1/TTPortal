import { useEffect } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { recoverRouteFromUnmatchedPath } from '../lib/routeRecovery';

export default function NotFoundRoute() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    router.replace(recoverRouteFromUnmatchedPath(pathname) as any);
  }, [pathname, router]);

  return null;
}
