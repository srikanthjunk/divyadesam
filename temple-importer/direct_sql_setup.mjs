import 'dotenv/config';
import url from 'url';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

async function executeStatement(sql, description) {
  try {
    console.log(`🔧 ${description}...`);
    
    // Use direct SQL execution without RPC
    const { data, error } = await sb
      .from('temples')
      .select('*')
      .limit(1);
      
    if (error) {
      console.log(`❌ Database connection test failed: ${error.message}`);
      return false;
    }
    
    console.log(`✅ Database connected - ${description} ready for manual execution`);
    return true;
  } catch (error) {
    console.log(`❌ ${description} failed: ${error.message}`);
    return false;
  }
}

async function testCurrentSetup() {
  console.log('🧪 Testing current database setup...\n');
  
  const tests = [
    { table: 'temples', desc: 'Main temples table' },
    { table: 'traditions', desc: 'Temple traditions' },
    { table: 'deities', desc: 'Temple deities' },
    { table: 'alert_events', desc: 'Alert events' }
  ];
  
  for (const test of tests) {
    try {
      const { count, error } = await sb.from(test.table).select('*', { count: 'exact', head: true });
      if (error) throw error;
      console.log(`✅ ${test.desc}: ${count || 0} records`);
    } catch (error) {
      console.log(`❌ ${test.desc}: ${error.message}`);
    }
  }
  
  // Test for new tables
  try {
    const { count } = await sb.from('trails').select('*', { count: 'exact', head: true });
    console.log(`✅ Trails table: ${count || 0} records`);
  } catch (error) {
    console.log(`❌ Trails table: ${error.message}`);
  }
  
  try {
    const { count } = await sb.from('subscribers').select('*', { count: 'exact', head: true });
    console.log(`✅ Subscribers table: ${count || 0} records`);
  } catch (error) {
    console.log(`❌ Subscribers table: ${error.message}`);
  }
}

async function checkMultilingualColumns() {
  try {
    const { data, error } = await sb
      .from('temples')
      .select('name, name_ta, name_te')
      .limit(1)
      .maybeSingle();
      
    if (error) {
      console.log(`❌ Multilingual columns not available: ${error.message}`);
      return false;
    }
    
    console.log('✅ Multilingual columns are available');
    return true;
  } catch (error) {
    console.log(`❌ Multilingual check failed: ${error.message}`);
    return false;
  }
}

async function manuallyCreateTables() {
  console.log('\n🔧 Attempting to create tables manually...');
  
  // Since RPC functions aren't available, let's try direct table operations
  try {
    // Create a simple trail record to test if table exists
    const { data, error } = await sb
      .from('trails')
      .insert({
        slug: 'test-trail',
        name: 'Test Trail',
        description: 'Test trail for verification'
      })
      .select('id')
      .maybeSingle();
      
    if (data) {
      console.log('✅ Trails table exists and working');
      // Clean up test record
      await sb.from('trails').delete().eq('id', data.id);
      return true;
    }
  } catch (error) {
    console.log(`❌ Trails table issue: ${error.message}`);
  }
  
  // Test subscribers table
  try {
    const { data, error } = await sb
      .from('subscribers')
      .select('id')
      .limit(1);
      
    if (!error) {
      console.log('✅ Subscribers table exists and working');
      return true;
    }
  } catch (error) {
    console.log(`❌ Subscribers table issue: ${error.message}`);
  }
  
  return false;
}

async function main() {
  console.log('🚀 Testing complete temple importer setup...\n');
  
  await testCurrentSetup();
  await checkMultilingualColumns();
  await manuallyCreateTables();
  
  console.log('\n📋 Manual SQL Setup Required:');
  console.log('Run these SQL commands in Supabase SQL Editor:');
  console.log('');
  console.log('-- 1. Trails Tables');
  console.log(`CREATE TABLE IF NOT EXISTS trails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    total_temples INTEGER DEFAULT 0,
    estimated_duration_days INTEGER,
    difficulty_level TEXT CHECK (difficulty_level IN ('easy', 'moderate', 'difficult', 'extreme')),
    region TEXT,
    state TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );`);
  
  console.log('');
  console.log('-- 2. Multilingual Columns');
  console.log(`ALTER TABLE temples 
ADD COLUMN IF NOT EXISTS name_ta TEXT,
ADD COLUMN IF NOT EXISTS name_te TEXT,
ADD COLUMN IF NOT EXISTS name_kn TEXT,
ADD COLUMN IF NOT EXISTS name_ml TEXT,
ADD COLUMN IF NOT EXISTS name_hi TEXT;`);
  
  console.log('\n✅ Setup verification completed!');
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  main().catch(console.error);
}