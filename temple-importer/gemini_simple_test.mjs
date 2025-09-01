import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

const GEMINI_API_KEY = 'AIzaSyCASKu_bqDXF9D9u2HNct6cY3eUfZRH1GU';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

async function testGeminiEnrichment() {
  console.log('🧪 Testing Gemini temple enrichment...');
  
  // Get one temple for testing
  const { data: temples, error } = await sb
    .from('temples')
    .select('id, name, locality, district, state, lat, lng, wikidata_qid')
    .limit(1);
    
  if (error || !temples || temples.length === 0) {
    console.log('❌ No temples found for testing');
    return;
  }
  
  const temple = temples[0];
  console.log('🏛️ Testing with temple:', temple.name);
  
  const prompt = `
Please provide comprehensive information about this Hindu temple:

Temple Name: ${temple.name}
Location: ${temple.locality}, ${temple.district}, ${temple.state}
Current Coordinates: ${temple.lat}, ${temple.lng}

Respond with ONLY a JSON object in this format:
{
  "coordinates": {
    "lat": 12.345678,
    "lng": 78.123456,
    "accuracy": "high"
  },
  "wikidata_qid": "Q12345678",
  "deity": "Primary deity name",
  "phone": "+91 XXXXXXXXXX",
  "timings": "Morning: 6:00 AM - 12:00 PM, Evening: 4:00 PM - 8:00 PM",
  "significance": "Brief description of temple importance"
}
`;

  try {
    console.log('🔍 Sending request to Gemini...');
    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    
    console.log('📝 Raw Gemini response:');
    console.log(responseText);
    
    // Try to parse JSON
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const enrichmentData = JSON.parse(jsonMatch[0]);
      console.log('\n✅ Parsed JSON successfully:');
      console.log(JSON.stringify(enrichmentData, null, 2));
      
      // Test update
      if (enrichmentData.deity) {
        const updateData = {
          significance_tags: [enrichmentData.deity], // Store as array
          notes: enrichmentData.significance || 'Enriched by Gemini AI',
          updated_at: new Date().toISOString()
        };
        
        const { error: updateError } = await sb
          .from('temples')
          .update(updateData)
          .eq('id', temple.id);
          
        if (updateError) {
          console.log('❌ Update failed:', updateError);
        } else {
          console.log('✅ Successfully updated temple with Gemini data!');
        }
      }
    } else {
      console.log('❌ Could not extract JSON from response');
    }
    
  } catch (error) {
    console.log('❌ Gemini request failed:', error.message);
  }
}

testGeminiEnrichment().catch(console.error);