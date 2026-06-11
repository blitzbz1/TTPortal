// Regression tests for the Android map shim's region conversion.
// The original onRegionDidChange handler HARDCODED latitudeDelta/
// longitudeDelta to 0.005 — the clusterer then saw a bogus tiny viewport
// after every zoom gesture, replaced the whole marker set, and the
// resulting MapLibre annotation churn crashed the app while zooming.
jest.mock('@maplibre/maplibre-react-native', () => ({
  Map: () => null,
  Camera: () => null,
  UserLocation: () => null,
  ViewAnnotation: () => null,
  Marker: () => null,
}));

import { viewStateToRegion, deltaToZoom } from '../react-native-maps.android';

describe('viewStateToRegion', () => {
  it('derives REAL deltas from the visible bounds', () => {
    const region = viewStateToRegion({
      center: [16.37, 48.21],
      zoom: 12,
      bounds: [16.30, 48.17, 16.44, 48.25], // [w, s, e, n]
    });
    expect(region).toEqual({
      latitude: 48.21,
      longitude: 16.37,
      latitudeDelta: expect.closeTo(0.08, 5),
      longitudeDelta: expect.closeTo(0.14, 5),
    });
  });

  it('falls back to zoom-derived deltas when bounds are missing', () => {
    const region = viewStateToRegion({ center: [16.37, 48.21], zoom: 12 });
    expect(region!.longitudeDelta).toBeCloseTo(360 / 2 ** 12, 6);
    // Round-trips through the shim's own zoom conversion.
    expect(deltaToZoom(region!.latitudeDelta)).toBeCloseTo(12, 5);
  });

  it('never returns the old hardcoded 0.005 for a zoomed-out viewport', () => {
    const zoomedOut = viewStateToRegion({
      center: [16.37, 48.21],
      zoom: 5,
      bounds: [10, 44, 22, 52],
    });
    expect(zoomedOut!.longitudeDelta).toBeGreaterThan(1);
    expect(zoomedOut!.latitudeDelta).toBeGreaterThan(1);
  });

  it('rejects malformed payloads instead of crashing', () => {
    expect(viewStateToRegion(undefined)).toBeNull();
    expect(viewStateToRegion({})).toBeNull();
    expect(viewStateToRegion({ center: [NaN, 48] })).toBeNull();
    // Garbage bounds → zoom fallback, not NaN deltas.
    const r = viewStateToRegion({ center: [16, 48], zoom: 10, bounds: [1, 2, NaN, 4] });
    expect(Number.isFinite(r!.latitudeDelta)).toBe(true);
    expect(Number.isFinite(r!.longitudeDelta)).toBe(true);
  });
});
