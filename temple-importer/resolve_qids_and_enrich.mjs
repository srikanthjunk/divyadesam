// resolve_qids_and_enrich.mjs
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// ============ CONFIG ============
const CONCURRENCY = 3;               // parallel workers
const USER_AGENT  = 'temple-importer/1.0 (alerts@communityforge.info)';
const OVERWRITE_EXISTING_COORDS = false; // true = overwrite lat/lng even if present

// Optional inline overrides (no extra file needed)
// Add entries like:
// { match: { slug: 'divya-desam-thiruvellarai' }, wiki: 'https://en.wikipedia.org/wiki/Pundarikakshan_Perumal_Temple' }
const QID_OVERRIDES = [
  // examples:
  // { match: { name: 'ThiruArangam' }, wiki: 'https://en.wikipedia.org/wiki/Ranganathaswamy_Temple,_Srirangam' },
  // { match: { slug: 'divya-desam-thiruvellarai' }, wiki: 'https://en.wikipedia.org/wiki/Pundarikakshan_Perumal_Temple' },
];

// ============ UTIL ============
function assertServiceRole() {
  const seg = (process.env.SUPABASE_SERVICE_KEY || '').split('.')[1];
  if (!seg) throw new Error('SUPABASE_SERVICE_KEY missing');
  const payload = JSON.parse(Buffer.from(seg, 'base64url').toString());
  if (payload.role !== 'service_role') throw new Error('Not a service_role key');
}
assertServiceRole();

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function norm(s=''){ return s.toLowerCase().replace(/\s+/g,' ').trim(); }
function matchesRule(t, rule) {
  const m = rule.match || {};
  return Object.keys(m).every(k => norm(t[k] || '').includes(norm(m[k] || '')));
}
function uniq(arr) { return Array.from(new Set(arr.filter(Boolean))); }

// Simple concurrency limiter (no deps)
function makeLimiter(limit=3) {
  let active = 0; const queue = [];
  const runNext = () => {
    if (active >= limit || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    fn().then(resolve, reject).finally(() => { active--; runNext(); });
  };
  return (fn) => new Promise((resolve, reject) => { queue.push({ fn, resolve, reject }); runNext(); });
}
const limit = makeLimiter(CONCURRENCY);

// ============ WIKI HELPERS ============
function nameVariants(raw) {
  const v = new Set();
  if (!raw) return [];
  const n = raw
    .replace(/-/g, ' ')
    .replace(/\(.*?\)/g,'')
    .replace(/\s+/g,' ')
    .trim();

  v.add(n);
  // Thiru/Tiru toggles
  v.add(n.replace(/^Thiru/i, 'Tiru'));
  v.add(n.replace(/^Tiru/i, 'Thiru'));
  // common suffixes
  v.add(n + ' Temple');
  v.add(n + ' Perumal Temple');
  // Koil/Kovil/Koyil
  v.add(n.replace(/Kovil/i, 'Koil'));
  v.add(n.replace(/Koil/i, 'Kovil'));
  v.add(n.replace(/Koyil/i, 'Kovil'));
  // Remove Thiru prefix entirely
  v.add(n.replace(/^Thir[ua]/i, '').trim());
  // Space variants
  v.add(n.replace(/\s+/g,''));
  return Array.from(v).filter(Boolean);
}

async function wikiApi(lang, params) {
  const url = `https://${lang}.wikipedia.org/w/api.php?` + new URLSearchParams(params).toString();
  const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!r.ok) throw new Error(`wiki ${lang} ${r.status}`);
  return await r.json();
}

