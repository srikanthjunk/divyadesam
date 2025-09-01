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
Please provide comprehensive information about this Hindu temple for a temple locator database:

Temple Name: ${temple.name}
Current Location: ${temple.locality || 'Unknown'}, ${temple.district || 'Unknown'}, ${temple.state || 'Tamil Nadu'}
Current Coordinates: ${temple.lat}, ${temple.lng}

Please research and provide accurate information in this EXACT JSON format:
{
  "coordinates": {
    "lat": 12.345678,
    "lng": 78.123456,
    "accuracy": "high|medium|low",
    "source": "official|maps|temple_website|estimated"
  },
  "basic_info": {
    "deity_primary": "Primary deity name",
    "deity_consort": "Consort/Goddess name or null",
    "temple_type": "shiva|vishnu|murugan|devi|other",
    "architecture_style": "dravidian|vijayanagara|chola|pandya|kerala|other",
    "approximate_age": "ancient|medieval|modern|unknown"
  },
  "identifiers": {
    "wikidata_qid": "Q12345678 or null",
    "wikipedia_url": "https://en.wikipedia.org/wiki/... or null",
    "official_website": "http://temple-website.org or null"
  },
  "location_details": {
    "precise_locality": "Exact area/village name",
    "district": "District name", 
    "state": "State name",
    "postal_code": "PIN code or null",
    "nearest_city": "Major nearby city",
    "region_traditional": "Traditional region like Chola Nadu, Pandya Nadu, etc."
  },
  "practical_info": {
    "phone": "+91 phone number or null",
    "typical_timings": "Morning: 6:00 AM - 12:00 PM, Evening: 4:00 PM - 8:00 PM or null",
    "dress_code": "traditional|casual|specific requirements or null",
    "entry_fee": "free|paid|donation or null",
    "photography": "allowed|restricted|prohibited or null"
  },
  "significance": {
    "tradition_classification": "divya_desam|paadal_petra_sthalam|abhimana_sthalam|other",
    "festival_primary": "Main festival name or null",
    "historical_significance": "Brief historical importance or null",
    "architectural_features": "Notable architectural elements or null"
  }
}

IMPORTANT: Respond with ONLY the JSON object, no additional text. Research carefully for accuracy.
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    
    // Try to extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const enrichmentData = JSON.parse(jsonMatch[0]);
      return { success: true, data: enrichmentData };
    }
    
    console.log(`❌ Invalid response format for ${temple.name}`);
    return { success: false, reason: 'Invalid JSON response' };
    
  } catch (error) {
    console.log(`❌ Gemini error for ${temple.name}: ${error.message}`);
    return { success: false, reason: error.message };
  }
}

async function updateTempleWithEnrichment(templeId, enrichmentData) {
  const coords = enrichmentData.coordinates || {};
  const basic = enrichmentData.basic_info || {};
  const identifiers = enrichmentData.identifiers || {};
  const location = enrichmentData.location_details || {};
  const practical = enrichmentData.practical_info || {};
  const significance = enrichmentData.significance || {};

  // Prepare significance_tags as JSON
  const significanceTags = {
    ...(basic.deity_primary && { primary_deity: basic.deity_primary }),
    ...(basic.deity_consort && { consort: basic.deity_consort }),
    ...(basic.temple_type && { type: basic.temple_type }),
    ...(basic.architecture_style && { architecture: basic.architecture_style }),
    ...(basic.approximate_age && { age: basic.approximate_age }),
    ...(significance.tradition_classification && { tradition: significance.tradition_classification }),
    ...(significance.festival_primary && { primary_festival: significance.festival_primary })
  };

  // Prepare logistics as JSON
  const logisticsData = {
    ...(practical.phone && { phone: practical.phone }),
    ...(practical.typical_timings && { timings: practical.typical_timings }),
    ...(practical.dress_code && { dress_code: practical.dress_code }),
    ...(practical.entry_fee && { entry_fee: practical.entry_fee }),
    ...(practical.photography && { photography: practical.photography }),
    ...(identifiers.official_website && { website: identifiers.official_website })
  };

  const updateData = {
    // Coordinates
    ...(coords.lat && coords.lng && {
      lat: coords.lat,
      lng: coords.lng
    }),
    
    // Identifiers
    ...(identifiers.wikidata_qid && identifiers.wikidata_qid !== 'null' && { 
      wikidata_qid: identifiers.wikidata_qid 
    }),
    
    // Enhanced location details
    ...(location.precise_locality && { locality: location.precise_locality }),
    ...(location.district && { district: location.district }),
    ...(location.state && { state: location.state }),
    
    // JSON fields
    ...(Object.keys(significanceTags).length > 0 && { significance_tags: JSON.stringify(significanceTags) }),
    ...(Object.keys(logisticsData).length > 0 && { logistics: JSON.stringify(logisticsData) }),
    
    // Notes field for additional info
    ...(significance.historical_significance && significance.architectural_features && {
      notes: `${significance.historical_significance}${significance.architectural_features ? '. Architecture: ' + significance.architectural_features : ''}`
    }),
    
    updated_at: new Date().toISOString()
  };

  const { error } = await sb
    .from('temples')
    .update(updateData)
    .eq('id', templeId);
    
  if (error) throw error;
  return updateData;
}

