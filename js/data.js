// ── GLOBAL STATE ─────────────────────────────────────────────────
let VENUES = [];
let CITIES = [];
let currentCity = null; // null = show all
let map, markers = {}, selectedId = null, currentFilter = 'all', currentSearch = '';
let addingMode = false, pendingVenue = null;
let geocodedLat = null, geocodedLng = null;
let editGeoLat = null, editGeoLng = null;
let userLat = null, userLng = null, nearMeActive = false;
let editingId = null;
let pendingReviewId = null, reviewRating = 0;
let sidebarCollapsed = false;

const STARE_COLOR = {buna:'#22c55e', acceptabila:'#f59e0b', deteriorata:'#ef4444', necunoscuta:'#94a3b8', profesionala:'#1a5080'};
const TYPE_ICON = {parc_exterior:'🏓', sala_indoor:'🏢'};

// Romania default view
const ROMANIA_CENTER = [45.9, 24.9];
const ROMANIA_ZOOM = 7;

// ── LOAD CITIES ───────────────────────────────────────────────────
async function loadCities() {
  const { data, error } = await sb.from('cities').select('*').eq('active', true).order('venue_count', { ascending: false });
  if (error) { console.error('Cities load error:', error); return []; }
  CITIES = data || [];
  return CITIES;
}

// ── LOAD VENUES ───────────────────────────────────────────────────
async function loadVenues(cityName = null) {
  if (typeof showToast !== 'undefined') showToast(
    cityName ? `Se încarcă ${cityName}…` : 'Se încarcă locațiile…', 'info'
  );

  let query = sb.from('venues').select('*').order('created_at');
  if (cityName) query = query.eq('city', cityName);

  const { data, error } = await query;
  if (error) {
    if (typeof showToast !== 'undefined') showToast('Eroare: ' + error.message, 'error');
    return;
  }

  // First-time seed for București only
  if ((!cityName || cityName === 'București') && data.length === 0) {
    if (typeof showToast !== 'undefined') showToast('Prima rulare — se populează București…', 'info');
    const { error: seedErr } = await sb.from('venues').insert(SEED);
    if (seedErr) { if (typeof showToast !== 'undefined') showToast('Eroare seed: ' + seedErr.message, 'error'); return; }
    const { data: seeded } = await sb.from('venues').select('*').order('created_at');
    VENUES = normalizeVenues(seeded || []);
  } else {
    VENUES = normalizeVenues(data);
  }

  const venueIds = VENUES.map(v => v.id);
  if (venueIds.length) {
    const { data: reviews } = await sb.from('reviews').select('*')
      .in('venue_id', venueIds)
      .order('created_at', { ascending: false });
    if (reviews) {
      reviews.forEach(r => {
        const v = VENUES.find(v => v.id === r.venue_id);
        if (v) v.reviews.push(r);
      });
    }
  }

  if (typeof renderList !== 'undefined') renderList();
  if (typeof renderMarkers !== 'undefined') renderMarkers();
  if (typeof showToast !== 'undefined') showToast(VENUES.length + (LANG === 'ro' ? ' locații încărcate' : ' venues loaded'), 'success');
}

function normalizeVenues(rows) {
  return rows.map(r => ({
    ...r,
    desc: r.description || '',
    reviews: [],
    photos: r.photos || [],
    city: r.city || 'București',
    county: r.county || '',
  }));
}

// ── SWITCH CITY ───────────────────────────────────────────────────
async function switchCity(cityObj) {
  currentCity = cityObj;
  localStorage.setItem('ttportal-city', JSON.stringify(cityObj));
  document.getElementById('current-city-label').textContent = cityObj.name;
  await loadVenues(cityObj.name);
  if (typeof map !== 'undefined') {
    map.flyTo([cityObj.lat, cityObj.lng], cityObj.zoom || 12, { duration: 1 });
  }
}

// ── SUPABASE CRUD ─────────────────────────────────────────────────
async function saveVenue(venue) {
  const { name, type, city, county, sector, address, lat, lng, tables, stare, hours,
    description, tags, acces_gratuit, nocturna, fileuri, tarif, website, verificat } = venue;
  const { data, error } = await sb.from('venues').insert([
    { name, type, city, county, sector, address, lat, lng, tables, stare, hours,
      description, tags, acces_gratuit, nocturna, fileuri, tarif, website, verificat }
  ]).select().single();
  if (error) { if (typeof showToast !== 'undefined') showToast('Eroare: ' + error.message, 'error'); return null; }
  return data;
}

