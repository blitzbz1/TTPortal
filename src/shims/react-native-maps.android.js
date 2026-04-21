// Android shim for react-native-maps.
// Translates the react-native-maps surface used in the app to
// @maplibre/maplibre-react-native (v11) + OpenFreeMap tiles, so Android no
// longer depends on the Google Maps SDK and its API key.
//
// iOS keeps using the real react-native-maps (Apple Maps), web keeps using the
// Leaflet shim — see metro.config.js and react-native.config.js.
//
// API surface re-implemented (only what MapViewScreen, AddressPickerField,
// EventDetailContent, and AmaturDetailSheet actually call):
//
// MapView (default export):
//   props: style, initialRegion ({latitude, longitude, latitudeDelta, longitudeDelta}),
//          showsUserLocation, scrollEnabled, zoomEnabled, rotateEnabled, pitchEnabled,
//          children.
//   ref:  animateToRegion(region, duration)
//
// Marker:
//   props: coordinate ({latitude, longitude}), title, description,
//          draggable, onDragEnd, tracksViewChanges (ignored — MapLibre handles
//          invalidation natively), children (custom pin view).
//
// Callout:
//   props: tooltip (ignored — we always render tooltip-style), onPress, children.
//   Rendered as a popup shown on marker tap.

import React, {
  Children,
  createContext,
  forwardRef,
  isValidElement,
  useCallback,
  useContext,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Map as MLMap,
  Camera as MLCamera,
  UserLocation as MLUserLocation,
  ViewAnnotation as MLViewAnnotation,
  Marker as MLMarker,
} from '@maplibre/maplibre-react-native';

const DEFAULT_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

// Shared selection state so only one Marker's callout is open at a time.
// Tapping another pin closes the prior one; tapping the map background (Map's
// onPress, which does NOT fire for taps on Marker children) clears selection.
const MapSelectionContext = createContext({
  selectedId: null,
  setSelectedId: () => {},
});

// latitudeDelta → MapLibre zoom level. Matches Web Mercator convention used by
// react-native-maps / Google Maps: delta of 360° corresponds to zoom 0.
// Clamp into a sensible range so degenerate props don't break the camera.
export function deltaToZoom(latitudeDelta) {
  if (!latitudeDelta || !Number.isFinite(latitudeDelta) || latitudeDelta <= 0) {
    return 13;
  }
  const zoom = Math.log2(360 / latitudeDelta);
  if (zoom < 0) return 0;
  if (zoom > 22) return 22;
  return zoom;
}

// react-native-maps uses {latitude, longitude} objects; MapLibre uses
// [longitude, latitude] tuples. Centralize the conversion so we don't flip
// coords by accident.
export function regionToCenter(region) {
  return [region.longitude, region.latitude];
}

// Translate MapLibre's drag event (nativeEvent.lngLat tuple) back to the
// react-native-maps shape, so existing onDragEnd handlers keep working
// unmodified.
export function maplibreDragToRnMaps(event) {
  const lngLat = event?.nativeEvent?.lngLat ?? [];
  return {
    nativeEvent: {
      coordinate: {
        latitude: lngLat[1],
        longitude: lngLat[0],
      },
    },
  };
}

