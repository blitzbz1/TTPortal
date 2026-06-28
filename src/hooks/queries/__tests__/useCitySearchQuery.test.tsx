// Stage 2 (T049): the debounced, min-length long-tail search hook. Uses the
// global jest.setup react-query mock (queryFn runs in an effect keyed on
// [queryKey, enabled]) + fake timers to drive the 250ms debounce.
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useCitySearchQuery } from '../useCitySearchQuery';

const mockSearchCities = jest.fn();
jest.mock('../../../services/citiesDelta', () => ({
  searchCities: (...args: unknown[]) => mockSearchCities(...args),
}));

beforeEach(() => {
  jest.useFakeTimers();
  mockSearchCities.mockReset();
  mockSearchCities.mockResolvedValue({ data: [{ id: 5, name: 'Cluj-Napoca', country_code: 'RO' }], error: null });
});
afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

async function settle() {
  // Flush the debounce timer AND the resulting async queryFn microtasks.
  await act(async () => {
    jest.advanceTimersByTime(DEBOUNCE);
  });
}
const DEBOUNCE = 250;

describe('useCitySearchQuery (Stage 2 T049)', () => {
  it('never calls searchCities for a 1-char query (min-length gate)', async () => {
    const { rerender } = renderHook(({ q }: { q: string }) => useCitySearchQuery(q), { initialProps: { q: '' } });
    rerender({ q: 'c' });
    await settle();
    expect(mockSearchCities).not.toHaveBeenCalled();
  });

  it('never calls searchCities before the debounce window settles', () => {
    const { rerender } = renderHook(({ q }: { q: string }) => useCitySearchQuery(q), { initialProps: { q: '' } });
    rerender({ q: 'cluj' });
    act(() => {
      jest.advanceTimersByTime(DEBOUNCE - 1); // one tick short
    });
    expect(mockSearchCities).not.toHaveBeenCalled();
  });

  it('calls searchCities once after the debounce for a ≥2-char query and maps to LocationCity', async () => {
    const { result, rerender } = renderHook(({ q }: { q: string }) => useCitySearchQuery(q), { initialProps: { q: '' } });
    rerender({ q: 'cluj' });
    // Fix #4: isSearching is true during the debounce window (before the fetch),
    // so the switcher shows a spinner instead of flashing "no results".
    expect(result.current.isSearching).toBe(true);
    await settle();
    expect(mockSearchCities).toHaveBeenCalledTimes(1);
    expect(mockSearchCities).toHaveBeenCalledWith('cluj');
    await waitFor(() => expect(result.current.results.length).toBe(1));
    expect(result.current.results[0].id).toBe(5);
    expect(result.current.results[0].country_name).toBe('Romania'); // toLocationCity derived it
  });

  it('collapses rapid keystrokes into a single trailing call', async () => {
    const { rerender } = renderHook(({ q }: { q: string }) => useCitySearchQuery(q), { initialProps: { q: '' } });
    rerender({ q: 'c' });
    rerender({ q: 'cl' });
    rerender({ q: 'clu' });
    rerender({ q: 'cluj' });
    await settle();
    expect(mockSearchCities).toHaveBeenCalledTimes(1);
    expect(mockSearchCities).toHaveBeenCalledWith('cluj');
  });

  it('stays dormant when the caller disables it (sufficient in-tier matches)', async () => {
    const { rerender } = renderHook(({ q }: { q: string }) => useCitySearchQuery(q, false), { initialProps: { q: '' } });
    rerender({ q: 'cluj' });
    await settle();
    expect(mockSearchCities).not.toHaveBeenCalled();
  });
});