async function wikiSearchBest(lang, t) {
  // 1) Search
  const variants = nameVariants(t.name);
  const locBits = [t.locality, t.state].filter(Boolean).join(' ');
  const queries = Array.from(new Set(
    variants.slice(0, 8).map(v => [v, locBits, 'temple'].filter(Boolean).join(' '))
  ));

  const titles = new Set();
  for (const q of queries) {
    try {
      const j = await wikiApi(lang, { action:'query', list:'search', srsearch:q, srlimit:5, format:'json' });
      (j?.query?.search || []).forEach(s => titles.add(s.title));
      await sleep(200);
    } catch {}
  }
  if (!titles.size) return null;

  // 2) Pageprops + categories for candidates
  const meta = await wikiApi(lang, {
    action:'query', prop:'pageprops|categories',
    titles: Array.from(titles).slice(0, 20).join('|'),
    clshow:'!hidden', cllimit:500, format:'json'
  }).catch(()=>null);
  const pages = meta?.query?.pages || {};

  // 3) Score
  const wantedState = (t.state || '').toLowerCase();
  const wantedLoc   = (t.locality || '').toLowerCase();

  let best = null, bestScore = -1;
  for (const p of Object.values(pages)) {
    const title = p.title || '';
    const cats = (p.categories || []).map(c => c.title.toLowerCase());
    const qid  = p.pageprops?.wikibase_item || null;

    let score = 0;
    if (cats.join(' ').match(/divya\s*desam/)) score += 100;
    if (cats.join(' ').match(/hindu temples|vishnu temples/)) score += 10;
    if (wantedState && cats.some(c => c.includes(wantedState))) score += 5;
    if (wantedLoc && (title.toLowerCase().includes(wantedLoc) || cats.some(c => c.includes(wantedLoc)))) score += 4;
    if (/temple/i.test(title)) score += 2;
    if (qid) score += 1;

    if (score > bestScore) { bestScore = score; best = { title, qid }; }
  }
  if (!best) return null;

  // ensure QID
  if (!best.qid) {
    const pp = await wikiApi(lang, { action:'query', prop:'pageprops', titles: best.title, format:'json' }).catch(()=>null);
    const obj = Object.values(pp?.query?.pages || {})[0];
    best.qid = obj?.pageprops?.wikibase_item || null;
  }
  return best.qid ? { qid: best.qid, wiki: `https://${lang}.wikipedia.org/wiki/${best.title.replace(/\s/g,'_')}` } : null;
}

async function wikiUrlToQid(wikiUrl) {
  try {
    const title = decodeURIComponent(wikiUrl.split('/wiki/')[1] || '').replace(/_/g,' ');
    if (!title) return null;
    const j = await wikiApi('en', { action:'query', prop:'pageprops', titles:title, format:'json' }).catch(()=>null);
    const pages = j?.query?.pages || {};
    const first = Object.values(pages)[0];
    return first?.pageprops?.wikibase_item || null;
  } catch { return null; }
}

// prefer overrides → existing source(wiki) → EN search → TA search
async function resolveQidAndWiki(t) {
  const ov = QID_OVERRIDES.find(r => matchesRule(t, r));
  if (ov?.wiki) {
    const qid = await wikiUrlToQid(ov.wiki);
    if (qid) return { qid, wiki: ov.wiki };
  }

  // existing Wikipedia source for this temple
  const { data: src } = await sb.from('sources')
    .select('url').eq('temple_id', t.id).ilike('url', '%wikipedia.org/wiki/%').limit(1);
  const wikiFromSource = src?.[0]?.url;
  if (wikiFromSource) {
    const qid = await wikiUrlToQid(wikiFromSource);
    if (qid) return { qid, wiki: wikiFromSource };
  }

  const en = await wikiSearchBest('en', t);
  if (en) return en;

  const ta = await wikiSearchBest('ta', t);
  if (ta) return ta;

  return null;
}

// ============ WIKIDATA ============
async function wdFetch(qid) {
  const q = `
    SELECT ?coord ?a1Label ?a2Label ?countryCode ?phone ?website ?img WHERE {
      VALUES ?item { wd:${qid} }
      OPTIONAL { ?item wdt:P625 ?coord. }
      OPTIONAL { ?item wdt:P131 ?a1. OPTIONAL { ?a1 wdt:P131 ?a2. } }
      OPTIONAL { ?item wdt:P17 ?country. ?country wdt:P297 ?countryCode. }
      OPTIONAL { ?item wdt:P1329 ?phone. }   # phone
      OPTIONAL { ?item wdt:P856  ?website. } # official website
      OPTIONAL { ?item wdt:P18   ?img. }     # image
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } LIMIT 1`;
  const r = await fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q), {
    headers: { 'User-Agent': USER_AGENT }
  });
  if (!r.ok) return {};
  const j = await r.json();
  const b = j?.results?.bindings?.[0] || {};
  let lat=null, lng=null;
  if (b.coord?.value) {
    const m = b.coord.value.match(/Point\(([-0-9.]+) ([ -0-9.]+)\)/);
    if (m) { lng = Number(m[1]); lat = Number(m[2]); }
  }
  return {
    lat, lng,
    state: b.a1Label?.value || null,
    district: b.a2Label?.value || null,
    country: b.countryCode?.value?.toUpperCase() || null,
    phone: b.phone?.value || null,
    website: b.website?.value || null,
    image: b.img?.value || null
  };
}

