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
  if (s.includes('shiva') || s.includes('siva') || s.includes('nataraja')) return 'Shiva';
  if (s.includes('vishnu') || s.includes('perumal')) return 'Vishnu';
  return 'Shiva';
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

async function processBatch(filename) {
  console.log(`🔄 Processing batch: ${filename}`);
  
  const filePath = path.join(DATA_DIR, filename);
  const jsonData = await fs.readFile(filePath, 'utf8');
  const temples = JSON.parse(jsonData);
  
  const traditionId = await getTraditionId(TRADITION_CODE);
  
  let inserted = 0;
  let skipped = 0;
  
  for (const temple of temples) {
    try {
      if (!temple.name || !temple.state) {
        console.log(`⚠️  Skipping temple with missing name/state`);
        skipped++;
        continue;
      }
      
      const deity = normDeity(temple.deity || temple.primary_deity);
      const deityId = await upsertDeity(deity);
      
      const slug = mkSlug({
        traditionCode: TRADITION_CODE,
        state: temple.state,
        locality: temple.locality,
        name: temple.name
      });
      
      // Check if exists by slug
      const { data: existing } = await sb
        .from('temples')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();
        
      if (existing) {
        console.log(`⚠️  Skipping existing: ${temple.name}`);
        skipped++;
        continue;
      }
      
      const templeData = {
        slug,
        name: temple.name,
        locality: temple.locality,
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
      
      await linkTempleTradition(insertedTemple.id, traditionId);
      await linkTempleDeity(insertedTemple.id, deityId);
      
      inserted++;
      console.log(`➕ Inserted: ${temple.name}`);
      
      await pause(100);
      
    } catch (error) {
      console.log(`❌ Error processing ${temple.name}: ${error.message}`);
    }
  }
  
  console.log(`📊 Batch ${filename}: ${inserted} inserted, ${skipped} skipped`);
  return { inserted, skipped };
}

async function main() {
  const batchFile = process.argv[2] || 'paadal_petra_batch2.json';
  console.log(`🏛️  Starting Paadal Petra batch import: ${batchFile}`);
  
  const result = await processBatch(batchFile);
  console.log(`✅ Batch import completed: ${result.inserted} temples added!`);
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  main().catch(console.error);
}