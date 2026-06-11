import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

// Wire TanStack Query to the native connectivity/lifecycle signals. Without
// this, React Query on React Native always reports "online" and "focused":
// refetchOnReconnect never fires, offline queries burn retries against a dead
// socket, and mutations never pause. This module is imported by app/_layout.tsx,
// so the wiring runs once at app start.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    setOnline(!!state.isConnected && state.isInternetReachable !== false);
  }),
);

// On web the browser's visibility events already drive focusManager.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (status) => {
    focusManager.setFocused(status === 'active');
  });
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});
