// fix_missing_qids.mjs
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';

// ---------- CONFIG ----------
const USER_AGENT = 'temple-importer/1.0 (alerts@communityforge.info)';
const CONCURRENCY = 3;
const SEARCH_LANGS = ['en', 'ta'];      // you can add 'te','kn','ml','si' if needed
const ALLOW_COUNTRY = new Set(['IN','LK']); // India, Sri Lanka
const AROUND_RADIUS_KM = 3;             // for coord-based match
// Inline overrides. Add lines like:
// { match: { slug: 'divya-desam-thiruvellarai' }, qid: 'Q633685' }  OR
// { match: { name: 'ThiruArangam' }, wiki: 'https://en.wikipedia.org/wiki/Ranganathaswamy_Temple,_Srirangam' }
const QID_OVERRIDES = [
  // examples:
  // { match: { name: 'ThiruArangam' }, wiki: 'https://en.wikipedia.org/wiki/Ranganathaswamy_Temple,_Srirangam' },
  // { match: { slug: 'divya-desam-thiruvellarai' }, qid: 'Q633685' },
];

// ---------- BOILERPLATE ----------
function assertServiceRole() {
  const seg = (process.env.SUPABASE_SERVICE_KEY || '').split('.')[1];
  if (!seg) throw new Error('SUPABASE_SERVICE_KEY missing');
  const payload = JSON.parse(Buffer.from(seg, 'base64url').toString());
  if (payload.role !== 'service_role') throw new Error('Not a service_role key');
}
assertServiceRole();

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession:false } });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm  = s => (s||'').toLowerCase().replace(/\s+/g,' ').trim();
const uniq  = arr => Array.from(new Set((arr||[]).filter(Boolean)));

function matchesRule(t, rule) {
  const m = rule.match || {};
  return Object.keys(m).every(k => norm(t[k] || '').includes(norm(m[k] || '')));
}

// Simple concurrency limiter
function makeLimiter(n=CONCURRENCY){
  let active = 0; const q = [];
  const run = () => {
    if (active>=n || q.length===0) return;
    active++;
    const {fn,resolve,reject} = q.shift();
    fn().then(resolve,reject).finally(()=>{active--;run();});
  };
  return fn => new Promise((res,rej)=>{ q.push({fn,resolve:res,reject:rej}); run(); });
}
const limit = makeLimiter(CONCURRENCY);

// ---------- DB ----------
async function listNeedingQID() {
  const { data, error } = await sb.from('temples')
    .select('id, slug, name, state, locality, lat, lng, wikidata_qid')
    .is('wikidata_qid', null)
    .order('name', { ascending: true })
    .limit(5000);
  if (error) throw error;
  return data;
}

async function setQID(temple_id, qid) {
  await sb.from('temples').update({ wikidata_qid: qid }).eq('id', temple_id);
}

async function addSource(temple_id, url, type='wiki') {
  if (!url) return;
  const { data: ex } = await sb.from('sources').select('id').eq('temple_id', temple_id).eq('url', url).maybeSingle();
  if (!ex) await sb.from('sources').insert({ temple_id, type, url });
}

async function getWikiSource(temple_id) {
  const { data } = await sb.from('sources').select('url').eq('temple_id', temple_id).ilike('url','%wikipedia.org/wiki/%').limit(1);
  return data?.[0]?.url || null;
}

// ---------- WIKI / WD HELPERS ----------
function nameVariants(raw) {
  const v = new Set();
  if (!raw) return [];
  const n = raw.replace(/-/g,' ').replace(/\(.*?\)/g,'').replace(/\s+/g,' ').trim();
  v.add(n);
  v.add(n + ' Temple'); v.add(n + ' Perumal Temple');
  v.add(n.replace(/^Thiru/i,'Tiru')); v.add(n.replace(/^Tiru/i,'Thiru'));
  v.add(n.replace(/Kovil/i,'Koil')); v.add(n.replace(/Koil/i,'Kovil')); v.add(n.replace(/Koyil/i,'Kovil'));
  v.add(n.replace(/^Thir[ua]/i,'').trim());
  v.add(n.replace(/\s+/g,'')); // concatenated
  return Array.from(v).filter(Boolean);
}

async function wikiApi(lang, params) {
  const url = `https://${lang}.wikipedia.org/w/api.php?` + new URLSearchParams(params).toString();
  const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!r.ok) throw new Error(`wiki ${lang} ${r.status}`);
  return r.json();
}

