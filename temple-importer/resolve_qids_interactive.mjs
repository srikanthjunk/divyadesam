// resolve_qids_interactive.mjs
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { exec } from 'node:child_process';

const USER_AGENT = 'temple-importer/1.0 (alerts@communityforge.info)';
const LANGS = ['en','ta']; // add 'te','kn','ml','si' if useful

function assertServiceRole() {
  const seg = (process.env.SUPABASE_SERVICE_KEY || '').split('.')[1];
  if (!seg) throw new Error('SUPABASE_SERVICE_KEY missing');
  const payload = JSON.parse(Buffer.from(seg, 'base64url').toString());
  if (payload.role !== 'service_role') throw new Error('Not a service_role key');
}
assertServiceRole();

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession:false } });

const rl = readline.createInterface({ input, output });
const openUrl = (u) => exec(`open "${u}"`); // macOS

const norm = s => (s||'').toLowerCase().replace(/\s+/g,' ').trim();
const uniq = arr => Array.from(new Set((arr||[]).filter(Boolean)));

function nameVariants(raw) {
  const v = new Set();
  if (!raw) return [];
  const n = raw.replace(/-/g,' ').replace(/\(.*?\)/g,'').replace(/\s+/g,' ').trim();
  v.add(n);
  v.add(n + ' Temple'); v.add(n + ' Perumal Temple'); v.add(n + ' Vishnu Temple');
  v.add(n.replace(/^Thiru/i,'Tiru')); v.add(n.replace(/^Tiru/i,'Thiru'));
  v.add(n.replace(/Kovil/i,'Koil')); v.add(n.replace(/Koil/i,'Kovil')); v.add(n.replace(/Koyil/i,'Kovil'));
  v.add(n.replace(/^Thir[ua]/i,'').trim());
  return Array.from(v).filter(Boolean);
}

async function wikiApi(lang, params) {
  const url = `https://${lang}.wikipedia.org/w/api.php?` + new URLSearchParams(params).toString();
  const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!r.ok) throw new Error(`wiki ${lang} ${r.status}`);
  return r.json();
}

async function wikiCandidates(t) {
  const loc = [t.locality, t.state].filter(Boolean).join(' ');
  const queries = uniq(nameVariants(t.name).slice(0,8).map(v => [v, loc, 'temple'].filter(Boolean).join(' ')));
  const out = [];

  for (const lang of LANGS) {
    const titles = new Set();
    for (const q of queries) {
      try {
        const j = await wikiApi(lang, { action:'query', list:'search', srsearch:q, srlimit:5, format:'json' });
        (j?.query?.search || []).forEach(s => titles.add(s.title));
      } catch {}
    }
    if (!titles.size) continue;

    // get QIDs for titles
    const pipe = Array.from(titles).slice(0,20).join('|');
    const meta = await wikiApi(lang, { action:'query', prop:'pageprops', titles: pipe, format:'json' }).catch(()=>null);
    const pages = meta?.query?.pages || {};
    for (const p of Object.values(pages)) {
      const title = p.title;
      const qid = p.pageprops?.wikibase_item || null;
      if (!title) continue;
      out.push({
        kind: `wiki-${lang}`,
        title,
        qid,
        link: `https://${lang}.wikipedia.org/wiki/${title.replace(/\s/g,'_')}`
      });
    }
  }
  // prefer ones with QID, then title containing locality/state
  const hint = norm([t.locality, t.state].filter(Boolean).join(' '));
  return out
    .sort((a,b) => (b.qid?1:0)-(a.qid?1:0) || ((norm(a.title).includes(hint)?1:0) - (norm(b.title).includes(hint)?1:0)))
    .slice(0,10);
}

