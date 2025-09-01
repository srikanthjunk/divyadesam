import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import slugify from 'slugify';

// --- config ---
const WIKI_PAGE = 'Abhimana_Kshethram';
const USER_AGENT = 'temple-importer/1.0 (contact: alerts@communityforge.info)';
const USE_REVERSE_GEOCODE = true; // set false if you want to skip Nominatim
const NOMINATIM_EMAIL = 'alerts@communityforge.info'; // include your email per Nominatim policy

// --- supabase ---
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

// guard: ensure service role key
(function assertServiceRole() {
  const key = process.env.SUPABASE_SERVICE_KEY || '';
  const seg = key.split('.')[1];
  if (!seg) throw new Error('SUPABASE_SERVICE_KEY missing');
  const payload = JSON.parse(Buffer.from(seg, 'base64url').toString());
  if (payload.role !== 'service_role') throw new Error('Not a service_role key');
})();

const pause = (ms) => new Promise(r => setTimeout(r, ms));

function mkSlug({ traditionCode, state, locality, name }) {
  const s = slugify(`${traditionCode || 'abhimana'}-${state || ''}-${locality || ''}-${name}`, { lower: true, strict: true });
  return s.replace(/-+/g, '-');
}
function guessSourceType(url='') { return url.includes('wikipedia.org') ? 'wiki' : 'site'; }

async function getTraditionId(code) {
  const { data, error } = await sb.from('traditions').select('id').eq('code', code).single();
  if (error) throw error;
  return data.id;
}
async function upsertDeity(name) {
  const { data } = await sb.from('deities').select('id').eq('name', name).maybeSingle();
  if (data) return data.id;
  const ins = await sb.from('deities').insert({ name }).select('id').single();
  return ins.data?.id ?? null;
}
async function linkTempleTradition(temple_id, tradition_id) {
  await sb.from('temple_traditions').upsert({ temple_id, tradition_id });
}
async function linkTempleDeity(temple_id, deity_id) {
  if (deity_id) await sb.from('temple_deities').upsert({ temple_id, deity_id });
}
async function addSources(temple_id, sources) {
  if (!sources?.length) return;
  const rows = sources.filter(Boolean).map(url => ({ temple_id, type: guessSourceType(url), url, title: null }));
  if (rows.length) await sb.from('sources').insert(rows).select('id');
}

// ---------- Wikipedia + Wikidata helpers ----------
async function wikiParseLinks(page) {
  const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(page)}&prop=links&format=json`;
  const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT }});
  if (!r.ok) throw new Error(`wiki parse ${r.status}`);
  const j = await r.json();
  const links = j?.parse?.links || [];
  // Keep only article-space links that look like temples
  const titles = links
    .filter(l => l.ns === 0 && l['*'])
    .map(l => l['*'])
    .filter(t => /Temple|Perumal|Vishnu|Divya Desam|Narayana/i.test(t));
  return Array.from(new Set(titles));
}

async function wikiTitleToQid(title) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&prop=pageprops&titles=${encodeURIComponent(title)}&format=json`;
  const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT }});
  if (!r.ok) return null;
  const j = await r.json();
  const pages = j?.query?.pages || {};
  const first = Object.values(pages)[0];
  return first?.pageprops?.wikibase_item || null; // e.g., Q12345
}

async function wdCoordsAndAdmin(qid) {
  // SPARQL: coords + up to 2 levels of admin (P131)
  const q = `
    SELECT ?coord ?a1Label ?a2Label ?countryCode WHERE {
      VALUES ?item { wd:${qid} }
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P131 ?a1 . OPTIONAL { ?a1 wdt:P131 ?a2 . } }
      OPTIONAL {
        ?item wdt:P17 ?country .
        ?country wdt:P297 ?countryCode .
      }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } LIMIT 1`;
  const url = 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q);
  const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT }});
  if (!r.ok) return {};
  const j = await r.json();
  const b = j.results.bindings?.[0];
  if (!b) return {};
  let lat=null, lng=null;
  if (b.coord?.value) {
    const m = b.coord.value.match(/Point\\(([-0-9\\.]+) ([ -0-9\\.]+)\\)/);
    if (m) { lng = Number(m[1]); lat = Number(m[2]); }
  }
  return {
    lat, lng,
    state: b.a1Label?.value || null,
    district: b.a2Label?.value || null,
    countryCode: b.countryCode?.value || null
  };
}

async function reverseGeocode(lat,lng) {
  if (!USE_REVERSE_GEOCODE || lat==null || lng==null) return {};
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1&email=${encodeURIComponent(NOMINATIM_EMAIL)}`;
  const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT }});
  if (!r.ok) return {};
  const j = await r.json();
  const a = j.address || {};
  return {
    country: a.country_code ? a.country_code.toUpperCase() : null,
    state: a.state || a.region || null,
    district: a.county || a.state_district || a.district || null,
    locality: a.town || a.city || a.village || a.suburb || null
  };
}

// ---------- main ----------
async function run() {
  const traditionId = await getTraditionId('abhimana');
  const vishnuId = await upsertDeity('Vishnu');

  console.log('Fetching Wikipedia links…');
  const titles = await wikiParseLinks(WIKI_PAGE);
  console.log(`Found ${titles.length} candidate titles`);

  for (const title of titles) {
    try {
      const qid = await wikiTitleToQid(title);
      if (!qid) { console.log('No QID:', title); continue; }

      const wd = await wdCoordsAndAdmin(qid);
      let { lat, lng } = wd;
      let state = wd.state || null;
      let district = wd.district || null;
      let locality = null;
      let country = wd.countryCode ? wd.countryCode.toUpperCase() : 'IN';

      // reverse geocode for nicer admin names
      if (lat != null && lng != null) {
        const rev = await reverseGeocode(lat,lng);
        country = rev.country || country;
        state = rev.state || state;
        district = rev.district || district;
        locality = rev.locality || locality;
        await pause(1000); // be kind to Nominatim
      }

      const name = title;
      const slug = mkSlug({ traditionCode: 'abhimana', state, locality, name });

      const { data: up, error: upErr } = await sb
        .from('temples')
        .upsert({
          slug, name,
          alt_names: null,
          country: country || 'IN',
          state, district, locality,
          lat, lng,
          significance_tags: null,
          experience_tags: null,
          logistics: null,
          history: null,
          notes: null
        }, { onConflict: 'slug' })
        .select('id')
        .single();

      if (upErr) { console.log('Upsert error', slug, upErr.message); continue; }

      await linkTempleTradition(up.id, traditionId);
      await linkTempleDeity(up.id, vishnuId);
      await addSources(up.id, [`https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g,'_'))}`]);

      console.log('Imported:', title, '→', slug);
      await pause(300); // ease off WDQS/Wikipedia
    } catch (e) {
      console.log('Skip:', title, e.message);
    }
  }

  console.log('Done.');
}

run().catch(e => { console.error(e); process.exit(1); });

