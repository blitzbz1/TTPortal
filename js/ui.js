// ── TOAST ─────────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:10px 18px;border-radius:8px;font-size:12px;font-weight:600;z-index:9999;transition:opacity .3s;pointer-events:none;white-space:nowrap;box-shadow:0 4px 16px rgba(0,0,0,0.2)';
    document.body.appendChild(t);
  }
  const colors = { info:'#1a4a2e', success:'#15803d', error:'#dc2626' };
  t.style.background = colors[type] || colors.info;
  t.style.color = '#fff'; t.style.opacity = '1'; t.textContent = msg;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.opacity = '0'; }, 2500);
}

// ── i18n ──────────────────────────────────────────────────────────
let LANG = localStorage.getItem('ttportal-lang') || 'ro';
const STRINGS = {
  en: {
    subtitle: 'Find a Table',
    splashSub: 'Find a table tennis venue in Romania',
    splashLocate: 'Use my location',
    splashOr: 'or pick a city',
    splashLocating: 'Detecting your city…',
    addVenue: 'Add venue',
    searchPh: 'Search venues, cities…',
    shown: (n) => n + ' venue' + (n!==1?'s':'') + ' shown',
    total: (n) => n + ' venue' + (n!==1?'s':''),
    park: 'park', indoor: 'indoor', free: 'free',
    tables: (n) => n + ' table' + (n!==1?'s':''),
    stare: {buna:'Good',acceptabila:'Fair',deteriorata:'Poor',necunoscuta:'Unknown',profesionala:'Pro'},
    stareD: {buna:'Good condition',acceptabila:'Fair condition',deteriorata:'Poor condition',necunoscuta:'Unknown',profesionala:'Professional'},
    typeL: {parc_exterior:'🌳 Outdoor park',sala_indoor:'🏢 Indoor venue'},
    infoLabel: 'Info', reviewsLabel: 'Community reviews',
    freeAccess: 'Free access', paidEntry: (t) => t||'Paid',
    nightOn: 'Night lighting', nightOff: 'No night lighting',
    netsOn: 'Nets present', netsOff: 'Nets missing',
    noCount: 'Count unconfirmed',
    noReviews: 'No reviews yet — be the first!',
    revCount: (n) => n + ' review' + (n!==1?'s':''),
    writeReview: '✍️ Write a review', anon: 'Anonymous',
    directions: 'Get directions',
    dirGoogleMaps: 'Google Maps', dirAppleMaps: 'Apple Maps', dirWaze: 'Waze',
    photos: 'Photos', addPhoto: 'Add photo',
    photoUploading: (n) => `Uploading ${n} photo(s)…`,
    photoUploaded: (n) => `${n} photo(s) added ✓`,
    photoTooLarge: 'File too large (max 5MB)',
    cityModal: 'Choose city',
    changeCity: 'Change city',
    venuesIn: (c) => `Venues in ${c}`,
    allRomania: 'All Romania',
    nearMe: 'Near me', nearMeOff: 'Near me',
    km: (d) => d < 1 ? Math.round(d*1000)+'m' : d.toFixed(1)+'km',
    alertName: 'Name and address are required.',
    alertCoords: 'Coordinates missing — use Locate button.',
    alertRating: 'Please select a rating.',
    alertReview: 'Please write a short review.',
    cancel: 'Cancel', save: 'Save →', add: 'Add venue →', publish: 'Post →',
  },
  ro: {
    subtitle: 'Găsește o masă',
    splashSub: 'Găsește o masă de tenis în România',
    splashLocate: 'Folosește locația mea',
    splashOr: 'sau alege un oraș',
    splashLocating: 'Se detectează orașul…',
    addVenue: 'Adaugă',
    searchPh: 'Caută locații, orașe…',
    shown: (n) => n + ' locații afișate',
    total: (n) => n + ' locații',
    park: 'parc', indoor: 'indoor', free: 'gratuit',
    tables: (n) => n + (n===1?' masă':' mese'),
    stare: {buna:'Bună',acceptabila:'Acceptabilă',deteriorata:'Deteriorată',necunoscuta:'Necunoscută',profesionala:'Pro'},
    stareD: {buna:'Stare bună',acceptabila:'Acceptabilă',deteriorata:'Deteriorată',necunoscuta:'Stare necunoscută',profesionala:'Profesională'},
    typeL: {parc_exterior:'🌳 Parc exterior',sala_indoor:'🏢 Sală indoor'},
    infoLabel: 'Informații', reviewsLabel: 'Recenzii comunitate',
    freeAccess: 'Acces gratuit', paidEntry: (t) => t||'Cu plată',
    nightOn: 'Iluminat nocturn', nightOff: 'Fără iluminat nocturn',
    netsOn: 'Fileuri prezente', netsOff: 'Fileuri lipsă',
    noCount: 'Număr neconfirmat',
    noReviews: 'Nicio recenzie — fii primul!',
    revCount: (n) => n + (n===1?' recenzie':' recenzii'),
    writeReview: '✍️ Scrie o recenzie', anon: 'Anonim',
    directions: 'Obține indicații',
    dirGoogleMaps: 'Google Maps', dirAppleMaps: 'Apple Maps', dirWaze: 'Waze',
    photos: 'Fotografii', addPhoto: 'Adaugă foto',
    photoUploading: (n) => `Se încarcă ${n} foto…`,
    photoUploaded: (n) => `${n} foto adăugate ✓`,
    photoTooLarge: 'Fișier prea mare (max 5MB)',
    cityModal: 'Alege orașul',
    changeCity: 'Schimbă orașul',
    venuesIn: (c) => `Locații în ${c}`,
    allRomania: 'Toată România',
    nearMe: 'Lângă mine', nearMeOff: 'Lângă mine',
    km: (d) => d < 1 ? Math.round(d*1000)+'m' : d.toFixed(1)+'km',
    alertName: 'Numele și adresa sunt obligatorii.',
    alertCoords: 'Coordonatele lipsesc — folosește butonul Localizează.',
    alertRating: 'Selectează o notă.',
    alertReview: 'Scrie o recenzie scurtă.',
    cancel: 'Anulează', save: 'Salvează →', add: 'Adaugă →', publish: 'Publică →',
  }
};

