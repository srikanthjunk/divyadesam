import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import url from 'url';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

async function createTrailsTable() {
  console.log('🛤️ Creating trails table...');
  
  const { error } = await sb.rpc('exec_sql', {
    sql: `
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
      
      CREATE INDEX IF NOT EXISTS idx_trails_tradition ON trails(tradition);
      CREATE INDEX IF NOT EXISTS idx_trails_region ON trails(region);
      CREATE INDEX IF NOT EXISTS idx_trails_status ON trails(status);
    `
  });
  
  if (error) {
    console.error('❌ Failed to create trails table:', error);
    return false;
  }
  
  console.log('✅ Trails table created successfully');
  return true;
}

async function createTempleTrailsTable() {
  console.log('🔗 Creating temple_trails junction table...');
  
  const { error } = await sb.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS temple_trails (
        id SERIAL PRIMARY KEY,
        trail_id INTEGER REFERENCES trails(id) ON DELETE CASCADE,
        temple_id INTEGER REFERENCES temples(id) ON DELETE CASCADE,
        position INTEGER NOT NULL, -- Order in the trail (1, 2, 3...)
        
        -- Trail-specific metadata for this temple
        day_number INTEGER, -- Which day of the pilgrimage
        notes TEXT, -- Special instructions for this temple in the trail
        is_optional BOOLEAN DEFAULT false, -- Optional stop vs mandatory
        estimated_duration_hours INTEGER, -- Time to spend at this temple
        
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        
        -- Ensure unique position per trail
        UNIQUE(trail_id, position),
        -- Ensure temple appears only once per trail
        UNIQUE(trail_id, temple_id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_temple_trails_trail_id ON temple_trails(trail_id);
      CREATE INDEX IF NOT EXISTS idx_temple_trails_temple_id ON temple_trails(temple_id);
      CREATE INDEX IF NOT EXISTS idx_temple_trails_position ON temple_trails(trail_id, position);
    `
  });
  
  if (error) {
    console.error('❌ Failed to create temple_trails table:', error);
    return false;
  }
  
  console.log('✅ Temple_trails junction table created successfully');
  return true;
}

async function seedSampleTrails() {
  console.log('🌱 Seeding sample trails...');
  
  const sampleTrails = [
    {
      name: 'Pancha Ranga Kshetram',
      description: 'The five sacred temples of Lord Ranganatha - Srirangam, Srirangapatna, Rangapatna, Brahmarangam, and Parimalarangam',
      region: 'South India',
      tradition: 'Divya Desam',
      total_temples: 5,
      difficulty_level: 'medium',
      estimated_days: 7,
      trail_type: 'pilgrimage'
    },
    {
      name: 'Nava Tirupati',
      description: 'Nine sacred Vishnu temples in the Tirupati region forming the Nava Tirupati circuit',
      region: 'Andhra Pradesh',
      tradition: 'Divya Desam',
      total_temples: 9,
      difficulty_level: 'easy',
      estimated_days: 3,
      trail_type: 'religious_circuit'
    },
    {
      name: 'Chola Nadu Divya Desams',
      description: 'The 40 Divya Desam temples located in the ancient Chola kingdom region',
      region: 'Tamil Nadu',
      tradition: 'Divya Desam',
      total_temples: 40,
      difficulty_level: 'hard',
      estimated_days: 21,
      trail_type: 'regional_tour'
    },
    {
      name: 'Pancha Bootha Sthalams',
      description: 'Five temples representing the five elements - earth, water, fire, air, and space',
      region: 'Tamil Nadu',
      tradition: 'Paadal Petra Sthalams',
      total_temples: 5,
      difficulty_level: 'medium',
      estimated_days: 5,
      trail_type: 'pilgrimage'
    }
  ];
  
  for (const trail of sampleTrails) {
    try {
      const { data, error } = await sb
        .from('trails')
        .insert(trail)
        .select('id, name')
        .single();
        
      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          console.log(`ℹ️ Trail '${trail.name}' already exists, skipping...`);
        } else {
          console.error(`❌ Failed to insert trail '${trail.name}':`, error);
        }
      } else {
        console.log(`✅ Created trail: ${data.name} (ID: ${data.id})`);
      }
    } catch (error) {
      console.error(`❌ Error creating trail '${trail.name}':`, error.message);
    }
  }
}

async function createHelperFunctions() {
  console.log('🔧 Creating helper functions...');
  
  const { error } = await sb.rpc('exec_sql', {
    sql: `
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
    `
  });
  
  if (error) {
    console.error('❌ Failed to create helper functions:', error);
    return false;
  }
  
  console.log('✅ Helper functions created successfully');
  return true;
}

async function linkSampleTemples() {
  console.log('🔗 Linking sample temples to trails...');
  
  // Get trail IDs
  const { data: trails } = await sb
    .from('trails')
    .select('id, name');
    
  if (!trails || trails.length === 0) {
    console.log('ℹ️ No trails found to link temples to');
    return;
  }
  
  console.log(`Found ${trails.length} trails to populate`);
  
  // Find some well-known temples for sample linking
  const { data: temples } = await sb
    .from('temples')
    .select('id, name, locality')
    .in('name', [
      'Srirangam Ranganathaswamy Temple',
      'Tirupati Venkateswara Temple', 
      'Thillai Natarajar Temple',
      'Meenakshi Sundareswarar Temple',
      'Rameswaram Ramanathaswamy Temple'
    ]);
    
  console.log(`Found ${temples?.length || 0} sample temples for linking`);
  
  // Example: Link to Pancha Ranga Kshetram trail if we have Srirangam
  const panchaRangaTrail = trails.find(t => t.name === 'Pancha Ranga Kshetram');
  const srirangamTemple = temples?.find(t => t.name.includes('Srirangam') || t.name.includes('Ranganatha'));
  
  if (panchaRangaTrail && srirangamTemple) {
    try {
      const { error } = await sb.rpc('add_temple_to_trail', {
        p_trail_id: panchaRangaTrail.id,
        p_temple_id: srirangamTemple.id,
        p_position: 1,
        p_day_number: 1,
        p_notes: 'Primary temple of the Pancha Ranga circuit - Adiranga',
        p_estimated_duration_hours: 4
      });
      
      if (error && !error.message.includes('duplicate')) {
        console.error('❌ Failed to link Srirangam:', error);
      } else {
        console.log('✅ Linked Srirangam to Pancha Ranga Kshetram trail');
      }
    } catch (error) {
      console.log(`ℹ️ Temple already linked or other issue: ${error.message}`);
    }
  }
  
  console.log('✅ Sample temple linking completed');
}

async function main() {
  console.log('🏛️ Setting up trails system for temple connections...\n');
  
  const tablesCreated = await createTrailsTable();
  if (!tablesCreated) return;
  
  const junctionCreated = await createTempleTrailsTable();
  if (!junctionCreated) return;
  
  const functionsCreated = await createHelperFunctions();
  if (!functionsCreated) return;
  
  await seedSampleTrails();
  await linkSampleTemples();
  
  console.log('\n🎯 Trails system setup completed!');
  console.log('\n📋 Available trails:');
  
  const { data: trailsList } = await sb
    .from('trails')
    .select('id, name, description, total_temples, trail_type')
    .order('name');
    
  trailsList?.forEach(trail => {
    console.log(`  📍 ${trail.name} (${trail.total_temples} temples) - ${trail.trail_type}`);
  });
  
  console.log('\n🔧 Usage examples:');
  console.log('  // Add temple to trail:');
  console.log('  SELECT add_temple_to_trail(trail_id, temple_id, position, day_number, notes);');
  console.log('  // Get trail temples:');
  console.log('  SELECT * FROM get_trail_temples(trail_id);');
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  main().catch(console.error);
}