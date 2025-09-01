import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from './email.mjs';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

async function createSubscribersTable() {
  try {
    await sb.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS subscribers (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email TEXT UNIQUE NOT NULL,
          unsubscribe_token TEXT UNIQUE DEFAULT gen_random_uuid(),
          is_active BOOLEAN DEFAULT TRUE,
          subscribed_at TIMESTAMPTZ DEFAULT NOW(),
          unsubscribed_at TIMESTAMPTZ,
          preferences JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(email);
        CREATE INDEX IF NOT EXISTS idx_subscribers_token ON subscribers(unsubscribe_token);
        CREATE INDEX IF NOT EXISTS idx_subscribers_active ON subscribers(is_active);
        
        -- Add sent_alerts tracking table
        CREATE TABLE IF NOT EXISTS sent_alerts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          subscriber_id UUID REFERENCES subscribers(id) ON DELETE CASCADE,
          alert_event_id UUID REFERENCES alert_events(id) ON DELETE CASCADE,
          sent_at TIMESTAMPTZ DEFAULT NOW(),
          email_status TEXT DEFAULT 'sent',
          
          UNIQUE(subscriber_id, alert_event_id)
        );
        
        CREATE INDEX IF NOT EXISTS idx_sent_alerts_subscriber ON sent_alerts(subscriber_id);
        CREATE INDEX IF NOT EXISTS idx_sent_alerts_event ON sent_alerts(alert_event_id);
      `
    });
    console.log('✅ Created subscribers and sent_alerts tables');
  } catch (error) {
    console.log('ℹ️  Tables may already exist:', error.message);
  }
}

function gmapsLink(name) { 
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

function buildEmailBody(events, unsubscribeToken) {
  if (!events.length) return null;
  const lines = [];
  lines.push('🔔 Upcoming Temple Alerts (next 2 days)');
  lines.push('');
  events.forEach(ev => {
    lines.push(fmtEvent(ev));
    lines.push('');
  });
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('🚨 Sent by Divya Desam Temple Locator');
  lines.push('🌐 https://divyadesam.communityforge.info');
  lines.push('');
  lines.push(`📧 Unsubscribe: https://divyadesam.communityforge.info/unsubscribe?token=${unsubscribeToken}`);
  return lines.join('\n');
}

async function fetchUpcomingEvents() {
  const now = new Date();
  const to = new Date(now.getTime() + 2*24*60*60*1000);
  
  const { data, error } = await sb
    .from('alert_events')
    .select('*')
    .gte('start_ts', now.toISOString().split('T')[0] + 'T00:00:00Z')
    .lte('start_ts', to.toISOString())
    .order('start_ts', { ascending: true });
    
  if (error) throw error;
  return data;
}

async function getActiveSubscribers() {
  const { data, error } = await sb
    .from('subscribers')
    .select('id, email, unsubscribe_token')
    .eq('is_active', true);
    
  if (error) throw error;
  return data;
}

async function getUnsentAlertsForSubscriber(subscriberId, eventIds) {
  const { data, error } = await sb
    .from('sent_alerts')
    .select('alert_event_id')
    .eq('subscriber_id', subscriberId)
    .in('alert_event_id', eventIds);
    
  if (error) throw error;
  
  const sentEventIds = new Set(data.map(r => r.alert_event_id));
  return eventIds.filter(id => !sentEventIds.has(id));
}

async function markAlertAsSent(subscriberId, eventId, status = 'sent') {
  await sb
    .from('sent_alerts')
    .upsert({
      subscriber_id: subscriberId,
      alert_event_id: eventId,
      email_status: status
    });
}

async function sendScheduledAlerts() {
  console.log('📧 Starting scheduled alert sending...');
  
  const events = await fetchUpcomingEvents();
  if (!events.length) {
    console.log('ℹ️  No upcoming events in next 2 days');
    return;
  }
  
  console.log(`📊 Found ${events.length} upcoming events`);
  
  const subscribers = await getActiveSubscribers();
  if (!subscribers.length) {
    console.log('ℹ️  No active subscribers');
    return;
  }
  
  console.log(`📊 Found ${subscribers.length} active subscribers`);
  
  let totalSent = 0;
  let totalErrors = 0;
  
  for (const subscriber of subscribers) {
    try {
      const eventIds = events.map(e => e.id);
      const unsentEventIds = await getUnsentAlertsForSubscriber(subscriber.id, eventIds);
      
      if (unsentEventIds.length === 0) {
        console.log(`ℹ️  No new alerts for ${subscriber.email}`);
        continue;
      }
      
      const unsentEvents = events.filter(e => unsentEventIds.includes(e.id));
      const emailBody = buildEmailBody(unsentEvents, subscriber.unsubscribe_token);
      
      if (emailBody) {
        await sendEmail({
          to: subscriber.email,
          subject: `🔔 ${unsentEvents.length} Temple Alert${unsentEvents.length > 1 ? 's' : ''} - Next 2 Days`,
          text: emailBody
        });
        
        // Mark all events as sent for this subscriber
        for (const eventId of unsentEventIds) {
          await markAlertAsSent(subscriber.id, eventId, 'sent');
        }
        
        totalSent++;
        console.log(`📧 Sent ${unsentEvents.length} alerts to ${subscriber.email}`);
        
        // Rate limit email sending
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (error) {
      totalErrors++;
      console.log(`❌ Error sending to ${subscriber.email}: ${error.message}`);
      
      // Mark as failed
      const eventIds = events.map(e => e.id);
      for (const eventId of eventIds) {
        await markAlertAsSent(subscriber.id, eventId, 'failed');
      }
    }
  }
  
  console.log('\n📊 Scheduled Alerts Summary:');
  console.log(`📧 Emails sent: ${totalSent}`);
  console.log(`💥 Errors: ${totalErrors}`);
  console.log('✅ Scheduled alert sending completed!');
}

async function main() {
  await createSubscribersTable();
  await sendScheduledAlerts();
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  main().catch(console.error);
}