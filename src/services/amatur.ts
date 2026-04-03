/**
 * Service to fetch and parse upcoming amateur table tennis tournament data
 * from the AmaTur circuit (amatur.ro/tenisdemasa/turnee?wh=Programate).
 *
 * Uses the w_f.php endpoint that powers the "Programate" (scheduled) tab.
 */

const WF_URL = 'https://www.amatur.ro/tenisdemasa/w_f.php';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export interface AmaturEvent {
  id: string;           // e.g. "3943"
  city: string;
  address: string | null; // street address at the venue
  name: string | null;    // tournament name, e.g. "Speed Of Light Cup IV"
  dateLabel: string;      // e.g. "04 apr 2026"
  startDate: Date;
  categories: string[];   // day-by-category split, e.g. ["1st day - E,O", "2nd day - A,H"]
  forumUrl: string | null;
  mapsUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  tables: number | null;       // total tables at the venue (from left-side icon)
  categorySpots: { category: string; spots: number }[]; // per-category available spots
}

let cache: { data: AmaturEvent[]; ts: number } | null = null;

const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  // Romanian month abbreviations
  ian: 0, fen: 1, mai: 4, iun: 5, iul: 6,
};

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/\u201e|\u201d|\u201c/g, '"')
    .replace(/\u00A0/g, ' ');
}

export function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, '')).trim();
}

export function parseDate(dateHtml: string): { label: string; date: Date } {
  // w2 div contains: <b>04 apr</b><br>2026  or  <b>30 mar</b><br>2026<br>Mon
  // Replace <br> with spaces first so "mar<br>2026" becomes "mar 2026"
  const stripped = stripTags(dateHtml.replace(/<br\s*\/?>/gi, ' ')).replace(/\s+/g, ' ').trim();
  // e.g. "04 apr 2026 Mon" or "04 apr 2026"
  const match = stripped.match(/(\d{1,2})\s+([a-z]{3})\s+(\d{4})/i);
  if (match) {
    const day = parseInt(match[1], 10);
    const monthStr = match[2].toLowerCase();
    const year = parseInt(match[3], 10);
    const monthIdx = MONTH_MAP[monthStr] ?? 0;
    return {
      label: `${match[1]} ${match[2]} ${match[3]}`,
      date: new Date(year, monthIdx, day),
    };
  }
  return { label: stripped, date: new Date() };
}

