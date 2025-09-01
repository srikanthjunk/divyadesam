import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

async function main() {
  console.log('📊 Quick QID Status Check...');
  
  const { data: total } = await sb.from('temples').select('id', { count: 'exact' });
  const { data: withQids } = await sb.from('temples').select('id', { count: 'exact' }).not('wikidata_qid', 'is', null);
  const { data: withoutQids } = await sb.from('temples').select('id', { count: 'exact' }).is('wikidata_qid', null);
  
  console.log(`Total temples: ${total.length}`);
  console.log(`With QIDs: ${withQids.length} (${Math.round(withQids.length/total.length*100)}%)`);
  console.log(`Without QIDs: ${withoutQids.length} (${Math.round(withoutQids.length/total.length*100)}%)`);
  
  // Sample temples with QIDs
  const { data: samples } = await sb
    .from('temples')
    .select('name, wikidata_qid')
    .not('wikidata_qid', 'is', null)
    .limit(5);
    
  console.log('\nSample temples with QIDs:');
  samples.forEach(t => console.log(`  ${t.name}: ${t.wikidata_qid}`));
}

main().catch(console.error);