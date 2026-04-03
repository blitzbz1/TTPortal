import {
  decodeHtmlEntities,
  stripTags,
  parseDate,
  parseTourneeHtml,
  getUpcomingAmaturEvents,
  type AmaturEvent,
} from '../amatur';

// ─── Helper utilities ────────────────────────────────────────────────────────

describe('decodeHtmlEntities', () => {
  it('decodes common HTML entities', () => {
    expect(decodeHtmlEntities('&amp; &lt; &gt; &quot; &#39;')).toBe('& < > " \'');
  });

  it('decodes numeric entities', () => {
    expect(decodeHtmlEntities('&#65;&#66;')).toBe('AB');
  });

  it('normalizes smart quotes', () => {
    expect(decodeHtmlEntities('\u201eCupa\u201d')).toBe('"Cupa"');
  });

  it('replaces &nbsp; with space', () => {
    expect(decodeHtmlEntities('hello&nbsp;world')).toBe('hello world');
  });

  it('returns plain text unchanged', () => {
    expect(decodeHtmlEntities('plain text')).toBe('plain text');
  });
});

describe('stripTags', () => {
  it('removes HTML tags and trims', () => {
    expect(stripTags('<b>hello</b> <i>world</i>')).toBe('hello world');
  });

  it('decodes entities after stripping', () => {
    expect(stripTags('<span>&amp; done</span>')).toBe('& done');
  });

  it('returns empty string for empty tags', () => {
    expect(stripTags('<div></div>')).toBe('');
  });
});

// ─── Date parsing ────────────────────────────────────────────────────────────

describe('parseDate', () => {
  it('parses "<b>04 apr</b><br>2026"', () => {
    const result = parseDate('<b>04 apr</b><br>2026');
    expect(result.label).toBe('04 apr 2026');
    expect(result.date.getFullYear()).toBe(2026);
    expect(result.date.getMonth()).toBe(3); // April = 3
    expect(result.date.getDate()).toBe(4);
  });

  it('parses "<b>30 mar</b><br>2026<br>Mon" with day-of-week', () => {
    const result = parseDate('<b>30 mar</b><br>2026<br>Mon');
    expect(result.label).toBe('30 mar 2026');
    expect(result.date.getFullYear()).toBe(2026);
    expect(result.date.getMonth()).toBe(2); // March = 2
    expect(result.date.getDate()).toBe(30);
  });

  it('parses self-closing <br/> tags', () => {
    const result = parseDate('<b>15 jun</b><br/>2026');
    expect(result.date.getMonth()).toBe(5); // June = 5
    expect(result.date.getDate()).toBe(15);
  });

  it('falls back to current date for unparseable input', () => {
    const before = Date.now();
    const result = parseDate('<div>???</div>');
    expect(result.date.getTime()).toBeGreaterThanOrEqual(before - 1000);
  });
});

// ─── Full HTML parsing ───────────────────────────────────────────────────────

