import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'expo-router';
import { useSession } from '../hooks/useSession';
import { logger } from '../lib/logger';

/** Props for AuthGate. */
interface AuthGateProps {
  children: React.ReactNode;
}

/**
 * Wrapper component that checks for an active session.
 * If the user is anonymous, navigates to `/sign-in` with a `returnTo` param
 * set to the current route so they can resume after logging in.
 * Use on add-venue, write-review, and edit-venue trigger points.
 */
export function AuthGate({ children }: AuthGateProps) {
  const { session } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!session) {
      logger.info('AuthGate: redirecting unauthenticated user', {
        returnTo: pathname,
      });
      router.replace({
        pathname: '/sign-in',
        params: { returnTo: pathname },
      });
    }
  }, [session, pathname, router]);

  if (!session) {
    return null;
  }

  return <>{children}</>;
}
