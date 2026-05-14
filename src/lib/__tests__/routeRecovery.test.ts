import { recoverRouteFromUnmatchedPath } from '../routeRecovery';

describe('recoverRouteFromUnmatchedPath', () => {
  it('recovers venue routes from restored direct paths', () => {
    expect(recoverRouteFromUnmatchedPath('/venue/42')).toBe('/venue/42');
  });

  it('recovers venue routes from deployed base-prefixed paths', () => {
    expect(recoverRouteFromUnmatchedPath('/TTPortal/app/venue/42')).toBe('/venue/42');
  });

  it('recovers protected event routes from public URL paths', () => {
    expect(recoverRouteFromUnmatchedPath('/event/7')).toBe('/(protected)/event/7');
  });

  it('falls back to tabs for unknown paths', () => {
    expect(recoverRouteFromUnmatchedPath('/somewhere/else')).toBe('/(tabs)/');
  });
});
