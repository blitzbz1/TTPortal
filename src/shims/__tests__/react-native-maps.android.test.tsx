import React, { createRef } from 'react';
import { Text, View } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';

// Mock MapLibre primitives so the shim can be unit-tested without the native
// module. Each mock is a plain RN View that forwards props + children, plus
// a ref exposing an easeTo spy for Camera so we can verify animateToRegion.
const mockEaseTo = jest.fn();

jest.mock('@maplibre/maplibre-react-native', () => {
  const RealReact = require('react');
  const RN = require('react-native');
  return {
    __esModule: true,
    Map: ({ children, mapStyle, onPress, ...rest }: any) =>
      RealReact.createElement(
        RN.View,
        { testID: 'mlrn-map', 'data-mapstyle': mapStyle, onPress, ...rest },
        children,
      ),
    Camera: RealReact.forwardRef(({ initialViewState, ...rest }: any, ref: any) => {
      RealReact.useImperativeHandle(ref, () => ({ easeTo: mockEaseTo }));
      return RealReact.createElement(RN.View, {
        testID: 'mlrn-camera',
        'data-initial-center': JSON.stringify(initialViewState?.center ?? null),
        'data-initial-zoom': String(initialViewState?.zoom ?? ''),
        ...rest,
      });
    }),
    UserLocation: ({ visible }: any) =>
      RealReact.createElement(RN.View, {
        testID: 'mlrn-user-location',
        'data-visible': String(!!visible),
      }),
    ViewAnnotation: ({ children, lngLat, draggable, onDragEnd, id, ...rest }: any) =>
      RealReact.createElement(
        RN.View,
        {
          testID: `mlrn-annotation-${id}`,
          'data-lnglat': JSON.stringify(lngLat ?? null),
          'data-draggable': String(!!draggable),
          onDragEnd,
          ...rest,
        },
        children,
      ),
    Marker: ({ children, lngLat, id, anchor, ...rest }: any) =>
      RealReact.createElement(
        RN.View,
        {
          testID: `mlrn-marker-${id}`,
          'data-lnglat': JSON.stringify(lngLat ?? null),
          'data-anchor': String(anchor ?? ''),
          ...rest,
        },
        children,
      ),
  };
});

import MapView, {
  Marker,
  Callout,
  deltaToZoom,
  regionToCenter,
  maplibreDragToRnMaps,
} from '../react-native-maps.android';

beforeEach(() => {
  mockEaseTo.mockClear();
});

describe('deltaToZoom', () => {
  it('maps common react-native-maps latitudeDeltas to sensible zoom levels', () => {
    // delta 360 → zoom 0 (entire world), halving doubles the zoom step.
    expect(deltaToZoom(360)).toBe(0);
    expect(deltaToZoom(180)).toBe(1);
    // Values used by the app:
    // 0.08 ≈ city level (≈ zoom 12.1)
    expect(deltaToZoom(0.08)).toBeCloseTo(12.13, 1);
    // 0.02 ≈ neighborhood (≈ zoom 14.1)
    expect(deltaToZoom(0.02)).toBeCloseTo(14.13, 1);
    // 0.005 ≈ street level (≈ zoom 16.1)
    expect(deltaToZoom(0.005)).toBeCloseTo(16.13, 1);
  });

  it('falls back to a safe default for missing/invalid deltas', () => {
    expect(deltaToZoom(0 as any)).toBe(13);
    expect(deltaToZoom(-1 as any)).toBe(13);
    expect(deltaToZoom(undefined as any)).toBe(13);
    expect(deltaToZoom(NaN as any)).toBe(13);
  });

  it('clamps out-of-range zooms', () => {
    // Absurdly small delta → would compute zoom > 22; clamp.
    expect(deltaToZoom(0.0000000001)).toBe(22);
  });
});

describe('regionToCenter', () => {
  it('flips {latitude,longitude} to [longitude,latitude]', () => {
    expect(regionToCenter({ latitude: 44.4268, longitude: 26.1025 })).toEqual([
      26.1025, 44.4268,
    ]);
  });
});

describe('maplibreDragToRnMaps', () => {
  it('translates a MapLibre drag event (nativeEvent.lngLat tuple) into the react-native-maps shape', () => {
    const event = { nativeEvent: { lngLat: [26.1025, 44.4268] } };
    expect(maplibreDragToRnMaps(event as any)).toEqual({
      nativeEvent: { coordinate: { latitude: 44.4268, longitude: 26.1025 } },
    });
  });

  it('is resilient to malformed events', () => {
    // Callers don't want a crash — degrade gracefully to undefineds.
    expect(maplibreDragToRnMaps(undefined as any)).toEqual({
      nativeEvent: { coordinate: { latitude: undefined, longitude: undefined } },
    });
  });
});