// Minimal fixture based on the actual amatur.ro w_f.php response structure
const FIXTURE_HTML = `<script>
$(document).ready(function(){
$(".tdimg").off().on('click', function(e) {
   $.post("/tenisdemasa/traffic.php", {page:"turnee click", what:$(this).attr('name') });
	});
$(".w3").off().on('click', function(e) {
   $.post("/tenisdemasa/traffic.php", {page:"turnee click", what:$(this).attr('name') });
	});
});
</script>
<div class="l1 lx">
<div class="ll1">
<div class="w1 bo">1<br><div class="idt">3943</div></div>
<div class="w2 bo"><b>30 mar</b><br>2026<br>Mon<div style="clear:both;"></div><a href="https://www.google.com/maps/place/Calea+Timi%C8%99orii+30,+Arad/@46.154805,21.32121,15z/" target="_blank"><div class="tdimg" name="gmaps_3943"><img src="images/gmaps.png"></div></a></div>
<div class="w3 bo" name="1302277 Arad">
    <a href="https://www.tenisdemasa.ro/forum/threads/1302277" target="_blank">
        <div class="t2l">
          <span style="color:#00bb00;">Arad <br><span style="font-size:12px; font-weight:normal;padding-left:20px;">- Calea Timisorii nr.30 -</span></span>        </div>
        <div class="d2d">
          \u201eSpeed Of Light Cup IV\u201d        </div>
    </a>
<div class="day";>1<sup>st</sup> day - <b>H</div></b><div class="day";>3<sup>rd</sup> day - <b>E,O</div></b><div class="day";>4<sup>th</sup> day - <b>A</div></b><div class="tdimg" style="float:right;"><img src="images/europa-25.jpg"><span>6</span></div></div>
</div>
<div class="ll1">
<div class="w4 bo"><div class="sys"></div><div style="height:5px; clear:both"></div><div class="sys fd"><h1></h1><h2>Elite</h2></div><div class="sys fd"><h1></h1><h2>Open</h2></div><div class="sys fd"><h1></h1><h2>Avansati</h2></div><div class="sys fd"><h1></h1><h2>Hobby</h2></div><div class="sys"></div></div>
<div class="w6 bo">
    <a href="/tenisdemasa/Cls_turneu/3943" target="_blank">
<div class="xd">Data</div><div class="xd">Ora</div><div class="xd">Locuri</div><div class="xd">Inscrieri</div><div style="height:5px; clear:both"></div><div class="xd"></div><div class="xd"></div><div class="xd">10</div>
        <div class="xd"></div><div style="clear:both"></div><div class="xd"></div><div class="xd"></div><div class="xd">16</div>
        <div class="xd"></div><div style="clear:both"></div><div class="xd"></div><div class="xd"></div><div class="xd">24</div>
        <div class="xd"></div><div style="clear:both"></div><div class="xd"></div><div class="xd"></div><div class="xd">24</div>
        <div class="xd"></div><div style="clear:both"></div><div class="xa">Act: 2026-03-25 09:36</div>    </a>
</div>
</div>
</div>
<div class="l2 lx">
<div class="ll1">
<div class="w1 bo">2<br><div class="idt">3934</div></div>
<div class="w2 bo"><b>04 apr</b><br>2026<div style="clear:both;"></div></div>
<div class="w3 bo" name="1302235 Curtea de Arges">
    <a href="https://www.tenisdemasa.ro/forum/threads/1302235" target="_blank">
        <div class="t2l">
          <span style="color:#e10000;">Curtea de Arge\u0219 <br><span style="font-size:12px; font-weight:normal;padding-left:20px;">- Sala de sport Stadionul Municipal -</span></span>        </div>
        <div class="d2d">
                  </div>
    </a>
<div class="tdimg" style="float:right;"><img src="images/europa-25.jpg"><span>16</span></div></div>
</div>
<div class="ll1">
<div class="w4 bo"><div class="sys"></div><div style="height:5px; clear:both"></div><div class="sys fd"><h1></h1><h2>Elite</h2></div><div class="sys fd"><h1></h1><h2>Open</h2></div><div class="sys fd"><h1></h1><h2>Avansati</h2></div><div class="sys fd"><h1></h1><h2>Hobby</h2></div><div class="sys"></div></div>
<div class="w6 bo">
    <a href="/tenisdemasa/Cls_turneu/3934" target="_blank">
<div class="xd">Data</div><div class="xd">Ora</div><div class="xd">Locuri</div><div class="xd">Inscrieri</div><div style="height:5px; clear:both"></div><div class="xd"></div><div class="xd"></div><div class="xd">24</div>
        <div class="xd"></div><div style="clear:both"></div><div class="xd"></div><div class="xd"></div><div class="xd">48</div>
        <div class="xd"></div><div style="clear:both"></div><div class="xd"></div><div class="xd"></div><div class="xd">48</div>
        <div class="xd"></div><div style="clear:both"></div><div class="xd"></div><div class="xd"></div><div class="xd">24</div>
        <div class="xd"></div><div style="clear:both"></div><div class="xa">Act: 2026-03-12 13:17</div>    </a>
</div>
</div>
</div>`;

