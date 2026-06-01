import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';

export function useFocusRefresh(refresh: () => void | Promise<unknown>, deps: readonly unknown[] = []) {
  useFocusEffect(
    useCallback(() => {
      void refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps),
  );
}
