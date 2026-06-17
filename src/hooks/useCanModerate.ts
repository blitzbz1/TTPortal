import { useSession } from './useSession';
import { useProfileQuery } from './queries/useProfileQuery';

/**
 * True when the signed-in user is staff (admin OR moderator). Derived from the
 * cached profile (is_admin/is_moderator, public columns), mirroring the
 * server's can_moderate(). UI-only gate — the server RPCs are authoritative.
 */
export function useCanModerate(): boolean {
  const { user } = useSession();
  const { data } = useProfileQuery(user?.id);
  return !!(data?.is_admin || data?.is_moderator);
}
