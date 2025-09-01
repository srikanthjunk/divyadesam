import fs from 'fs/promises';
import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');  // repo root

// Files
const BASE = path.join(ROOT, 'abhimana.json');           // your curated list
const UPD  = path.join(ROOT, 'abhimana_updates.json');   // Gemini output

// Simple match key: name + locality (case/space-insensitive)
const key = (n,l) => `${(n||'').toLowerCase().replace(/\s+/g,' ').trim()}|${(l||'').toLowerCase().replace(/\s+/g,' ').trim()}`;

function mergeOne(base, upd) {
  // copy desired fields from update if present
  if (typeof upd.lat === 'number') base.lat = upd.lat;
  if (typeof upd.lng === 'number') base.lng = upd.lng;
  if (upd.state)    base.state = upd.state;
  if (upd.locality) base.locality = upd.locality;
  // contacts & links
  base.wiki = upd.wiki || base.wiki || null;
  if (!base.alt_names) base.alt_names = [];
  if (Array.isArray(upd.contacts?.phones) || Array.isArray(upd.contacts?.websites) || Array.isArray(upd.contacts?.emails)) {
    base.contacts = {
      phones: upd.contacts?.phones || [],
      websites: upd.contacts?.websites || [],
      emails: upd.contacts?.emails || []
    };
  }
  base.notes = upd.notes || base.notes || null;
  base.sources = upd.sources || base.sources || [];
}

async function run() {
  const base = JSON.parse(await fs.readFile(BASE, 'utf8'));
  const updates = JSON.parse(await fs.readFile(UPD, 'utf8'));

  const idx = new Map(base.map(b => [key(b.name, b.locality || b.state || ''), b]));
  let merged = 0, missing = [];

  for (const u of updates) {
    const k = key(u.name, u.locality || u.state || '');
    const row = idx.get(k);
    if (row) { mergeOne(row, u); merged++; }
    else { missing.push(u); }
  }

  // backup and write
  await fs.writeFile(BASE.replace('.json', `.backup.${Date.now()}.json`), JSON.stringify(base, null, 2));
  await fs.writeFile(BASE, JSON.stringify(base, null, 2));

  console.log(`Merged ${merged} records into abhimana.json`);
  if (missing.length) {
    const MISS = path.join(ROOT, `abhimana_updates_unmatched.${Date.now()}.json`);
    await fs.writeFile(MISS, JSON.stringify(missing, null, 2));
    console.log(`Unmatched updates: ${missing.length} → ${MISS}`);
  }
}
run().catch(e => { console.error(e.message); process.exit(1); });

