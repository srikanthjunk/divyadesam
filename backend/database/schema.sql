-- BhaktiMap Peyarchi Feature - Simplified Schema (SQLite)
-- No user accounts - just collect birth details + email for alerts

-- Subscribers table (one entry per person)
CREATE TABLE IF NOT EXISTS subscribers (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,

    -- Birth details
    date_of_birth DATE NOT NULL,
    time_of_birth TIME NOT NULL,
    place_of_birth TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    timezone TEXT NOT NULL,

    -- Calculated astrology data (cached from Prokerala)
    nakshatra TEXT,
    nakshatra_pada INTEGER,
    nakshatra_lord TEXT,
    rashi TEXT,
    rashi_lord TEXT,
    lagna TEXT,
    lagna_lord TEXT,

    -- Alert preferences
    send_alerts INTEGER DEFAULT 1, -- 1 = yes, 0 = no
    alert_frequency TEXT DEFAULT 'monthly', -- monthly, quarterly, major_only

    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_calculated DATETIME,
    last_alert_sent DATETIME,
    unsubscribe_token TEXT UNIQUE
);

-- Peyarchi status (current and upcoming transits)
CREATE TABLE IF NOT EXISTS peyarchi_status (
    id TEXT PRIMARY KEY,
    subscriber_id TEXT NOT NULL,
    planet TEXT NOT NULL, -- Sani, Guru, Rahu, Ketu
    from_rashi TEXT,
    to_rashi TEXT NOT NULL,
    effect TEXT NOT NULL, -- favorable, neutral, unfavorable, critical
    effect_score INTEGER, -- -3 to +3
    effect_description TEXT,
    remedies TEXT, -- JSON array of remedy suggestions
    start_date DATE NOT NULL,
    end_date DATE,
    is_current INTEGER DEFAULT 0, -- 1 if currently active
    is_upcoming INTEGER DEFAULT 0, -- 1 if starting within 90 days
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (subscriber_id) REFERENCES subscribers(id) ON DELETE CASCADE,
    UNIQUE(subscriber_id, planet, start_date)
);

-- Email alert queue
CREATE TABLE IF NOT EXISTS alert_queue (
    id TEXT PRIMARY KEY,
    subscriber_id TEXT NOT NULL,
    alert_type TEXT NOT NULL, -- peyarchi_upcoming, peyarchi_current, remedy_reminder
    planet TEXT,
    subject TEXT NOT NULL,
    html_content TEXT NOT NULL,
    scheduled_date DATETIME NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, sent, failed
    sent_at DATETIME,
    error_message TEXT,

    FOREIGN KEY (subscriber_id) REFERENCES subscribers(id) ON DELETE CASCADE
);

-- Recommended temples for each subscriber
CREATE TABLE IF NOT EXISTS recommended_temples (
    id TEXT PRIMARY KEY,
    subscriber_id TEXT NOT NULL,
    temple_name TEXT NOT NULL,
    deity TEXT NOT NULL,
    planet TEXT, -- Which navagraha temple
    reason TEXT, -- "Sani peyarchi remedy", "Guru pariharam", etc
    distance_km REAL,
    priority INTEGER DEFAULT 3, -- 1 (urgent) to 5 (optional)

    FOREIGN KEY (subscriber_id) REFERENCES subscribers(id) ON DELETE CASCADE
);

-- API usage tracking (for Prokerala rate limiting)
CREATE TABLE IF NOT EXISTS api_usage (
    id TEXT PRIMARY KEY,
    api_name TEXT DEFAULT 'prokerala',
    endpoint TEXT,
    credits_used INTEGER DEFAULT 1,
    response_status INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(email);
CREATE INDEX IF NOT EXISTS idx_peyarchi_subscriber ON peyarchi_status(subscriber_id, is_current);
CREATE INDEX IF NOT EXISTS idx_peyarchi_upcoming ON peyarchi_status(is_upcoming, start_date);
CREATE INDEX IF NOT EXISTS idx_alert_queue_pending ON alert_queue(status, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_api_usage_date ON api_usage(created_at);

-- View for subscriber dashboard
CREATE VIEW IF NOT EXISTS subscriber_dashboard AS
SELECT
    s.id,
    s.email,
    s.name,
    s.nakshatra,
    s.rashi,
    s.lagna,
    s.place_of_birth,
    GROUP_CONCAT(DISTINCT
        CASE WHEN ps.is_current = 1
        THEN ps.planet || ': ' || ps.effect
        END
    ) as current_transits,
    GROUP_CONCAT(DISTINCT
        CASE WHEN ps.is_upcoming = 1
        THEN ps.planet || ' → ' || ps.to_rashi || ' on ' || ps.start_date
        END
    ) as upcoming_transits,
    COUNT(DISTINCT rt.id) as recommended_temples_count,
    s.last_alert_sent
FROM subscribers s
LEFT JOIN peyarchi_status ps ON s.id = ps.subscriber_id
LEFT JOIN recommended_temples rt ON s.id = rt.subscriber_id
GROUP BY s.id;