describe('MapView', () => {
  it('renders a MapLibre Map with the OpenFreeMap style and passes initialRegion to the Camera', () => {
    const { getByTestId } = render(
      <MapView
        initialRegion={{
          latitude: 44.4268,
          longitude: 26.1025,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        }}
      >
        <Text>child</Text>
      </MapView>,
    );
    const map = getByTestId('mlrn-map');
    expect(map.props['data-mapstyle']).toBe(
      'https://tiles.openfreemap.org/styles/liberty',
    );
    const camera = getByTestId('mlrn-camera');
    expect(camera.props['data-initial-center']).toBe(
      JSON.stringify([26.1025, 44.4268]),
    );
    // Should be around zoom 12 for the 0.08 delta city view.
    expect(parseFloat(camera.props['data-initial-zoom'])).toBeCloseTo(12.13, 1);
  });

  it('renders UserLocation only when showsUserLocation is true', () => {
    const { queryByTestId, rerender } = render(<MapView />);
    expect(queryByTestId('mlrn-user-location')).toBeNull();
    rerender(<MapView showsUserLocation />);
    expect(queryByTestId('mlrn-user-location')).not.toBeNull();
  });

  it('exposes animateToRegion via ref and forwards it to Camera.easeTo with correct zoom + duration', () => {
    const ref = createRef<any>();
    render(
      <MapView
        ref={ref}
        initialRegion={{
          latitude: 0,
          longitude: 0,
          latitudeDelta: 360,
          longitudeDelta: 360,
        }}
      />,
    );
    ref.current.animateToRegion(
      {
        latitude: 44.4268,
        longitude: 26.1025,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      800,
    );
    expect(mockEaseTo).toHaveBeenCalledTimes(1);
    const arg = mockEaseTo.mock.calls[0][0];
    expect(arg.center).toEqual([26.1025, 44.4268]);
    expect(arg.duration).toBe(800);
    expect(arg.zoom).toBeCloseTo(14.13, 1);
  });

  it('does not crash when animateToRegion is called before Camera is ready or with no region', () => {
    const ref = createRef<any>();
    render(<MapView ref={ref} />);
    // Camera ref resolves via useImperativeHandle — easeTo exists. Calling with
    // a falsy region should no-op without throwing.
    expect(() => ref.current.animateToRegion(null as any)).not.toThrow();
    expect(mockEaseTo).not.toHaveBeenCalled();
  });
});

describe('Marker', () => {
  it('renders a non-draggable marker with Marker (interactive, not ViewAnnotation), anchored at bottom like iOS', () => {
    const { getByTestId, queryByTestId } = render(
      <MapView>
        <Marker coordinate={{ latitude: 44.4268, longitude: 26.1025 }}>
          <View testID="pin-content" />
        </Marker>
      </MapView>,
    );
    // Non-draggable path uses MLMarker — that's what makes tap events and
    // popup toggling work on Android (ViewAnnotation rasterizes to a bitmap).
    const marker = getByTestId('mlrn-marker-mk-44.4268-26.1025');
    expect(marker.props['data-lnglat']).toBe(
      JSON.stringify([26.1025, 44.4268]),
    );
    // Bottom anchor mirrors iOS: the pin's tip sits at the coordinate, and
    // any popup can grow upward without displacing the pin.
    expect(marker.props['data-anchor']).toBe('bottom');
    // And must NOT have used ViewAnnotation for this marker.
    expect(queryByTestId('mlrn-annotation-mk-44.4268-26.1025')).toBeNull();
  });

  it('draggable marker uses ViewAnnotation (only MapLibre primitive with native drag) and translates onDragEnd events', () => {
    const onDragEnd = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <MapView>
        <Marker
          coordinate={{ latitude: 44.4268, longitude: 26.1025 }}
          draggable
          onDragEnd={onDragEnd}
        >
          <View testID="pin-content" />
        </Marker>
      </MapView>,
    );
    const annotation = getByTestId('mlrn-annotation-mk-44.4268-26.1025');
    expect(annotation.props['data-draggable']).toBe('true');
    // The interactive Marker primitive is NOT used on the draggable path.
    expect(queryByTestId('mlrn-marker-mk-44.4268-26.1025')).toBeNull();

    // Simulate MapLibre firing a drag end event (nativeEvent.lngLat tuple).
    annotation.props.onDragEnd({ nativeEvent: { lngLat: [26.2, 44.5] } });
    expect(onDragEnd).toHaveBeenCalledTimes(1);
    expect(onDragEnd).toHaveBeenCalledWith({
      nativeEvent: { coordinate: { latitude: 44.5, longitude: 26.2 } },
    });
  });

  it('renders pin children and fires Callout.onPress when the popup is tapped after a pin tap', () => {
    const onCalloutPress = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <MapView>
        <Marker coordinate={{ latitude: 1, longitude: 2 }}>
          <View testID="pin-content" />
          <Callout onPress={onCalloutPress}>
            <View testID="callout-content">
              <Text>Hello</Text>
            </View>
          </Callout>
        </Marker>
      </MapView>,
    );

    // Pin is rendered, callout is not until tapped.
    expect(getByTestId('pin-content')).toBeTruthy();
    expect(queryByTestId('callout-content')).toBeNull();

    // Tap the pin → popup appears.
    fireEvent.press(getByTestId('pin-content').parent!);
    expect(queryByTestId('callout-content')).not.toBeNull();

    // Tap the popup → fires the registered onPress.
    fireEvent.press(queryByTestId('callout-content')!.parent!);
    expect(onCalloutPress).toHaveBeenCalledTimes(1);
    // And closes the popup.
    expect(queryByTestId('callout-content')).toBeNull();
  });

  it('pans the map to the pin when opening a callout (matches iOS auto-centering so the popup is visible)', () => {
    const { getByTestId } = render(
      <MapView
        initialRegion={{
          latitude: 0,
          longitude: 0,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        }}
      >
        <Marker coordinate={{ latitude: 44.4268, longitude: 26.1025 }}>
          <View testID="pin-content" />
          <Callout onPress={() => {}}>
            <View testID="callout-content" />
          </Callout>
        </Marker>
      </MapView>,
    );
    // Mock is set up once per describe — clear prior calls from MapView init.
    mockEaseTo.mockClear();

    fireEvent.press(getByTestId('pin-content').parent!);

    expect(mockEaseTo).toHaveBeenCalledTimes(1);
    const arg = mockEaseTo.mock.calls[0][0];
    expect(arg.center).toEqual([26.1025, 44.4268]);
    expect(typeof arg.duration).toBe('number');
  });

  it('does not pan when closing (tapping the already-selected pin)', () => {
    const { getByTestId } = render(
      <MapView>
        <Marker coordinate={{ latitude: 44.4268, longitude: 26.1025 }}>
          <View testID="pin-content" />
          <Callout onPress={() => {}}>
            <View testID="callout-content" />
          </Callout>
        </Marker>
      </MapView>,
    );
    // First tap opens (and pans) — ignore. Then second tap closes.
    fireEvent.press(getByTestId('pin-content').parent!);
    mockEaseTo.mockClear();
    fireEvent.press(getByTestId('pin-content').parent!);

    expect(mockEaseTo).not.toHaveBeenCalled();
  });

  it('only one callout is visible at a time — opening a second pin closes the first', () => {
    const { getByTestId, queryByTestId } = render(
      <MapView>
        <Marker coordinate={{ latitude: 1, longitude: 2 }}>
          <View testID="pin-a" />
          <Callout onPress={() => {}}>
            <View testID="callout-a" />
          </Callout>
        </Marker>
        <Marker coordinate={{ latitude: 3, longitude: 4 }}>
          <View testID="pin-b" />
          <Callout onPress={() => {}}>
            <View testID="callout-b" />
          </Callout>
        </Marker>
      </MapView>,
    );

    // Open A.
    fireEvent.press(getByTestId('pin-a').parent!);
    expect(queryByTestId('callout-a')).not.toBeNull();
    expect(queryByTestId('callout-b')).toBeNull();

    // Opening B should close A.
    fireEvent.press(getByTestId('pin-b').parent!);
    expect(queryByTestId('callout-a')).toBeNull();
    expect(queryByTestId('callout-b')).not.toBeNull();
  });

  it('tapping the map background closes any open callout', () => {
    const { getByTestId, queryByTestId } = render(
      <MapView>
        <Marker coordinate={{ latitude: 1, longitude: 2 }}>
          <View testID="pin-content" />
          <Callout onPress={() => {}}>
            <View testID="callout-content" />
          </Callout>
        </Marker>
      </MapView>,
    );

    // Open the popup via pin tap — this also sets the suppress-next-map-press
    // flag, so we must deliberately consume that spurious map press before
    // firing a real background tap. This mirrors the real sequence:
    //   pin.press → map.press (suppressed) → later: map.press (real, clears)
    fireEvent.press(getByTestId('pin-content').parent!);
    const map = getByTestId('mlrn-map');
    fireEvent(map, 'press'); // suppressed — popup must still be visible
    expect(queryByTestId('callout-content')).not.toBeNull();

    // Now a genuine empty-map tap clears the selection.
    fireEvent(map, 'press');
    expect(queryByTestId('callout-content')).toBeNull();
  });

  it('pin-tap-then-map-press does not immediately close the popup (MapLibre onPress bubbles up)', () => {
    const { getByTestId, queryByTestId } = render(
      <MapView>
        <Marker coordinate={{ latitude: 1, longitude: 2 }}>
          <View testID="pin-content" />
          <Callout onPress={() => {}}>
            <View testID="callout-content" />
          </Callout>
        </Marker>
      </MapView>,
    );

    // Tap the pin: MLMarker's Pressable handles it, selection opens.
    fireEvent.press(getByTestId('pin-content').parent!);
    // A few ms later, MapLibre's Map.onPress fires for the SAME tap —
    // simulated here as a press event on the map immediately after. The
    // shim must suppress this one, not clear the selection.
    const map = getByTestId('mlrn-map');
    fireEvent(map, 'press');
    expect(queryByTestId('callout-content')).not.toBeNull();
  });
});

describe('Callout', () => {
  it('renders nothing when used outside a Marker', () => {
    const { toJSON } = render(
      <Callout onPress={() => {}}>
        <Text>orphan</Text>
      </Callout>,
    );
    expect(toJSON()).toBeNull();
  });
});