async function wikiUrlToQid(wikiUrl) {
  try {
    const title = decodeURIComponent((wikiUrl.split('/wiki/')[1] || '').replace(/_/g,' '));
    if (!title) return null;
    const j = await wikiApi('en', { action:'query', prop:'pageprops', titles:title, format:'json' }).catch(()=>null);
    const pages = j?.query?.pages || {};
    const first = Object.values(pages)[0];
    return first?.pageprops?.wikibase_item || null;
  } catch { return null; }
}

async function wikiSearchBest(lang, t) {
  const variants = nameVariants(t.name);
  const loc = [t.locality, t.state].filter(Boolean).join(' ');
  const queries = Array.from(new Set(variants.slice(0,8).map(v => [v, loc, 'temple'].filter(Boolean).join(' '))));
  const titles = new Set();
  for (const q of queries) {
    try {
      const j = await wikiApi(lang, { action:'query', list:'search', srsearch:q, srlimit:5, format:'json' });
      (j?.query?.search || []).forEach(s => titles.add(s.title));
      await sleep(150);
    } catch {}
  }
  if (!titles.size) return null;

  const meta = await wikiApi(lang, {
    action:'query', prop:'pageprops|categories', titles: Array.from(titles).slice(0,20).join('|'),
    clshow:'!hidden', cllimit:500, format:'json'
  }).catch(()=>null);
  const pages = meta?.query?.pages || {};

  const wantState = (t.state||'').toLowerCase();
  const wantLoc   = (t.locality||'').toLowerCase();
  let best=null, scoreBest=-1;
  for (const p of Object.values(pages)) {
    const title = p.title || '';
    const cats = (p.categories || []).map(c => c.title.toLowerCase());
    const qid  = p.pageprops?.wikibase_item || null;

    let s = 0;
    if (/divya\s*desam/.test(cats.join(' '))) s += 100;
    if (/hindu temples|vishnu temples|shiva temples/.test(cats.join(' '))) s += 10;
    if (wantState && cats.some(c=>c.includes(wantState))) s += 5;
    if (wantLoc && (title.toLowerCase().includes(wantLoc) || cats.some(c=>c.includes(wantLoc)))) s += 4;
    if (/temple/i.test(title)) s += 2;
    if (qid) s += 1;

    if (s>scoreBest) { scoreBest=s; best={title, qid}; }
  }
  if (!best) return null;

  if (!best.qid) {
    const pp = await wikiApi(lang, { action:'query', prop:'pageprops', titles: best.title, format:'json' }).catch(()=>null);
    const obj = Object.values(pp?.query?.pages || {})[0];
    best.qid = obj?.pageprops?.wikibase_item || null;
  }
  return best.qid ? { qid: best.qid, wiki: `https://${lang}.wikipedia.org/wiki/${best.title.replace(/\s/g,'_')}` } : null;
}

// Direct Wikidata search fallback
async function wdSearchEntities(q) {
  const url = 'https://www.wikidata.org/w/api.php?' + new URLSearchParams({
    action:'wbsearchentities', search:q, language:'en', format:'json', limit:'5'
  }).toString();
  const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!r.ok) return [];
  const j = await r.json();
  return (j?.search || []).map(s => s.id).filter(Boolean);
}

// Check QID is a plausible temple in allowed countries (fast SPARQL)
async function wdCheck(qid) {
  const q = `
    SELECT ?countryCode WHERE {
      VALUES ?item { wd:${qid} }
      OPTIONAL { ?item wdt:P17 ?cty . ?cty wdt:P297 ?countryCode. }
      OPTIONAL { ?item wdt:P31/wdt:P279* ?cls. }
    } LIMIT 1`;
  const r = await fetch('https://query.wikidata.org/sparql?format=json&query='+encodeURIComponent(q), { headers: { 'User-Agent': USER_AGENT } });
  if (!r.ok) return { ok:false };
  const b = r.ok ? (await r.json())?.results?.bindings?.[0] : null;
  const cc = b?.countryCode?.value?.toUpperCase() || null;
  return { ok: !cc || ALLOW_COUNTRY.has(cc), country: cc };
}

