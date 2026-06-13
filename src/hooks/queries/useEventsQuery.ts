import { useInfiniteQuery, useQuery, type InfiniteData } from '@tanstack/react-query';
import { getEvents, PAST_EVENTS_PAGE_SIZE } from '../../services/events';
import { getUserEventFeedbackForEvents } from '../../services/eventFeedback';
import { getAmaturEvents, type AmaturEvent } from '../../services/amatur';
import {
  loadCachedEvents,
  saveCachedEvents,
  loadCachedFeedbackGiven,
  saveCachedFeedbackGiven,
  type EventTabKey,
} from '../../lib/eventsCache';

/** Row shape the events list renders: trimmed select columns plus the
 * participants_count / my_participation embed aliases (T043). */
export type EventListItem = {
  id: number;
  title?: string | null;
  description?: string | null;
  starts_at: string;
  ends_at?: string | null;
  status: string;
  event_type?: string | null;
  organizer_id?: string | null;
  max_participants?: number | null;
  recurrence_rule?: string | null;
  table_number?: number | null;
  venues?: {
    name?: string | null;
    city?: string | null;
    lat?: number | null;
    lng?: number | null;
  } | null;
  event_participants?: {
    user_id: string;
    hours_played?: number | null;
    profiles?: { full_name?: string | null } | null;
  }[];
  /** Count aggregate (T043) — the embed above is capped at 6 rows. */
  participants_count?: { count: number }[];
  /** The caller's own participant row, via a filtered embed alias (T043). */
  my_participation?: { user_id: string; hours_played?: number | null }[];
};

/** Prefix shared by every events-list query — invalidate this after
 * join/leave/create mutations to refresh all tabs. */
export const eventsQueryKeyPrefix = ['events'] as const;

export const eventsQueryKey = (
  tab: EventTabKey,
  userId: string | undefined,
  city: string | null | undefined,
) => ['events', tab, userId ?? null, city ?? null] as const;

export const pastEventsQueryKey = (userId: string | undefined, city: string | null | undefined) =>
  eventsQueryKey('past', userId, city);

export const amaturEventsQueryKey = () => ['amatur-events'] as const;

// In-memory staleTime mirrors the persistent eventsCache TTLs: "mine" and
// "past" change rarely; "upcoming" gets the 60s fast-path (T043) so quick
// Map↔Events toggles don't refetch.
const STALE_MS: Record<EventTabKey, number> = {
  upcoming: 60 * 1000,
  mine: 6 * 60 * 60 * 1000,
  past: 12 * 60 * 60 * 1000,
};

/**
 * Whether the persistent (disk) events cache is still fresh. Mutation sites
 * (EventDetailScreen, CreateEventScreen, LogHoursModal, feedback) invalidate
 * the disk cache, so a focus-time check against it forces a refetch even
 * when the in-memory query is within staleTime.
 */
export function isEventsCacheFresh(
  userId: string | undefined,
  tab: EventTabKey,
  city?: string | null,
): boolean {
  if (!userId) return false;
  return loadCachedEvents<EventListItem>(userId, tab, city)?.fresh ?? false;
}

// Fresh disk data counts as just-fetched (no refetch within staleTime);
// stale disk data still renders instantly but refetches in the background.
function cachedUpdatedAt(cached: { fresh: boolean } | null | undefined): number | undefined {
  if (!cached) return undefined;
  return cached.fresh ? Date.now() - 1000 : 0;
}

/** Upcoming/mine events list (single page, 50-cap) in the blessed shape:
 * queryFn mirrors to eventsCache, initialData hydrates from it. */
export function useEventsQuery(
  tab: Exclude<EventTabKey, 'past'>,
  userId: string | undefined,
  city: string | null | undefined,
  enabled = true,
) {
  return useQuery<EventListItem[]>({
    queryKey: eventsQueryKey(tab, userId, city),
    queryFn: async () => {
      // userId is passed for every tab since T043: the participants embed is
      // capped at 6, so the caller's joined-state comes from the filtered
      // my_participation alias instead of scanning the full embed.
      const { data, error } = await getEvents(tab, userId, { limit: 50, offset: 0, city });
      if (error) throw error;
      const list = (data ?? []) as unknown as EventListItem[];
      if (userId) saveCachedEvents(userId, tab, list, city);
      return list;
    },
    initialData: () =>
      userId ? loadCachedEvents<EventListItem>(userId, tab, city)?.data : undefined,
    initialDataUpdatedAt: () =>
      userId ? cachedUpdatedAt(loadCachedEvents<EventListItem>(userId, tab, city)) : undefined,
    staleTime: STALE_MS[tab],
    enabled,
  });
}

export interface PastEventsPage {
  events: EventListItem[];
  /** Ids of the page's events the user already gave feedback for —
   * fetched alongside the page (single round trip, as before T050). */
  feedbackGivenIds: number[];
}

/**
 * Past tab with offset pagination (page size PAST_EVENTS_PAGE_SIZE, wired
 * to the FlashList onEndReached from T042). Only page one mirrors to the
 * persistent cache — hydration only ever needs the first screenful.
 */
export function usePastEventsInfiniteQuery(
  userId: string | undefined,
  city: string | null | undefined,
  enabled = true,
) {
  return useInfiniteQuery({
    queryKey: pastEventsQueryKey(userId, city),
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<PastEventsPage> => {
      const { data, error } = await getEvents('past', userId, {
        limit: PAST_EVENTS_PAGE_SIZE,
        offset: pageParam,
        city,
      });
      if (error) throw error;
      const events = (data ?? []) as unknown as EventListItem[];
      let feedbackGivenIds: number[] = [];
      if (userId && events.length) {
        const { data: fb } = await getUserEventFeedbackForEvents(
          userId,
          events.map((ev) => ev.id),
        );
        feedbackGivenIds = fb ?? [];
      }
      if (userId && pageParam === 0) {
        saveCachedEvents(userId, 'past', events, city);
        saveCachedFeedbackGiven(userId, feedbackGivenIds);
      }
      return { events, feedbackGivenIds };
    },
    getNextPageParam: (lastPage: PastEventsPage, allPages: PastEventsPage[]) =>
      lastPage.events.length < PAST_EVENTS_PAGE_SIZE
        ? undefined
        : allPages.reduce((n, p) => n + p.events.length, 0),
    initialData: (): InfiniteData<PastEventsPage, number> | undefined => {
      if (!userId) return undefined;
      const cached = loadCachedEvents<EventListItem>(userId, 'past', city);
      if (!cached) return undefined;
      return {
        pages: [{ events: cached.data, feedbackGivenIds: loadCachedFeedbackGiven(userId) ?? [] }],
        pageParams: [0],
      };
    },
    initialDataUpdatedAt: () =>
      userId ? cachedUpdatedAt(loadCachedEvents<EventListItem>(userId, 'past', city)) : undefined,
    staleTime: STALE_MS.past,
    enabled,
  });
}

/** AmaTur tournament list. The service keeps its own 30-min in-memory cache
 * and falls back to it on failure, so staleTime stays 0 and a focus refetch
 * is cheap; only a failure with nothing to show becomes a query error. */
export function useAmaturEventsQuery(enabled = true) {
  return useQuery<AmaturEvent[]>({
    queryKey: amaturEventsQueryKey(),
    queryFn: async () => {
      const { data, error } = await getAmaturEvents();
      if (error && data.length === 0) throw new Error(error);
      return data;
    },
    staleTime: 0,
    enabled,
  });
}
