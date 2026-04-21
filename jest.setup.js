process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'test-google-web-client-id';

// Mock expo-sqlite (native module not available in test environment)
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: () => ({
    execSync: jest.fn(),
    getFirstSync: jest.fn(() => null),
    runSync: jest.fn(),
  }),
}));

// Mock @react-native-async-storage/async-storage — Supabase session storage
// adapter uses it on native. In-memory implementation is enough for tests.
jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((key) => Promise.resolve(store.get(key) ?? null)),
      setItem: jest.fn((key, value) => { store.set(key, value); return Promise.resolve(); }),
      removeItem: jest.fn((key) => { store.delete(key); return Promise.resolve(); }),
      clear: jest.fn(() => { store.clear(); return Promise.resolve(); }),
      getAllKeys: jest.fn(() => Promise.resolve(Array.from(store.keys()))),
      multiGet: jest.fn((keys) => Promise.resolve(keys.map((k) => [k, store.get(k) ?? null]))),
      multiSet: jest.fn((pairs) => { pairs.forEach(([k, v]) => store.set(k, v)); return Promise.resolve(); }),
      multiRemove: jest.fn((keys) => { keys.forEach((k) => store.delete(k)); return Promise.resolve(); }),
    },
  };
});

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Error: 'error', Warning: 'warning' },
}));

jest.mock('expo-apple-authentication', () => ({
  AppleAuthenticationButton: () => null,
  AppleAuthenticationButtonStyle: { BLACK: 'BLACK', WHITE: 'WHITE', WHITE_OUTLINE: 'WHITE_OUTLINE' },
  AppleAuthenticationButtonType: { SIGN_IN: 'SIGN_IN', CONTINUE: 'CONTINUE' },
  AppleAuthenticationScope: { FULL_NAME: 'FULL_NAME', EMAIL: 'EMAIL' },
  getCredentialStateAsync: jest.fn(),
  isAvailableAsync: jest.fn(() => Promise.resolve(false)),
  refreshAsync: jest.fn(),
  signInAsync: jest.fn(),
  signOutAsync: jest.fn(),
}));

jest.mock('expo-router', () => {
  const React = require('react');
  return {
    Link: ({ children }) => children,
    Redirect: () => null,
    Stack: ({ children }) => React.createElement(React.Fragment, null, children),
    Tabs: ({ children }) => React.createElement(React.Fragment, null, children),
    router: {
      back: jest.fn(),
      push: jest.fn(),
      replace: jest.fn(),
      setParams: jest.fn(),
    },
    useFocusEffect: (effect) => effect(),
    useLocalSearchParams: () => ({}),
    usePathname: () => '/',
    useRouter: () => ({
      back: jest.fn(),
      push: jest.fn(),
      replace: jest.fn(),
      setParams: jest.fn(),
    }),
    useSegments: () => [],
  };
});

// Mock react-native-map-clustering
jest.mock('react-native-map-clustering', () => {
  return {
    __esModule: true,
    default: 'ClusteredMapView',
  };
});

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: ({ children }) => children,
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => frame,
    initialWindowMetrics: { insets, frame },
  };
});
