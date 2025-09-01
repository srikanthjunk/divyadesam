import 'dotenv/config';
import url from 'url';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

async function executeSQL(sql, description) {
  try {
    console.log(`🔧 ${description}...`);
    const { data, error } = await sb.rpc('exec_sql', { sql });
    if (error) throw error;
    console.log(`✅ ${description} completed`);
    return true;
  } catch (error) {
    console.log(`❌ ${description} failed: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 Running complete temple importer setup...\n');
  
  // 1. Create trails tables
  const trailsSQL = `
    CREATE TABLE IF NOT EXISTS trails (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      total_temples INTEGER DEFAULT 0,
      estimated_duration_days INTEGER,
      difficulty_level TEXT CHECK (difficulty_level IN ('easy', 'moderate', 'difficult', 'extreme')),
      region TEXT,
      state TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    CREATE TABLE IF NOT EXISTS temple_trails (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      trail_id UUID NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
      temple_id UUID NOT NULL REFERENCES temples(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      is_optional BOOLEAN DEFAULT FALSE,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      
      UNIQUE(trail_id, temple_id),
      UNIQUE(trail_id, position)
    );
  `;
  
  await executeSQL(trailsSQL, 'Creating trails tables');
  
  // 2. Add multilingual columns
  const multilingualSQL = `
    ALTER TABLE temples 
    ADD COLUMN IF NOT EXISTS name_ta TEXT,
    ADD COLUMN IF NOT EXISTS name_te TEXT,
    ADD COLUMN IF NOT EXISTS name_kn TEXT,
    ADD COLUMN IF NOT EXISTS name_ml TEXT,
    ADD COLUMN IF NOT EXISTS name_hi TEXT;
  `;
  
  await executeSQL(multilingualSQL, 'Adding multilingual columns');
  
  // 3. Create subscribers table
  const subscribersSQL = `
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
    
    CREATE TABLE IF NOT EXISTS sent_alerts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      subscriber_id UUID REFERENCES subscribers(id) ON DELETE CASCADE,
      alert_event_id UUID REFERENCES alert_events(id) ON DELETE CASCADE,
      sent_at TIMESTAMPTZ DEFAULT NOW(),
      email_status TEXT DEFAULT 'sent',
      
      UNIQUE(subscriber_id, alert_event_id)
    );
  `;
  
  await executeSQL(subscribersSQL, 'Creating subscribers tables');
  
  // 4. Create indexes
  const indexesSQL = `
    CREATE INDEX IF NOT EXISTS idx_trails_slug ON trails(slug);
    CREATE INDEX IF NOT EXISTS idx_trails_region ON trails(region);
    CREATE INDEX IF NOT EXISTS idx_temple_trails_trail_id ON temple_trails(trail_id);
    CREATE INDEX IF NOT EXISTS idx_temple_trails_temple_id ON temple_trails(temple_id);
    CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(email);
    CREATE INDEX IF NOT EXISTS idx_subscribers_token ON subscribers(unsubscribe_token);
    CREATE INDEX IF NOT EXISTS idx_temples_name_ta ON temples(name_ta);
    CREATE INDEX IF NOT EXISTS idx_temples_name_te ON temples(name_te);
  `;
  
  await executeSQL(indexesSQL, 'Creating indexes');
  
  // 5. Insert sample trails
  const sampleTrailsSQL = `
    INSERT INTO trails (slug, name, description, estimated_duration_days, difficulty_level, region, state)
    VALUES 
      ('pancha-ranga-kshetram', 'Pancha Ranga Kshetram', 'Five sacred Ranganatha temples across South India', 7, 'moderate', 'South India', 'Multi-state'),
      ('nava-tirupati', 'Nava Tirupati', 'Nine Tirupati temples pilgrimage circuit', 3, 'easy', 'Andhra Pradesh', 'Andhra Pradesh'),
      ('kanchipuram-circuit', 'Kanchipuram Temple Circuit', 'Major temples in the temple city of Kanchipuram', 2, 'easy', 'Tamil Nadu', 'Tamil Nadu')
    ON CONFLICT (slug) DO NOTHING;
  `;
  
  await executeSQL(sampleTrailsSQL, 'Inserting sample trails');
  
  console.log('\n🎉 Complete setup finished! Database is ready for temple imports.');
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  main().catch(console.error);
}