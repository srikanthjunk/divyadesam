import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

async function seedSampleTrails() {
  console.log('🌱 Creating sample trails...');
  
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
  
  let created = 0;
  let skipped = 0;
  
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
          skipped++;
        } else {
          console.error(`❌ Failed to insert trail '${trail.name}':`, error);
        }
      } else {
        console.log(`✅ Created trail: ${data.name} (ID: ${data.id})`);
        created++;
      }
    } catch (error) {
      console.error(`❌ Error creating trail '${trail.name}':`, error.message);
    }
  }
  
  console.log(`📊 Results: ✅${created} created, ℹ️${skipped} skipped`);
}

async function main() {
  console.log('🏛️ Setting up trails system for temple connections...\n');
  
  console.log('📋 Note: Tables must be created manually via SQL or Supabase dashboard');
  console.log('📄 Schema file: setup_trails_sql.sql\n');
  
  // Try to check if tables exist first
  try {
    const { data: trailsTest } = await sb.from('trails').select('id').limit(1);
    console.log('✅ Trails table exists, proceeding with seeding...');
  } catch (error) {
    console.log('❌ Trails table does not exist. Please create it first using setup_trails_sql.sql');
    console.log('🔧 You can run the SQL in Supabase dashboard or via psql');
    return;
  }
  
  await seedSampleTrails();
  
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
  console.log('  // Add temple to trail via SQL:');
  console.log('  SELECT add_temple_to_trail(trail_id, temple_id, position, day_number, notes);');
  console.log('  // Get trail temples:');
  console.log('  SELECT * FROM get_trail_temples(trail_id);');
}

main().catch(console.error);