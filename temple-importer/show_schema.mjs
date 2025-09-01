import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

async function main() {
  console.log('📊 Current database schema:');
  
  // Try to get table names
  const tables = ['temples', 'traditions', 'deities', 'trails', 'temple_trails'];
  
  for (const table of tables) {
    try {
      const { data, error } = await sb.from(table).select('*').limit(1);
      if (error) {
        console.log(`❌ ${table}: ${error.message}`);
      } else {
        console.log(`✅ ${table}: exists`);
      }
    } catch (error) {
      console.log(`❌ ${table}: ${error.message}`);
    }
  }
}

main().catch(console.error);