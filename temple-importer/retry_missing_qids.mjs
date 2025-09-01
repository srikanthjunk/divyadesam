import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import url from 'url';
import { createClient } from '@supabase/supabase-js';
import got from 'got';
import pLimit from 'p-limit';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

const UA = 'temple-importer/1.0 (alerts@communityforge.info)';
const limit = pLimit(2); // Conservative rate limiting for Wikidata

async function searchWikidataByName(name, locality, state) {
  try {
    const searchTerms = [
      `${name} temple ${locality} ${state}`,
      `${name} ${locality} ${state}`,
      `${name} temple ${state}`,
      name
    ];
    
    for (const searchTerm of searchTerms) {
      const url = 'https://www.wikidata.org/w/api.php';
      const response = await got(url, {
        searchParams: {
          action: 'wbsearchentities',
          search: searchTerm,
          language: 'en',
          format: 'json',
          limit: 5
        },
        headers: { 'User-Agent': UA },
        timeout: { request: 15000 }
      }).json();
      
      if (response?.search?.length > 0) {
        // Look for temple-related results
        for (const result of response.search) {
          const desc = (result.description || '').toLowerCase();
          if (desc.includes('temple') || desc.includes('shrine') || desc.includes('kovil')) {
            return result.id;
          }
        }
        // If no temple-specific result, try the first match
        if (response.search[0]) {
          return response.search[0].id;
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit
    }
    
    return null;
  } catch (error) {
    console.log(`❌ Wikidata search failed for ${name}: ${error.message}`);
    return null;
  }
}

async function getTemplesWithoutQID(limit = 50, offset = 0) {
  const { data, error } = await sb
    .from('temples')
    .select('id, slug, name, locality, state')
    .is('wikidata_qid', null)
    .range(offset, offset + limit - 1);
    
  if (error) throw error;
  return data;
}

async function updateTempleQID(templeId, qid) {
  const { error } = await sb
    .from('temples')
    .update({ wikidata_qid: qid, updated_at: new Date().toISOString() })
    .eq('id', templeId);
    
  if (error) throw error;
}

async function processTemple(temple) {
  try {
    console.log(`🔍 Searching Wikidata for: ${temple.name} (${temple.locality}, ${temple.state})`);
    
    const qid = await searchWikidataByName(temple.name, temple.locality, temple.state);
    
    if (qid) {
      await updateTempleQID(temple.id, qid);
      console.log(`✅ Found QID ${qid} for ${temple.name}`);
      return { success: true, qid };
    } else {
      console.log(`❌ No QID found for ${temple.name}`);
      return { success: false };
    }
  } catch (error) {
    console.log(`❌ Error processing ${temple.name}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🔍 Starting missing Wikidata QID resolution...');
  
  const BATCH_SIZE = 25;
  let offset = 0;
  let totalFound = 0;
  let totalNotFound = 0;
  let totalErrors = 0;
  let batchNumber = 1;
  
  while (true) {
    const temples = await getTemplesWithoutQID(BATCH_SIZE, offset);
    
    if (temples.length === 0) {
      console.log('✅ All temples processed!');
      break;
    }
    
    console.log(`\n📦 Processing batch ${batchNumber} (${temples.length} temples, offset ${offset})`);
    
    let found = 0;
    let notFound = 0;
    let errors = 0;
    
    // Process temples with concurrency limit
    const results = await Promise.all(
      temples.map(temple => limit(() => processTemple(temple)))
    );
    
    results.forEach(result => {
      if (result.success) {
        found++;
        totalFound++;
      } else if (result.error) {
        errors++;
        totalErrors++;
      } else {
        notFound++;
        totalNotFound++;
      }
    });
    
    console.log(`📊 Batch ${batchNumber} Results: ✅${found} ❌${notFound} 💥${errors}`);
    
    offset += BATCH_SIZE;
    batchNumber++;
    
    // Progress update every 5 batches
    if (batchNumber % 5 === 0) {
      console.log(`\n🎯 Overall Progress: ✅${totalFound} ❌${totalNotFound} 💥${totalErrors}`);
    }
  }
  
  console.log('\n📊 Final QID Resolution Summary:');
  console.log(`✅ Found: ${totalFound} QIDs`);
  console.log(`❌ Not found: ${totalNotFound} temples`);
  console.log(`💥 Errors: ${totalErrors} temples`);
  console.log('✅ Missing QID resolution completed!');
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  main().catch(console.error);
}