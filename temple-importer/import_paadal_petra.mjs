import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import url from 'url';
import { createClient } from '@supabase/supabase-js';
import slugify from 'slugify';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

const COUNTRY = 'IN';
const TRADITION_CODE = 'paadal-petra';

const pause = ms => new Promise(r => setTimeout(r, ms));

function mkSlug({ traditionCode = TRADITION_CODE, state, locality, name }) {
  const s = slugify(`${traditionCode}-${state || ''}-${locality || ''}-${name}`, { lower: true, strict: true });
  return s.replace(/-+/g, '-');
}

function normDeity(d) {
  if (!d) return 'Shiva';
  const s = d.toLowerCase();
  if (s.includes('shiva') || s.includes('siva') || s.includes('nataraja') || s.includes('easwara') || s.includes('iswara')) return 'Shiva';
  if (s.includes('vishnu') || s.includes('perumal') || s.includes('narayana')) return 'Vishnu';
  if (s.includes('murugan') || s.includes('karthik') || s.includes('subramanya')) return 'Murugan';
  if (s.includes('ambal') || s.includes('parvati') || s.includes('devi') || s.includes('amman')) return 'Ambal';
  if (s.includes('ganesha') || s.includes('vinay') || s.includes('pillaiyar')) return 'Ganesha';
  return 'Shiva'; // Default for Paadal Petra Sthalams
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

async function loadPaadalPetraData() {
  // Try to load from CSV or JSON file
  const jsonPath = path.join(DATA_DIR, 'paadal_petra.json');
  const csvPath = path.join(DATA_DIR, 'paadal_petra.csv');
  
  try {
    const jsonData = await fs.readFile(jsonPath, 'utf8');
    return JSON.parse(jsonData);
  } catch {
    try {
      const csvData = await fs.readFile(csvPath, 'utf8');
      return parsePaadalPetraCSV(csvData);
    } catch {
      console.log('No paadal_petra.json or paadal_petra.csv found. Please provide temple data.');
      process.exit(1);
    }
  }
}

function parsePaadalPetraCSV(csvText) {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = values[i] || null;
    });
    return obj;
  });
}

async function findExistingTemple(name, locality, state) {
  const queries = [
    // Exact match
    sb.from('temples').select('id, slug').eq('name', name).eq('locality', locality).eq('state', state),
    // Name and state match
    sb.from('temples').select('id, slug').eq('name', name).eq('state', state),
    // Fuzzy name match
    sb.from('temples').select('id, slug').ilike('name', `%${name}%`).eq('state', state)
  ];
  
  for (const query of queries) {
    const { data } = await query.maybeSingle();
    if (data) return data;
  }
  
  return null;
}

async function insertPaadalPetraTemple(temple, traditionId) {
  const deity = normDeity(temple.deity || temple.primary_deity);
  const deityId = await upsertDeity(deity);
  
  const slug = mkSlug({
    traditionCode: TRADITION_CODE,
    state: temple.state,
    locality: temple.locality || temple.location,
    name: temple.name
  });
  
  const templeData = {
    slug,
    name: temple.name,
    locality: temple.locality || temple.location,
    district: temple.district,
    state: temple.state,
    country: COUNTRY,
    lat: temple.lat ? parseFloat(temple.lat) : null,
    lng: temple.lng ? parseFloat(temple.lng) : null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  const { data: insertedTemple, error } = await sb
    .from('temples')
    .insert(templeData)
    .select('id')
    .single();
    
  if (error) throw error;
  
  const templeId = insertedTemple.id;
  
  // Link to tradition and deity
  await linkTempleTradition(templeId, traditionId);
  await linkTempleDeity(templeId, deityId);
  
  // Add sources if available
  const sources = [];
  if (temple.wikipedia) sources.push(temple.wikipedia);
  if (temple.website) sources.push(temple.website);
  if (sources.length) await addSources(templeId, sources);
  
  return templeId;
}

async function updateExistingTemple(existingId, temple, traditionId) {
  const deity = normDeity(temple.deity || temple.primary_deity);
  const deityId = await upsertDeity(deity);
  
  // Update temple data
  const updates = {
    updated_at: new Date().toISOString()
  };
  
  // Add coordinates if missing
  if (temple.lat && temple.lng) {
    const { data: existing } = await sb.from('temples').select('lat, lng').eq('id', existingId).single();
    if (!existing.lat || !existing.lng) {
      updates.lat = parseFloat(temple.lat);
      updates.lng = parseFloat(temple.lng);
    }
  }
  
  await sb.from('temples').update(updates).eq('id', existingId);
  
  // Link to tradition and deity
  await linkTempleTradition(existingId, traditionId);
  await linkTempleDeity(existingId, deityId);
  
  // Add sources if available
  const sources = [];
  if (temple.wikipedia) sources.push(temple.wikipedia);
  if (temple.website) sources.push(temple.website);
  if (sources.length) await addSources(existingId, sources);
  
  return existingId;
}

async function main() {
  console.log('🏛️  Starting Paadal Petra Sthalams import...');
  
  try {
    const traditionId = await getTraditionId(TRADITION_CODE);
    console.log(`✅ Found tradition ID: ${traditionId}`);
  } catch (error) {
    console.log('❌ Creating paadal-petra tradition...');
    const { data } = await sb.from('traditions').insert({
      code: TRADITION_CODE,
      name: 'Paadal Petra Sthalams',
      description: '276 sacred Shiva temples glorified in Tamil Saiva literature'
    }).select('id').single();
    console.log(`✅ Created tradition ID: ${data.id}`);
  }
  
  const traditionId = await getTraditionId(TRADITION_CODE);
  const temples = await loadPaadalPetraData();
  
  console.log(`📊 Processing ${temples.length} Paadal Petra Sthalams...`);
  
  let inserted = 0;
  let updated = 0;
  let errors = 0;
  
  for (const temple of temples) {
    try {
      if (!temple.name || !temple.state) {
        console.log(`⚠️  Skipping temple with missing name/state: ${JSON.stringify(temple)}`);
        continue;
      }
      
      const existing = await findExistingTemple(temple.name, temple.locality || temple.location, temple.state);
      
      if (existing) {
        await updateExistingTemple(existing.id, temple, traditionId);
        updated++;
        console.log(`🔄 Updated: ${temple.name} (${existing.slug})`);
      } else {
        await insertPaadalPetraTemple(temple, traditionId);
        inserted++;
        console.log(`➕ Inserted: ${temple.name}`);
      }
      
      await pause(100); // Be respectful to database
      
    } catch (error) {
      errors++;
      console.log(`❌ Error processing ${temple.name}: ${error.message}`);
    }
  }
  
  console.log('\n📊 Import Summary:');
  console.log(`➕ Inserted: ${inserted} temples`);
  console.log(`🔄 Updated: ${updated} temples`);
  console.log(`❌ Errors: ${errors} temples`);
  console.log('✅ Paadal Petra Sthalams import completed!');
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  main().catch(console.error);
}