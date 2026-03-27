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

const MapView = React.forwardRef(({ children, style, initialRegion, ...props }, ref) => {
  const containerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);

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
    <View style={[{ flex: 1 }, style]} {...props}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 0 }} />
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

function Marker({ coordinate, children, tracksViewChanges, ...props }) {
  const map = useContext(MapContext);
  const markerRef = useRef(null);

  const { color, emoji, hasFriend, calloutOnPress, calloutTitle, calloutSub } = extractPinData(children);

  useEffect(() => {
    if (!map || !coordinate || typeof window === 'undefined') return;

    const L = window.L;
    if (!L) return;

    const friendHtml = hasFriend
      ? '<div class="pin-friend">👋</div>'
      : '';

    const html = `
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
      iconSize: [30, 40],
      iconAnchor: [15, 40],
      popupAnchor: [0, -40],
    });

    const marker = L.marker([coordinate.latitude, coordinate.longitude], { icon }).addTo(map);
    markerRef.current = marker;

    if (calloutTitle) {
      const popupHtml = `
        <div class="popup-title">${calloutTitle}</div>
        <div class="popup-sub">${calloutSub}</div>
      `;
      marker.bindPopup(popupHtml, { closeButton: false, offset: [0, -5] });
    }

    if (calloutOnPress) {
      marker.on('click', () => {
        calloutOnPress();
      });
    }

    return () => {
      if (marker) map.removeLayer(marker);
    };
  }, [map, coordinate?.latitude, coordinate?.longitude, color, emoji, hasFriend, calloutTitle]);

  return null;
}

function Callout({ children, onPress, tooltip }) {
  return null;
}

export default MapView;
export { Marker, Callout };
