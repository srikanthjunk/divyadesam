import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import url from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

async function executeSQLFile() {
  try {
    const sqlPath = path.join(__dirname, 'create_trails_tables.sql');
    const sqlContent = await fs.readFile(sqlPath, 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`📊 Executing ${statements.length} SQL statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          await sb.rpc('exec_sql', { sql: statement });
          console.log(`✅ Statement ${i + 1}/${statements.length} executed`);
        } catch (error) {
          // Some statements might fail if already exists - that's ok
          if (error.message.includes('already exists')) {
            console.log(`ℹ️  Statement ${i + 1}/${statements.length} - already exists`);
          } else {
            console.log(`❌ Statement ${i + 1}/${statements.length} failed: ${error.message}`);
          }
        }
      }
    }
    
    console.log('✅ Database setup completed!');
    
  } catch (error) {
    console.log(`❌ Database setup failed: ${error.message}`);
    throw error;
  }
}

async function setupSubscribersTable() {
  try {
    const sql = `
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
    `;
    
    await sb.rpc('exec_sql', { sql });
    console.log('✅ Subscribers tables created');
    
  } catch (error) {
    console.log(`ℹ️  Subscribers tables may already exist: ${error.message}`);
  }
}

async function addMultilingualColumns() {
  try {
    const sql = `
      ALTER TABLE temples 
      ADD COLUMN IF NOT EXISTS name_ta TEXT,
      ADD COLUMN IF NOT EXISTS name_te TEXT,
      ADD COLUMN IF NOT EXISTS name_kn TEXT,
      ADD COLUMN IF NOT EXISTS name_ml TEXT,
      ADD COLUMN IF NOT EXISTS name_hi TEXT;
      
      CREATE INDEX IF NOT EXISTS idx_temples_name_ta ON temples(name_ta);
      CREATE INDEX IF NOT EXISTS idx_temples_name_te ON temples(name_te);
    `;
    
    await sb.rpc('exec_sql', { sql });
    console.log('✅ Multilingual columns added');
    
  } catch (error) {
    console.log(`ℹ️  Multilingual columns may already exist: ${error.message}`);
  }
}

async function main() {
  console.log('🏗️  Setting up complete database schema...');
  
  await executeSQLFile();
  await setupSubscribersTable(); 
  await addMultilingualColumns();
  
  console.log('✅ Complete database setup finished!');
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  main().catch(console.error);
}