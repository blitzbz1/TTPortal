import { useEffect, useState } from 'react';
import type { DbChallenge } from './types';

let currentSelectedChallenge: DbChallenge | null = null;
const listeners = new Set<(challenge: DbChallenge | null) => void>();

export function setCurrentSelectedChallenge(challenge: DbChallenge | null) {
  currentSelectedChallenge = challenge;
  listeners.forEach((listener) => listener(currentSelectedChallenge));
}

export function getCurrentSelectedChallenge() {
  return currentSelectedChallenge;
}

export function useCurrentSelectedChallenge() {
  const [challenge, setChallenge] = useState(currentSelectedChallenge);

  useEffect(() => {
    listeners.add(setChallenge);
    return () => {
      listeners.delete(setChallenge);
    };
  }, []);

  return challenge;
}
