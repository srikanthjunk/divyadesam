import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import url from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT_DIR  = path.join(__dirname, '..');                    // parent folder with alerts.json
const ALERTS_PATH = path.join(ROOT_DIR, 'alerts.json');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

function normalize(e) {
  return {
    kind: String(e.kind).toLowerCase(),
    name: e.name || null,
    start_ts: new Date(e.start_ts).toISOString(),
    end_ts: e.end_ts ? new Date(e.end_ts).toISOString() : null,
    regions: Array.isArray(e.regions) ? e.regions : ['IN'],
    payload: e.payload || {}
  };
}

async function upsertAlert(ev) {
  const { data: existing, error: selErr } = await sb
    .from('alert_events')
    .select('id')
    .eq('kind', ev.kind)
    .eq('name', ev.name)
    .eq('start_ts', ev.start_ts)
    .maybeSingle();
  if (selErr) throw selErr;

  if (existing) {
    const { error: updErr } = await sb
      .from('alert_events')
      .update({ end_ts: ev.end_ts, regions: ev.regions, payload: ev.payload })
      .eq('id', existing.id);
    if (updErr) throw updErr;
    return { action: 'updated', id: existing.id };
  } else {
    const { data: inserted, error: insErr } = await sb
      .from('alert_events')
      .insert(ev)
      .select('id')
      .single();
    if (insErr) throw insErr;
    return { action: 'inserted', id: inserted.id };
  }
}

async function run() {
  const raw = await fs.readFile(ALERTS_PATH, 'utf8');
  const arr = JSON.parse(raw);
  for (const e of arr) {
    const ev = normalize(e);
    const { action, id } = await upsertAlert(ev);
    console.log(`${action.toUpperCase()}: ${ev.kind} — ${ev.name} @ ${ev.start_ts} (id=${id})`);
  }
  console.log('Alert events seeded.');
}
run().catch(e => { console.error(e.message); process.exit(1); });

