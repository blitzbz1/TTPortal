// Regression guard: supabase-js's SupabaseClient.rpc is `rpc(fn,args){ return
// this.rest.rpc(...) }` — it relies on `this`. Capturing it bare
// (`const callRpc = supabase.rpc`) drops the binding and throws at call time
// (`this.rest` of undefined). Every service callRpc shim must `.bind(supabase)`.
//
// The other test mocks stub `rpc` as a plain `this`-less function, so they
// can't catch this. Here the mock deliberately mirrors the real client by
// dispatching through `this.rest`, so an unbound capture throws and fails.

jest.mock('../../lib/supabase', () => {
  const rest = {
    rpc: (fn: string, args: unknown) => Promise.resolve({ data: { fn, args }, error: null }),
  };
  return {
    supabase: {
      rest,
      // Mirrors supabase-js: uses `this.rest` → only works when `this` is kept.
      rpc(fn: string, args: unknown) {
        return (this as any).rest.rpc(fn, args);
      },
    },
  };
});

import { getVenueBusyness, getLiveVenueCounts } from '../venueIntel';
import { getCityGuide } from '../cityGuide';
import { getVenueBoard } from '../venueBoard';
import { getPlayerMatches } from '../matches';

describe('callRpc preserves `this` across services (binding regression)', () => {
  it('venueIntel.getVenueBusyness reaches the rpc without losing this', async () => {
    const r = await getVenueBusyness(1);
    expect(r.error).toBeNull();
  });
  it('venueIntel.getLiveVenueCounts', async () => {
    const r = await getLiveVenueCounts(1);
    expect(r.error).toBeNull();
  });
  it('cityGuide.getCityGuide', async () => {
    const r = await getCityGuide(1);
    expect(r.error).toBeNull();
  });
  it('venueBoard.getVenueBoard', async () => {
    const r = await getVenueBoard(1);
    expect(r.error).toBeNull();
  });
  it('matches.getPlayerMatches', async () => {
    const r = await getPlayerMatches('user-1');
    expect(r.error).toBeNull();
  });
});