export function parseTourneeHtml(html: string): AmaturEvent[] {
  const events: AmaturEvent[] = [];

  // Each event block: <div class="l1 lx"> or <div class="l2 lx">
  const blocks = html.split(/<div\s+class="l[12]\s+lx">/i).slice(1);

  for (const block of blocks) {
    // --- ID ---
    const idMatch = block.match(/<div\s+class="idt">\s*(\d+)\s*<\/div>/i);
    const id = idMatch ? idMatch[1] : `amatur-${events.length}`;

    // --- Date ---
    const w2Match = block.match(/<div\s+class="w2\s+bo">([\s\S]*?)<\/div>\s*<\/div>/i)
      ?? block.match(/<div\s+class="w2\s+bo">([\s\S]*?)<\/div>/i);
    const dateInfo = w2Match ? parseDate(w2Match[1]) : { label: '', date: new Date() };

    // --- City & Venue ---
    const w3Match = block.match(/<div\s+class="w3\s+bo"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i);
    const w3Content = w3Match ? w3Match[1] : '';

    // City: inside <span style="color:...">CityName<br>
    const citySpanMatch = w3Content.match(/<span\s+style="color:[^"]*;">([^<]+)/i);
    const city = citySpanMatch ? decodeHtmlEntities(citySpanMatch[1]).trim() : '';

    // Address: inside the nested span with font-size:12px, between dashes
    const addressMatch = w3Content.match(/<span\s+style="font-size:12px[^"]*"[^>]*>-\s*(.*?)\s*-<\/span>/i);
    const address = addressMatch ? decodeHtmlEntities(addressMatch[1]).trim() : null;

    // Tournament name: inside <div class="d2d">
    const nameMatch = w3Content.match(/<div\s+class="d2d">([\s\S]*?)<\/div>/i);
    const rawName = nameMatch ? stripTags(nameMatch[1]) : null;
    const name = rawName && rawName.length > 0 ? rawName.replace(/^[„""]+|[""„]+$/g, '').trim() : null;

    // Forum URL: first <a href="...tenisdemasa.ro/forum...">
    const forumMatch = w3Content.match(/href="(https?:\/\/www\.tenisdemasa\.ro\/forum[^"]+)"/i);
    const forumUrl = forumMatch ? forumMatch[1] : null;

    // Categories: <div class="day"...>
    const categories: string[] = [];
    const dayMatches = w3Content.matchAll(/<div\s+class="day"[^>]*>([\s\S]*?)(?:<\/div>|<\/b>)/gi);
    for (const dm of dayMatches) {
      const catText = stripTags(dm[1]).replace(/\s+/g, ' ');
      if (catText) categories.push(catText);
    }

    // Tables count: the <span> inside .tdimg at the end of w3
    const tablesMatch = w3Content.match(/<div\s+class="tdimg"[^>]*>.*?<span>(\d+)<\/span>/is);
    const tables = tablesMatch ? parseInt(tablesMatch[1], 10) : null;

    // --- Google Maps URL & coordinates ---
    const mapsMatch = block.match(/href="(https?:\/\/www\.google\.[^"]*maps[^"]+)"/i);
    const mapsUrl = mapsMatch ? mapsMatch[1] : null;

    // Extract lat/lng from Google Maps URL: @lat,lng or /place/.../@lat,lng
    let latitude: number | null = null;
    let longitude: number | null = null;
    if (mapsUrl) {
      const coordMatch = mapsUrl.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
      if (coordMatch) {
        latitude = parseFloat(coordMatch[1]);
        longitude = parseFloat(coordMatch[2]);
      }
    }

    // --- Per-category spots (from w4 + w6 divs) ---
    const categorySpots: { category: string; spots: number }[] = [];

    // Category names from w4: <h2>Elite</h2>, <h2>Open</h2>, etc.
    const w4Match = block.match(/<div\s+class="w4\s+bo">([\s\S]*?)<\/div>\s*<\/div>/i);
    const catNames: string[] = [];
    if (w4Match) {
      const h2Matches = w4Match[1].matchAll(/<h2>([^<]+)<\/h2>/gi);
      for (const h2 of h2Matches) {
        catNames.push(h2[1].trim());
      }
    }

    // Spots from w6: each data row has 4 xd divs, 3rd is "Locuri"
    const w6Match = block.match(/<div\s+class="w6\s+bo">([\s\S]*?)<\/div>\s*<\/div>/i);
    if (w6Match && catNames.length > 0) {
      const w6Content = w6Match[1];
      // Split by clear:both to get rows, skip the header row (first segment)
      const rows = w6Content.split(/clear:\s*both/i).slice(1);
      for (let ri = 0; ri < Math.min(rows.length, catNames.length); ri++) {
        // Extract all xd values in this row
        const xdValues = [...rows[ri].matchAll(/<div\s+class="xd">([\s\S]*?)<\/div>/gi)]
          .map(m => stripTags(m[1]));
        // 3rd xd (index 2) is "Locuri", but after the split the first xd in the row
        // might contain the end of the previous row. Let's find the number.
        // The pattern per row is: xd(empty) xd(empty) xd(SPOTS) xd(empty)
        const spotsVal = xdValues.find(v => /^\d+$/.test(v));
        if (spotsVal) {
          categorySpots.push({ category: catNames[ri], spots: parseInt(spotsVal, 10) });
        }
      }
    }

    if (!city) continue;

    events.push({
      id,
      city,
      address,
      name: name || null,
      dateLabel: dateInfo.label,
      startDate: dateInfo.date,
      categories,
      forumUrl,
      mapsUrl,
      latitude,
      longitude,
      tables,
      categorySpots,
    });
  }

  return events;
}

export async function getAmaturEvents(): Promise<{ data: AmaturEvent[]; error: string | null }> {
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return { data: cache.data, error: null };
  }

  try {
    const body = new URLSearchParams({
      turnee: '1',
      limit: '100',
      start: '0',
      select: '1 and cls=0 ORDER by cls=0 desc, case when cls>0 then data end desc, case when cls>0 then ID end desc, case when cls=0 then data end asc, case when cls=0 then ID end asc ',
    });

    const response = await fetch(WF_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      return { data: cache?.data ?? [], error: `HTTP ${response.status}` };
    }
    const html = await response.text();
    const events = parseTourneeHtml(html);
    cache = { data: events, ts: Date.now() };
    return { data: events, error: null };
  } catch (err: any) {
    return { data: cache?.data ?? [], error: err.message ?? 'Network error' };
  }
}

export function getUpcomingAmaturEvents(events: AmaturEvent[]): AmaturEvent[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return events.filter(e => e.startDate >= now);
}
