-- Create trails table for temple pilgrimage routes
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

-- Create temple_trails join table for many-to-many relationship
CREATE TABLE IF NOT EXISTS temple_trails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trail_id UUID NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
    temple_id UUID NOT NULL REFERENCES temples(id) ON DELETE CASCADE,
    position INTEGER NOT NULL, -- Order in the trail (1, 2, 3...)
    is_optional BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(trail_id, temple_id),
    UNIQUE(trail_id, position)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_trails_slug ON trails(slug);
CREATE INDEX IF NOT EXISTS idx_trails_region ON trails(region);
CREATE INDEX IF NOT EXISTS idx_trails_state ON trails(state);
CREATE INDEX IF NOT EXISTS idx_temple_trails_trail_id ON temple_trails(trail_id);
CREATE INDEX IF NOT EXISTS idx_temple_trails_temple_id ON temple_trails(temple_id);
CREATE INDEX IF NOT EXISTS idx_temple_trails_position ON temple_trails(trail_id, position);

-- Create trigger to update total_temples count
CREATE OR REPLACE FUNCTION update_trail_temple_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE trails 
        SET total_temples = (
            SELECT COUNT(*) 
            FROM temple_trails 
            WHERE trail_id = NEW.trail_id
        ),
        updated_at = NOW()
        WHERE id = NEW.trail_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE trails 
        SET total_temples = (
            SELECT COUNT(*) 
            FROM temple_trails 
            WHERE trail_id = OLD.trail_id
        ),
        updated_at = NOW()
        WHERE id = OLD.trail_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS trail_temple_count_trigger ON temple_trails;
CREATE TRIGGER trail_temple_count_trigger
    AFTER INSERT OR DELETE ON temple_trails
    FOR EACH ROW
    EXECUTE FUNCTION update_trail_temple_count();

-- Insert some sample trails
INSERT INTO trails (slug, name, description, estimated_duration_days, difficulty_level, region, state)
VALUES 
    ('pancha-ranga-kshetram', 'Pancha Ranga Kshetram', 'Five sacred Ranganatha temples across South India', 7, 'moderate', 'South India', 'Multi-state'),
    ('nava-tirupati', 'Nava Tirupati', 'Nine Tirupati temples pilgrimage circuit', 3, 'easy', 'Andhra Pradesh', 'Andhra Pradesh'),
    ('kanchipuram-circuit', 'Kanchipuram Temple Circuit', 'Major temples in the temple city of Kanchipuram', 2, 'easy', 'Tamil Nadu', 'Tamil Nadu'),
    ('thanjavur-region', 'Thanjavur Region Temples', 'Important temples in historic Thanjavur district', 4, 'moderate', 'Tamil Nadu', 'Tamil Nadu')
ON CONFLICT (slug) DO NOTHING;

COMMENT ON TABLE trails IS 'Pilgrimage routes connecting multiple temples';
COMMENT ON TABLE temple_trails IS 'Junction table linking temples to pilgrimage trails with ordering';
COMMENT ON COLUMN temple_trails.position IS 'Order of temple visit in the trail (1=first, 2=second, etc.)';
COMMENT ON COLUMN temple_trails.is_optional IS 'Whether this temple is optional in the pilgrimage route';