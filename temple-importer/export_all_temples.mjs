import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

async function exportAllTemples() {
  console.log('📦 Exporting all temples from database...');
  
  const { data: temples, error } = await sb
    .from('temples')
    .select('name, locality, district, state, lat, lng, significance_tags, logistics, wikidata_qid')
    .order('name');
    
  if (error) {
    console.error('❌ Failed to fetch temples:', error);
    return;
  }
  
  console.log(`📊 Found ${temples.length} temples in database`);
  
  // Transform to match the expected format
  const transformedTemples = temples.map(temple => {
    // Extract deity from significance_tags if available
    let deity = 'Unknown';
    let consort = null;
    
    if (temple.significance_tags && Array.isArray(temple.significance_tags)) {
      deity = temple.significance_tags[0] || 'Unknown';
    }
    
    // Extract logistics info
    let link = `https://www.google.com/maps/search/${encodeURIComponent(temple.name + ' ' + temple.locality + ' ' + temple.state)}`;
    
    return {
      name: temple.name,
      displayName: temple.name,
      lat: temple.lat,
      lng: temple.lng,
      link: link,
      perumal: deity,
      thaayaar: consort,
      locality: temple.locality,
      district: temple.district,
      state: temple.state,
      region: determineRegion(temple),
      wikidata_qid: temple.wikidata_qid
    };
  });
  
  console.log('🔄 Transformed temple data structure');
  
  // Generate the temple-data.js file
  const jsContent = `// Auto-generated temple data - All ${temples.length} temples
// Generated on ${new Date().toISOString()}
// Includes: Divya Desam (108) + Paadal Petra (264) + Abhimana (29) temples

window.divyaDesams = ${JSON.stringify(transformedTemples, null, 2)};

console.log('📊 Loaded', window.divyaDesams.length, 'temples from all traditions');
`;

  await fs.writeFile('../temple-data.js', jsContent);
  console.log(`✅ Generated temple-data.js with ${transformedTemples.length} temples`);
  
  // Generate summary statistics
  const stats = {
    total: transformedTemples.length,
    withQids: transformedTemples.filter(t => t.wikidata_qid).length,
    byState: {}
  };
  
  transformedTemples.forEach(temple => {
    stats.byState[temple.state] = (stats.byState[temple.state] || 0) + 1;
  });
  
  console.log('\n📊 Export Statistics:');
  console.log(`  Total temples: ${stats.total}`);
  console.log(`  With Wikidata QIDs: ${stats.withQids} (${Math.round(stats.withQids/stats.total*100)}%)`);
  console.log('  By state:');
  Object.entries(stats.byState).forEach(([state, count]) => {
    console.log(`    ${state}: ${count} temples`);
  });
}

function determineRegion(temple) {
  // Simple region classification based on location and name patterns
  const name = temple.name.toLowerCase();
  const locality = (temple.locality || '').toLowerCase();
  
  // Check for Divya Desam patterns
  if (name.includes('ranganatha') || name.includes('venkateswara') || name.includes('perumal')) {
    return 'Divya Desam';
  }
  
  // Check for Paadal Petra patterns (Shiva temples)
  if (name.includes('nathar') || name.includes('eswara') || name.includes('eeswar')) {
    return 'Paadal Petra Sthalam';
  }
  
  // Check for Abhimana patterns
  if (name.includes('abhimana')) {
    return 'Abhimana Sthalam';
  }
  
  // Regional classification by state/district
  if (temple.state === 'Tamil Nadu') {
    return 'Tamil Nadu Temple';
  } else if (temple.state === 'Kerala') {
    return 'Kerala Temple';
  } else if (temple.state === 'Andhra Pradesh') {
    return 'Andhra Pradesh Temple';
  }
  
  return 'Sacred Temple';
}

exportAllTemples().catch(console.error);