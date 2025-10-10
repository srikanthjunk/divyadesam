#!/usr/bin/env node

/**
 * Simple Temple Data Importer for Divya Desam
 * Imports 108 temples from temple-data.js into Supabase
 */

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import url from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);

/**
 * Load temple data from temple-data.js
 * The file uses browser globals (window), so we need to parse it differently
 */
async function loadTempleData() {
  const filePath = path.join(__dirname, '..', 'temple-data.js');
  const content = await fs.readFile(filePath, 'utf8');

  // Extract the array content using regex
  const match = content.match(/const divyaDesams = (\[[\s\S]*?\]);/);
  if (!match) {
    throw new Error('Could not find divyaDesams array in temple-data.js');
  }

  // Convert JavaScript object notation to JSON
  let arrayContent = match[1];

  // Replace JavaScript object syntax with JSON syntax
  // Add quotes around property names
  arrayContent = arrayContent.replace(/(\w+):/g, '"$1":');

  // Parse as JSON
  try {
    return JSON.parse(arrayContent);
  } catch (error) {
    console.error('Failed to parse temple data as JSON');
    console.error('This might be due to complex JavaScript syntax in temple-data.js');
    throw error;
  }
}

/**
 * Import a single temple into Supabase
 */
async function importTemple(temple, index, total) {
  const {
    name,
    displayName,
    lat,
    lng,
    link,
    perumal,
    thaayaar,
    region,
    locality,
    district,
    state,
    wikidata_qid
  } = temple;

  // Prepare temple data with ALL fields from temple-data.js
  const templeData = {
    name: name || displayName,
    display_name: displayName || name,
    lat: lat ? parseFloat(lat) : null,
    lng: lng ? parseFloat(lng) : null,
    link: link || null,
    perumal: perumal || null,
    thaayaar: thaayaar || null,
    region: region || null,
    locality: locality || null,
    district: district || null,
    state: state || null,
    wikidata_qid: wikidata_qid || null,
  };

  try {
    // Insert or update temple
    const { data, error } = await supabase
      .from('temples')
      .upsert(templeData, {
        onConflict: 'name',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) {
      console.error(`❌ [${index + 1}/${total}] Failed: ${displayName}`);
      console.error(`   Error: ${error.message}`);
      return false;
    }

    console.log(`✅ [${index + 1}/${total}] Imported: ${displayName} (${region})`);
    return true;
  } catch (err) {
    console.error(`❌ [${index + 1}/${total}] Exception: ${displayName}`);
    console.error(`   ${err.message}`);
    return false;
  }
}

/**
 * Main import function
 */
async function main() {
  console.log('🏛️  Divya Desam Temple Importer');
  console.log('================================\n');

  // Check environment variables
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('❌ Error: Missing Supabase credentials in .env file');
    console.error('   Please ensure SUPABASE_URL and SUPABASE_SERVICE_KEY are set');
    process.exit(1);
  }

  console.log(`📡 Connecting to Supabase...`);
  console.log(`   URL: ${process.env.SUPABASE_URL}\n`);

  // Load temple data
  console.log('📖 Loading temple data from temple-data.js...');
  let temples;
  try {
    temples = await loadTempleData();
    console.log(`✅ Loaded ${temples.length} temples\n`);
  } catch (error) {
    console.error('❌ Failed to load temple data:', error.message);
    process.exit(1);
  }

  // Import temples
  console.log('🚀 Starting import...\n');

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < temples.length; i++) {
    const success = await importTemple(temples[i], i, temples.length);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Summary
  console.log('\n================================');
  console.log('📊 Import Summary');
  console.log('================================');
  console.log(`✅ Successfully imported: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📋 Total temples: ${temples.length}`);
  console.log('================================\n');

  if (failCount > 0) {
    console.log('⚠️  Some temples failed to import. Check the errors above.');
    process.exit(1);
  } else {
    console.log('🎉 All temples imported successfully!\n');
    console.log('Next steps:');
    console.log('1. View temples: https://supabase.com/dashboard/project/kcuvbgahpghzrazztlmb/editor');
    console.log('2. Test API: SELECT COUNT(*) FROM temples;');
    console.log('3. Verify RLS: Try reading with Anon Key\n');
    process.exit(0);
  }
}

// Run the import
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
