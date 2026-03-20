// ── MAP INIT ──────────────────────────────────────────────────────
function initMap() {
  map = L.map('map', { zoomControl: false }).setView(ROMANIA_CENTER, ROMANIA_ZOOM);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(map);
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  const legend = L.control({ position: 'topright' });
  legend.onAdd = function() {
    const d = L.DomUtil.create('div', 'map-legend');
    d.id = 'map-legend';
    if (typeof updateLegend !== 'undefined') updateLegend(d);
    return d;
  };
  legend.addTo(map);

  map.on('click', function(e) {
    if (addingMode && pendingVenue) {
      pendingVenue.lat = e.latlng.lat;
      pendingVenue.lng = e.latlng.lng;
      if (typeof confirmAddVenue !== 'undefined') confirmAddVenue(pendingVenue);
    }
  });
}

function makeIcon(v, selected) {
  const color = STARE_COLOR[v.stare];
  const icon = TYPE_ICON[v.type];
  const size = selected ? 34 : 28;
  const border = selected ? 3 : 2.5;
  const shadow = selected
    ? '0 0 0 3px rgba(0,0,0,0.2), 0 4px 10px rgba(0,0,0,0.4)'
    : '0 2px 6px rgba(0,0,0,0.35)';
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:${border}px solid #fff;display:flex;align-items:center;justify-content:center;font-size:${selected?15:12}px;box-shadow:${shadow};cursor:pointer">${icon}</div>`,
    className: '', iconSize: [size, size], iconAnchor: [size/2, size/2]
  });
}

function renderMarkers() {
  Object.values(markers).forEach(m => map.removeLayer(m));
  markers = {};
  if (typeof getFiltered === 'undefined') return;
  const filteredIds = new Set(getFiltered().map(v => v.id));
  VENUES.forEach(v => {
    const isFiltered = filteredIds.has(v.id);
    const icon = isFiltered ? makeIcon(v, v.id === selectedId) : L.divIcon({
      html: `<div style="width:20px;height:20px;border-radius:50%;background:#ccc;border:2px solid #fff;opacity:0.4;box-shadow:0 1px 3px rgba(0,0,0,0.2)"></div>`,
      className: '', iconSize: [20,20], iconAnchor: [10,10]
    });
    markers[v.id] = L.marker([v.lat, v.lng], { icon }).addTo(map).on('click', () => {
      if (typeof selectVenue !== 'undefined') selectVenue(v.id);
    });
  });
}

// ── GEOCODING (city-aware, national) ────────────────────────────
async function geocodeAddress() {
  const address = document.getElementById('f-address').value.trim();
  const cityInput = document.getElementById('f-city').value.trim();
  if (!address) { setGeoStatus('Introdu o adresă mai întâi.', 'error'); return; }

  const btn = document.getElementById('geo-btn');
  btn.textContent = '⏳'; btn.disabled = true;
  setGeoStatus('Se caută…', 'info');

  // Build query with city context if available
  const cityContext = cityInput || (currentCity ? currentCity.name : 'România');
  const fullQuery = `${address} ${cityContext} Romania`;

  let hit = null;
  try {
    const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(fullQuery)}&limit=5`);
    if (res.ok) {
      const data = await res.json();
      hit = (data.features || []).find(f => {
        const [lo, la] = f.geometry.coordinates;
        return la > 43.5 && la < 48.5 && lo > 20 && lo < 30;
      });
      if (hit) { geocodedLat = hit.geometry.coordinates[1]; geocodedLng = hit.geometry.coordinates[0]; }
    }
  } catch(e) {}

  if (!hit) {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(fullQuery)}&format=json&limit=1&countrycodes=ro`);
      if (res.ok) {
        const data = await res.json();
        if (data.length) { geocodedLat = parseFloat(data[0].lat); geocodedLng = parseFloat(data[0].lon); hit = data[0]; }
      }
    } catch(e) {}
  }

  if (hit) {
    const p = hit.properties || {};
    const label = [p.housenumber ? (p.street||'') + ' ' + p.housenumber : null, p.city || p.county, hit.display_name]
      .filter(Boolean)[0] || address;
    setGeoStatus('✓ ' + label.split(',').slice(0,2).join(','), 'success');
    document.getElementById('geo-preview').style.display = 'block';
    document.getElementById('geo-preview-text').textContent = `lat: ${geocodedLat.toFixed(5)}, lng: ${geocodedLng.toFixed(5)}`;
    map.flyTo([geocodedLat, geocodedLng], 17, { duration: 0.8 });
  } else {
    setGeoStatus('', '');
    document.getElementById('geo-preview').style.display = 'block';
    document.getElementById('geo-preview-text').innerHTML =
      '❌ Negăsit — <a href="https://maps.google.com/?q=' + encodeURIComponent(fullQuery) +
      '" target="_blank" style="color:var(--blue)">Caută pe Google Maps</a>, copiază coord.:';
    if (!document.getElementById('manual-coords')) {
      const div = document.createElement('div');
      div.id = 'manual-coords';
      div.style.cssText = 'display:flex;gap:6px;margin-top:6px';
      div.innerHTML = `<input class="form-input" id="f-lat" placeholder="lat" style="flex:1" oninput="applyManualCoords()">
        <input class="form-input" id="f-lng" placeholder="lng" style="flex:1" oninput="applyManualCoords()">`;
      document.getElementById('geo-preview').after(div);
    }
    document.getElementById('manual-coords').style.display = 'flex';
  }
  btn.textContent = '📍 Localizează'; btn.disabled = false;
}