const MapView = forwardRef(function MapView(
  {
    style,
    initialRegion,
    showsUserLocation,
    scrollEnabled,
    zoomEnabled,
    rotateEnabled,
    pitchEnabled,
    children,
    ...rest
  },
  ref,
) {
  const cameraRef = useRef(null);
  const [selectedId, setSelectedId] = useState(null);
  // Mirror state to a ref so selectMarker (stable callback) can read the
  // current selection without invalidating its identity on every state change.
  const selectedIdRef = useRef(null);
  selectedIdRef.current = selectedId;
  // Native MapLibre fires Map.onPress for EVERY tap within the map area,
  // including taps on Marker children (which are RN views overlaid on the
  // map). When a pin is tapped, its Pressable fires first, then the map's
  // onPress fires microseconds later. This ref lets us swallow that one
  // stray map press so the selection we just set is not immediately cleared.
  // Callout taps must NOT use this guard — they always close directly.
  const suppressNextMapPress = useRef(false);
  const selectMarker = useCallback((id, lngLat) => {
    suppressNextMapPress.current = true;
    const isOpening = selectedIdRef.current !== id;
    setSelectedId(isOpening ? id : null);
    // Match iOS: when opening a callout, pan the camera to the pin so the
    // popup appears well inside the visible map and is not clipped at an edge.
    // Do nothing when merely closing the current pin.
    if (isOpening && lngLat && cameraRef.current) {
      cameraRef.current.easeTo({ center: lngLat, duration: 300 });
    }
  }, []);
  const clearSelection = useCallback(() => setSelectedId(null), []);
  const onMapPress = useCallback(() => {
    if (suppressNextMapPress.current) {
      suppressNextMapPress.current = false;
      return;
    }
    setSelectedId(null);
  }, []);
  const selectionValue = useMemo(
    () => ({ selectedId, selectMarker, clearSelection }),
    [selectedId, selectMarker, clearSelection],
  );

  useImperativeHandle(
    ref,
    () => ({
      animateToRegion: (region, duration = 500) => {
        if (!cameraRef.current || !region) return;
        cameraRef.current.easeTo({
          center: regionToCenter(region),
          zoom: deltaToZoom(region.latitudeDelta),
          duration,
        });
      },
    }),
    [],
  );

  const initialCamera = useMemo(() => {
    if (!initialRegion) return undefined;
    return {
      center: regionToCenter(initialRegion),
      zoom: deltaToZoom(initialRegion.latitudeDelta),
    };
  }, [initialRegion]);

  return (
    <MLMap
      style={[styles.fill, style]}
      mapStyle={DEFAULT_STYLE_URL}
      scrollEnabled={scrollEnabled !== false}
      zoomEnabled={zoomEnabled !== false}
      rotateEnabled={rotateEnabled !== false}
      pitchEnabled={pitchEnabled !== false}
      onPress={onMapPress}
      {...rest}
    >
      <MLCamera ref={cameraRef} initialViewState={initialCamera} />
      {showsUserLocation ? <MLUserLocation visible /> : null}
      <MapSelectionContext.Provider value={selectionValue}>
        {children}
      </MapSelectionContext.Provider>
    </MLMap>
  );
});

MapView.displayName = 'MapView';

// Extract the Callout child (if any) from Marker children, so we can render
// the pin contents and the popup tooltip separately.
function splitCalloutFromChildren(children) {
  const arr = Children.toArray(children);
  const callout = arr.find(
    (c) => isValidElement(c) && c.type === Callout,
  );
  const pinChildren = arr.filter(
    (c) => !isValidElement(c) || c.type !== Callout,
  );
  return { callout, pinChildren };
}

function DefaultPin({ title, description }) {
  // Minimal fallback for callers that pass no custom pin view. Matches the
  // visual density of a native red pin so it doesn't look out of place.
  return (
    <View style={styles.defaultPinWrap}>
      <View style={styles.defaultPin} />
      {title || description ? (
        <View style={styles.defaultPinTooltipHidden} />
      ) : null}
    </View>
  );
}