async function wdCandidates(t) {
  const q = [t.name, t.locality, t.state, 'temple', 'India'].filter(Boolean).join(' ');
  const url = 'https://www.wikidata.org/w/api.php?' + new URLSearchParams({
    action:'wbsearchentities', search:q, language:'en', format:'json', limit:'5'
  }).toString();
  const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!r.ok) return [];
  const j = await r.json();
  return (j?.search || []).map(s => ({
    kind: 'wd',
    qid: s.id,
    title: `${s.label || ''} — ${s.description || ''}`.trim(),
    link: `https://www.wikidata.org/wiki/${s.id}`
  }));
}

async function listMissing(limit=200) {
  const { data, error } = await sb.from('temples')
    .select('id, slug, name, state, locality, lat, lng, wikidata_qid')
    .is('wikidata_qid', null)
    .order('state', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data;
}

async function setQID(temple_id, qid) {
  await sb.from('temples').update({ wikidata_qid: qid }).eq('id', temple_id);
  await sb.from('sources').insert({ temple_id, type: 'wikidata', url: `https://www.wikidata.org/wiki/${qid}` }).select('id');
}

async function handleTemple(t) {
  console.log('\n— — —');
  console.log(`${t.name}  (${t.locality || ''}, ${t.state || ''})`);
  console.log(`slug: ${t.slug}`);

  const [wk, wd] = await Promise.all([wikiCandidates(t), wdCandidates(t)]);
  const candidates = [...wk, ...wd];
  if (!candidates.length) {
    console.log('No candidates. Shortcuts:\n  g  open Google search\n  we open English Wikipedia search\n  wt open Tamil Wikipedia search');
  } else {
    candidates.forEach((c, i) => {
      const label = c.kind.startsWith('wiki') ? `${c.kind}  ${c.title}` : `${c.kind}  ${c.qid}  ${c.title}`;
      const qtag = c.qid ? `  [${c.qid}]` : '';
      console.log(`${i+1}. ${label}${qtag}`);
    });
  }

  // helper links
  const q = encodeURIComponent([t.name, t.locality, t.state, 'temple'].filter(Boolean).join(' '));
  const links = {
    g:  `https://www.google.com/search?q=${q}`,
    we: `https://en.wikipedia.org/w/index.php?search=${q}`,
    wt: `https://ta.wikipedia.org/w/index.php?search=${q}`,
    wd: `https://www.wikidata.org/w/index.php?search=${q}`
  };

  while (true) {
    const ans = await rl.question('Pick number / paste QID / oN=open N / g/we/wt/wd / s=skip / q=quit: ');
    if (!ans) continue;
    if (ans === 'q') process.exit(0);
    if (ans === 's') return;

    if (['g','we','wt','wd'].includes(ans)) { openUrl(links[ans]); continue; }
    if (/^o\d+$/i.test(ans)) {
      const idx = parseInt(ans.slice(1),10)-1;
      const c = candidates[idx]; if (c?.link) openUrl(c.link); else console.log('No link for that candidate');
      continue;
    }
    if (/^\d+$/.test(ans)) {
      const idx = parseInt(ans,10)-1;
      const c = candidates[idx];
      if (!c) { console.log('No such candidate'); continue; }
      const qid = c.qid || (await rl.question('No QID on that item. Paste QID (Q12345) or Enter to cancel: ')).trim();
      if (!qid) continue;
      await setQID(t.id, qid);
      if (c.link && c.kind.startsWith('wiki')) await sb.from('sources').insert({ temple_id: t.id, type: 'wiki', url: c.link }).select('id');
      console.log(`✓ set ${qid}`);
      return;
    }
    if (/^Q\d+$/i.test(ans)) {
      await setQID(t.id, ans.toUpperCase());
      console.log(`✓ set ${ans.toUpperCase()}`);
      return;
    }
    console.log('Unrecognized input.');
  }
}

async function run() {
  const limitArg = Number(process.argv[2]) || 500;
  const list = await listMissing(limitArg);
  console.log(`Missing QID count (loaded): ${list.length}`);
  for (const t of list) {
    await handleTemple(t);
  }
  rl.close();
  console.log('\nAll done.');
}

run().catch(e => { console.error(e); process.exit(1); });