function applyManualCoords() {
  const lat = parseFloat(document.getElementById('f-lat')?.value);
  const lng = parseFloat(document.getElementById('f-lng')?.value);
  if (!isNaN(lat) && !isNaN(lng) && lat > 43 && lat < 49 && lng > 19 && lng < 31) {
    geocodedLat = lat; geocodedLng = lng;
    setGeoStatus('✓ Coordonate setate manual', 'success');
    map.flyTo([lat, lng], 17, { duration: 0.6 });
  }
}

async function geocodeEditAddress() {
  const address = document.getElementById('e-address').value.trim();
  const cityVal = document.getElementById('e-city').value.trim();
  if (!address) return;
  const btn = document.getElementById('e-geo-btn');
  btn.textContent = '⏳'; btn.disabled = true;
  document.getElementById('e-geo-status').style.color = 'var(--ink-faint)';
  document.getElementById('e-geo-status').textContent = 'Se caută…';
  try {
    const q = `${address} ${cityVal || 'România'} Romania`;
    const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=3`);
    const data = await res.json();
    const hits = (data.features||[]).filter(f => {
      const [lo, la] = f.geometry.coordinates;
      return la > 43.5 && la < 48.5 && lo > 20 && lo < 30;
    });
    if (hits.length) {
      editGeoLat = hits[0].geometry.coordinates[1];
      editGeoLng = hits[0].geometry.coordinates[0];
      document.getElementById('e-lat').value = editGeoLat.toFixed(5);
      document.getElementById('e-lng').value = editGeoLng.toFixed(5);
      const p = hits[0].properties;
      document.getElementById('e-geo-status').style.color = '#15803d';
      document.getElementById('e-geo-status').textContent = '✓ ' + [p.name, p.street, p.city].filter(Boolean).join(', ');
      map.flyTo([editGeoLat, editGeoLng], 16, {duration:0.6});
    } else {
      document.getElementById('e-geo-status').style.color = '#dc2626';
      document.getElementById('e-geo-status').textContent = '❌ Adresa nu a fost găsită';
    }
  } catch(e) {
    document.getElementById('e-geo-status').style.color = '#dc2626';
    document.getElementById('e-geo-status').textContent = '❌ Eroare: ' + e.message;
  }
  btn.textContent = '📍 Localizează'; btn.disabled = false;
}

// ── REVERSE GEOCODE (lat/lng → city name) ────────────────────────
async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ro`);
    if (res.ok) {
      const data = await res.json();
      return data.address?.city || data.address?.town || data.address?.municipality || null;
    }
  } catch(e) {}
  return null;
}

function distanceTo(lat, lng) {
  if (!userLat || !userLng) return null;
  const R = 6371, dLat = (lat-userLat)*Math.PI/180, dLon = (lng-userLng)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(userLat*Math.PI/180)*Math.cos(lat*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Find closest city object to coordinates
function findClosestCity(lat, lng) {
  if (!CITIES.length) return null;
  let closest = null, minDist = Infinity;
  CITIES.forEach(c => {
    const d = Math.sqrt((c.lat-lat)**2 + (c.lng-lng)**2);
    if (d < minDist) { minDist = d; closest = c; }
  });
  return closest;
}
