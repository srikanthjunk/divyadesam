import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import url from 'url';
import { createClient } from '@supabase/supabase-js';
import slugify from 'slugify';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..'); // one level up, where your data files live

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

const COUNTRY = 'IN';
const TRADITION_CODE = 'divya-desam';

/* ------------- helpers ------------- */
const pause = ms => new Promise(r => setTimeout(r, ms));

function mkSlug({ traditionCode = TRADITION_CODE, state, locality, name }) {
  const s = slugify(`${traditionCode}-${state || ''}-${locality || ''}-${name}`, { lower: true, strict: true });
  return s.replace(/-+/g, '-');
}

function normDeity(d) {
  if (!d) return 'Other';
  const s = d.toLowerCase();
  if (s.includes('vishnu') || s.includes('perumal') || s.includes('narayana')) return 'Vishnu';
  if (s.includes('shiva') || s.includes('siva') || s.includes('nataraja')) return 'Shiva';
  if (s.includes('murugan') || s.includes('karthik')) return 'Murugan';
  if (s.includes('ambal') || s.includes('parvati') || s.includes('devi') || s.includes('amman') || s.includes('lakshmi')) return 'Ambal';
  if (s.includes('ganesha') || s.includes('vinay') || s.includes('pillaiyar')) return 'Ganesha';
  if (s.includes('hanuman') || s.includes('anjaneya')) return 'Hanuman';
  if (s.includes('navagraha') || s.includes('surya') || s.includes('shani') || s.includes('rahu') || s.includes('ketu')) return 'Navagraha';
  return 'Other';
}

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
function guessSourceType(u='') {
  if (u.includes('wikipedia.org')) return 'wiki';
  if (u.includes('hrce.tn.gov.in')) return 'hrce';
  return 'site';
}
async function addSources(temple_id, sources) {
  if (!sources?.length) return;
  const rows = sources.filter(Boolean).map(url => ({ temple_id, type: guessSourceType(url), url, title: null }));
  if (rows.length) await sb.from('sources').insert(rows).select('id');
}

/* ------------- load your files ------------- */
async function loadDivyaDesams() {
  // Actual file structure exports { divyaDesams, regionalSummary }
  const mod = await import(url.pathToFileURL(path.join(DATA_DIR, 'temple-data.js')).href);
  // Support both ESM default and CJS module.exports
  const arr = mod?.divyaDesams || mod?.default?.divyaDesams || mod?.default || [];
  if (!Array.isArray(arr)) throw new Error('divyaDesams array not found in temple-data.js');
  return arr;
}

async function loadTimingDatabaseComplete() {
  const p = path.join(DATA_DIR, 'timing-database-complete.json');
  const txt = await fs.readFile(p, 'utf8');
  return JSON.parse(txt); // { "ThiruArangam": { hours:[..], phone, website, ...}, ... }
}

async function loadTempleTimingsReal() {
  const p = path.join(DATA_DIR, 'temple-timings-real.json');
  const txt = await fs.readFile(p, 'utf8');
  const arr = JSON.parse(txt); // [ { temple, hours, contact, address, ... }, ... ]
  // make a quick lookup by lowercased temple field
  const byTemple = new Map(arr.map(x => [String(x.temple || '').toLowerCase(), x]));
  return { list: arr, byTemple };
}

/* ------------- merge timings + contacts ------------- */
function normalizeHoursFromComplete(entry) {
  if (!entry?.hours) return null;
  if (Array.isArray(entry.hours)) return entry.hours.join('; ');
  if (typeof entry.hours === 'string') return entry.hours;
  return null;
}

function extractContactsFromComplete(nameKey, completeObj) {
  const rec = completeObj?.[nameKey];
  if (!rec) return null;
  const phones = rec.phone ? [rec.phone] : [];
  const sites  = rec.website ? [rec.website] : [];
  return { phones, sites, emails: [] };
}

function extractContactsFromReal(realRec) {
  if (!realRec) return null;
  const phones = (realRec.contact?.[0]?.phone || []).map(p => p.value).filter(Boolean);
  const sites  = (realRec.contact?.[0]?.www   || []).map(w => w.value).filter(Boolean);
  const emails = (realRec.contact?.[0]?.email || []).map(e => e.value).filter(Boolean);
  return { phones, sites, emails, address: realRec.address || null };
}

