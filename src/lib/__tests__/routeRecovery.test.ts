import { recoverRouteFromUnmatchedPath, recoverSharedRoute } from '../routeRecovery';

describe('recoverRouteFromUnmatchedPath', () => {
  it('recovers venue routes from restored direct paths', () => {
    expect(recoverRouteFromUnmatchedPath('/venue/42')).toBe('/venue/42');
  });

  it('recovers venue routes from deployed base-prefixed paths', () => {
    expect(recoverRouteFromUnmatchedPath('/TTPortal/app/venue/42')).toBe('/venue/42');
  });

  it('recovers public event routes from deployed paths', () => {
    expect(recoverRouteFromUnmatchedPath('/TTPortal/app/event/7')).toBe('/event/7');
  });

  it('recovers every shared content path from the deployed base', () => {
    expect(recoverSharedRoute('/TTPortal/app/player/u-1')).toBe('/(protected)/player/u-1');
    expect(recoverSharedRoute('/TTPortal/app/join/ABC123')).toBe('/join/ABC123');
    expect(recoverSharedRoute('/TTPortal/app/nope/1')).toBeNull();
  });

  it('falls back to tabs for unknown paths', () => {
    expect(recoverRouteFromUnmatchedPath('/somewhere/else')).toBe('/(tabs)/');
  });
});