// Coord-based around search on WD (if temple has lat/lng)
async function wdFindByCoords(lat, lng, name) {
  if (lat==null || lng==null) return null;
  const label = (name||'').replace(/"/g,'\\"');
  const q = `
    SELECT ?item ?itemLabel WHERE {
      SERVICE wikibase:around {
        ?item wdt:P625 ?loc .
        bd:serviceParam wikibase:center "Point(${lng} ${lat})"^^geo:wktLiteral .
        bd:serviceParam wikibase:radius "${AROUND_RADIUS_KM}" .
      }
      ?item wdt:P31/wdt:P279* wd:Q42948 .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,ta" . }
      FILTER(CONTAINS(LCASE(STR(?itemLabel)), LCASE("${label.split(' ')[0]}")))
    } LIMIT 1`;
  const r = await fetch('https://query.wikidata.org/sparql?format=json&query='+encodeURIComponent(q), { headers: { 'User-Agent': USER_AGENT } });
  if (!r.ok) return null;
  const b = (await r.json())?.results?.bindings?.[0];
  if (!b) return null;
  const uri = b.item?.value || '';
  const qid = uri.split('/').pop();
  return qid || null;
}

// ---------- RESOLUTION PIPE ----------
async function resolveQID(t) {
  // A) overrides
  const ov = QID_OVERRIDES.find(r => matchesRule(t, r));
  if (ov?.qid)  return { qid: ov.qid, via: 'override-qid', wiki: ov.wiki || null };
  if (ov?.wiki) {
    const qid = await wikiUrlToQid(ov.wiki);
    if (qid) return { qid, via:'override-wiki', wiki: ov.wiki };
  }

  // B) existing wiki source
  const srcWiki = await getWikiSource(t.id);
  if (srcWiki) {
    const qid = await wikiUrlToQid(srcWiki);
    if (qid) return { qid, via:'source', wiki: srcWiki };
  }

  // C) coord-based
  const byGeo = await wdFindByCoords(t.lat, t.lng, t.name);
  if (byGeo) return { qid: byGeo, via:'coords', wiki: null };

  // D) Wikipedia search (en → ta)
  for (const lang of SEARCH_LANGS) {
    const hit = await wikiSearchBest(lang, t);
    if (hit?.qid) return { qid: hit.qid, via:`wiki-${lang}`, wiki: hit.wiki };
  }

  // E) Wikidata search
  const qtxt = [t.name, t.locality, t.state, 'temple', 'India'].filter(Boolean).join(' ');
  const cands = await wdSearchEntities(qtxt);
  for (const qid of cands) {
    const chk = await wdCheck(qid);
    if (chk.ok) return { qid, via:'wdsearch', wiki: null };
  }

  return null;
}

// ---------- MAIN ----------
async function run() {
  const rows = await listNeedingQID();
  console.log('Temples missing QID:', rows.length);

  const unresolved = [];
  let set=0;

  const tasks = rows.map(t => limit(async () => {
    try {
      const r = await resolveQID(t);
      if (!r) {
        unresolved.push(t);
        console.log('No QID:', t.name);
        return;
      }
      await setQID(t.id, r.qid);
      if (r.wiki) await addSource(t.id, r.wiki, 'wiki');
      await addSource(t.id, `https://www.wikidata.org/wiki/${r.qid}`, 'wikidata');
      console.log(`QID set: ${t.name} → ${r.qid} (${r.via})`);
      set++;
      await sleep(150);
    } catch (e) {
      unresolved.push(t);
      console.log('Skip:', t.name, e.message);
    }
  }));

  await Promise.all(tasks);

  // write unresolved CSV with helpful search URLs
  if (unresolved.length) {
    const lines = [
      'slug,name,locality,state,wikipedia_search,wikidata_search,google_search'
    ];
    for (const u of unresolved) {
      const q = encodeURIComponent([u.name, u.locality, u.state, 'temple'].filter(Boolean).join(' '));
      const wEn = `https://en.wikipedia.org/w/index.php?search=${q}`;
      const wd  = `https://www.wikidata.org/w/index.php?search=${q}`;
      const gg  = `https://www.google.com/search?q=${q}`;
      lines.push([
        u.slug, `"${u.name.replace(/"/g,'""')}"`,
        `"${(u.locality||'').replace(/"/g,'""')}"`,
        `"${(u.state||'').replace(/"/g,'""')}"`,
        wEn, wd, gg
      ].join(','));
    }
    await fs.writeFile('missing_qid.csv', lines.join('\n'), 'utf8');
  }

  console.log(`Done. QIDs set: ${set}. Still missing: ${unresolved.length}.`);
  if (unresolved.length) console.log('See missing_qid.csv for quick links.');
}

run().catch(e => { console.error(e); process.exit(1); });

