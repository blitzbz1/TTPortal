import { Stack, useRouter, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { useSession } from '../../hooks/useSession';
import { logger } from '../../lib/logger';

/**
 * Protected route group layout.
 * Wraps write-action routes (add-venue, review) behind an auth guard.
 * When the user is unauthenticated, redirects to `/sign-in` with a `returnTo` param
 * so they can resume after logging in. Tabs and venue detail remain publicly accessible
 * outside this group per FR-020.
 */
export default function ProtectedLayout() {
  const { session } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!session) {
      logger.info('Redirecting unauthenticated user to sign-in', {
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

  return (
    <Stack>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="add-venue" />
        <Stack.Screen name="review/[venueId]" />
      </Stack.Protected>
    </Stack>
  );
}
