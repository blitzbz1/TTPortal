import { onlineManager, focusManager } from '@tanstack/react-query';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

// Importing the module runs the wiring (same as app start via _layout.tsx).
import '../queryClient';

const netInfoAddEventListener = NetInfo.addEventListener as jest.Mock;

function lastNetInfoCallback(): (state: any) => void {
  const calls = netInfoAddEventListener.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1][0];
}

describe('queryClient connectivity wiring', () => {
  afterEach(() => {
    // Leave the managers in their default state for other suites.
    onlineManager.setOnline(true);
    focusManager.setFocused(undefined);
  });

  it('subscribes onlineManager to NetInfo', () => {
    expect(netInfoAddEventListener).toHaveBeenCalled();
  });

  it('marks queries offline when NetInfo reports no connection', () => {
    const emit = lastNetInfoCallback();
    emit({ isConnected: false, isInternetReachable: false });
    expect(onlineManager.isOnline()).toBe(false);

    emit({ isConnected: true, isInternetReachable: true });
    expect(onlineManager.isOnline()).toBe(true);
  });

  it('treats connected-but-unreachable as offline', () => {
    const emit = lastNetInfoCallback();
    emit({ isConnected: true, isInternetReachable: false });
    expect(onlineManager.isOnline()).toBe(false);
  });

  it('treats unknown reachability (null) as online', () => {
    const emit = lastNetInfoCallback();
    emit({ isConnected: true, isInternetReachable: null });
    expect(onlineManager.isOnline()).toBe(true);
  });

  it('drives focusManager from AppState transitions', () => {
    // jest-expo runs as iOS, so the native AppState branch is wired.
    const setFocused = jest.spyOn(focusManager, 'setFocused');
    AppState.currentState = 'active';

    // Emit through the mock emitter if available; otherwise call the
    // registered listener directly.
    const addListener = AppState.addEventListener as unknown as jest.Mock;
    if (typeof addListener.mock !== 'undefined') {
      const change = addListener.mock.calls.find((c: any[]) => c[0] === 'change');
      expect(change).toBeTruthy();
      change![1]('background');
      expect(setFocused).toHaveBeenCalledWith(false);
      change![1]('active');
      expect(setFocused).toHaveBeenCalledWith(true);
    }
    setFocused.mockRestore();
  });
});
