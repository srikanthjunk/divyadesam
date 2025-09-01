import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import url from 'url';
import { createClient } from '@supabase/supabase-js';
import slugify from 'slugify';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

const trailsData = [
  {
    slug: 'pancha-ranga-kshetram',
    name: 'Pancha Ranga Kshetram',
    description: 'Five sacred Ranganatha temples: Srirangam, Tiruchirappalli, Kumbakonam, Mayiladuthurai, and Indalur',
    temples: [
      { name: 'Srirangam Ranganathaswamy Temple', locality: 'Srirangam', state: 'Tamil Nadu', position: 1 },
      { name: 'Rockfort Ucchi Pillayar Temple', locality: 'Tiruchirappalli', state: 'Tamil Nadu', position: 2 },
      { name: 'Sarangapani Temple', locality: 'Kumbakonam', state: 'Tamil Nadu', position: 3 },
      { name: 'Mayuranathaswamy Temple', locality: 'Mayiladuthurai', state: 'Tamil Nadu', position: 4 },
      { name: 'Appakkudathaan Perumal Temple', locality: 'Koviladi', state: 'Tamil Nadu', position: 5 }
    ],
    estimated_duration_days: 7,
    difficulty_level: 'moderate',
    region: 'Tamil Nadu',
    state: 'Tamil Nadu'
  },
  {
    slug: 'nava-tirupati',
    name: 'Nava Tirupati',
    description: 'Nine sacred hills around Tirupati dedicated to different forms of Vishnu',
    temples: [
      { name: 'Tirumala Venkateswara Temple', locality: 'Tirumala', state: 'Andhra Pradesh', position: 1 },
      { name: 'Tiruchanur Padmavathi Temple', locality: 'Tiruchanur', state: 'Andhra Pradesh', position: 2 },
      { name: 'Sholinghur Narasimha Temple', locality: 'Sholinghur', state: 'Tamil Nadu', position: 3 },
      { name: 'Ahobilam Narasimha Temple', locality: 'Ahobilam', state: 'Andhra Pradesh', position: 4 },
      { name: 'Mangapuram Temple', locality: 'Mangapuram', state: 'Andhra Pradesh', position: 5 },
      { name: 'Kalahasti Temple', locality: 'Kalahasti', state: 'Andhra Pradesh', position: 6 }
    ],
    estimated_duration_days: 3,
    difficulty_level: 'easy',
    region: 'Andhra Pradesh',
    state: 'Andhra Pradesh'
  },
  {
    slug: 'kanchipuram-circuit',
    name: 'Kanchipuram Temple Circuit',
    description: 'Major Divya Desam and ancient temples in the temple city of Kanchipuram',
    temples: [
      { name: 'Varadharaja Perumal Temple', locality: 'Kanchipuram', state: 'Tamil Nadu', position: 1 },
      { name: 'Ekambareswarar Temple', locality: 'Kanchipuram', state: 'Tamil Nadu', position: 2 },
      { name: 'Kamakshi Amman Temple', locality: 'Kanchipuram', state: 'Tamil Nadu', position: 3 },
      { name: 'Ulagalantha Perumal Temple', locality: 'Kanchipuram', state: 'Tamil Nadu', position: 4 },
      { name: 'Deepaprakashar Temple', locality: 'Kanchipuram', state: 'Tamil Nadu', position: 5 }
    ],
    estimated_duration_days: 2,
    difficulty_level: 'easy',
    region: 'Tamil Nadu',
    state: 'Tamil Nadu'
  }
];

async function findTempleByName(name, locality, state) {
  // Try exact match first
  let { data } = await sb
    .from('temples')
    .select('id, slug, name')
    .eq('name', name)
    .eq('locality', locality)
    .eq('state', state)
    .maybeSingle();
    
  if (data) return data;
  
  // Try fuzzy match on name and state
  ({ data } = await sb
    .from('temples')
    .select('id, slug, name')
    .ilike('name', `%${name}%`)
    .eq('state', state)
    .limit(1)
    .maybeSingle());
    
  return data;
}

async function createTrail(trailData) {
  try {
    // Insert trail
    const { data: trail, error: trailError } = await sb
      .from('trails')
      .upsert({
        slug: trailData.slug,
        name: trailData.name,
        description: trailData.description,
        estimated_duration_days: trailData.estimated_duration_days,
        difficulty_level: trailData.difficulty_level,
        region: trailData.region,
        state: trailData.state
      })
      .select('id')
      .single();
      
    if (trailError) throw trailError;
    
    console.log(`✅ Created/updated trail: ${trailData.name}`);
    
    // Link temples to trail
    let linkedCount = 0;
    let notFoundCount = 0;
    
    for (const templeData of trailData.temples) {
      const temple = await findTempleByName(templeData.name, templeData.locality, templeData.state);
      
      if (temple) {
        await sb
          .from('temple_trails')
          .upsert({
            trail_id: trail.id,
            temple_id: temple.id,
            position: templeData.position,
            is_optional: templeData.is_optional || false,
            notes: templeData.notes || null
          });
          
        linkedCount++;
        console.log(`  🔗 Linked: ${temple.name} (position ${templeData.position})`);
      } else {
        notFoundCount++;
        console.log(`  ❌ Temple not found: ${templeData.name} in ${templeData.locality}, ${templeData.state}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 100)); // Rate limit
    }
    
    console.log(`📊 Trail ${trailData.name}: ${linkedCount} linked, ${notFoundCount} not found`);
    return { linkedCount, notFoundCount };
    
  } catch (error) {
    console.log(`❌ Error creating trail ${trailData.name}: ${error.message}`);
    return { error: error.message };
  }
}

async function main() {
  console.log('🛤️  Starting trails creation...');
  
  let totalLinked = 0;
  let totalNotFound = 0;
  let totalErrors = 0;
  
  for (const trailData of trailsData) {
    const result = await createTrail(trailData);
    
    if (result.error) {
      totalErrors++;
    } else {
      totalLinked += result.linkedCount;
      totalNotFound += result.notFoundCount;
    }
  }
  
  console.log('\n📊 Trails Creation Summary:');
  console.log(`✅ Trails created: ${trailsData.length}`);
  console.log(`🔗 Temples linked: ${totalLinked}`);
  console.log(`❌ Temples not found: ${totalNotFound}`);
  console.log(`💥 Errors: ${totalErrors}`);
  console.log('✅ Trails seeding completed!');
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  main().catch(console.error);
}