async function getTemplesForEnrichment(limit = 5, offset = 0) {
  const { data, error } = await sb
    .from('temples')
    .select('id, name, locality, district, state, lat, lng, wikidata_qid, significance_tags, logistics, notes')
    .or('wikidata_qid.is.null,significance_tags.is.null,logistics.is.null')
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
    console.log(`🔍 Enriching: ${temple.name} (${temple.locality || 'Unknown'}, ${temple.state || 'Unknown'})`);
    
    const enrichmentResult = await enrichTempleWithGemini(temple);
    
    if (enrichmentResult.success) {
      const enrichmentData = enrichmentResult.data;
      
      // Validate coordinates if provided
      let locationChange = 0;
      if (enrichmentData.coordinates && enrichmentData.coordinates.lat && enrichmentData.coordinates.lng) {
        locationChange = calculateDistance(
          temple.lat, temple.lng,
          enrichmentData.coordinates.lat, enrichmentData.coordinates.lng
        );
      }
      
      const updateData = await updateTempleWithEnrichment(temple.id, enrichmentData);
      
      // Report what was updated
      const updates = [];
      if (updateData.lat && updateData.lng) updates.push(`📍 Coords (${locationChange.toFixed(1)}km)`);
      if (updateData.perumal) updates.push(`🕉️ Deity`);
      if (updateData.wikidata_qid) updates.push(`🔗 QID`);
      if (updateData.phone) updates.push(`📞 Phone`);
      if (updateData.typical_timings) updates.push(`⏰ Timings`);
      
      console.log(`✅ ${temple.name}: ${updates.join(', ')}`);
      
      return { 
        success: true, 
        updates: updates.length,
        locationChange,
        newQid: !!updateData.wikidata_qid,
        newPhone: !!updateData.phone
      };
    } else {
      console.log(`❌ Failed to enrich ${temple.name}: ${enrichmentResult.reason}`);
      return { success: false };
    }
  } catch (error) {
    console.log(`❌ Error processing ${temple.name}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🎯 Starting Gemini-powered comprehensive temple enrichment...');
  console.log('📊 Will update: coordinates, QIDs, deities, phone numbers, timings, and more\n');
  
  const BATCH_SIZE = 3; // Start small for testing
  let offset = 0;
  let totalUpdated = 0;
  let totalFailed = 0;
  let totalErrors = 0;
  let batchNumber = 1;
  
  const enrichmentStats = {
    newQids: 0,
    locationUpdates: 0,
    phoneNumbers: 0,
    deityUpdates: 0,
    totalFields: 0
  };
  
  while (true) {
    const temples = await getTemplesForEnrichment(BATCH_SIZE, offset);
    
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
      const result = await processTempleEnrichment(temple);
      
      if (result.success) {
        updated++;
        totalUpdated++;
        enrichmentStats.totalFields += result.updates;
        if (result.newQid) enrichmentStats.newQids++;
        if (result.newPhone) enrichmentStats.phoneNumbers++;
        if (result.locationChange > 0) enrichmentStats.locationUpdates++;
      } else if (result.error) {
        errors++;
        totalErrors++;
      } else {
        failed++;
        totalFailed++;
      }
      
      // Rate limiting for Gemini API (2 seconds between calls)
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log(`📊 Batch ${batchNumber} Results: ✅${updated} ❌${failed} 💥${errors}`);
    
    offset += BATCH_SIZE;
    batchNumber++;
    
    // Stop after first batch for testing
    if (batchNumber > 1) {
      console.log('\n🛑 Stopping after first batch for testing...');
      break;
    }
  }
  
  console.log('\n📊 Gemini Enrichment Summary:');
  console.log(`✅ Updated: ${totalUpdated} temples`);
  console.log(`❌ Failed: ${totalFailed} temples`);
  console.log(`💥 Errors: ${totalErrors} temples`);
  console.log('\n📈 Data Enrichment:');
  console.log(`  🔗 New QIDs: ${enrichmentStats.newQids}`);
  console.log(`  📍 Location updates: ${enrichmentStats.locationUpdates}`);
  console.log(`  📞 Phone numbers: ${enrichmentStats.phoneNumbers}`);
  console.log(`  📊 Total fields updated: ${enrichmentStats.totalFields}`);
  console.log('\n✅ Gemini comprehensive enrichment completed!');
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  main().catch(console.error);
}