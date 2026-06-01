import { useCallback, useEffect, useState } from 'react';
import {
  addChallengeToEvent,
  awardEventChallengeSubmission,
  getEventChallengeSubmissions,
} from '../api';
import type { DbChallenge, EventChallengeSubmission } from '../types';

export function useEventChallenges(eventId?: number | null, userId?: string | null) {
  const [challenges, setChallenges] = useState<EventChallengeSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!eventId || !userId) {
      setChallenges([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    const { data, error: eventChallengeError } = await getEventChallengeSubmissions(eventId);
    setIsLoading(false);
    if (eventChallengeError) {
      setError(eventChallengeError);
      return;
    }
    setChallenges((data ?? []) as EventChallengeSubmission[]);
  }, [eventId, userId]);

  useEffect(() => {
    let alive = true;
    if (!eventId || !userId) {
      setChallenges([]);
      setIsLoading(false);
      setError(null);
      return undefined;
    }

    setIsLoading(true);
    setError(null);
    getEventChallengeSubmissions(eventId).then(({ data, error: eventChallengeError }) => {
      if (!alive) return;
      setIsLoading(false);
      if (eventChallengeError) {
        setError(eventChallengeError);
        return;
      }
      setChallenges((data ?? []) as EventChallengeSubmission[]);
    });

    return () => {
      alive = false;
    };
  }, [eventId, userId]);

  const addChallenge = useCallback(async (challenge: DbChallenge) => {
    if (!eventId || !userId) return { error: null };
    const result = await addChallengeToEvent(eventId, challenge.id);
    if (!result.error) await refresh();
    return result;
  }, [eventId, refresh, userId]);

  const awardChallenge = useCallback(async (submissionId: string) => {
    const result = await awardEventChallengeSubmission(submissionId);
    if (!result.error) await refresh();
    return result;
  }, [refresh]);

  return {
    addChallenge,
    awardChallenge,
    challenges,
    error,
    isLoading,
    refresh,
    setChallenges,
  };
}