function mergeContacts(a, b) {
  const uniq = arr => Array.from(new Set((arr||[]).filter(Boolean)));
  return {
    phones: uniq([...(a?.phones||[]), ...(b?.phones||[])]),
    sites:  uniq([...(a?.sites ||[]), ...(b?.sites ||[])]),
    emails: uniq([...(a?.emails||[]), ...(b?.emails||[])]),
    address: b?.address || a?.address || null
  };
}

/* ------------- main import ------------- */
async function run() {
  const [dd, completeDB, real] = await Promise.all([
    loadDivyaDesams(),
    loadTimingDatabaseComplete(),
    loadTempleTimingsReal()
  ]);

  const traditionId = await getTraditionId(TRADITION_CODE);

  for (const t of dd) {
    try {
      const name = String(t.name || '').trim();
      if (!name) continue;

      // Basic geography from your file (state/district aren’t present; keep empty for now)
      const state = '';
      const district = null;
      const locality = '';

      // Coordinates from your file
      const lat = t.lat ?? t.latitude ?? null;
      const lng = t.lng ?? t.longitude ?? null;

      const slug = mkSlug({ traditionCode: TRADITION_CODE, state, locality, name });

      // Timings/contacts:
      // 1) exact key match against completeDB (keys are Divya Desam short names like "ThiruArangam")
      const completeRec = completeDB[name];
      const hoursFromComplete = normalizeHoursFromComplete(completeRec);
      let contacts = extractContactsFromComplete(name, completeDB);

      // 2) fuzzy match against temple-timings-real by displayName/name substring
      let realRec = null;
      const dn = String(t.displayName || '').toLowerCase();
      if (dn) {
        realRec = real.list.find(x => String(x.temple || '').toLowerCase().includes(dn));
      }
      if (!realRec) {
        // as a fallback, try name itself in long temple name
        const nn = name.toLowerCase();
        realRec = real.list.find(x => String(x.temple || '').toLowerCase().includes(nn));
      }
      if (realRec) {
        const c2 = extractContactsFromReal(realRec);
        contacts = mergeContacts(contacts, c2);
      }

      const logistics = {
        ...(hoursFromComplete ? { hours: hoursFromComplete } : {}),
        ...(t.logistics || {}),
        ...(contacts?.address ? { address: contacts.address } : {}),
        cultural_region: t.region || null
      };

      const { data: up, error: upErr } = await sb
        .from('temples')
        .upsert({
          slug, name,
          alt_names: t.displayName ? [t.displayName] : null,
          country: COUNTRY,
          state, district, locality,
          lat, lng,
          significance_tags: null,
          experience_tags: null,
          logistics,
          history: null,
          notes: null
        }, { onConflict: 'slug' })
        .select('id')
        .single();

      if (upErr) { console.log('Upsert error', slug, upErr.message); continue; }

      await linkTempleTradition(up.id, traditionId);

      const deityName = normDeity(t.perumal || 'Vishnu');
      const deityId = await upsertDeity(deityName);
      await linkTempleDeity(up.id, deityId);

      // Sources: use displayName/name + wikipedia if present later; for now none in JS
      // If you add a "wiki" or "sources" field later, this will capture it:
      if (t.wiki) await addSources(up.id, [t.wiki]);
      if (Array.isArray(t.sources)) await addSources(up.id, t.sources);

      // Contacts table rows (phones/sites/emails)
      const contactRows = [];
      for (const p of (contacts?.phones || [])) contactRows.push({ temple_id: up.id, type: 'office', phone: p });
      for (const s of (contacts?.sites  || [])) contactRows.push({ temple_id: up.id, type: 'office', website: s });
      for (const e of (contacts?.emails || [])) contactRows.push({ temple_id: up.id, type: 'office', email: e });
      if (contactRows.length) await sb.from('contacts').insert(contactRows);

      console.log('Imported:', slug);
      await pause(50);
    } catch (e) {
      console.log('Skip:', t?.name, e.message);
    }
  }

  console.log('Done.');
}

run().then(() => process.exit(0));

