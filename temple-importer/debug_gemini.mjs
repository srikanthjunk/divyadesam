import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

const GEMINI_API_KEY = 'AIzaSyCASKu_bqDXF9D9u2HNct6cY3eUfZRH1GU';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

async function debugGeminiResponse() {
  const { data: temples } = await sb
    .from('temples')
    .select('id, name, locality, district, state, lat, lng')
    .eq('name', 'Nageswarar Temple, Kumbakonam')
    .limit(1);
    
  if (!temples || temples.length === 0) {
    console.log('❌ Temple not found');
    return;
  }
  
  const temple = temples[0];
  console.log('🏛️ Testing with:', temple.name);
  
  const prompt = `
Provide information for: ${temple.name}
Location: ${temple.locality}, ${temple.district}, ${temple.state}

Return only valid JSON:
{"deity": "temple deity", "qid": "Q123 or null", "phone": "+91 123 or null", "timings": "6 AM - 8 PM or null"}
`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    
    console.log('📄 Full Gemini response:');
    console.log('---START---');
    console.log(responseText);
    console.log('---END---');
    
    // Try different JSON extraction methods
    console.log('\n🔍 JSON extraction attempts:');
    
    // Method 1: Find first { to last }
    const method1 = responseText.match(/\{[\s\S]*\}/);
    console.log('Method 1 (full match):', method1 ? method1[0] : 'No match');
    
    // Method 2: Remove markdown formatting
    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    console.log('Method 2 (cleaned):', cleaned);
    
    // Method 3: Try to parse cleaned version
    try {
      const parsed = JSON.parse(cleaned);
      console.log('Method 3 (parsed):', parsed);
    } catch (parseError) {
      console.log('Method 3 parse error:', parseError.message);
    }
    
  } catch (error) {
    console.log('❌ Gemini error:', error.message);
  }
}

debugGeminiResponse().catch(console.error);