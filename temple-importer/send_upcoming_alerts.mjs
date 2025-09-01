import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from './email.mjs';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false }});

// Window: today to +2 days
function iso(d) { return d.toISOString(); }
const now = new Date();
const to = new Date(now.getTime() + 2*24*60*60*1000);

async function fetchUpcomingEvents() {
  const { data, error } = await sb
    .from('alert_events')
    .select('*')
    .gte('start_ts', iso(new Date(now.getFullYear(), now.getMonth(), now.getDate()))) // start of today
    .lte('start_ts', iso(to))
    .order('start_ts', { ascending: true });
  if (error) throw error;
  return data;
}

async function fetchSubscribers() {
  const { data, error } = await sb
    .from('subscribers')
    .select('email')
    .eq('is_active', true);
  if (error) throw error;
  return data.map(x => ({ email: x.email }));
}

function gmapsLink(name){ 
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;
}
function fmtEvent(ev) {
  const when = new Date(ev.start_ts).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const recs = (ev.payload?.recommendations || []).length
    ? ev.payload.recommendations.map(s => `• ${s} — ${gmapsLink(s)}`).join('\n')
    : '• (Add temple recommendations soon)';
  const notes = ev.payload?.notes ? `\nNotes: ${ev.payload.notes}` : '';
  return `— ${ev.kind.toUpperCase()} — ${ev.name}\nWhen: ${when}\nRegions: ${ev.regions?.join(', ') || '—'}\nTemples:\n${recs}${notes}`;
}

function buildEmailBody(events) {
  if (!events.length) return null;
  const lines = [];
  lines.push('🔔 Upcoming Temple Alerts (next 2 days)');
  lines.push('');
  events.forEach(ev => {
    lines.push(fmtEvent(ev));
    lines.push('');
  });
  lines.push('Manage preferences (coming soon).');
  return lines.join('\n');
}

async function run() {
  const [events, subs] = await Promise.all([fetchUpcomingEvents(), fetchSubscribers()]);
  if (!events.length) {
    console.log('No events in next 2 days — nothing to send.');
    return;
  }
  const body = buildEmailBody(events);
  if (!body) return;

  for (const s of subs) {
    try {
      await sendEmail({ to: s.email, subject: 'Upcoming Temple Alerts', text: body });
      console.log('Sent to', s.email);
    } catch (e) {
      console.log('Failed to', s.email, e.message);
    }
  }
}

run().catch(e => { console.error(e.message); process.exit(1); });