function s(key, ...args) {
  const v = STRINGS[LANG][key];
  return typeof v === 'function' ? v(...args) : (v ?? STRINGS.en[key] ?? key);
}

// ── SPLASH SCREEN ─────────────────────────────────────────────────
function initSplash() {
  // Check if user has a saved city
  const saved = localStorage.getItem('ttportal-city');
  if (saved) {
    try {
      const city = JSON.parse(saved);
      hideSplash();
      switchCity(city);
      return;
    } catch(e) {}
  }
  renderSplashCities();
  applySplashLang();
  document.getElementById('splash').style.display = 'flex';
}

function renderSplashCities() {
  const grid = document.getElementById('splash-city-grid');
  if (!grid) return;
  const top = CITIES.slice(0, 8);
  grid.innerHTML = top.map(c => `
    <button class="splash-city-btn" onclick="splashPickCity(${c.id})">
      <span class="splash-city-name">${c.name}</span>
      <span class="splash-city-count">${c.venue_count || 0}</span>
    </button>
  `).join('');
}

async function splashLocate() {
  const btn = document.getElementById('splash-locate-btn');
  const lbl = document.getElementById('splash-locate-label');
  lbl.textContent = s('splashLocating');
  btn.disabled = true;

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      userLat = pos.coords.latitude;
      userLng = pos.coords.longitude;
      const closest = findClosestCity(userLat, userLng);
      if (closest) {
        hideSplash();
        await switchCity(closest);
        addUserMarker();
        nearMeActive = true;
        document.getElementById('btn-near').classList.add('active');
        renderList(); renderMarkers();
      } else {
        hideSplash();
        await loadVenues();
        map.flyTo([userLat, userLng], 13, { duration: 1 });
        addUserMarker();
      }
    },
    (err) => {
      lbl.textContent = s('splashLocate');
      btn.disabled = false;
      showToast(LANG === 'ro' ? 'Locație indisponibilă' : 'Location unavailable', 'error');
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

function addUserMarker() {
  if (!window._userMarker) {
    window._userMarker = L.circleMarker([userLat, userLng], {
      radius: 9, fillColor: '#3b82f6', fillOpacity: 1, color: '#fff', weight: 2.5
    }).addTo(map).bindPopup(LANG === 'ro' ? 'Ești aici' : 'You are here');
  } else {
    window._userMarker.setLatLng([userLat, userLng]);
  }
}

async function splashPickCity(cityId) {
  const city = CITIES.find(c => c.id === cityId);
  if (!city) return;
  hideSplash();
  await switchCity(city);
}

function hideSplash() {
  const splash = document.getElementById('splash');
  splash.style.opacity = '0';
  splash.style.pointerEvents = 'none';
  setTimeout(() => { splash.style.display = 'none'; }, 400);
}

function setSplashLang(lang) {
  LANG = lang;
  localStorage.setItem('ttportal-lang', lang);
  document.getElementById('splash-lang-en').classList.toggle('active', lang === 'en');
  document.getElementById('splash-lang-ro').classList.toggle('active', lang === 'ro');
  applySplashLang();
}

function applySplashLang() {
  document.getElementById('splash-sub').textContent = s('splashSub');
  document.getElementById('splash-locate-label').textContent = s('splashLocate');
  document.getElementById('splash-or').textContent = s('splashOr');
}

// ── CITY SWITCHER ─────────────────────────────────────────────────
function openCitySwitcher() {
  document.getElementById('city-modal-title').textContent = s('cityModal');
  renderCityList(CITIES);
  document.getElementById('city-modal').classList.add('open');
}

function closeCitySwitcher() {
  document.getElementById('city-modal').classList.remove('open');
  document.getElementById('city-search').value = '';
}

function renderCityList(cities) {
  const list = document.getElementById('city-list');
  list.innerHTML = `
    <button class="city-list-item ${!currentCity ? 'active' : ''}" onclick="pickCity(null)">
      <span>🇷🇴 ${s('allRomania')}</span>
      <span class="city-list-count">${VENUES.length || ''}</span>
    </button>
    ${cities.map(c => `
      <button class="city-list-item ${currentCity?.id === c.id ? 'active' : ''}" onclick="pickCity(${c.id})">
        <span>${c.name} <span style="color:var(--ink-faint);font-weight:400;font-size:11px">${c.county}</span></span>
        <span class="city-list-count">${c.venue_count || 0}</span>
      </button>
    `).join('')}
  `;
}

function filterCityList() {
  const q = document.getElementById('city-search').value.toLowerCase();
  const filtered = q ? CITIES.filter(c => c.name.toLowerCase().includes(q) || c.county.toLowerCase().includes(q)) : CITIES;
  renderCityList(filtered);
}

async function pickCity(cityId) {
  closeCitySwitcher();
  if (!cityId) {
    currentCity = null;
    localStorage.removeItem('ttportal-city');
    document.getElementById('current-city-label').textContent = s('allRomania');
    await loadVenues(null);
    map.flyTo(ROMANIA_CENTER, ROMANIA_ZOOM, { duration: 1 });
    return;
  }
  const city = CITIES.find(c => c.id === cityId);
  if (city) await switchCity(city);
}

// ── FILTER & LIST ────────────────────────────────────────────────
function starsHTML(r) { const f = Math.round(r); return '★'.repeat(f) + '☆'.repeat(5-f); }
function avgRating(v) { if (!v.reviews.length) return null; return v.reviews.reduce((a,r)=>a+r.rating,0)/v.reviews.length; }

function getFiltered() {
  return VENUES.filter(v => {
    if (currentFilter === 'parc_exterior' && v.type !== 'parc_exterior') return false;
    if (currentFilter === 'sala_indoor' && v.type !== 'sala_indoor') return false;
    if (currentFilter === 'verified' && !v.verificat) return false;
    if (!currentSearch) return true;
    const q = currentSearch;
    return v.name.toLowerCase().includes(q) ||
      (v.sector||'').toLowerCase().includes(q) ||
      (v.address||'').toLowerCase().includes(q) ||
      (v.city||'').toLowerCase().includes(q) ||
      (v.tags||[]).some(t => t.toLowerCase().includes(q));
  });
}

function filterVenues() {
  currentSearch = document.getElementById('search-input').value.toLowerCase();
  renderList(); renderMarkers();
}

function setFilter(f, el) {
  currentFilter = f;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderList(); renderMarkers();
}

function renderList() {
  let f = getFiltered();
  if (nearMeActive && userLat && userLng) {
    f = [...f].sort((a, b) => (distanceTo(a.lat, a.lng)||999) - (distanceTo(b.lat, b.lng)||999));
  }

  const cityName = currentCity ? currentCity.name : s('allRomania');
  document.getElementById('current-city-label').textContent = cityName;
  document.getElementById('list-header').textContent = s('shown', f.length);
  updateSidebarToggleLabel();

  const list = document.getElementById('venues-list');
  if (!f.length) {
    list.innerHTML = `<div class="empty-state">🏓<br>${LANG==='ro'?'Nicio locație găsită.':'No venues found.'}</div>`;
    return;
  }

  const stareColor = {buna:'#15803d',acceptabila:'#a16207',deteriorata:'#dc2626',necunoscuta:'#64748b',profesionala:'#1e40af'};
  list.innerHTML = f.map(v => {
    const avg = avgRating(v);
    const dist = distanceTo(v.lat, v.lng);
    const stStr = s('stare')[v.stare] || v.stare;
    const starsStr = avg ? '★'.repeat(Math.round(avg))+'☆'.repeat(5-Math.round(avg)) : '';
    const cityTag = !currentCity && v.city ? `<span class="tag" style="background:#e0f2fe;color:#0369a1">${v.city}</span>` : '';
    return `<div class="venue-card${v.id===selectedId?' active':''}" onclick="selectVenue(${v.id})">
      <div class="venue-card-top">
        <div class="venue-name">${v.name}</div>
        <span class="vtype ${v.type}">${v.type==='sala_indoor'?s('indoor'):s('park')}</span>
      </div>
      <div class="venue-meta">
        ${v.city||''} ${v.sector?'· '+v.sector:''} · ${v.tables!=null?s('tables',v.tables):'–'}
        · <span class="stare-dot ${v.stare}"></span><span style="color:${stareColor[v.stare]||'var(--ink-faint)'};font-size:10px;font-weight:600">${stStr}</span>
        ${dist!=null?`<span style="float:right" class="distance-badge">${s('km',dist)}</span>`:''}
      </div>
      ${avg ? `<div style="font-size:11px;color:#f59e0b;margin-bottom:2px">${starsStr} <span style="color:var(--ink-muted)">${avg.toFixed(1)}</span> <span style="color:var(--ink-faint)">(${v.reviews.length})</span></div>` : ''}
      <div class="venue-tags">
        ${v.acces_gratuit?`<span class="tag green">${s('free')}</span>`:''}
        ${cityTag}
        ${(v.tags||[]).filter(t=>t!=='gratuit'&&t!=='plată').slice(0,2).map(t=>`<span class="tag">${t}</span>`).join('')}
        ${v.verificat?'<span class="tag green">✓</span>':''}
      </div>
    </div>`;
  }).join('');
}

function selectVenue(id) {
  selectedId = id;
  const v = VENUES.find(x => x.id === id);
  if (!v) return;
  renderList(); renderMarkers();
  document.getElementById('dp-name').textContent = v.name;
  const dist = distanceTo(v.lat, v.lng);
  let badges = `<span class="vtype ${v.type}" style="font-size:11px">${s('typeL')[v.type]||v.type}</span>`;
  badges += `<span class="stare-badge ${v.stare}">${s('stareD')[v.stare]||v.stare}</span>`;
  if (v.verificat) badges += `<span class="verified-badge">✓ verified</span>`;
  if (dist != null) badges += `<span class="distance-badge">${s('km',dist)}</span>`;
  if (v.city) badges += `<span class="city-badge">${v.city}</span>`;
  document.getElementById('dp-badges').innerHTML = badges;

  const avg = avgRating(v);
  let html = `<div class="detail-section">
    <div class="detail-label">${s('infoLabel')}</div>
    <div class="detail-info-row"><span>📍</span><span>${v.address||''}</span></div>
    <div class="detail-info-row"><span>🏓</span><span>${v.tables!=null?s('tables',v.tables):s('noCount')}</span></div>
    <div class="detail-info-row"><span>⏰</span><span>${v.hours||''}</span></div>
    <div class="detail-info-row"><span>💶</span><span>${v.acces_gratuit?s('freeAccess'):s('paidEntry',v.tarif)}</span></div>
    ${v.nocturna!=null?`<div class="detail-info-row"><span>🌙</span><span>${v.nocturna?s('nightOn'):s('nightOff')}</span></div>`:''}
    ${v.fileuri!=null&&v.type==='parc_exterior'?`<div class="detail-info-row"><span>🥅</span><span>${v.fileuri?s('netsOn'):s('netsOff')}</span></div>`:''}
    ${v.website?`<div class="detail-info-row"><span>🔗</span><span><a href="${v.website}" target="_blank" style="color:var(--blue);word-break:break-all">${v.website.replace('https://','')}</a></span></div>`:''}
    ${v.desc?`<div class="detail-info-row" style="margin-top:4px"><span>💬</span><span style="font-style:italic;color:var(--ink-faint)">${v.desc}</span></div>`:''}
  </div>`;

  html += `<div class="detail-section"><div class="venue-tags">${(v.tags||[]).map(t=>`<span class="tag">${t}</span>`).join('')}</div></div>`;

  if (v.photos && v.photos.length) {
    html += `<div class="detail-section">
      <div class="detail-label">${s('photos')}</div>
      <div class="photo-strip">${v.photos.map(url=>`<img class="photo-thumb" src="${url}" loading="lazy" onclick="openLightbox('${url}')">`).join('')}</div>
    </div>`;
  }

  // Directions
  html += `<div class="directions-wrap">
    <div class="directions-label">${s('directions')}</div>
    <div class="directions-row">
      <a class="btn-dir btn-dir-google" href="https://www.google.com/maps/dir/?api=1&destination=${v.lat},${v.lng}" target="_blank" rel="noopener">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
        ${s('dirGoogleMaps')}
      </a>
      <a class="btn-dir btn-dir-apple" href="https://maps.apple.com/?daddr=${v.lat},${v.lng}&dirflg=d" target="_blank" rel="noopener">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
        ${s('dirAppleMaps')}
      </a>
      <a class="btn-dir btn-dir-waze" href="https://waze.com/ul?ll=${v.lat},${v.lng}&navigate=yes" target="_blank" rel="noopener">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.54 6.63C19.08 4.04 16.6 2.22 13.72 1.67c-2.95-.56-5.96.39-8.03 2.46C3.62 6.2 2.67 8.87 3.04 11.5c.2 1.41.73 2.67 1.43 3.8l-.02.01-.06.09c-.28.43-.54.88-.74 1.35-.5 1.19-.56 2.39.12 3.37.68.97 1.86 1.37 3.06 1.32.62-.02 1.25-.17 1.87-.38l.09-.03c1.04.56 2.2.88 3.4.92h.35c4.98 0 9.26-3.88 9.62-8.86.19-2.59-.6-5.08-2.12-6.96h-.1z"/></svg>
        ${s('dirWaze')}
      </a>
    </div>
  </div>`;

  html += `<div class="detail-section"><div class="detail-label">${s('reviewsLabel')}</div>`;
  if (avg) {
    html += `<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:8px">
      <span style="font-size:34px;font-weight:700">${avg.toFixed(1)}</span>
      <div><div style="color:var(--orange);font-size:16px">${starsHTML(avg)}</div>
      <div style="font-size:11px;color:var(--ink-faint)">${s('revCount',v.reviews.length)}</div></div></div>
      <div class="reviews-list">${v.reviews.map(r=>`<div class="review-item">
        <div class="review-top"><span class="reviewer">${r.name||s('anon')}</span><span class="review-stars">${starsHTML(r.rating)}</span></div>
        <div class="review-text">${r.text}</div>
        <div class="review-date">${new Date(r.created_at).toLocaleDateString('ro-RO',{month:'short',year:'numeric'})}</div>
      </div>`).join('')}</div>`;
  } else {
    html += `<div style="font-size:12px;color:var(--ink-faint);padding:8px 0;line-height:1.6">${s('noReviews')}</div>`;
  }
  html += `</div><button class="btn-review" onclick="openReviewModal()">${s('writeReview')}</button>`;

  document.getElementById('dp-body').innerHTML = html;
  document.getElementById('detail-panel').classList.add('open');
  map.flyTo([v.lat, v.lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
}

function closeDetail() {
  document.getElementById('detail-panel').classList.remove('open');
  selectedId = null; renderList(); renderMarkers();
}

// ── ADD VENUE ─────────────────────────────────────────────────────
function openAddModal() {
  geocodedLat = null; geocodedLng = null;
  document.getElementById('geo-status').textContent = '';
  document.getElementById('geo-preview').style.display = 'none';
  // Pre-fill city from current context
  if (currentCity) {
    document.getElementById('f-city').value = currentCity.name;
    document.getElementById('f-county').value = currentCity.county || '';
  }
  document.getElementById('add-modal').classList.add('open');
}

function closeAddModal() {
  document.getElementById('add-modal').classList.remove('open');
  addingMode = false; map.getContainer().style.cursor = '';
}

async function submitVenue() {
  const name = document.getElementById('f-name').value.trim();
  const address = document.getElementById('f-address').value.trim();
  const city = document.getElementById('f-city').value.trim();
  if (!name || !address || !city) { alert(s('alertName') + (city ? '' : ' (oraș lipsă)')); return; }
  let lat = geocodedLat, lng = geocodedLng;
  if (!lat || !lng) {
    showToast('Se caută adresa…', 'info');
    try {
      const q = encodeURIComponent(`${address} ${city} Romania`);
      const res = await fetch(`https://photon.komoot.io/api/?q=${q}&limit=5`);
      if (res.ok) {
        const data = await res.json();
        const hit = (data.features||[]).find(f => { const [lo,la] = f.geometry.coordinates; return la>43.5&&la<48.5&&lo>20&&lo<30; });
        if (hit) { lat = hit.geometry.coordinates[1]; lng = hit.geometry.coordinates[0]; }
      }
    } catch(e) {}
  }
  if (!lat || !lng) {
    pendingVenue = buildVenueObj(name, address, city, map.getCenter().lat, map.getCenter().lng);
    closeAddModal(); addingMode = true;
    map.getContainer().style.cursor = 'crosshair';
    showToast('📍 Click pe hartă pentru a plasa locația', 'info');
    clearForm(); return;
  }
  pendingVenue = buildVenueObj(name, address, city, lat, lng);
  closeAddModal(); clearForm();
  await confirmAddVenue(pendingVenue);
}

function buildVenueObj(name, address, city, lat, lng) {
  return {
    name, type: document.getElementById('f-type').value,
    city, county: document.getElementById('f-county').value.trim() || '',
    sector: document.getElementById('f-sector').value.trim() || '',
    address, tables: parseInt(document.getElementById('f-tables').value) || null,
    stare: 'necunoscuta',
    hours: document.getElementById('f-hours').value.trim() || 'Verificați',
    desc: document.getElementById('f-desc').value.trim() || 'Adăugat de comunitate.',
    tags: ['nou adăugat'],
    acces_gratuit: document.getElementById('f-type').value === 'parc_exterior',
    nocturna: false, fileuri: null, verificat: false, lat, lng
  };
}

function clearForm() {
  ['f-name','f-sector','f-address','f-tables','f-hours','f-desc','f-city','f-county'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  geocodedLat = null; geocodedLng = null;
  const mc = document.getElementById('manual-coords'); if (mc) mc.style.display = 'none';
  const prev = document.getElementById('geo-preview'); if (prev) prev.style.display = 'none';
  const status = document.getElementById('geo-status'); if (status) status.textContent = '';
}

async function confirmAddVenue(venue) {
  addingMode = false; map.getContainer().style.cursor = '';
  showToast('Saving…', 'info');
  const saved = await saveVenue({ ...venue, description: venue.desc });
  if (!saved) return;
  VENUES.push({ ...saved, desc: saved.description || '', reviews: [], photos: [] });
  pendingVenue = null;
  renderMarkers(); renderList(); selectVenue(saved.id);
  showToast(LANG==='ro'?'Locație adăugată!':'Venue added!', 'success');
}

// ── REVIEWS ───────────────────────────────────────────────────────
function openReviewModal() {
  pendingReviewId = selectedId; reviewRating = 0;
  document.querySelectorAll('.star-btn').forEach(b => b.classList.remove('lit'));
  document.getElementById('r-name').value = '';
  document.getElementById('r-text').value = '';
  document.getElementById('review-modal').classList.add('open');
}
function closeReviewModal() { document.getElementById('review-modal').classList.remove('open'); }
function setRating(v) { reviewRating = v; document.querySelectorAll('.star-btn').forEach((b,i) => b.classList.toggle('lit', i < v)); }

async function submitReview() {
  if (!reviewRating) { alert(s('alertRating')); return; }
  const text = document.getElementById('r-text').value.trim();
  if (!text) { alert(s('alertReview')); return; }
  const v = VENUES.find(x => x.id === pendingReviewId); if (!v) return;
  const review = { name: document.getElementById('r-name').value.trim() || 'Anonim', rating: reviewRating, text };
  showToast(LANG==='ro'?'Se salvează…':'Saving…', 'info');
  const saved = await saveReview(v.id, review);
  if (!saved) return;
  v.reviews.unshift(saved);
  closeReviewModal(); renderList();
  if (selectedId === pendingReviewId) selectVenue(selectedId);
  showToast(LANG==='ro'?'Recenzie publicată!':'Review published!', 'success');
}

// ── EDIT VENUE ───────────────────────────────────────────────────
function openEditModal() {
  const v = VENUES.find(x => x.id === selectedId); if (!v) return;
  editingId = v.id; editGeoLat = v.lat; editGeoLng = v.lng;
  document.getElementById('e-name').value = v.name || '';
  document.getElementById('e-type').value = v.type || 'parc_exterior';
  document.getElementById('e-stare').value = v.stare || 'necunoscuta';
  document.getElementById('e-city').value = v.city || '';
  document.getElementById('e-county').value = v.county || '';
  document.getElementById('e-address').value = v.address || '';
  document.getElementById('e-sector').value = v.sector || '';
  document.getElementById('e-tables').value = v.tables || '';
  document.getElementById('e-hours').value = v.hours || '';
  document.getElementById('e-tarif').value = v.tarif || '';
  document.getElementById('e-website').value = v.website || '';
  document.getElementById('e-tags').value = (v.tags || []).join(', ');
  document.getElementById('e-desc').value = v.desc || v.description || '';
  document.getElementById('e-lat').value = v.lat || '';
  document.getElementById('e-lng').value = v.lng || '';
  document.getElementById('e-acces_gratuit').checked = !!v.acces_gratuit;
  document.getElementById('e-nocturna').checked = !!v.nocturna;
  document.getElementById('e-fileuri').checked = !!v.fileuri;
  document.getElementById('e-verificat').checked = !!v.verificat;
  document.getElementById('e-geo-status').textContent = '';
  document.getElementById('edit-modal').classList.add('open');
  renderEditPhotoStrip(v);
}

function renderEditPhotoStrip(v) {
  const strip = document.getElementById('e-photo-strip'); if (!strip) return;
  const photos = v.photos || [];
  strip.innerHTML = photos.map(url => `<img class="photo-thumb" src="${url}" loading="lazy" onclick="openLightbox('${url}')">`).join('');
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'photo-upload-btn';
  btn.innerHTML = `<span style="font-size:20px">📷</span><span>${s('addPhoto')}</span>`;
  btn.onclick = () => document.getElementById('e-photo-input').click();
  strip.appendChild(btn);
}

async function handlePhotoUpload(event) {
  const files = Array.from(event.target.files);
  if (!files.length || !editingId) return;
  const statusEl = document.getElementById('e-photo-status');
  statusEl.textContent = s('photoUploading', files.length);
  let uploaded = 0;
  for (const file of files) {
    if (file.size > 5 * 1024 * 1024) { showToast(s('photoTooLarge'), 'error'); continue; }
    const url = await uploadPhoto(editingId, file);
    if (url) {
      await addPhotoToVenue(editingId, url);
      const v = VENUES.find(x => x.id === editingId);
      if (v) { v.photos = [...(v.photos||[]), url]; renderEditPhotoStrip(v); }
      uploaded++;
    }
  }
  statusEl.textContent = uploaded ? s('photoUploaded', uploaded) : '';
  event.target.value = '';
}

function openLightbox(url) {
  const lb = document.createElement('div');
  lb.className = 'photo-lightbox';
  lb.innerHTML = `<button class="photo-lightbox-close" onclick="this.parentElement.remove()">✕</button><img src="${url}">`;
  lb.onclick = (e) => { if (e.target === lb) lb.remove(); };
  document.body.appendChild(lb);
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.remove('open');
  editingId = null; editGeoLat = null; editGeoLng = null;
}

async function submitEdit() {
  const name = document.getElementById('e-name').value.trim();
  const address = document.getElementById('e-address').value.trim();
  if (!name || !address) { alert('Numele și adresa sunt obligatorii.'); return; }
  const lat = parseFloat(document.getElementById('e-lat').value) || editGeoLat;
  const lng = parseFloat(document.getElementById('e-lng').value) || editGeoLng;
  if (!lat || !lng) { alert(s('alertCoords')); return; }
  const tags = document.getElementById('e-tags').value.split(',').map(t => t.trim()).filter(Boolean);
  const fields = {
    name, type: document.getElementById('e-type').value, stare: document.getElementById('e-stare').value,
    city: document.getElementById('e-city').value.trim(),
    county: document.getElementById('e-county').value.trim(),
    address, sector: document.getElementById('e-sector').value.trim() || null,
    tables: parseInt(document.getElementById('e-tables').value) || null,
    hours: document.getElementById('e-hours').value.trim() || null,
    tarif: document.getElementById('e-tarif').value.trim() || null,
    website: document.getElementById('e-website').value.trim() || null,
    tags, description: document.getElementById('e-desc').value.trim() || null,
    lat, lng,
    acces_gratuit: document.getElementById('e-acces_gratuit').checked,
    nocturna: document.getElementById('e-nocturna').checked,
    fileuri: document.getElementById('e-fileuri').checked,
    verificat: document.getElementById('e-verificat').checked,
  };
  showToast('Saving…', 'info');
  const saved = await updateVenue(editingId, fields);
  if (!saved) return;
  const idx = VENUES.findIndex(x => x.id === editingId);
  if (idx !== -1) VENUES[idx] = { ...VENUES[idx], ...saved, desc: saved.description || '' };
  closeEditModal(); renderList(); renderMarkers(); selectVenue(editingId);
  showToast(LANG==='ro'?'Locație actualizată!':'Venue updated!', 'success');
}

function setGeoStatus(msg, type) {
  const el = document.getElementById('geo-status'); if(!el) return;
  const colors = { info:'var(--ink-faint)', success:'#15803d', error:'#dc2626' };
  el.style.color = colors[type] || colors.info; el.textContent = msg;
}

// ── LANG ──────────────────────────────────────────────────────────
function setLang(lang) {
  LANG = lang; localStorage.setItem('ttportal-lang', lang);
  document.getElementById('lang-en').classList.toggle('active', lang==='en');
  document.getElementById('lang-ro').classList.toggle('active', lang==='ro');
  applyLang(); renderList();
  if (selectedId) selectVenue(selectedId);
}

function applyLang() {
  document.querySelector('.logo-sub').textContent = s('subtitle');
  document.querySelector('[data-i18n="addVenue"]').textContent = s('addVenue');
  const si = document.getElementById('search-input'); if(si) si.placeholder = s('searchPh');
  document.getElementById('city-modal-title').textContent = s('cityModal');
  const nearLbl = document.getElementById('btn-near-label');
  if (nearLbl) nearLbl.textContent = nearMeActive ? s('nearMe') : s('nearMeOff');
  updateLegend();
}

function updateLegend(el) {
  const d = el || document.getElementById('map-legend'); if (!d) return;
  d.innerHTML = `
    <div style="font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:#888;margin-bottom:6px;font-weight:600">${LANG==='ro'?'Tip / Stare':'Type / Condition'}</div>
    <div class="legend-row"><div class="legend-marker" style="background:#22c55e">🏓</div>${LANG==='ro'?'Parc – bună':'Park – good'}</div>
    <div class="legend-row"><div class="legend-marker" style="background:#f59e0b">🏓</div>${LANG==='ro'?'Parc – acceptabilă':'Park – fair'}</div>
    <div class="legend-row"><div class="legend-marker" style="background:#ef4444">🏓</div>${LANG==='ro'?'Parc – deteriorată':'Park – poor'}</div>
    <div class="legend-row"><div class="legend-marker" style="background:#94a3b8">🏓</div>${LANG==='ro'?'Parc – necunoscută':'Park – unknown'}</div>
    <div class="legend-row"><div class="legend-marker" style="background:#1a5080">🏢</div>${LANG==='ro'?'Sală indoor':'Indoor venue'}</div>`;
}

// ── NEAR ME ───────────────────────────────────────────────────────
function toggleNearMe() {
  const btn = document.getElementById('btn-near');
  const lbl = document.getElementById('btn-near-label');
  if (nearMeActive) {
    nearMeActive = false; btn.classList.remove('active');
    if (lbl) lbl.textContent = s('nearMeOff');
    renderList(); renderMarkers(); return;
  }
  if (userLat && userLng) {
    nearMeActive = true; btn.classList.add('active');
    if (lbl) lbl.textContent = s('nearMe');
    renderList(); renderMarkers();
    map.flyTo([userLat, userLng], 14, {duration:0.8}); return;
  }
  showToast(LANG==='ro'?'Se caută locația…':'Getting location…', 'info');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userLat = pos.coords.latitude; userLng = pos.coords.longitude;
      nearMeActive = true; btn.classList.add('active');
      if (lbl) lbl.textContent = s('nearMe');
      addUserMarker();
      renderList(); renderMarkers();
      map.flyTo([userLat, userLng], 14, {duration:0.8});
      showToast(LANG==='ro'?'Sortate după distanță':'Sorted by distance', 'success');
    },
    (err) => showToast((LANG==='ro'?'Locație indisponibilă: ':'Location unavailable: ') + err.message, 'error'),
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

// ── UI HELPERS ────────────────────────────────────────────────────
function toggleSidebar() {
  sidebarCollapsed = !sidebarCollapsed;
  document.getElementById('sidebar').classList.toggle('collapsed', sidebarCollapsed);
  document.getElementById('sidebar-toggle-icon').textContent = sidebarCollapsed ? '▲' : '▼';
  updateSidebarToggleLabel();
}

function updateSidebarToggleLabel() {
  const lbl = document.getElementById('sidebar-toggle-label'); if (!lbl) return;
  const count = document.querySelectorAll('.venue-card').length;
  lbl.textContent = sidebarCollapsed
    ? (count + ' ' + (LANG==='ro'?'locații':'venues') + ' — tap')
    : (LANG==='ro'?'Ascunde lista':'Hide list');
}

function resetView(e) {
  if (e && e.preventDefault) e.preventDefault();
  closeDetail();
  map.flyTo(currentCity ? [currentCity.lat, currentCity.lng] : ROMANIA_CENTER,
            currentCity ? (currentCity.zoom || 12) : ROMANIA_ZOOM, {duration:0.8});
  document.getElementById('search-input').value = '';
  currentSearch = ''; currentFilter = 'all'; nearMeActive = false;
  document.getElementById('btn-near').classList.remove('active');
  document.querySelectorAll('.filter-chip').forEach((c,i) => c.classList.toggle('active', i===0));
  renderList(); renderMarkers();
}

// ── INIT ──────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('lang-en').classList.toggle('active', LANG==='en');
  document.getElementById('lang-ro').classList.toggle('active', LANG==='ro');
  initMap();
  await loadCities();
  initSplash();
  applyLang();
});
