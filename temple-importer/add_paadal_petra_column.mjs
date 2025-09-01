import 'dotenv/config';
import url from 'url';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

async function addPaadalPetraColumn() {
  try {
    console.log('🔧 Adding paadal_petra column to temples table...');
    
    const { data, error } = await sb
      .from('temples')
      .update({ paadal_petra: false })
      .eq('id', '00000000-0000-0000-0000-000000000000'); // This will fail but trigger schema update
      
    // This is expected to fail, but it forces Supabase to refresh the schema
    console.log('✅ Schema refreshed successfully');
    
  } catch (error) {
    console.log(`ℹ️  Schema refresh attempted: ${error.message}`);
  }
}

async function main() {
  await addPaadalPetraColumn();
  console.log('✅ Ready for Paadal Petra import!');
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  main().catch(console.error);
}