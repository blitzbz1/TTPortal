import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { getPlayHistory } from '../../services/checkins';
import { getTrainingSessions } from '../../services/training';
import type { TrainingSession } from '../../types/database';
import { loadCachedPlayHistory, saveCachedPlayHistory } from '../../lib/playHistoryCache';

export const PLAY_HISTORY_PAGE_SIZE = 20;

export interface PlayHistoryBundle {
  history: any[];
  allCheckins: { venue_id: number; venue_name: string; started_at: string; ended_at: string | null }[];
  eventHours: { hours_played: number; starts_at: string; venue_id: number | null }[];
  eventVenues: { venue_id: number; venue_name: string; event_title: string; starts_at: string; hours_played: number | null }[];
  // F060: the user's training sessions for the window (NOT paginated — fetched
  // in full like allCheckins/eventHours so the calendar + summary line up).
  trainingSessions: TrainingSession[];
}

export const playHistoryQueryKey = (userId: string | undefined, sinceIso: string | null) =>
  ['play-history', userId, sinceIso ?? 'all'] as const;

/**
 * Composite play-history bundle (T050): first history page + the three
 * calendar/stat sources, fetched together exactly as the screen used to.
 * Blessed shape: mirrors to playHistoryCache, hydrates initialData from it.
 * Pagination beyond page one stays imperative in the screen (appended
 * pages are view state, not canonical cache).
 */
export function usePlayHistoryQuery(userId: string | undefined, sinceIso: string | null) {
  return useQuery<PlayHistoryBundle>({
    queryKey: playHistoryQueryKey(userId, sinceIso),
    queryFn: async () => {
      if (!userId) return { history: [], allCheckins: [], eventHours: [], eventVenues: [], trainingSessions: [] };

      let allCheckinsQuery = supabase
        .from('checkins')
        .select('venue_id, started_at, ended_at, venues(name)')
        .eq('user_id', userId);
      let eventsQuery = supabase
        .from('event_participants')
        .select('event_id, hours_played, events(venue_id, starts_at, title, venues(name))')
        .eq('user_id', userId);
      if (sinceIso) {
        allCheckinsQuery = allCheckinsQuery.gte('started_at', sinceIso);
        eventsQuery = eventsQuery.gte('events.starts_at', sinceIso);
      }
      const [historyRes, allCheckinsRes, eventParticipationsRes, trainingRes] = await Promise.all([
        getPlayHistory(userId, PLAY_HISTORY_PAGE_SIZE, 0, sinceIso ?? undefined),
        allCheckinsQuery,
        eventsQuery,
        getTrainingSessions(userId, sinceIso ?? undefined),
      ]);

      const allCheckins = (allCheckinsRes.data ?? []).map((c: any) => ({
        venue_id: c.venue_id, venue_name: c.venues?.name ?? '', started_at: c.started_at, ended_at: c.ended_at,
      }));
      const participants = eventParticipationsRes.data ?? [];
      const eventHours = participants
        .map((ep: any) => ({
          hours_played: Number(ep.hours_played ?? 0),
          starts_at: ep.events?.starts_at,
          venue_id: ep.events?.venue_id ?? null,
        }))
        .filter((r: any) => r.starts_at && r.hours_played > 0);
      const eventVenues = participants
        .map((ep: any) => ({
          venue_id: ep.events?.venue_id,
          venue_name: ep.events?.venues?.name ?? ep.events?.title ?? '',
          event_title: ep.events?.title ?? '',
          starts_at: ep.events?.starts_at,
          hours_played: Number(ep.hours_played ?? 0) > 0 ? Number(ep.hours_played) : null,
        }))
        .filter((v: any) => v.venue_id);

      const bundle: PlayHistoryBundle = {
        history: historyRes.data ?? [],
        allCheckins,
        eventHours,
        eventVenues,
        trainingSessions: trainingRes.data ?? [],
      };
      saveCachedPlayHistory(userId, sinceIso, bundle);
      return bundle;
    },
    initialData: () => {
      if (!userId) return undefined;
      const cached = loadCachedPlayHistory(userId, sinceIso);
      return (cached?.data as PlayHistoryBundle | undefined) ?? undefined;
    },
    enabled: !!userId,
    staleTime: 60 * 1000,
  });
}
