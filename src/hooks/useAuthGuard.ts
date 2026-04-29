import { useEffect } from 'react';
import { useRouter, usePathname } from 'expo-router';
import { useSession } from './useSession';

/**
 * Redirects unauthenticated users to /sign-in with a returnTo param.
 * Returns true if the user is authenticated, false while redirecting.
 */
export function useAuthGuard(): boolean {
  const { session, isLoading } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !session) {
      router.replace({
        pathname: '/sign-in',
        params: { returnTo: pathname },
      });
    }
  }, [session, isLoading, pathname, router]);

  return !isLoading && !!session;
}
