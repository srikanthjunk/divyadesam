-- ================================================
-- SUPABASE SECURITY SETUP - Row Level Security
-- ================================================
-- Run this in Supabase SQL Editor after revoking old keys
-- This adds defense-in-depth even if API keys are exposed
-- ================================================

-- ================================================
-- 1. ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ================================================

-- Temples table (main temple data)
ALTER TABLE IF EXISTS temples ENABLE ROW LEVEL SECURITY;

-- Alert events (scheduled temple events)
ALTER TABLE IF EXISTS alert_events ENABLE ROW LEVEL SECURITY;

-- Subscriptions (user email subscriptions)
ALTER TABLE IF EXISTS subscriptions ENABLE ROW LEVEL SECURITY;

-- Trails (pilgrimage trails)
ALTER TABLE IF EXISTS trails ENABLE ROW LEVEL SECURITY;

-- Trail temples (junction table)
ALTER TABLE IF EXISTS trail_temples ENABLE ROW LEVEL SECURITY;

-- ================================================
-- 2. TEMPLES TABLE POLICIES
-- ================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public read access to temples" ON temples;
DROP POLICY IF EXISTS "Service role can insert temples" ON temples;
DROP POLICY IF EXISTS "Service role can update temples" ON temples;
DROP POLICY IF EXISTS "Service role can delete temples" ON temples;

-- Allow anyone to READ temple data (public directory)
CREATE POLICY "Public read access to temples"
ON temples
FOR SELECT
USING (true);

-- Only service role can INSERT temples
CREATE POLICY "Service role can insert temples"
ON temples
FOR INSERT
WITH CHECK (auth.role() = 'service_role');

-- Only service role can UPDATE temples
CREATE POLICY "Service role can update temples"
ON temples
FOR UPDATE
USING (auth.role() = 'service_role');

-- Only service role can DELETE temples
CREATE POLICY "Service role can delete temples"
ON temples
FOR DELETE
USING (auth.role() = 'service_role');

-- ================================================
-- 3. ALERT EVENTS TABLE POLICIES
-- ================================================

DROP POLICY IF EXISTS "Public read access to alert events" ON alert_events;
DROP POLICY IF EXISTS "Service role can manage alert events" ON alert_events;

-- Allow anyone to READ alert events (public information)
CREATE POLICY "Public read access to alert events"
ON alert_events
FOR SELECT
USING (true);

-- Only service role can manage (INSERT/UPDATE/DELETE) alert events
CREATE POLICY "Service role can manage alert events"
ON alert_events
FOR ALL
USING (auth.role() = 'service_role');

-- ================================================
-- 4. SUBSCRIPTIONS TABLE POLICIES (SENSITIVE)
-- ================================================

DROP POLICY IF EXISTS "Users can read own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Service role can manage subscriptions" ON subscriptions;

-- Users can only see their own subscriptions (by email)
-- This requires authenticated users or service role
CREATE POLICY "Users can read own subscriptions"
ON subscriptions
FOR SELECT
USING (
  auth.role() = 'service_role' OR
  email = auth.jwt()->>'email'
);

-- Only service role can INSERT/UPDATE/DELETE subscriptions
CREATE POLICY "Service role can manage subscriptions"
ON subscriptions
FOR ALL
USING (auth.role() = 'service_role');

-- ================================================
-- 5. TRAILS TABLE POLICIES
-- ================================================

DROP POLICY IF EXISTS "Public read access to trails" ON trails;
DROP POLICY IF EXISTS "Service role can manage trails" ON trails;

-- Allow anyone to READ trails (public pilgrimage routes)
CREATE POLICY "Public read access to trails"
ON trails
FOR SELECT
USING (true);

-- Only service role can manage trails
CREATE POLICY "Service role can manage trails"
ON trails
FOR ALL
USING (auth.role() = 'service_role');

-- ================================================
-- 6. TRAIL TEMPLES TABLE POLICIES
-- ================================================

DROP POLICY IF EXISTS "Public read access to trail temples" ON trail_temples;
DROP POLICY IF EXISTS "Service role can manage trail temples" ON trail_temples;

-- Allow anyone to READ trail-temple associations
CREATE POLICY "Public read access to trail temples"
ON trail_temples
FOR SELECT
USING (true);

-- Only service role can manage trail temples
CREATE POLICY "Service role can manage trail temples"
ON trail_temples
FOR ALL
USING (auth.role() = 'service_role');

-- ================================================
-- 7. CREATE INDEXES FOR PERFORMANCE
-- ================================================

-- Index on temple coordinates for nearby searches
CREATE INDEX IF NOT EXISTS idx_temples_coordinates
ON temples (lat, lng);

-- Index on temple names for search
CREATE INDEX IF NOT EXISTS idx_temples_display_name
ON temples (display_name);

-- Index on alert events date
CREATE INDEX IF NOT EXISTS idx_alert_events_date
ON alert_events (event_date);

-- Index on subscriptions email (for lookups)
CREATE INDEX IF NOT EXISTS idx_subscriptions_email
ON subscriptions (email);

-- Index on subscriptions active status
CREATE INDEX IF NOT EXISTS idx_subscriptions_active
ON subscriptions (is_active);

-- ================================================
-- 8. CREATE SECURITY VIEWS (Optional)
-- ================================================

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
  created_at
FROM temples;

-- Public view of upcoming events
CREATE OR REPLACE VIEW upcoming_events AS
SELECT
  ae.id,
  ae.event_name,
  ae.event_date,
  ae.description,
  t.display_name as temple_name,
  t.lat,
  t.lng
FROM alert_events ae
JOIN temples t ON ae.temple_id = t.id
WHERE ae.event_date >= CURRENT_DATE
ORDER BY ae.event_date ASC;

-- Grant public read access to views
GRANT SELECT ON public_temples TO anon, authenticated;
GRANT SELECT ON upcoming_events TO anon, authenticated;

-- ================================================
-- 9. SECURITY AUDIT FUNCTIONS
-- ================================================

-- Function to check if tables are properly secured
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
    AND c.relname IN ('temples', 'alert_events', 'subscriptions', 'trails', 'trail_temples')
  GROUP BY c.relname, c.relrowsecurity
  ORDER BY c.relname;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- 10. VERIFICATION
-- ================================================

-- Check RLS status on all tables
SELECT * FROM check_rls_status();

-- Verify policies exist
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ================================================
-- NOTES AND BEST PRACTICES
-- ================================================

/*
1. ANON KEY (Public Key):
   - Safe to use in frontend JavaScript
   - Can only read public data (SELECT policies with USING true)
   - Cannot modify data without proper policies
   - Use this in your HTML/frontend code

2. SERVICE ROLE KEY (Secret Key):
   - Has full admin access (bypasses RLS)
   - MUST be kept secret
   - Only use in backend scripts (Node.js)
   - NEVER expose in frontend code
   - Keep in .env file (which is now in .gitignore)

3. AFTER REVOKING OLD KEYS:
   - Get your NEW service role key from Supabase dashboard
   - Update temple-importer/.env with NEW key
   - Your scripts will continue to work with full access
   - But if anon key is exposed, attackers can only read public data

4. TESTING RLS:
   - Test with anon key: Should only allow reads
   - Test with service key: Should allow all operations
   - Try to insert with anon key: Should fail

5. MONITORING:
   - Check Supabase logs regularly
   - Monitor for unusual API usage
   - Set up usage alerts in Supabase dashboard
*/

-- ================================================
-- END OF SECURITY SETUP
-- ================================================
