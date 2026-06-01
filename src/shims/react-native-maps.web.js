// Web shim for react-native-maps — renders a Leaflet map
import React, { useEffect, useRef, useImperativeHandle, useState, createContext, useContext } from 'react';
import { View } from 'react-native';

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

const MapContext = createContext(null);

let cssInjected = false;
function injectCSS() {
  if (cssInjected || typeof document === 'undefined') return;
  cssInjected = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = LEAFLET_CSS;
  document.head.appendChild(link);
  const style = document.createElement('style');
  style.textContent = `
    .custom-pin { background: none !important; border: none !important; }
    .pin-wrap {
      width: 30px; height: 30px; border-radius: 50%;
      border: 2.5px solid #fff; display: flex; align-items: center;
      justify-content: center; font-size: 13px; line-height: 1;
      box-shadow: 0 1px 4px rgba(0,0,0,0.25); cursor: pointer;
      position: relative;
    }
    .pin-arrow {
      width: 0; height: 0; margin-top: -1px;
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-top: 7px solid #fff;
    }
    .pin-outer { display: flex; flex-direction: column; align-items: center; }
    .pin-friend {
      position: absolute; top: -4px; right: -4px;
      width: 16px; height: 16px; border-radius: 50%;
      background: #7c3aed; border: 1.5px solid #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 8px; line-height: 1;
    }
    .current-location-outer {
      width: 40px; height: 40px; position: relative;
      display: flex; align-items: center; justify-content: center;
    }
    .current-location-badge {
      width: 36px; height: 36px; border-radius: 999px;
      box-sizing: border-box; border: 3px solid #fff;
      background: #13524A; display: flex; align-items: center;
      justify-content: center; position: relative;
      box-shadow: 0 2px 5px rgba(0,0,0,0.30);
    }
    .current-location-mark {
      width: 18px; height: 25px; position: relative;
    }
    .leaflet-popup-content-wrapper {
      border-radius: 10px !important; padding: 0 !important;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important;
    }
    .leaflet-popup-content { margin: 10px !important; min-width: 140px; }
    .leaflet-popup-content .popup-title {
      font-family: 'DM Sans', system-ui, sans-serif;
      font-size: 13px; font-weight: 600; color: #111810; margin-bottom: 2px;
    }
    .leaflet-popup-content .popup-sub {
      font-family: 'DM Sans', system-ui, sans-serif;
      font-size: 11px; color: #9ca39a;
    }
  `;
  document.head.appendChild(style);
}

let leafletPromise = null;
function loadLeaflet() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.onload = () => resolve(window.L);
    document.head.appendChild(script);
  });
  return leafletPromise;
}

const MapView = React.forwardRef(({ children, style, initialRegion, onPress, ...props }, ref) => {
  const containerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  // Mirror onPress to a ref so the once-only Leaflet click handler always
  // calls the latest closure without rebinding (and re-rendering the map).
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;

  useImperativeHandle(ref, () => ({
    animateToRegion: (region) => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView([region.latitude, region.longitude], 14, { animate: true });
      }
    },
  }));

  useEffect(() => {
    injectCSS();
    let cancelled = false;

    loadLeaflet().then((L) => {
      if (cancelled || !L || !containerRef.current || mapInstanceRef.current) return;

      const lat = initialRegion?.latitude ?? 44.4268;
      const lng = initialRegion?.longitude ?? 26.1025;
      const zoom = initialRegion?.latitudeDelta
        ? Math.round(Math.log2(360 / (initialRegion.latitudeDelta || 0.08))) + 1
        : 13;

      const map = L.map(containerRef.current, {
        center: [lat, lng],
        zoom,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer(TILE_URL, { maxZoom: 19 }).addTo(map);
      // Translate Leaflet click → react-native-maps onPress shape so the
      // address-picker tap-to-place handler stays platform-agnostic.
      map.on('click', (e) => {
        const handler = onPressRef.current;
        if (!handler) return;
        handler({
          nativeEvent: {
            coordinate: { latitude: e.latlng.lat, longitude: e.latlng.lng },
          },
        });
      });
      mapInstanceRef.current = map;
      setMapReady(true);

      [100, 300, 600, 1200].forEach((ms) =>
        setTimeout(() => map.invalidateSize(), ms),
      );
    });

    let observer;
    if (containerRef.current && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
      });
      observer.observe(containerRef.current);
    }

    return () => {
      cancelled = true;
      if (observer) observer.disconnect();
    };
  }, []);

  return (
    // minHeight + position:relative guards against zero-height collapse when
    // the parent doesn't pass an explicit height — without it Leaflet renders
    // into a 0px container and the map appears blank.
    <View style={[{ flex: 1, minHeight: 180, position: 'relative' }, style]} {...props}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 180, position: 'absolute', top: 0, left: 0, zIndex: 0 }} />
      {mapReady && (
        <MapContext.Provider value={mapInstanceRef.current}>
          {children}
        </MapContext.Provider>
      )}
    </View>
  );
});
MapView.displayName = 'MapView';