async function saveReview(venueId, review) {
  const { data, error } = await sb.from('reviews').insert([{
    venue_id: venueId, name: review.name, rating: review.rating, text: review.text,
  }]).select().single();
  if (error) { if (typeof showToast !== 'undefined') showToast('Eroare recenzie: ' + error.message, 'error'); return null; }
  return data;
}

async function updateVenue(id, fields) {
  const { data, error } = await sb.from('venues').update(fields).eq('id', id).select().single();
  if (error) { if (typeof showToast !== 'undefined') showToast('Eroare: ' + error.message, 'error'); return null; }
  return data;
}

async function uploadPhoto(venueId, file) {
  const ext = file.name.split('.').pop();
  const path = `venues/${venueId}/${Date.now()}.${ext}`;
  const { error: upErr } = await sb.storage.from('venue-photos').upload(path, file, { upsert: false });
  if (upErr) { if (typeof showToast !== 'undefined') showToast('Eroare upload: ' + upErr.message, 'error'); return null; }
  const { data } = sb.storage.from('venue-photos').getPublicUrl(path);
  return data.publicUrl;
}

async function addPhotoToVenue(venueId, url) {
  const v = VENUES.find(x => x.id === venueId);
  const photos = [...(v?.photos || []), url];
  const { data, error } = await sb.from('venues').update({ photos }).eq('id', venueId).select().single();
  if (error) { if (typeof showToast !== 'undefined') showToast('Eroare foto: ' + error.message, 'error'); return null; }
  return data;
}

