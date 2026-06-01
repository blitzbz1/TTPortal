import { useCallback, useEffect, useState } from 'react';
import {
  CHALLENGE_CHOICE_POOL_SIZE,
  VISIBLE_CHALLENGE_COUNT,
} from '../constants';
import { getChallengeChoices } from '../api';
import type { ChallengeCategory, DbChallenge } from '../types';

interface UseChallengeChoicesOptions {
  enabled?: boolean;
  onlyOtherPlayer?: boolean;
  visibleCount?: number;
}

export function useChallengeChoices(
  category: ChallengeCategory,
  {
    enabled = true,
    onlyOtherPlayer = false,
    visibleCount = VISIBLE_CHALLENGE_COUNT,
  }: UseChallengeChoicesOptions = {},
) {
  const [choices, setChoices] = useState<DbChallenge[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setIsLoading(true);
    setError(null);
    const { data, error: choicesError } = await getChallengeChoices(category, CHALLENGE_CHOICE_POOL_SIZE);
    setIsLoading(false);
    if (choicesError) {
      setChoices([]);
      setError(choicesError);
      return;
    }

    const nextChoices = ((data ?? []) as DbChallenge[])
      .filter((challenge) => !onlyOtherPlayer || challenge.verification_type === 'other')
      .slice(0, visibleCount);
    setChoices(nextChoices);
  }, [category, enabled, onlyOtherPlayer, visibleCount]);

  useEffect(() => {
    let alive = true;
    if (!enabled) {
      setChoices([]);
      setIsLoading(false);
      setError(null);
      return undefined;
    }

    setIsLoading(true);
    setError(null);
    getChallengeChoices(category, CHALLENGE_CHOICE_POOL_SIZE).then(({ data, error: choicesError }) => {
      if (!alive) return;
      setIsLoading(false);
      if (choicesError) {
        setChoices([]);
        setError(choicesError);
        return;
      }

      const nextChoices = ((data ?? []) as DbChallenge[])
        .filter((challenge) => !onlyOtherPlayer || challenge.verification_type === 'other')
        .slice(0, visibleCount);
      setChoices(nextChoices);
    });

    return () => {
      alive = false;
    };
  }, [category, enabled, onlyOtherPlayer, visibleCount]);

  return { choices, error, isLoading, refresh };
}
