// T052: react-query hooks for the admin moderation lists, following the
// useLeaderboardQuery shape — queryFn calls the service and mirrors to the
// persistent adminListsCache; initialData hydrates from it. Reports have no
// persistent cache, so that one is a plain useQuery.
//
// Hooks take an `enabled` flag because the screen shell subscribes to all of
// them (disabled) for tab badge counts while each tab owns the enabled query:
// disabled subscribers skip initialData so badges stay at zero until a tab is
// first opened, exactly like the old loaded-once flags.
import { useQuery } from '@tanstack/react-query';
import {
  getPendingVenues,
  getFlaggedReviews,
  getUserFeedback,
  getVenueChangeRequests,
  getPendingCoaches,
  searchVenuesAdmin,
} from '../../services/admin';
import { getUnresolvedReports, type ContentReport } from '../../services/moderation';
import {
  loadCachedPendingVenues,
  saveCachedPendingVenues,
  loadCachedFlaggedReviews,
  saveCachedFlaggedReviews,
  loadCachedUserFeedback,
  saveCachedUserFeedback,
  loadCachedVenueChangeRequests,
  saveCachedVenueChangeRequests,
  loadCachedPendingCoaches,
  saveCachedPendingCoaches,
} from '../../lib/adminListsCache';
import type { CacheRead } from '../../lib/cacheUtils';

export const adminPendingVenuesKey = ['admin', 'pending-venues'] as const;
export const adminFlaggedReviewsKey = ['admin', 'flagged-reviews'] as const;
export const adminFeedbackKey = ['admin', 'user-feedback'] as const;
export const adminReportsKey = ['admin', 'reports'] as const;
export const adminChangeRequestsKey = ['admin', 'change-requests'] as const;
export const adminPendingCoachesKey = ['admin', 'pending-coaches'] as const;
export const adminVenueSearchKeyPrefix = ['admin', 'venue-search'] as const;
export const adminVenueSearchKey = (term: string) =>
  [...adminVenueSearchKeyPrefix, term] as const;

// Matches the adminListsCache TTL so query freshness and disk freshness agree.
const ADMIN_LISTS_STALE_MS = 5 * 60 * 1000;

// Seed a query from the persistent cache. Fresh rows suppress the mount
// refetch (the old screens' `cached.fresh` early-return); stale rows paint
// immediately and revalidate in the background.
function cacheSeed<T>(enabled: boolean, read: () => CacheRead<T> | null) {
  if (!enabled) return {};
  return {
    initialData: () => read()?.data,
    initialDataUpdatedAt: () => (read()?.fresh ? Date.now() - 1000 : 0),
  };
}

export function useAdminPendingVenuesQuery(enabled = true) {
  return useQuery<any[]>({
    queryKey: adminPendingVenuesKey,
    queryFn: async () => {
      const { data, error } = await getPendingVenues();
      if (error) throw error;
      const next = (data ?? []) as any[];
      saveCachedPendingVenues(next);
      return next;
    },
    enabled,
    ...cacheSeed(enabled, () => loadCachedPendingVenues<any>()),
    staleTime: ADMIN_LISTS_STALE_MS,
  });
}

export function useAdminFlaggedReviewsQuery(enabled = true) {
  return useQuery<any[]>({
    queryKey: adminFlaggedReviewsKey,
    queryFn: async () => {
      const { data, error } = await getFlaggedReviews();
      if (error) throw error;
      const next = (data ?? []) as any[];
      saveCachedFlaggedReviews(next);
      return next;
    },
    enabled,
    ...cacheSeed(enabled, () => loadCachedFlaggedReviews<any>()),
    staleTime: ADMIN_LISTS_STALE_MS,
  });
}

// Fixed at the service's default limit; the persistent cache is keyed by it.
const FEEDBACK_LIMIT = 100;

export function useAdminFeedbackQuery(enabled = true) {
  return useQuery<any[]>({
    queryKey: adminFeedbackKey,
    queryFn: async () => {
      const { data, error } = await getUserFeedback(FEEDBACK_LIMIT);
      if (error) throw error;
      const next = (data ?? []) as any[];
      saveCachedUserFeedback(FEEDBACK_LIMIT, next);
      return next;
    },
    enabled,
    ...cacheSeed(enabled, () => loadCachedUserFeedback<any>(FEEDBACK_LIMIT)),
    staleTime: ADMIN_LISTS_STALE_MS,
  });
}

export function useAdminReportsQuery(enabled = true) {
  return useQuery<ContentReport[]>({
    queryKey: adminReportsKey,
    queryFn: async () => {
      // getUnresolvedReports already coalesces errors to an empty list.
      const { data } = await getUnresolvedReports();
      return data;
    },
    enabled,
    staleTime: ADMIN_LISTS_STALE_MS,
  });
}

export function useAdminChangeRequestsQuery(enabled = true) {
  return useQuery<any[]>({
    queryKey: adminChangeRequestsKey,
    queryFn: async () => {
      const { data, error } = await getVenueChangeRequests();
      if (error) throw error;
      const next = (data ?? []) as any[];
      saveCachedVenueChangeRequests(next);
      return next;
    },
    enabled,
    ...cacheSeed(enabled, () => loadCachedVenueChangeRequests<any>()),
    staleTime: ADMIN_LISTS_STALE_MS,
  });
}

export function useAdminPendingCoachesQuery(enabled = true) {
  return useQuery<any[]>({
    queryKey: adminPendingCoachesKey,
    queryFn: async () => {
      const { data, error } = await getPendingCoaches();
      if (error) throw error;
      const next = (data ?? []) as any[];
      saveCachedPendingCoaches(next);
      return next;
    },
    enabled,
    ...cacheSeed(enabled, () => loadCachedPendingCoaches<any>()),
    staleTime: ADMIN_LISTS_STALE_MS,
  });
}

/** Admin venue search, keyed by the debounced term (min 3 chars). */
export function useAdminVenueSearchQuery(term: string) {
  return useQuery<any[]>({
    queryKey: adminVenueSearchKey(term),
    queryFn: async () => {
      const { data } = await searchVenuesAdmin(term);
      return (data ?? []) as any[];
    },
    enabled: term.length >= 3,
  });
}
