import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

(function assertServiceRole() {
  const key = process.env.SUPABASE_SERVICE_KEY || '';
  const seg = key.split('.')[1];
  if (!seg) throw new Error('SUPABASE_SERVICE_KEY missing');
  const payload = JSON.parse(Buffer.from(seg, 'base64url').toString());
  if (payload.role !== 'service_role') throw new Error('Not a service_role key');
})();

const prefix = process.argv.includes('--prefix') ? process.argv[process.argv.indexOf('--prefix')+1] : null;
const really = process.argv.includes('--really');

async function listOrphans() {
  // pull all temples with no traditions; optionally filter slug by prefix
  let q = sb.from('temples')
            .select('id, slug, name, created_at')
            .not('id', 'in', sb.from('temple_traditions').select('temple_id')); // PostgREST-style subquery is not supported directly

  // Workaround: fetch two lists and filter client-side
  const { data: temples, error } = await sb.from('temples').select('id, slug, name, created_at');
  if (error) throw error;
  const { data: withTrad, error: e2 } = await sb.from('temple_traditions').select('temple_id');
  if (e2) throw e2;
  const withSet = new Set(withTrad.map(r => r.temple_id));

  return temples
    .filter(t => !withSet.has(t.id))
    .filter(t => (prefix ? t.slug.startsWith(prefix) : true));
}

async function run() {
  const orphans = await listOrphans();
  console.log(`Found ${orphans.length} orphan temples${prefix ? ` with prefix '${prefix}'` : ''}.`);
  orphans.slice(0, 50).forEach(t => console.log('-', t.slug, '|', t.name));

  if (!really || !orphans.length) {
    console.log('Dry run. Add --really to delete.');
    return;
  }

  const ids = orphans.map(o => o.id);
  // delete in chunks to avoid URL length limits
  const chunk = 200;
  for (let i=0; i<ids.length; i+=chunk) {
    const batch = ids.slice(i, i+chunk);
    const { error } = await sb.from('temples').delete().in('id', batch);
    if (error) throw error;
    console.log(`Deleted ${batch.length}`);
  }
  console.log('Done.');
}
run().catch(e => { console.error(e.message); process.exit(1); });