// Helper: extract pin data from React Native children tree
function extractPinData(children) {
  let color = '#22c55e';
  let emoji = '🏓';
  let hasFriend = false;
  let calloutOnPress = null;
  let calloutTitle = '';
  let calloutSub = '';

  React.Children.forEach(children, (child) => {
    if (!child?.props) return;

    // Callout component
    if (child.type === Callout) {
      calloutOnPress = child.props.onPress;
      // Extract text from Callout > View > Text children
      React.Children.forEach(child.props.children, (cv) => {
        if (!cv?.props) return;
        React.Children.forEach(cv.props.children, (text) => {
          if (!text?.props) return;
          const content = extractText(text);
          if (!calloutTitle) calloutTitle = content;
          else calloutSub = content;
        });
      });
      return;
    }

    // Pin outer View — walk its children
    walkChildren(child, (node) => {
      if (!node?.props) return;
      const s = node.props.style;
      if (s) {
        const flat = Array.isArray(s) ? Object.assign({}, ...s.filter(Boolean)) : s;
        // Detect the pin circle (has borderRadius ~15)
        if (flat.borderRadius >= 10 && flat.backgroundColor && flat.width >= 28) {
          color = flat.backgroundColor;
        }
        // Detect friend badge (purple, small)
        if (flat.backgroundColor === '#7c3aed' || flat.position === 'absolute' && flat.width === 16) {
          hasFriend = true;
        }
      }
      // Extract emoji text
      if (node.props.children && typeof node.props.children === 'string') {
        const t = node.props.children.trim();
        if (t === '🏢' || t === '🏓' || t === '👋') {
          if (t === '👋') hasFriend = true;
          else emoji = t;
        }
      }
    });
  });

  return { color, emoji, hasFriend, calloutOnPress, calloutTitle, calloutSub };
}

function walkChildren(node, fn) {
  if (!node) return;
  fn(node);
  if (node.props?.children) {
    React.Children.forEach(node.props.children, (child) => walkChildren(child, fn));
  }
}

function extractText(node) {
  if (typeof node === 'string') return node;
  if (!node?.props) return '';
  if (typeof node.props.children === 'string') return node.props.children;
  let text = '';
  React.Children.forEach(node.props.children, (child) => {
    text += extractText(child);
  });
  return text;
}

function currentLocationPinSvg(fill, maskId) {
  return `
    <svg viewBox="0 0 348 486" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <mask id="${maskId}">
          <rect width="100%" height="100%" fill="black"></rect>
          <g transform="translate(0,486) scale(0.1,-0.1)">
            <path d="M1575 4760 c-86 -10 -247 -52 -335 -87 -210 -83 -361 -184 -536 -358 -197 -196 -319 -393 -414 -675 -127 -372 -126 -831 2 -1255 87 -289 242 -629 410 -899 105 -168 339 -500 412 -584 13 -15 73 -86 133 -157 132 -157 354 -388 442 -461 49 -40 68 -51 80 -44 18 10 279 265 300 292 12 16 -63 93 -718 745 -402 401 -731 733 -731 739 0 7 10 14 23 17 41 9 302 77 337 87 33 10 630 156 755 185 33 8 134 32 225 54 166 40 320 77 550 132 69 16 141 34 160 39 49 13 512 126 582 141 33 8 60 20 64 29 3 8 12 89 19 180 31 371 -25 679 -180 995 -77 156 -118 219 -225 348 -161 193 -367 344 -595 439 -60 25 -139 52 -175 61 -36 8 -87 21 -115 27 -61 15 -374 22 -470 10z" fill="white"></path>
            <path d="M3160 2443 c-52 -12 -111 -27 -130 -33 -19 -5 -84 -21 -145 -35 -161 -38 -275 -65 -315 -75 -19 -6 -73 -19 -120 -29 -221 -51 -308 -72 -340 -81 -19 -5 -66 -17 -105 -25 -38 -9 -106 -25 -150 -35 -44 -11 -129 -31 -190 -45 -60 -14 -126 -30 -145 -35 -19 -5 -64 -16 -100 -24 -180 -41 -352 -83 -419 -102 -17 -5 5 -28 530 -550 477 -473 677 -668 689 -672 12 -5 262 295 390 468 103 138 272 399 335 515 79 145 136 262 179 365 26 63 51 124 56 135 5 11 23 65 40 120 18 55 36 111 41 124 6 13 6 27 2 31 -4 3 -51 -4 -103 -17z" fill="white"></path>
          </g>
          <circle cx="178.54" cy="157.76" r="58.3" fill="black"></circle>
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="${fill}" mask="url(#${maskId})"></rect>
    </svg>
  `;
}

