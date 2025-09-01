import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs/promises';
import url from 'url';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

const GEMINI_API_KEY = 'AIzaSyCASKu_bqDXF9D9u2HNct6cY3eUfZRH1GU';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

async function getTempleLocationFromGemini(temple) {
  try {
    const prompt = `
Please provide accurate coordinates for this Hindu temple:

Temple Name: ${temple.name}
Current Location: ${temple.locality}, ${temple.district}, ${temple.state}
Current Coordinates: ${temple.lat}, ${temple.lng}

Please respond with ONLY a JSON object in this exact format:
{
  "lat": 12.345678,
  "lng": 78.123456,
  "accuracy": "high|medium|low",
  "source": "official|maps|estimated",
  "notes": "any important location details"
}

Requirements:
- Use decimal degrees (not DMS)
- Precision to 6 decimal places
- High accuracy means exact temple location
- Medium accuracy means approximate area
- Low accuracy means general locality
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    
    // Try to extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const locationData = JSON.parse(jsonMatch[0]);
      
      // Validate the response
      if (locationData.lat && locationData.lng && 
          typeof locationData.lat === 'number' && 
          typeof locationData.lng === 'number') {
        return {
          success: true,
          lat: locationData.lat,
          lng: locationData.lng,
          accuracy: locationData.accuracy || 'medium',
          source: locationData.source || 'gemini',
          notes: locationData.notes || ''
        };
      }
    }
    
    console.log(`❌ Invalid response format for ${temple.name}`);
    return { success: false, reason: 'Invalid response format' };
    
  } catch (error) {
    console.log(`❌ Gemini error for ${temple.name}: ${error.message}`);
    return { success: false, reason: error.message };
  }
}

async function updateTempleLocation(templeId, locationData) {
  const { error } = await sb
    .from('temples')
    .update({
      lat: locationData.lat,
      lng: locationData.lng,
      location_accuracy: locationData.accuracy,
      location_source: locationData.source,
      location_notes: locationData.notes,
      updated_at: new Date().toISOString()
    })
    .eq('id', templeId);
    
  if (error) throw error;
}

async function getTemplesForLocationUpdate(limit = 25, offset = 0) {
  const { data, error } = await sb
    .from('temples')
    .select('id, name, locality, district, state, lat, lng, location_accuracy')
    .is('location_accuracy', null)
    .range(offset, offset + limit - 1);
    
  if (error) throw error;
  return data;
}

async function processTempleLocation(temple) {
  try {
    console.log(`🔍 Enhancing location for: ${temple.name} (${temple.locality}, ${temple.state})`);
    
    const locationData = await getTempleLocationFromGemini(temple);
    
    if (locationData.success) {
      // Calculate distance from current coordinates
      const distance = calculateDistance(
        temple.lat, temple.lng,
        locationData.lat, locationData.lng
      );
      
      if (distance > 50) { // More than 50km difference
        console.log(`⚠️ Large distance change (${distance.toFixed(1)}km) for ${temple.name}`);
        locationData.notes = `Large move: ${distance.toFixed(1)}km from original. ${locationData.notes}`;
      }
      
      await updateTempleLocation(temple.id, locationData);
      console.log(`✅ Updated ${temple.name}: ${locationData.accuracy} accuracy (${distance.toFixed(1)}km change)`);
      
      return { success: true, distance, accuracy: locationData.accuracy };
    } else {
      console.log(`❌ Failed to get location for ${temple.name}: ${locationData.reason}`);
      return { success: false };
    }
  } catch (error) {
    console.log(`❌ Error processing ${temple.name}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + 
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

async function main() {
  console.log('🎯 Starting Gemini-powered temple location enhancement...');
  
  const BATCH_SIZE = 3; // Start with tiny batches for testing
  let offset = 0;
  let totalUpdated = 0;
  let totalFailed = 0;
  let totalErrors = 0;
  let batchNumber = 1;
  
  const improvementStats = {
    high: 0, medium: 0, low: 0,
    smallMoves: 0, largeMoves: 0
  };
  
  while (true) {
    const temples = await getTemplesForLocationUpdate(BATCH_SIZE, offset);
    
    if (temples.length === 0) {
      console.log('✅ All temples processed!');
      break;
    }
    
    console.log(`\n📦 Processing batch ${batchNumber} (${temples.length} temples, offset ${offset})`);
    
    let updated = 0;
    let failed = 0;
    let errors = 0;
    
    // Process temples sequentially to respect API limits
    for (const temple of temples) {
      const result = await processTempleLocation(temple);
      
      if (result.success) {
        updated++;
        totalUpdated++;
        improvementStats[result.accuracy]++;
        if (result.distance < 5) {
          improvementStats.smallMoves++;
        } else {
          improvementStats.largeMoves++;
        }
      } else if (result.error) {
        errors++;
        totalErrors++;
      } else {
        failed++;
        totalFailed++;
      }
      
      // Rate limiting for Gemini API
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log(`📊 Batch ${batchNumber} Results: ✅${updated} ❌${failed} 💥${errors}`);
    
    offset += BATCH_SIZE;
    batchNumber++;
    
    // Progress update every 3 batches
    if (batchNumber % 3 === 0) {
      console.log(`\n🎯 Overall Progress: ✅${totalUpdated} ❌${totalFailed} 💥${totalErrors}`);
      console.log(`📊 Accuracy: High:${improvementStats.high} Med:${improvementStats.medium} Low:${improvementStats.low}`);
    }
  }
  
  console.log('\n📊 Final Location Enhancement Summary:');
  console.log(`✅ Updated: ${totalUpdated} temples`);
  console.log(`❌ Failed: ${totalFailed} temples`);
  console.log(`💥 Errors: ${totalErrors} temples`);
  console.log('\n📍 Accuracy Distribution:');
  console.log(`  🎯 High: ${improvementStats.high} temples`);
  console.log(`  📊 Medium: ${improvementStats.medium} temples`);
  console.log(`  📍 Low: ${improvementStats.low} temples`);
  console.log('\n📏 Movement Analysis:');
  console.log(`  🎯 Small moves (<5km): ${improvementStats.smallMoves}`);
  console.log(`  📏 Large moves (>5km): ${improvementStats.largeMoves}`);
  console.log('\n✅ Gemini location enhancement completed!');
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  main().catch(console.error);
}