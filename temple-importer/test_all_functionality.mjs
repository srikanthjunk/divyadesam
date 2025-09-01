import 'dotenv/config';
import url from 'url';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

async function testDatabaseConnection() {
  try {
    const { count, error } = await sb.from('temples').select('*', { count: 'exact', head: true });
    if (error) throw error;
    console.log(`✅ Database connection: ${count || 0} temples in database`);
    return true;
  } catch (error) {
    console.log(`❌ Database connection failed: ${error.message}`);
    return false;
  }
}

async function testTableStructure() {
  const tables = ['temples', 'traditions', 'deities', 'temple_traditions', 'temple_deities', 'sources', 'alert_events', 'trails', 'temple_trails', 'subscribers', 'sent_alerts'];
  let passed = 0;
  
  for (const table of tables) {
    try {
      const { count, error } = await sb.from(table).select('*', { count: 'exact', head: true });
      if (error) throw error;
      console.log(`✅ Table ${table}: ${count || 0} records`);
      passed++;
    } catch (error) {
      console.log(`❌ Table ${table}: ${error.message}`);
    }
  }
  
  return passed === tables.length;
}

async function testTempleTraditions() {
  try {
    const { data: traditions, error: tradError } = await sb.from('traditions').select('id, code');
    if (tradError) throw tradError;
    
    console.log('✅ Temple-Tradition relationships:');
    
    for (const tradition of traditions) {
      const { count, error } = await sb
        .from('temple_traditions')
        .select('*', { count: 'exact', head: true })
        .eq('tradition_id', tradition.id);
        
      if (error) throw error;
      console.log(`  ${tradition.code}: ${count || 0} temples`);
    }
    
    return true;
  } catch (error) {
    console.log(`❌ Temple-Tradition test failed: ${error.message}`);
    return false;
  }
}

async function testWikidataIntegration() {
  try {
    const { data, error } = await sb
      .from('temples')
      .select('wikidata_qid')
      .not('wikidata_qid', 'is', null)
      .select('*', { count: 'exact' });
      
    if (error) throw error;
    
    const { count: totalCount } = await sb.from('temples').select('*', { count: 'exact', head: true });
    const wikidataCount = data.length;
    const percentage = totalCount > 0 ? Math.round((wikidataCount / totalCount) * 100) : 0;
    
    console.log(`✅ Wikidata integration: ${wikidataCount}/${totalCount} temples (${percentage}%) have QIDs`);
    return true;
  } catch (error) {
    console.log(`❌ Wikidata integration test failed: ${error.message}`);
    return false;
  }
}

async function testMultilingualSupport() {
  try {
    const { data, error } = await sb
      .from('temples')
      .select('name_ta, name_te, name_kn, name_ml, name_hi')
      .or('name_ta.not.is.null,name_te.not.is.null,name_kn.not.is.null,name_ml.not.is.null,name_hi.not.is.null')
      .limit(5);
      
    if (error) throw error;
    
    console.log(`✅ Multilingual support: ${data.length} temples have multilingual names`);
    if (data.length > 0) {
      console.log('  Sample:', data[0]);
    }
    return true;
  } catch (error) {
    console.log(`❌ Multilingual support test failed: ${error.message}`);
    return false;
  }
}

async function testTrailsSystem() {
  try {
    const { data: trails, error: trailsError } = await sb
      .from('trails')
      .select('id, slug, name, total_temples')
      .limit(5);
      
    if (trailsError) throw trailsError;
    
    console.log(`✅ Trails system: ${trails.length} trails available`);
    
    for (const trail of trails) {
      const { data: templeTrails, error: ttError } = await sb
        .from('temple_trails')
        .select('position, temples(name, locality)')
        .eq('trail_id', trail.id)
        .order('position');
        
      if (ttError) throw ttError;
      
      console.log(`  ${trail.name}: ${templeTrails.length} temples linked`);
    }
    
    return true;
  } catch (error) {
    console.log(`❌ Trails system test failed: ${error.message}`);
    return false;
  }
}

async function testAlertSystem() {
  try {
    const { data: events, error: eventsError } = await sb
      .from('alert_events')
      .select('*', { count: 'exact', head: true });
      
    if (eventsError) throw eventsError;
    
    const { data: subscribers, error: subsError } = await sb
      .from('subscribers')
      .select('*', { count: 'exact', head: true });
      
    if (subsError) throw subsError;
    
    console.log(`✅ Alert system: ${events.length || 0} events, ${subscribers.length || 0} subscribers`);
    return true;
  } catch (error) {
    console.log(`❌ Alert system test failed: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🧪 Starting comprehensive functionality tests...\n');
  
  const tests = [
    { name: 'Database Connection', test: testDatabaseConnection },
    { name: 'Table Structure', test: testTableStructure },
    { name: 'Temple-Tradition Relationships', test: testTempleTraditions },
    { name: 'Wikidata Integration', test: testWikidataIntegration },
    { name: 'Multilingual Support', test: testMultilingualSupport },
    { name: 'Trails System', test: testTrailsSystem },
    { name: 'Alert System', test: testAlertSystem }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const { name, test } of tests) {
    console.log(`\n🔬 Testing: ${name}`);
    const result = await test();
    if (result) {
      passed++;
    } else {
      failed++;
    }
  }
  
  console.log('\n📊 Test Results Summary:');
  console.log(`✅ Passed: ${passed}/${tests.length} tests`);
  console.log(`❌ Failed: ${failed}/${tests.length} tests`);
  
  if (failed === 0) {
    console.log('🎉 All functionality tests passed!');
  } else {
    console.log('⚠️  Some tests failed - check logs above');
  }
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  main().catch(console.error);
}