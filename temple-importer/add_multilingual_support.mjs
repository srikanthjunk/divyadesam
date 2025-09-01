import 'dotenv/config';
import url from 'url';
import { createClient } from '@supabase/supabase-js';
import got from 'got';
import pLimit from 'p-limit';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

const UA = 'temple-importer/1.0 (alerts@communityforge.info)';
const limit = pLimit(2);

// Add multilingual columns to temples table first
async function addMultilingualColumns() {
  try {
    await sb.rpc('exec_sql', {
      sql: `
        ALTER TABLE temples 
        ADD COLUMN IF NOT EXISTS name_ta TEXT,
        ADD COLUMN IF NOT EXISTS name_te TEXT,
        ADD COLUMN IF NOT EXISTS name_kn TEXT,
        ADD COLUMN IF NOT EXISTS name_ml TEXT,
        ADD COLUMN IF NOT EXISTS name_hi TEXT;
        
        CREATE INDEX IF NOT EXISTS idx_temples_name_ta ON temples(name_ta);
        CREATE INDEX IF NOT EXISTS idx_temples_name_te ON temples(name_te);
      `
    });
    console.log('✅ Added multilingual columns to temples table');
  } catch (error) {
    // Columns might already exist
    console.log('ℹ️  Multilingual columns may already exist');
  }
}

async function getWikidataLabels(qid) {
  try {
    const url = 'https://www.wikidata.org/w/api.php';
    const response = await got(url, {
      searchParams: {
        action: 'wbgetentities',
        ids: qid,
        props: 'labels',
        languages: 'ta|te|kn|ml|hi',
        format: 'json'
      },
      headers: { 'User-Agent': UA },
      timeout: { request: 15000 }
    }).json();
    
    const entity = response?.entities?.[qid];
    if (!entity?.labels) return {};
    
    const labels = {};
    if (entity.labels.ta) labels.name_ta = entity.labels.ta.value;
    if (entity.labels.te) labels.name_te = entity.labels.te.value;
    if (entity.labels.kn) labels.name_kn = entity.labels.kn.value;
    if (entity.labels.ml) labels.name_ml = entity.labels.ml.value;
    if (entity.labels.hi) labels.name_hi = entity.labels.hi.value;
    
    return labels;
  } catch (error) {
    console.log(`❌ Failed to get labels for ${qid}: ${error.message}`);
    return {};
  }
}

async function getTemplesWithQID() {
  const { data, error } = await sb
    .from('temples')
    .select('id, slug, name, wikidata_qid')
    .not('wikidata_qid', 'is', null)
    .is('name_ta', null) // Only process temples without Tamil names
    .limit(500);
    
  if (error) throw error;
  return data;
}

async function updateTempleLabels(templeId, labels) {
  if (Object.keys(labels).length === 0) return false;
  
  const { error } = await sb
    .from('temples')
    .update({ 
      ...labels, 
      updated_at: new Date().toISOString() 
    })
    .eq('id', templeId);
    
  if (error) throw error;
  return true;
}

async function processTemple(temple) {
  try {
    console.log(`🌐 Getting multilingual names for: ${temple.name} (${temple.wikidata_qid})`);
    
    const labels = await getWikidataLabels(temple.wikidata_qid);
    
    if (Object.keys(labels).length > 0) {
      await updateTempleLabels(temple.id, labels);
      const langCount = Object.keys(labels).length;
      console.log(`✅ Added ${langCount} language labels for ${temple.name}`);
      return { success: true, count: langCount };
    } else {
      console.log(`❌ No multilingual labels found for ${temple.name}`);
      return { success: false };
    }
  } catch (error) {
    console.log(`❌ Error processing ${temple.name}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🌐 Starting multilingual support addition...');
  
  // First add the columns
  await addMultilingualColumns();
  
  const temples = await getTemplesWithQID();
  console.log(`📊 Found ${temples.length} temples with Wikidata QIDs to process`);
  
  let processed = 0;
  let successful = 0;
  let totalLabels = 0;
  let errors = 0;
  
  // Process temples with concurrency limit
  const results = await Promise.all(
    temples.map(temple => limit(async () => {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit
      return processTemple(temple);
    }))
  );
  
  results.forEach(result => {
    processed++;
    if (result.success) {
      successful++;
      totalLabels += result.count || 0;
    } else if (result.error) {
      errors++;
    }
  });
  
  console.log('\n📊 Multilingual Support Summary:');
  console.log(`🏛️  Processed: ${processed} temples`);
  console.log(`✅ Successful: ${successful} temples`);
  console.log(`🌐 Total labels added: ${totalLabels}`);
  console.log(`💥 Errors: ${errors} temples`);
  console.log('✅ Multilingual support addition completed!');
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  main().catch(console.error);
}