describe('parseTourneeHtml', () => {
  let events: AmaturEvent[];

  beforeAll(() => {
    events = parseTourneeHtml(FIXTURE_HTML);
  });

  it('extracts the correct number of events', () => {
    expect(events).toHaveLength(2);
  });

  // ── First event (Arad) ─────────────────────────────────────────────────

  describe('first event (Arad)', () => {
    it('parses the event ID', () => {
      expect(events[0].id).toBe('3943');
    });

    it('parses the date correctly', () => {
      expect(events[0].dateLabel).toBe('30 mar 2026');
      expect(events[0].startDate.getFullYear()).toBe(2026);
      expect(events[0].startDate.getMonth()).toBe(2); // March
      expect(events[0].startDate.getDate()).toBe(30);
    });

    it('parses the city', () => {
      expect(events[0].city).toBe('Arad');
    });

    it('parses the address', () => {
      expect(events[0].address).toBe('Calea Timisorii nr.30');
    });

    it('parses the tournament name and strips smart quotes', () => {
      expect(events[0].name).toBe('Speed Of Light Cup IV');
    });

    it('parses the forum URL', () => {
      expect(events[0].forumUrl).toBe('https://www.tenisdemasa.ro/forum/threads/1302277');
    });

    it('extracts Google Maps URL', () => {
      expect(events[0].mapsUrl).toContain('google.com/maps');
    });

    it('extracts coordinates from the maps URL', () => {
      expect(events[0].latitude).toBeCloseTo(46.154805, 4);
      expect(events[0].longitude).toBeCloseTo(21.32121, 4);
    });

    it('parses tables count', () => {
      expect(events[0].tables).toBe(6);
    });

    it('parses day-by-category distribution', () => {
      expect(events[0].categories).toHaveLength(3);
      expect(events[0].categories[0]).toContain('H');
      expect(events[0].categories[1]).toContain('E,O');
      expect(events[0].categories[2]).toContain('A');
    });

    it('parses per-category spots', () => {
      expect(events[0].categorySpots).toEqual([
        { category: 'Elite', spots: 10 },
        { category: 'Open', spots: 16 },
        { category: 'Avansati', spots: 24 },
        { category: 'Hobby', spots: 24 },
      ]);
    });
  });

  // ── Second event (Curtea de Argeș) ─────────────────────────────────────

  describe('second event (Curtea de Argeș)', () => {
    it('parses the event ID', () => {
      expect(events[1].id).toBe('3934');
    });

    it('parses the date correctly', () => {
      expect(events[1].dateLabel).toBe('04 apr 2026');
      expect(events[1].startDate.getMonth()).toBe(3); // April
      expect(events[1].startDate.getDate()).toBe(4);
    });

    it('parses the city with diacritics', () => {
      expect(events[1].city).toBe('Curtea de Argeș');
    });

    it('parses the address', () => {
      expect(events[1].address).toBe('Sala de sport Stadionul Municipal');
    });

    it('returns null for empty tournament name', () => {
      expect(events[1].name).toBeNull();
    });

    it('returns null for missing coordinates', () => {
      expect(events[1].latitude).toBeNull();
      expect(events[1].longitude).toBeNull();
      expect(events[1].mapsUrl).toBeNull();
    });

    it('has no day categories when none are in the HTML', () => {
      expect(events[1].categories).toHaveLength(0);
    });

    it('parses tables count', () => {
      expect(events[1].tables).toBe(16);
    });

    it('parses per-category spots', () => {
      expect(events[1].categorySpots).toEqual([
        { category: 'Elite', spots: 24 },
        { category: 'Open', spots: 48 },
        { category: 'Avansati', spots: 48 },
        { category: 'Hobby', spots: 24 },
      ]);
    });
  });
});

describe('parseTourneeHtml edge cases', () => {
  it('returns empty array for empty HTML', () => {
    expect(parseTourneeHtml('')).toEqual([]);
  });

  it('returns empty array for HTML with no event blocks', () => {
    expect(parseTourneeHtml('<script>alert(1)</script><div>no events</div>')).toEqual([]);
  });

  it('skips blocks without a city', () => {
    const html = `<div class="l1 lx">
<div class="ll1">
<div class="w1 bo">1<br><div class="idt">9999</div></div>
<div class="w2 bo"><b>01 jan</b><br>2026</div>
<div class="w3 bo" name="test">
    <a href="https://www.tenisdemasa.ro/forum/threads/1"><div class="t2l"><span style="color:red;"></span></div><div class="d2d"></div></a>
</div>
</div>
<div class="ll1">
<div class="w4 bo"></div>
<div class="w6 bo"></div>
</div>
</div>`;
    expect(parseTourneeHtml(html)).toEqual([]);
  });
});

// ─── getUpcomingAmaturEvents ─────────────────────────────────────────────────

describe('getUpcomingAmaturEvents', () => {
  const makeEvent = (daysFromNow: number): AmaturEvent => ({
    id: `test-${daysFromNow}`,
    city: 'Test',
    address: null,
    name: null,
    dateLabel: '',
    startDate: new Date(Date.now() + daysFromNow * 86400000),
    categories: [],
    forumUrl: null,
    mapsUrl: null,
    latitude: null,
    longitude: null,
    tables: null,
    categorySpots: [],
  });

  it('filters out past events', () => {
    const events = [makeEvent(-2), makeEvent(1), makeEvent(5)];
    const upcoming = getUpcomingAmaturEvents(events);
    expect(upcoming).toHaveLength(2);
    expect(upcoming[0].id).toBe('test-1');
    expect(upcoming[1].id).toBe('test-5');
  });

  it('returns empty array when all events are past', () => {
    const events = [makeEvent(-10), makeEvent(-1)];
    expect(getUpcomingAmaturEvents(events)).toHaveLength(0);
  });

  it('returns all events when none are past', () => {
    const events = [makeEvent(1), makeEvent(30)];
    expect(getUpcomingAmaturEvents(events)).toHaveLength(2);
  });
});
