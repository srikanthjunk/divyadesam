-- Create trails table
CREATE TABLE IF NOT EXISTS trails (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  region VARCHAR(100),
  tradition VARCHAR(50),
  total_temples INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Additional metadata
  difficulty_level VARCHAR(20) DEFAULT 'medium', -- easy, medium, hard
  estimated_days INTEGER,
  trail_type VARCHAR(50), -- pilgrimage, religious_circuit, regional_tour
  status VARCHAR(20) DEFAULT 'active' -- active, inactive, draft
);

-- Create indexes for trails table
CREATE INDEX IF NOT EXISTS idx_trails_tradition ON trails(tradition);
CREATE INDEX IF NOT EXISTS idx_trails_region ON trails(region);
CREATE INDEX IF NOT EXISTS idx_trails_status ON trails(status);

-- Create temple_trails junction table
CREATE TABLE IF NOT EXISTS temple_trails (
  id SERIAL PRIMARY KEY,
  trail_id INTEGER REFERENCES trails(id) ON DELETE CASCADE,
  temple_id INTEGER REFERENCES temples(id) ON DELETE CASCADE,
  position INTEGER NOT NULL, -- Order in the trail (1, 2, 3...)
  
  -- Trail-specific metadata for this temple
  day_number INTEGER, -- Which day of the pilgrimage
  notes TEXT, -- Special instructions for this temple in the trail
  is_optional BOOLEAN DEFAULT false, -- Optional stop vs mandatory
  estimated_duration_hours INTEGER DEFAULT 2, -- Time to spend at this temple
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique position per trail
  UNIQUE(trail_id, position),
  -- Ensure temple appears only once per trail
  UNIQUE(trail_id, temple_id)
);

-- Create indexes for temple_trails table
CREATE INDEX IF NOT EXISTS idx_temple_trails_trail_id ON temple_trails(trail_id);
CREATE INDEX IF NOT EXISTS idx_temple_trails_temple_id ON temple_trails(temple_id);
CREATE INDEX IF NOT EXISTS idx_temple_trails_position ON temple_trails(trail_id, position);

-- Helper function to add temple to trail
CREATE OR REPLACE FUNCTION add_temple_to_trail(
  p_trail_id INTEGER,
  p_temple_id INTEGER,
  p_position INTEGER DEFAULT NULL,
  p_day_number INTEGER DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_is_optional BOOLEAN DEFAULT false,
  p_estimated_duration_hours INTEGER DEFAULT 2
) RETURNS INTEGER AS $$
DECLARE
  v_position INTEGER;
BEGIN
  -- Auto-assign position if not provided
  IF p_position IS NULL THEN
    SELECT COALESCE(MAX(position), 0) + 1 INTO v_position
    FROM temple_trails 
    WHERE trail_id = p_trail_id;
  ELSE
    v_position := p_position;
  END IF;
  
  -- Insert the temple-trail relationship
  INSERT INTO temple_trails (
    trail_id, temple_id, position, day_number, notes, 
    is_optional, estimated_duration_hours
  ) VALUES (
    p_trail_id, p_temple_id, v_position, p_day_number, p_notes,
    p_is_optional, p_estimated_duration_hours
  );
  
  -- Update trail temple count
  UPDATE trails 
  SET total_temples = (
    SELECT COUNT(*) FROM temple_trails WHERE trail_id = p_trail_id
  ),
  updated_at = NOW()
  WHERE id = p_trail_id;
  
  RETURN v_position;
END;
$$ LANGUAGE plpgsql;

-- Helper function to get trail with temples
CREATE OR REPLACE FUNCTION get_trail_temples(p_trail_id INTEGER)
RETURNS TABLE(
  trail_name VARCHAR,
  temple_position INTEGER,
  temple_name VARCHAR,
  temple_locality VARCHAR,
  temple_district VARCHAR,
  day_number INTEGER,
  notes TEXT,
  is_optional BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.name as trail_name,
    tt.position as temple_position,
    tmp.name as temple_name,
    tmp.locality as temple_locality,
    tmp.district as temple_district,
    tt.day_number,
    tt.notes,
    tt.is_optional
  FROM trails t
  JOIN temple_trails tt ON t.id = tt.trail_id
  JOIN temples tmp ON tt.temple_id = tmp.id
  WHERE t.id = p_trail_id
  ORDER BY tt.position;
END;
$$ LANGUAGE plpgsql;