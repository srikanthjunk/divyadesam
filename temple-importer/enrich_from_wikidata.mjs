// enrich_from_wikidata.mjs
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import got from 'got';
import pLimit from 'p-limit';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

// --- guard service role ---
(() => {
  const seg = (process.env.SUPABASE_SERVICE_KEY||'').split('.')[1];
  if (!seg) throw new Error('SUPABASE_SERVICE_KEY missing');
  const role = JSON.parse(Buffer.from(seg,'base64url').toString()).role;
  if (role !== 'service_role') throw new Error('Not a service_role key');
})();

const UA = 'temple-importer/1.0 (alerts@communityforge.info)';
const limit = pLimit(3);

async function templesNeedingEnrichment() {
  // Pull temples missing coords OR state/district
  const { data, error } = await sb
    .from('temples')
    .select('id, name, state, district, locality, lat, lng')
    .or('lat.is.null,lng.is.null,state.is.null,district.is.null')
    .limit(1000);
  if (error) throw error;
  return data;
}

async function wikiSourceForTemple(id) {
  const { data } = await sb
    .from('sources')
    .select('url')
    .eq('temple_id', id)
    .ilike('url', '%wikipedia.org/wiki/%')
    .limit(1);
  return data?.[0]?.url || null;
}

async function titleToQidFromWikipedia(title) {
  const url = 'https://en.wikipedia.org/w/api.php';
  const j = await got(url, {
    searchParams: { action:'query', prop:'pageprops', titles:title, format:'json' },
    headers: { 'User-Agent': UA }, timeout: { request: 15000 }
  }).json();
  const pages = j?.query?.pages || {};
  const first = Object.values(pages)[0];
  return first?.pageprops?.wikibase_item || null;
}

async function wikiUrlToQid(wikiUrl) {
  try {
    const title = decodeURIComponent(wikiUrl.split('/wiki/')[1] || '').replace(/_/g,' ');
    if (!title) return null;
    return await titleToQidFromWikipedia(title);
  } catch { return null; }
}

async function wdFetch(qid) {
  // Get coords, admin labels (P131 chain), country code, phone (P1329), website (P856), image (P18)
  const q = `
    SELECT ?coord ?a1Label ?a2Label ?countryCode ?phone ?website ?img WHERE {
      VALUES ?item { wd:${qid} }
      OPTIONAL { ?item wdt:P625 ?coord. }
      OPTIONAL { ?item wdt:P131 ?a1. OPTIONAL { ?a1 wdt:P131 ?a2. } }
      OPTIONAL { ?item wdt:P17 ?country. ?country wdt:P297 ?countryCode. }
      OPTIONAL { ?item wdt:P1329 ?phone. }
      OPTIONAL { ?item wdt:P856  ?website. }
      OPTIONAL { ?item wdt:P18   ?img. }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } LIMIT 1`;
  const j = await got('https://query.wikidata.org/sparql', {
    searchParams: { format: 'json', query: q },
    headers: { 'User-Agent': UA },
    timeout: { request: 20000 }
  }).json();
  const b = j?.results?.bindings?.[0] || {};
  let lat=null, lng=null;
  if (b.coord?.value) {
    const m = b.coord.value.match(/Point\\(([-0-9.]+) ([ -0-9.]+)\\)/);
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

async function upsertContacts(temple_id, { phone, website }) {
  if (!phone && !website) return;
  // Upsert simple contacts row; adjust if your schema differs
  const payload = {};
  if (phone) payload.phones = [phone];
  if (website) payload.websites = [website];

  // Try update existing; else insert
  const { data: existing } = await sb.from('contacts').select('temple_id').eq('temple_id', temple_id).maybeSingle();
  if (existing) {
    await sb.from('contacts').update(payload).eq('temple_id', temple_id);
  } else {
    await sb.from('contacts').insert({ temple_id, ...payload });
  }
}

async function addSource(temple_id, url, type='wikidata') {
  if (!url) return;
  await sb.from('sources').insert({ temple_id, type, url }).select('id');
}

async function updateTemple(temple_id, patch) {
  const clean = Object.fromEntries(Object.entries(patch).filter(([,v]) => v !== undefined));
  if (!Object.keys(clean).length) return;
  await sb.from('temples').update(clean).eq('id', temple_id);
}

async function processTemple(t) {
  try {
    // 1) find QID
    const wikiUrl = await wikiSourceForTemple(t.id);
    let qid = wikiUrl ? await wikiUrlToQid(wikiUrl) : null;

    // fallback: try label search via Wikipedia title API using temple name
    if (!qid) qid = await titleToQidFromWikipedia(t.name);
    if (!qid) { console.log('No QID:', t.name); return; }

    // 2) fetch facts
    const wd = await wdFetch(qid);

    // 3) patch temple
    const patch = {};
    if (wd.lat != null && wd.lng != null) { patch.lat = wd.lat; patch.lng = wd.lng; }
    if (wd.state && !t.state) patch.state = wd.state;
    if (wd.district && !t.district) patch.district = wd.district;
    if (wd.country) patch.country = wd.country;

    await updateTemple(t.id, patch);

    // 4) contacts + sources
    await upsertContacts(t.id, { phone: wd.phone, website: wd.website });
    await addSource(t.id, wd.image, 'image');
    await addSource(t.id, `https://www.wikidata.org/wiki/${qid}`, 'wikidata');

    console.log(`Enriched: ${t.name} ${wd.lat!=null && wd.lng!=null ? '📍' : ''} ${wd.state || ''}`);
  } catch (e) {
    console.log('Skip:', t.name, e.message);
  }
}

async function run() {
  const list = await templesNeedingEnrichment();
  console.log('To enrich:', list.length);
  await Promise.all(list.map(t => limit(() => processTemple(t))));
  console.log('Done.');
}

run().catch(e => { console.error(e); process.exit(1); });

