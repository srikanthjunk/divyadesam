import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..'); // where you'll place pariharam_mappings.json

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

// guard
(() => {
  const seg = (process.env.SUPABASE_SERVICE_KEY||'').split('.')[1];
  if (!seg) throw new Error('SUPABASE_SERVICE_KEY missing');
  const role = JSON.parse(Buffer.from(seg,'base64url').toString()).role;
  if (role !== 'service_role') throw new Error('Not a service_role key');
})();

async function getTagId(code) {
  const { data } = await sb.from('pariharam_tags').select('id').eq('code', code).maybeSingle();
  if (data) return data.id;
  const ins = await sb.from('pariharam_tags').insert({ code, label: code }).select('id').single();
  return ins.data.id;
}

async function findTempleId({ slug, name, state, locality }) {
  // 1) Exact slug
  if (slug) {
    const { data } = await sb.from('temples').select('id').eq('slug', slug).maybeSingle();
    if (data) return data.id;
  }

  // 2) Prefer name + locality/state together
  if (name && (locality || state)) {
    let q = sb.from('temples').select('id, name, state, locality').ilike('name', name);
    if (state) q = q.eq('state', state);
    if (locality) q = q.ilike('locality', `${locality}%`);
    const { data } = await q.maybeSingle();
    if (data) return data.id;
  }

  // 3) Loose name patterns / common aliases
  if (name) {
    const variants = [name];
    if (/oppili/i.test(name)) variants.push('Thiruvinnagar', 'Vinnagar');
    if (/ranganatha/i.test(name)) variants.push('Ranganathaswamy');
    const like = variants.map(v => `%${v}%`);
    for (const pat of like) {
      const { data } = await sb.from('temples').select('id').ilike('name', pat).maybeSingle();
      if (data) return data.id;
    }
  }

  // 4) Still not found
  return null;
}

async function run() {
  const file = process.argv[2] || 'pariharam_mappings.json';
  const p = path.join(ROOT, file);
  const arr = JSON.parse(await fs.readFile(p, 'utf8'));

  for (const row of arr) {
    const temple_id = await findTempleId(row);
    if (!temple_id) { console.log('Temple not found:', row); continue; }
    for (const code of row.tags) {
      const pariharam_id = await getTagId(code);
      await sb.from('temple_pariharam').upsert({ temple_id, pariharam_id });
      console.log('Tagged', row.slug || row.name, '→', code);
    }
  }
  console.log('Done.');
}
run().catch(e => { console.error(e.message); process.exit(1); });

