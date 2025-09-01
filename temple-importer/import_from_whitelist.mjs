import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import url from 'url';
import slugify from 'slugify';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT_DIR  = path.join(__dirname, '..'); // parent dir with abhimana.json

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

// ensure service key
(function assertServiceRole() {
  const key = process.env.SUPABASE_SERVICE_KEY || '';
  const seg = key.split('.')[1];
  if (!seg) throw new Error('SUPABASE_SERVICE_KEY missing');
  const payload = JSON.parse(Buffer.from(seg, 'base64url').toString());
  if (payload.role !== 'service_role') throw new Error('Not a service_role key');
})();

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
  const rows = sources.filter(Boolean).map(url => ({ temple_id, type: url.includes('wikipedia.org') ? 'wiki' : 'site', url, title: null }));
  if (rows.length) await sb.from('sources').insert(rows).select('id');
}

function makeSlug({ state, locality, name }) {
  return slugify(`${state || ''}-${locality || ''}-${name}`, { lower: true, strict: true }).replace(/-+/g, '-');
}

async function findExisting({ name, lat, lng, link_to_slug }) {
  if (link_to_slug) {
    const { data } = await sb.from('temples').select('id').eq('slug', link_to_slug).maybeSingle();
    if (data) return data;
  }
  // exact name (case-insensitive)
  let { data: exact } = await sb.from('temples').select('id, name, lat, lng').ilike('name', name).limit(1);
  if (exact?.length) return exact[0];

  // proximity (~1km) if coords present
  if (lat != null && lng != null) {
    const box = 0.01;
    let { data: near } = await sb
      .from('temples').select('id, name, lat, lng')
      .gte('lat', lat - box).lte('lat', lat + box)
      .gte('lng', lng - box).lte('lng', lng + box)
      .limit(1);
    if (near?.length) return near[0];
  }
  return null;
}

async function upsertOne(entry, traditionCode, defaultDeity) {
  const traditionId = await getTraditionId(traditionCode);
  const deityId = defaultDeity ? await upsertDeity(defaultDeity) : null;

  const name = entry.name.trim();
  const state = entry.state || null;
  const district = entry.district || null;
  const locality = entry.locality || null;
  const lat = entry.lat ?? null, lng = entry.lng ?? null;
  const alt = Array.isArray(entry.alt_names) && entry.alt_names.length ? entry.alt_names : null;
  const sources = entry.wiki ? [entry.wiki] : [];

  // re-use existing temple if present
  const existing = await findExisting({ name, lat, lng, link_to_slug: entry.link_to_slug });
  if (existing) {
    await linkTempleTradition(existing.id, traditionId);
    if (deityId) await linkTempleDeity(existing.id, deityId);
    await addSources(existing.id, sources);
    console.log(`Linked ${traditionCode} to existing: ${name}`);
    return;
  }

  // insert new
  const slug = makeSlug({ state, locality, name });
  const { data: up, error } = await sb.from('temples').upsert({
    slug, name,
    alt_names: alt,
    country: state ? (state === 'Tamil Nadu' ? 'IN' : 'IN') : 'IN',
    state, district, locality,
    lat, lng,
    significance_tags: null, experience_tags: null,
    logistics: null, history: null, notes: null
  }, { onConflict: 'slug' }).select('id').single();
  if (error) { console.log('Upsert error', name, error.message); return; }

  await linkTempleTradition(up.id, traditionId);
  if (deityId) await linkTempleDeity(up.id, deityId);
  await addSources(up.id, sources);
  console.log(`Inserted new ${traditionCode}: ${name}`);
}

async function loadList(file) {
  const p = path.join(ROOT_DIR, file);
  const txt = await fs.readFile(p, 'utf8');
  const arr = JSON.parse(txt);
  if (!Array.isArray(arr)) throw new Error(`${file} must be an array`);
  return arr;
}

async function run() {
  const abhi = await loadList('abhimana.json');
  for (const row of abhi) {
    await upsertOne(row, 'abhimana', 'Vishnu');
  }

  // If/when you add a curated Purana list:
  try {
    const purana = await loadList('purana_desams.json');
    for (const row of purana) {
      await upsertOne(row, 'purana-desam', 'Vishnu');
    }
  } catch (_) { /* optional file; ignore if missing */ }

  console.log('Whitelist import complete.');
}

run().catch(e => { console.error(e.message); process.exit(1); });