function Marker({
  coordinate,
  title,
  description,
  draggable,
  onDragEnd,
  tracksViewChanges: _tracksViewChanges, // MapLibre ViewAnnotation auto-refreshes; safely ignored.
  children,
  ...rest
}) {
  const { callout, pinChildren } = useMemo(
    () => splitCalloutFromChildren(children),
    [children],
  );

  // Stable id per coordinate — MapLibre requires one, and it doubles as the key
  // in the shared selection context so taps on another pin close this one.
  const id = useMemo(
    () =>
      `mk-${coordinate?.latitude ?? 'x'}-${coordinate?.longitude ?? 'y'}`,
    [coordinate?.latitude, coordinate?.longitude],
  );

  const { selectedId, selectMarker, clearSelection } = useContext(
    MapSelectionContext,
  );
  const isSelected = selectedId === id;

  const handleDragEnd = useCallback(
    (feature) => {
      if (onDragEnd) onDragEnd(maplibreDragToRnMaps(feature));
    },
    [onDragEnd],
  );

  const handlePinPress = useCallback(() => {
    // Only open a popup when there is something to show. Otherwise the marker
    // stays inert — matches native behavior. selectMarker toggles when the
    // same pin is tapped again, auto-closes any previously open pin, and pans
    // the camera when opening so the popup lands inside the visible map.
    if (!callout && !title && !description) return;
    selectMarker(id, lngLat);
  }, [callout, title, description, id, lngLat, selectMarker]);

  const handleCalloutPress = useCallback(() => {
    if (callout?.props?.onPress) callout.props.onPress();
    clearSelection();
  }, [callout, clearSelection]);

  const pinNode =
    pinChildren.length > 0 ? (
      pinChildren
    ) : (
      <DefaultPin title={title} description={description} />
    );

  const lngLat = coordinate
    ? [coordinate.longitude, coordinate.latitude]
    : undefined;

  // Draggable pins use ViewAnnotation — it's the only MapLibre primitive with
  // native drag support. On Android its children are rasterized (non-interactive),
  // but that's fine because draggable markers in this app don't show popups.
  if (draggable) {
    return (
      <MLViewAnnotation
        id={id}
        lngLat={lngLat}
        draggable
        onDragEnd={handleDragEnd}
        {...rest}
      >
        {pinNode}
      </MLViewAnnotation>
    );
  }

  // Non-draggable pins use Marker — an interactive React Native view placed at
  // the projection, not a bitmap. That's what lets tap events + state-toggled
  // popups work on Android (unlike ViewAnnotation).
  //
  // anchor="bottom" mirrors iOS react-native-maps behavior for custom pins
  // (their tip sits at the geographic coordinate). Combined with
  // flexDirection:column-reverse on the wrapper, this makes the callout appear
  // ABOVE the pin and — crucially — prevents the pin from visually jumping
  // when the popup opens: the bottom of the wrapper stays pinned to the
  // coordinate, so new content above the pin extends upward.
  return (
    <MLMarker id={id} lngLat={lngLat} anchor="bottom" {...rest}>
      <View style={styles.markerBox} collapsable={false}>
        <Pressable onPress={handlePinPress}>{pinNode}</Pressable>
        {isSelected && callout ? (
          <Pressable onPress={handleCalloutPress} style={styles.calloutFloat}>
            {callout.props.children}
          </Pressable>
        ) : null}
      </View>
    </MLMarker>
  );
}

function Callout(_props) {
  // Rendered as a marker popup by Marker above. When rendered outside a Marker,
  // render nothing — matches react-native-maps behavior.
  return null;
}

const styles = StyleSheet.create({
  // overflow:hidden keeps Marker overlays (which are RN views placed on the
  // map projection by MapLibre) from bleeding outside the map container and
  // rendering over surrounding UI — the header, legend card, bottom sheet, etc.
  fill: { flex: 1, overflow: 'hidden' },
  markerBox: { alignItems: 'center', flexDirection: 'column-reverse' },
  defaultPinWrap: { alignItems: 'center' },
  defaultPin: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#d64545',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  defaultPinTooltipHidden: { display: 'none' },
  calloutFloat: {
    // Gap between the pin and the popup above it. Because the wrapping
    // markerBox uses flexDirection: column-reverse, this marginBottom
    // visually acts as space between the popup (top) and pin (bottom).
    marginBottom: 6,
    alignSelf: 'center',
  },
  fallbackCallout: {
    marginTop: 6,
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#00000022',
  },
  fallbackCalloutInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fallbackCalloutTitleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#333',
  },
});

export default MapView;
export { Marker, Callout };