// ── SEED DATA (București) ─────────────────────────────────────────
const SEED = [
  {name:"Parcul Național – Aleea Belvedere",type:"parc_exterior",city:"București",county:"Ilfov",sector:"Sector 1",address:"Aleea Belvedere, Sector 1, București",lat:44.4468,lng:26.0834,tables:2,stare:"buna",hours:"Acces liber",description:"Zona Belvedere din Parcul Național.",tags:["gratuit","exterior"],acces_gratuit:true,nocturna:false,fileuri:true,verificat:false},
  {name:"Parcul Național – Amfiteatrul Eminescu",type:"parc_exterior",city:"București",county:"Ilfov",sector:"Sector 1",address:"Lângă Amfiteatrul Mihai Eminescu, Parcul Național, Sector 1",lat:44.4441,lng:26.0798,tables:2,stare:"buna",hours:"Acces liber",description:"Mese lângă amfiteatrul Mihai Eminescu.",tags:["gratuit","exterior","amfiteatru"],acces_gratuit:true,nocturna:false,fileuri:true,verificat:false},
  {name:"Parcul IOR (Alexandru Ioan Cuza)",type:"parc_exterior",city:"București",county:"Ilfov",sector:"Sector 3",address:"Str. Liviu Rebreanu, Sector 3, București",lat:44.4225,lng:26.1312,tables:6,stare:"buna",hours:"Acces liber",description:"Parc renovat cu mese în mai multe zone.",tags:["gratuit","exterior","lac"],acces_gratuit:true,nocturna:false,fileuri:true,verificat:true},
  {name:"Parcul Drumul Taberei (Moghioroș)",type:"parc_exterior",city:"București",county:"Ilfov",sector:"Sector 6",address:"Bd. Timișoara / Str. Brașov, Sector 6, București",lat:44.4198,lng:26.0218,tables:4,stare:"acceptabila",hours:"Acces liber",description:"Parc mare din Sectorul 6.",tags:["gratuit","exterior","fotbal"],acces_gratuit:true,nocturna:false,fileuri:true,verificat:false},
  {name:"Parcul Tineretului",type:"parc_exterior",city:"București",county:"Ilfov",sector:"Sector 4",address:"Bd. Tineretului, Sector 4, București",lat:44.4005,lng:26.1089,tables:4,stare:"buna",hours:"Acces liber",description:"Unul dintre cele mai mari parcuri din Sectorul 4.",tags:["gratuit","exterior","fitness","lac"],acces_gratuit:true,nocturna:false,fileuri:true,verificat:false},
  {name:"Parcul Carol I",type:"parc_exterior",city:"București",county:"Ilfov",sector:"Sector 4",address:"Bd. Mărășești, Sector 4, București",lat:44.4198,lng:26.0855,tables:3,stare:"buna",hours:"Acces liber",description:"Parc istoric renovat.",tags:["gratuit","exterior","istoric"],acces_gratuit:true,nocturna:false,fileuri:true,verificat:true},
  {name:"Parcul Kiseleff",type:"parc_exterior",city:"București",county:"Ilfov",sector:"Sector 1",address:"Șos. Kiseleff, Sector 1, București",lat:44.4668,lng:26.0732,tables:2,stare:"buna",hours:"Acces liber",description:"Parc central-nord.",tags:["gratuit","exterior"],acces_gratuit:true,nocturna:false,fileuri:true,verificat:false},
  {name:"Parcul Tei",type:"parc_exterior",city:"București",county:"Ilfov",sector:"Sector 2",address:"Șos. Ștefan cel Mare / Str. Dobrogeanu Gherea, Sector 2",lat:44.4612,lng:26.1338,tables:3,stare:"acceptabila",hours:"Acces liber",description:"Parc cu lac în Sectorul 2.",tags:["gratuit","exterior","lac"],acces_gratuit:true,nocturna:false,fileuri:true,verificat:false},
  {name:"Ping Pong Academy",type:"sala_indoor",city:"București",county:"Ilfov",sector:"Sector 5",address:"Str. Hațegana nr. 17, Sector 5, București",lat:44.4198,lng:26.0613,tables:12,stare:"profesionala",hours:"Luni–Duminică (verificați pagina)",description:"Club complet cu antrenori, echipă Divizia A.",tags:["plată","indoor","antrenori","Divizia A"],acces_gratuit:false,nocturna:true,tarif:"33–43 lei/oră",website:"https://www.facebook.com/clubsportivpingpongacademy",verificat:true},
  {name:"Ping Poc",type:"sala_indoor",city:"București",county:"Ilfov",sector:"Sector 4",address:"Șos. Berceni nr. 104, bl. turn, et. 3, Sector 4",lat:44.3942,lng:26.1025,tables:5,stare:"profesionala",hours:"Zilnic 09:00–23:00",description:"Nou deschis 2024. Separeu privat + spațiu comun.",tags:["plată","indoor","separeu","rezervare online"],acces_gratuit:false,nocturna:true,tarif:"25–35 lei/oră",website:"https://pingpoc.ro",verificat:true},
  {name:"TSP Vibe",type:"sala_indoor",city:"București",county:"Ilfov",sector:"Sector 3",address:"Șos. Dudești-Pantelimon nr. 44, incinta Antilopa, Sector 3",lat:44.4385,lng:26.1944,tables:9,stare:"profesionala",hours:"Verificați pagina Facebook",description:"540 mp, PVC. Concursuri seara.",tags:["plată","indoor","robot","concursuri"],acces_gratuit:false,nocturna:true,tarif:"25–35 lei/oră",website:"https://www.facebook.com/groups/3146582045558341/",verificat:true},
  {name:"PingPro",type:"sala_indoor",city:"București",county:"Ilfov",sector:"Sector 1",address:"Str. Copilului nr. 20A, Domenii, Sector 1, București",lat:44.4558,lng:26.0718,tables:null,stare:"profesionala",hours:"D-J 08:30–22:30, V-S 08:30–23:30",description:"Rezervare online cu alegere masă.",tags:["plată","indoor","rezervare online","Joola"],acces_gratuit:false,nocturna:true,tarif:"variabil",website:"https://www.pingpro.ro",verificat:true},
  {name:"IDM Club – Tenis de Masă",type:"sala_indoor",city:"București",county:"Ilfov",sector:"Sector 6",address:"Splaiul Independenței nr. 319B, Sector 6, București",lat:44.4302,lng:26.0392,tables:null,stare:"profesionala",hours:"L-J 09:00–01:00, V-S 09:00–03:00",description:"Cel mai mare club din București (8300 mp).",tags:["plată","indoor","bowling","fitness","Butterfly"],acces_gratuit:false,nocturna:true,tarif:"card 150 lei/an",website:"https://www.idmclub.ro",verificat:true},
  {name:"eWe Ping Pong",type:"sala_indoor",city:"București",county:"Ilfov",sector:"Ilfov",address:"Str. Fortului nr. 81, Domnești, Ilfov",lat:44.4178,lng:26.0782,tables:7,stare:"profesionala",hours:"Zilnic 09:00–22:00",description:"Cafenea inclusă. Recomandat Militari/Ghencea.",tags:["plată","indoor","cafenea","Joola","ITTF"],acces_gratuit:false,nocturna:true,tarif:"35 lei/oră",website:"https://ewepingpong.ro",verificat:true},
];