function currentLocationMarkerHtml() {
  return `
    <div class="current-location-outer" aria-label="Current location">
      <div class="current-location-badge">
        <div class="current-location-mark">${currentLocationPinSvg('#ffffff', 'cl-pinmask-mark')}</div>
      </div>
    </div>
  `;
}

function Marker({ coordinate, children, tracksViewChanges, draggable, onDragEnd, identifier, ...props }) {
  const map = useContext(MapContext);
  const markerRef = useRef(null);
  // Latest onDragEnd handler — Leaflet's `dragend` listener is bound once at
  // marker creation, so we read the closure indirectly to avoid rebinding
  // (and recreating the marker) every time the parent re-renders.
  const onDragEndRef = useRef(onDragEnd);
  onDragEndRef.current = onDragEnd;

  const { color, emoji, hasFriend, calloutOnPress, calloutTitle, calloutSub } = extractPinData(children);
  const isCurrentLocation = identifier === 'current-location';

  // Build the Leaflet marker once (or when its essential identity changes).
  // For draggable markers, intentionally exclude coordinate.* from deps so
  // the marker is not re-created on every drag-end / parent state update —
  // we update the position imperatively in a separate effect below.
  useEffect(() => {
    if (!map || !coordinate || typeof window === 'undefined') return;

    const L = window.L;
    if (!L) return;

    const friendHtml = hasFriend
      ? '<div class="pin-friend">👋</div>'
      : '';

    const html = isCurrentLocation ? currentLocationMarkerHtml() : `
      <div class="pin-outer">
        <div class="pin-wrap" style="background-color:${color}">
          ${emoji}
          ${friendHtml}
        </div>
        <div class="pin-arrow"></div>
      </div>
    `;

    const icon = L.divIcon({
      html,
      className: 'custom-pin',
      iconSize: isCurrentLocation ? [40, 40] : [30, 40],
      iconAnchor: isCurrentLocation ? [20, 20] : [15, 40],
      popupAnchor: isCurrentLocation ? [0, -20] : [0, -40],
    });

    const marker = L.marker([coordinate.latitude, coordinate.longitude], {
      icon,
      draggable: !!draggable,
      autoPan: !!draggable,
    }).addTo(map);
    markerRef.current = marker;

    if (draggable) {
      marker.on('dragend', () => {
        const { lat, lng } = marker.getLatLng();
        const handler = onDragEndRef.current;
        if (handler) {
          handler({
            nativeEvent: { coordinate: { latitude: lat, longitude: lng } },
          });
        }
      });
    }

    if (!isCurrentLocation && calloutTitle) {
      const popupHtml = `
        <div class="popup-title">${calloutTitle}</div>
        <div class="popup-sub">${calloutSub}</div>
      `;
      marker.bindPopup(popupHtml, { closeButton: false, offset: [0, -5] });
    }

    if (!isCurrentLocation && calloutOnPress) {
      marker.on('click', () => {
        calloutOnPress();
      });
    }

    return () => {
      if (marker) map.removeLayer(marker);
      markerRef.current = null;
    };
  }, [map, color, emoji, hasFriend, calloutTitle, draggable, isCurrentLocation]);

  // Reposition the existing marker when coordinate changes (after a drag
  // ends, after tap-to-place, or after a programmatic move from search).
  useEffect(() => {
    if (!markerRef.current || !coordinate) return;
    markerRef.current.setLatLng([coordinate.latitude, coordinate.longitude]);
  }, [coordinate?.latitude, coordinate?.longitude]);

  return null;
}

function Callout({ children, onPress, tooltip }) {
  return null;
}

export default MapView;
export { Marker, Callout };
