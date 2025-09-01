import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import url from 'url';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

const GEMINI_API_KEY = 'AIzaSyCASKu_bqDXF9D9u2HNct6cY3eUfZRH1GU';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

async function enrichTempleWithGemini(temple) {
  try {
    const prompt = `
Provide accurate information for this Hindu temple in Tamil Nadu/India:

Temple: ${temple.name}
Location: ${temple.locality || 'Unknown'}, ${temple.district || 'Unknown'}, ${temple.state}
Current coordinates: ${temple.lat}, ${temple.lng}

Respond with ONLY this JSON format:
{
  "coordinates": {
    "lat": 12.345678,
    "lng": 78.123456,
    "accuracy": "high|medium|low"
  },
  "wikidata_qid": "Q12345678 or null",
  "deity": "Primary deity name",
  "phone": "+91 XXXXXXXXXX or null",
  "timings": "Typical temple hours or null",
  "significance": "Brief description"
}
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    
    // Clean and extract JSON from response
    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const enrichmentData = JSON.parse(jsonMatch[0]);
      return { success: true, data: enrichmentData };
    }
    
    return { success: false, reason: 'No valid JSON found' };
    
  } catch (error) {
    return { success: false, reason: error.message };
  }
}

async function updateTempleWithGeminiData(templeId, enrichmentData) {
  const updates = {};
  let updateCount = 0;
  
  // Update coordinates if they changed significantly
  if (enrichmentData.coordinates && enrichmentData.coordinates.lat && enrichmentData.coordinates.lng) {
    updates.lat = enrichmentData.coordinates.lat;
    updates.lng = enrichmentData.coordinates.lng;
    updateCount++;
  }
  
  // Update Wikidata QID if found
  if (enrichmentData.wikidata_qid && enrichmentData.wikidata_qid !== 'null') {
    updates.wikidata_qid = enrichmentData.wikidata_qid;
    updateCount++;
  }
  
  // Update significance tags with deity info
  if (enrichmentData.deity) {
    updates.significance_tags = [enrichmentData.deity];
    updateCount++;
  }
  
  // Update logistics with phone and timings
  const logistics = {};
  if (enrichmentData.phone && enrichmentData.phone !== 'null') {
    logistics.phone = enrichmentData.phone;
  }
  if (enrichmentData.timings && enrichmentData.timings !== 'null') {
    logistics.timings = enrichmentData.timings;
  }
  if (Object.keys(logistics).length > 0) {
    updates.logistics = logistics;
    updateCount++;
  }
  
  // Update notes
  if (enrichmentData.significance) {
    updates.notes = enrichmentData.significance;
    updateCount++;
  }
  
  updates.updated_at = new Date().toISOString();
  
  if (updateCount > 0) {
    const { error } = await sb
      .from('temples')
      .update(updates)
      .eq('id', templeId);
      
    if (error) throw error;
  }
  
  return updateCount;
}

async function getTemplesForEnrichment(limit = 5, offset = 0) {
  const { data, error } = await sb
    .from('temples')
    .select('id, name, locality, district, state, lat, lng, wikidata_qid, significance_tags')
    .or('wikidata_qid.is.null,significance_tags.is.null')
    .range(offset, offset + limit - 1);
    
  if (error) throw error;
  return data;
}

function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + 
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

async function processTempleEnrichment(temple) {
  try {
    console.log(`🔍 Enriching: ${temple.name}`);
    
    const enrichmentResult = await enrichTempleWithGemini(temple);
    
    if (enrichmentResult.success) {
      const enrichmentData = enrichmentResult.data;
      
      // Calculate location change if coordinates provided
      let locationChange = 0;
      if (enrichmentData.coordinates && enrichmentData.coordinates.lat) {
        locationChange = calculateDistance(
          temple.lat, temple.lng,
          enrichmentData.coordinates.lat, enrichmentData.coordinates.lng
        );
      }
      
      const updateCount = await updateTempleWithGeminiData(temple.id, enrichmentData);
      
      // Report what was updated
      const updates = [];
      if (locationChange > 0.1) updates.push(`📍 Location (${locationChange.toFixed(1)}km)`);
      if (enrichmentData.wikidata_qid && enrichmentData.wikidata_qid !== 'null') updates.push(`🔗 QID`);
      if (enrichmentData.deity) updates.push(`🕉️ Deity`);
      if (enrichmentData.phone && enrichmentData.phone !== 'null') updates.push(`📞 Phone`);
      if (enrichmentData.timings && enrichmentData.timings !== 'null') updates.push(`⏰ Timings`);
      
      console.log(`✅ ${temple.name}: ${updates.join(', ') || 'Basic info'} (${updateCount} fields)`);
      
      return { success: true, updateCount, hasNewQid: !!(enrichmentData.wikidata_qid && enrichmentData.wikidata_qid !== 'null') };
    } else {
      console.log(`❌ Failed: ${temple.name} - ${enrichmentResult.reason}`);
      return { success: false };
    }
  } catch (error) {
    console.log(`❌ Error: ${temple.name} - ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🎯 Starting Gemini batch temple enrichment...');
  
  const BATCH_SIZE = 5;
  let offset = 0;
  let totalUpdated = 0;
  let totalFailed = 0;
  let newQids = 0;
  let totalFields = 0;
  let batchNumber = 1;
  
  while (true) {
    const temples = await getTemplesForEnrichment(BATCH_SIZE, offset);
    
    if (temples.length === 0) {
      console.log('✅ All temples processed!');
      break;
    }
    
    console.log(`\n📦 Batch ${batchNumber} (${temples.length} temples, offset ${offset})`);
    
    let updated = 0;
    let failed = 0;
    
    for (const temple of temples) {
      const result = await processTempleEnrichment(temple);
      
      if (result.success) {
        updated++;
        totalUpdated++;
        totalFields += result.updateCount;
        if (result.hasNewQid) newQids++;
      } else {
        failed++;
        totalFailed++;
      }
      
      // Rate limiting: 3 seconds between API calls
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    console.log(`📊 Batch ${batchNumber}: ✅${updated} ❌${failed}`);
    
    offset += BATCH_SIZE;
    batchNumber++;
    
    // Limit to first few batches for testing
    if (batchNumber > 3) {
      console.log('\n⏸️ Stopping after 3 batches for testing...');
      break;
    }
  }
  
  console.log('\n📊 Gemini Enrichment Results:');
  console.log(`✅ Temples updated: ${totalUpdated}`);
  console.log(`❌ Failed: ${totalFailed}`);
  console.log(`🔗 New Wikidata QIDs: ${newQids}`);
  console.log(`📊 Total fields enriched: ${totalFields}`);
  console.log('✅ Gemini enrichment completed!');
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  main().catch(console.error);
}