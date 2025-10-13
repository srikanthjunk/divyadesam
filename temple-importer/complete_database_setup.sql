-- ========================================================================================================
-- DIVYA DESAM COMPLETE DATABASE SETUP
-- ========================================================================================================
-- Run this ENTIRE script in Supabase SQL Editor to set up your database from scratch
-- Go to: https://supabase.com/dashboard/project/kcuvbgahpghzrazztlmb/sql
-- ========================================================================================================

-- ========================================================================================================
-- 1. CREATE TEMPLES TABLE (Main table for 108 Divya Desam temples)
-- ========================================================================================================

CREATE TABLE IF NOT EXISTS temples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  perumal TEXT,
  thaayaar TEXT,
  region TEXT,
  timing TEXT,
  phone TEXT,
  website TEXT,
  link TEXT,
  qid TEXT,
  description TEXT,
  history TEXT,
  festivals JSONB DEFAULT '[]',
  nearby_places JSONB DEFAULT '[]',

  -- Multilingual names
  name_ta TEXT,
  name_te TEXT,
  name_kn TEXT,
  name_ml TEXT,
  name_hi TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(name)
);

-- ========================================================================================================
-- 2. CREATE ALERT EVENTS TABLE (Temple festival/event notifications)
-- ========================================================================================================

CREATE TABLE IF NOT EXISTS alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  temple_id UUID REFERENCES temples(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  event_date DATE NOT NULL,
  event_type TEXT CHECK (event_type IN ('festival', 'ceremony', 'special_occasion', 'anniversary')),
  description TEXT,
  notification_days_before INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================================================================================
-- 3. CREATE SUBSCRIBERS TABLE (Email subscription management)
-- ========================================================================================================

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

-- ========================================================================================================
-- 4. CREATE SENT ALERTS TABLE (Track sent email notifications)
-- ========================================================================================================

CREATE TABLE IF NOT EXISTS sent_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID REFERENCES subscribers(id) ON DELETE CASCADE,
  alert_event_id UUID REFERENCES alert_events(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  email_status TEXT DEFAULT 'sent',

  UNIQUE(subscriber_id, alert_event_id)
);

-- ========================================================================================================
-- 5. CREATE TRAILS TABLE (Pilgrimage routes)
-- ========================================================================================================

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

-- ========================================================================================================
-- 6. CREATE TEMPLE_TRAILS TABLE (Trail-temple associations)
-- ========================================================================================================

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

-- ========================================================================================================
-- 7. CREATE INDEXES FOR PERFORMANCE
-- ========================================================================================================

-- Temple indexes
CREATE INDEX IF NOT EXISTS idx_temples_coordinates ON temples (lat, lng);
CREATE INDEX IF NOT EXISTS idx_temples_display_name ON temples (display_name);
CREATE INDEX IF NOT EXISTS idx_temples_region ON temples (region);
CREATE INDEX IF NOT EXISTS idx_temples_name_ta ON temples (name_ta);
CREATE INDEX IF NOT EXISTS idx_temples_name_te ON temples (name_te);
CREATE INDEX IF NOT EXISTS idx_temples_qid ON temples (qid);

-- Alert events indexes
CREATE INDEX IF NOT EXISTS idx_alert_events_temple_id ON alert_events (temple_id);
CREATE INDEX IF NOT EXISTS idx_alert_events_date ON alert_events (event_date);
CREATE INDEX IF NOT EXISTS idx_alert_events_type ON alert_events (event_type);

-- Subscribers indexes
CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers (email);
CREATE INDEX IF NOT EXISTS idx_subscribers_token ON subscribers (unsubscribe_token);
CREATE INDEX IF NOT EXISTS idx_subscribers_active ON subscribers (is_active);

-- Sent alerts indexes
CREATE INDEX IF NOT EXISTS idx_sent_alerts_subscriber ON sent_alerts (subscriber_id);
CREATE INDEX IF NOT EXISTS idx_sent_alerts_event ON sent_alerts (alert_event_id);

-- Trails indexes
CREATE INDEX IF NOT EXISTS idx_trails_slug ON trails (slug);
CREATE INDEX IF NOT EXISTS idx_trails_region ON trails (region);
CREATE INDEX IF NOT EXISTS idx_trails_state ON trails (state);

-- Temple trails indexes
CREATE INDEX IF NOT EXISTS idx_temple_trails_trail_id ON temple_trails (trail_id);
CREATE INDEX IF NOT EXISTS idx_temple_trails_temple_id ON temple_trails (temple_id);
CREATE INDEX IF NOT EXISTS idx_temple_trails_position ON temple_trails (trail_id, position);

-- ========================================================================================================
-- 8. ENABLE ROW LEVEL SECURITY (RLS)
-- ========================================================================================================

ALTER TABLE temples ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sent_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE trails ENABLE ROW LEVEL SECURITY;
ALTER TABLE temple_trails ENABLE ROW LEVEL SECURITY;

-- ========================================================================================================
-- 9. CREATE RLS POLICIES
-- ========================================================================================================

-- TEMPLES: Public read, admin write
DROP POLICY IF EXISTS "Public read access to temples" ON temples;
CREATE POLICY "Public read access to temples"
ON temples FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Service role can manage temples" ON temples;
CREATE POLICY "Service role can manage temples"
ON temples FOR ALL
USING (auth.role() = 'service_role');

-- ALERT EVENTS: Public read, admin write
DROP POLICY IF EXISTS "Public read access to alert events" ON alert_events;
CREATE POLICY "Public read access to alert events"
ON alert_events FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Service role can manage alert events" ON alert_events;
CREATE POLICY "Service role can manage alert events"
ON alert_events FOR ALL
USING (auth.role() = 'service_role');

-- SUBSCRIBERS: Private, admin only
DROP POLICY IF EXISTS "Service role can manage subscribers" ON subscribers;
CREATE POLICY "Service role can manage subscribers"
ON subscribers FOR ALL
USING (auth.role() = 'service_role');

-- SENT ALERTS: Admin only
DROP POLICY IF EXISTS "Service role can manage sent alerts" ON sent_alerts;
CREATE POLICY "Service role can manage sent alerts"
ON sent_alerts FOR ALL
USING (auth.role() = 'service_role');

-- TRAILS: Public read, admin write
DROP POLICY IF EXISTS "Public read access to trails" ON trails;
CREATE POLICY "Public read access to trails"
ON trails FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Service role can manage trails" ON trails;
CREATE POLICY "Service role can manage trails"
ON trails FOR ALL
USING (auth.role() = 'service_role');

-- TEMPLE TRAILS: Public read, admin write
DROP POLICY IF EXISTS "Public read access to temple trails" ON temple_trails;
CREATE POLICY "Public read access to temple trails"
ON temple_trails FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Service role can manage temple trails" ON temple_trails;
CREATE POLICY "Service role can manage temple trails"
ON temple_trails FOR ALL
USING (auth.role() = 'service_role');

-- ========================================================================================================
-- 10. CREATE VIEWS
-- ========================================================================================================

-- Public view of temples (no sensitive admin fields)
CREATE OR REPLACE VIEW public_temples AS
SELECT
  id,
  name,
  display_name,
  lat,
  lng,
  perumal,
  thaayaar,
  region,
  timing,
  phone,
  website,
  link,
  description,
  history,
  festivals,
  nearby_places,
  name_ta,
  name_te,
  name_kn,
  name_ml,
  name_hi,
  created_at
FROM temples;

-- Upcoming events view
CREATE OR REPLACE VIEW upcoming_events AS
SELECT
  ae.id,
  ae.event_name,
  ae.event_date,
  ae.event_type,
  ae.description,
  t.display_name as temple_name,
  t.lat,
  t.lng,
  t.region
FROM alert_events ae
JOIN temples t ON ae.temple_id = t.id
WHERE ae.event_date >= CURRENT_DATE
ORDER BY ae.event_date ASC;

-- Active subscribers count
CREATE OR REPLACE VIEW subscriber_stats AS
SELECT
  COUNT(*) FILTER (WHERE is_active = true) as active_subscribers,
  COUNT(*) FILTER (WHERE is_active = false) as inactive_subscribers,
  COUNT(*) as total_subscribers
FROM subscribers;

-- Grant public access to views
GRANT SELECT ON public_temples TO anon, authenticated;
GRANT SELECT ON upcoming_events TO anon, authenticated;

-- ========================================================================================================
-- 11. INSERT SAMPLE PILGRIMAGE TRAILS
-- ========================================================================================================

INSERT INTO trails (slug, name, description, estimated_duration_days, difficulty_level, region, state)
VALUES
  ('pancha-ranga-kshetram', 'Pancha Ranga Kshetram', 'Five sacred Ranganatha temples across South India - Srirangam, Srirangapatna, Kumbakonam, Indalur, and Mysuru', 7, 'moderate', 'South India', 'Multi-state'),
  ('nava-tirupati', 'Nava Tirupati', 'Nine Tirupati temples pilgrimage circuit in the Kanchipuram region', 3, 'easy', 'Tamil Nadu', 'Tamil Nadu'),
  ('kanchipuram-circuit', 'Kanchipuram Temple Circuit', 'Major Divya Desam temples in the ancient temple city of Kanchipuram', 2, 'easy', 'Tamil Nadu', 'Tamil Nadu'),
  ('chola-nadu-trail', 'Chola Nadu Pilgrimage', 'Temple circuit covering the historic Chola Nadu region with 40 Divya Desams', 10, 'moderate', 'Tamil Nadu', 'Tamil Nadu'),
  ('kerala-temples', 'Kerala Divya Desams', 'Pilgrimage covering all Kerala-based Divya Desam temples', 5, 'moderate', 'Kerala', 'Kerala')
ON CONFLICT (slug) DO NOTHING;

-- ========================================================================================================
-- 12. UTILITY FUNCTIONS
-- ========================================================================================================

-- Function to update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for auto-updating updated_at
DROP TRIGGER IF EXISTS update_temples_updated_at ON temples;
CREATE TRIGGER update_temples_updated_at
    BEFORE UPDATE ON temples
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_alert_events_updated_at ON alert_events;
CREATE TRIGGER update_alert_events_updated_at
    BEFORE UPDATE ON alert_events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscribers_updated_at ON subscribers;
CREATE TRIGGER update_subscribers_updated_at
    BEFORE UPDATE ON subscribers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_trails_updated_at ON trails;
CREATE TRIGGER update_trails_updated_at
    BEFORE UPDATE ON trails
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to check RLS status
CREATE OR REPLACE FUNCTION check_rls_status()
RETURNS TABLE (
  table_name text,
  rls_enabled boolean,
  policies_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.relname::text,
    c.relrowsecurity,
    COUNT(p.polname)
  FROM pg_class c
  LEFT JOIN pg_policy p ON p.polrelid = c.oid
  WHERE c.relnamespace = 'public'::regnamespace
    AND c.relkind = 'r'
    AND c.relname IN ('temples', 'alert_events', 'subscribers', 'sent_alerts', 'trails', 'temple_trails')
  GROUP BY c.relname, c.relrowsecurity
  ORDER BY c.relname;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================================================================================
-- 13. VERIFICATION
-- ========================================================================================================

-- Check RLS status
SELECT * FROM check_rls_status();

-- List all tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Count policies
SELECT
  schemaname,
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;

-- ========================================================================================================
-- ✅ SETUP COMPLETE!
-- ========================================================================================================
-- Your database is now ready with:
-- ✅ All tables created (temples, alert_events, subscribers, trails, etc.)
-- ✅ Row Level Security (RLS) enabled on all tables
-- ✅ Security policies in place (public read, admin write)
-- ✅ Indexes for performance
-- ✅ Sample pilgrimage trails
-- ✅ Utility functions and triggers
--
-- NEXT STEPS:
-- 1. Import temple data using: node temple-importer/import_divyadesam.mjs
-- 2. Verify data: SELECT COUNT(*) FROM temples;
-- 3. Test RLS: Try reading temples with Anon Key (should work)
-- 4. Test security: Try writing with Anon Key (should fail)
-- ========================================================================================================