// ============ DB OPS ============
async function listTargets() {
  // Enrich those missing coords OR state/district; tweak filter as needed
  const { data, error } = await sb.from('temples')
    .select('id, slug, name, state, district, locality, lat, lng')
    .or('lat.is.null,lng.is.null,state.is.null,district.is.null')
    .order('name', { ascending: true })
    .limit(2000);
  if (error) throw error;
  return data;
}

async function updateTemple(temple_id, t, wd) {
  const patch = {};
  if (wd.country) patch.country = wd.country;
  if (wd.state && !t.state) patch.state = wd.state;
  if (wd.district && !t.district) patch.district = wd.district;

  const hasCoords = t.lat != null && t.lng != null;
  if (wd.lat != null && wd.lng != null) {
    if (OVERWRITE_EXISTING_COORDS || !hasCoords) {
      patch.lat = wd.lat; patch.lng = wd.lng;
    }
  }

  if (Object.keys(patch).length) {
    await sb.from('temples').update(patch).eq('id', temple_id);
  }
}

async function upsertContacts(temple_id, wd) {
  const phones = wd.phone ? [String(wd.phone)] : [];
  const webs   = wd.website ? [String(wd.website)] : [];
  if (!phones.length && !webs.length) return;

  const { data: existing } = await sb.from('contacts')
    .select('phones, websites').eq('temple_id', temple_id).maybeSingle();

  const payload = {
    phones: uniq([...(existing?.phones || []), ...phones]),
    websites: uniq([...(existing?.websites || []), ...webs]),
  };

  if (existing) await sb.from('contacts').update(payload).eq('temple_id', temple_id);
  else await sb.from('contacts').insert({ temple_id, ...payload });
}

async function addSource(temple_id, url, type='wiki') {
  if (!url) return;
  // avoid exact dup insert (best-effort)
  const { data: ex } = await sb.from('sources').select('id').eq('temple_id', temple_id).eq('url', url).maybeSingle();
  if (ex) return;
  await sb.from('sources').insert({ temple_id, type, url });
}

async function processTemple(t) {
  try {
    const res = await resolveQidAndWiki(t);
    if (!res) { console.log('No QID:', t.name); return; }

    const { qid, wiki } = res;
    const wd = await wdFetch(qid);

    await updateTemple(t.id, t, wd);
    await upsertContacts(t.id, wd);
    await addSource(t.id, wiki, 'wiki');
    await addSource(t.id, `https://www.wikidata.org/wiki/${qid}`, 'wikidata');
    if (wd.image) {
      const imgUrl = wd.image.startsWith('http') ? wd.image : wd.image; // WD returns full URL for P18 via SPARQL
      await addSource(t.id, imgUrl, 'image');
    }

    console.log(`Enriched: ${t.name} → ${qid}${(wd.lat!=null && wd.lng!=null) ? ' 📍' : ''}`);
    await sleep(200); // be kind to WDQS
  } catch (e) {
    console.log('Skip:', t.name, e.message);
  }
}

async function backfillGeography() {
  // set geom/geog where null, if lat/lng present
  const { error } = await sb.rpc('exec_sql', { q: `
    create extension if not exists postgis;
    alter table temples
      add column if not exists geom geometry(Point, 4326),
      add column if not exists geog geography(Point);
    update temples
      set geom = case when lat is not null and lng is not null then ST_SetSRID(ST_MakePoint(lng, lat),4326) else geom end,
          geog = case when lat is not null and lng is not null then ST_SetSRID(ST_MakePoint(lng, lat),4326)::geography else geog end
      where (geom is null or geog is null) and (lat is not null and lng is not null);
  `});
  // If you don't have an exec_sql RPC, just run the SQL above once in the SQL editor.
  if (error) {
    // Fallback: ignore; you can run the SQL manually
  }
}

async function run() {
  const list = await listTargets();
  console.log('To enrich:', list.length);

  const tasks = list.map(t => () => processTemple(t));
  const chunks = tasks.map(fn => limit(fn));
  await Promise.all(chunks);

  await backfillGeography();
  console.log('Done.');
}

run().catch(e => { console.error(e); process.exit(1); });

