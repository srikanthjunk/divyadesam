# Trails System Setup

## Overview
This document provides the complete setup for the trails system that allows linking temples to pilgrimage routes like Pancha Ranga Kshetram and Nava Tirupati.

## Schema Creation

### 1. Create Tables
Execute this SQL in your Supabase dashboard or via psql:

```sql
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
```

### 2. Create Helper Functions
```sql
-- Function to add temple to trail
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

-- Function to get trail with temples
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
```

## 3. Sample Data

After creating the tables, run this to populate sample trails:

```sql
-- Insert sample trails
INSERT INTO trails (name, description, region, tradition, total_temples, difficulty_level, estimated_days, trail_type) VALUES
('Pancha Ranga Kshetram', 'The five sacred temples of Lord Ranganatha - Srirangam, Srirangapatna, Rangapatna, Brahmarangam, and Parimalarangam', 'South India', 'Divya Desam', 5, 'medium', 7, 'pilgrimage'),
('Nava Tirupati', 'Nine sacred Vishnu temples in the Tirupati region forming the Nava Tirupati circuit', 'Andhra Pradesh', 'Divya Desam', 9, 'easy', 3, 'religious_circuit'),
('Chola Nadu Divya Desams', 'The 40 Divya Desam temples located in the ancient Chola kingdom region', 'Tamil Nadu', 'Divya Desam', 40, 'hard', 21, 'regional_tour'),
('Pancha Bootha Sthalams', 'Five temples representing the five elements - earth, water, fire, air, and space', 'Tamil Nadu', 'Paadal Petra Sthalams', 5, 'medium', 5, 'pilgrimage')
ON CONFLICT (name) DO NOTHING;
```

## 4. Usage Examples

### Adding Temples to Trails

```sql
-- Example: Add Srirangam to Pancha Ranga Kshetram (assuming trail_id=1, temple_id=123)
SELECT add_temple_to_trail(
  p_trail_id := 1,
  p_temple_id := 123,
  p_position := 1,
  p_day_number := 1,
  p_notes := 'Primary temple of the Pancha Ranga circuit - Adiranga',
  p_is_optional := false,
  p_estimated_duration_hours := 4
);

-- Example: Add temples in sequence
SELECT add_temple_to_trail(1, 124, 2, 2, 'Second Ranga temple');
SELECT add_temple_to_trail(1, 125, 3, 3, 'Third Ranga temple');
```

### Querying Trail Data

```sql
-- Get all trails
SELECT * FROM trails ORDER BY name;

-- Get temples in a specific trail
SELECT * FROM get_trail_temples(1);

-- Get trails containing a specific temple
SELECT t.*, tt.position, tt.notes
FROM trails t
JOIN temple_trails tt ON t.id = tt.trail_id
WHERE tt.temple_id = 123;

-- Get trail statistics
SELECT 
  t.name,
  t.total_temples,
  COUNT(tt.temple_id) as actual_linked_temples,
  AVG(tt.estimated_duration_hours) as avg_duration
FROM trails t
LEFT JOIN temple_trails tt ON t.id = tt.trail_id
GROUP BY t.id, t.name, t.total_temples;
```

## 5. Node.js Integration

After creating the tables, you can use the seeding script:

```bash
node setup_trails_simple.mjs
```

This will populate the sample trails data automatically.

## 6. Future Enhancements

- **Temple Auto-Linking**: Script to automatically link temples based on tradition/region
- **Route Optimization**: Calculate optimal visiting order based on geography
- **Pilgrimage Planning**: Generate day-by-day itineraries
- **Trail Validation**: Ensure all referenced temples exist and are accessible