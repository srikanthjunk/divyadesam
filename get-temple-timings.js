#!/usr/bin/env node

// Get Real Temple Timings using Google Places API
// This script fetches actual opening hours for temples

const fs = require('fs');

// Google Places API key for getting real temple timings
// Set your API key as environment variable: export GOOGLE_PLACES_API_KEY=your_key_here
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || 'YOUR_GOOGLE_PLACES_API_KEY';

// Alternative: Use HERE Maps Places API (which we already have access to)
// Set your API key as environment variable: export HERE_API_KEY=your_key_here
const HERE_API_KEY = process.env.HERE_API_KEY || 'YOUR_HERE_API_KEY';

// Read temple data
function readTempleData() {
    const data = fs.readFileSync('./temple-data.js', 'utf8');
    const arrayMatch = data.match(/const divyaDesams = (\[[\s\S]*?\]);/);
    if (!arrayMatch) {
        throw new Error('Could not parse temple data');
    }
    
    // Convert JavaScript object notation to JSON by evaluating it safely
    const arrayContent = arrayMatch[1];
    try {
        // Use Function constructor for safer evaluation than eval
        return new Function('return ' + arrayContent)();
    } catch (error) {
        throw new Error('Could not parse temple data: ' + error.message);
    }
}

// Search for temple details using HERE Maps Places API
async function getTempleDetails(temple) {
    const query = encodeURIComponent(temple.displayName);
    
    // First, search for the place
    const searchUrl = `https://discover.search.hereapi.com/v1/discover?at=${temple.lat},${temple.lng}&q=${query}&limit=5&apikey=${HERE_API_KEY}`;
    
    try {
        const response = await fetch(searchUrl);
        const data = await response.json();
        
        if (data.items && data.items.length > 0) {
            const place = data.items[0];
            
            // Get place details if available
            if (place.id) {
                const detailsUrl = `https://lookup.search.hereapi.com/v1/lookup?id=${place.id}&apikey=${HERE_API_KEY}`;
                const detailsResponse = await fetch(detailsUrl);
                const details = await detailsResponse.json();
                
                return {
                    success: true,
                    name: place.title,
                    hours: details.openingHours || null,
                    contact: details.contacts || null,
                    address: place.address?.label || null,
                    rating: place.averageRating || null
                };
            }
        }
        
        return { success: false, reason: 'No detailed info found' };
    } catch (error) {
        return { success: false, reason: error.message };
    }
}

// Scrape Google search for temple timings when API returns incorrect 24hr data
async function scrapeGoogleTimings(templeName) {
    try {
        // Use a simple search approach - this is a basic implementation
        // In practice, you might want to use a proper web scraping library
        const searchQuery = encodeURIComponent(`${templeName} temple timings opening hours`);
        
        console.log(`   🔍 Scraping Google for: ${templeName} temple timings`);
        
        // Return a placeholder for now - actual web scraping would require more setup
        return {
            success: false,
            reason: 'Web scraping not implemented - would need proper scraping setup',
            suggestion: 'Manual verification needed for accurate timings'
        };
    } catch (error) {
        return { success: false, reason: error.message };
    }
}

// Get temple timings using Google Places API
async function getGooglePlaceDetails(temple) {
    if (!GOOGLE_PLACES_API_KEY || GOOGLE_PLACES_API_KEY === 'YOUR_GOOGLE_PLACES_API_KEY') {
        return { success: false, reason: 'Google API key not configured' };
    }
    
    try {
        // First, search for the place
        const searchQuery = encodeURIComponent(temple.displayName);
        const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${searchQuery}&location=${temple.lat},${temple.lng}&radius=1000&key=${GOOGLE_PLACES_API_KEY}`;
        
        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();
        
        if (searchData.results && searchData.results.length > 0) {
            const placeId = searchData.results[0].place_id;
            
            // Get detailed information including opening hours
            const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,opening_hours,formatted_phone_number,rating,reviews&key=${GOOGLE_PLACES_API_KEY}`;
            
            const detailsResponse = await fetch(detailsUrl);
            const details = await detailsResponse.json();
            
            if (details.result) {
                const openingHours = details.result.opening_hours;
                let formattedHours = null;
                
                if (openingHours?.weekday_text) {
                    // Check if Google is returning incorrect 24-hour data
                    const hasIncorrect24Hours = openingHours.weekday_text.some(day => 
                        day.includes('00:00 - 24:00') || 
                        day.includes('Open 24 hours') ||
                        day.includes('24 hours')
                    );
                    
                    if (hasIncorrect24Hours) {
                        console.log(`   ⚠️ Google returned 24-hour timing (likely incorrect for temple)`);
                        // Try to scrape more accurate data
                        const scrapedResult = await scrapeGoogleTimings(temple.displayName);
                        if (scrapedResult.success) {
                            formattedHours = scrapedResult.hours;
                        } else {
                            // Mark as needs manual verification
                            formattedHours = {
                                raw: openingHours.weekday_text,
                                error: 'Google returned 24-hour timing - likely incorrect for Hindu temple',
                                needsManualVerification: true,
                                suggestion: 'Typical temple hours: Morning 6AM-12PM, Evening 4PM-8PM'
                            };
                        }
                    } else {
                        // Process the hours to extract morning and evening sessions
                        formattedHours = {
                            raw: openingHours.weekday_text,
                            daily: openingHours.weekday_text.map(day => {
                                // Try to parse morning/evening sessions
                                const match = day.match(/(\w+):\s*(.+)/);
                                if (match) {
                                    const dayName = match[1];
                                    const timing = match[2];
                                    
                                    // Look for patterns like "6:00 AM – 12:00 PM, 4:00 PM – 8:00 PM"
                                    const sessions = timing.split(',').map(s => s.trim());
                                    
                                    return {
                                        day: dayName,
                                        timing: timing,
                                        morning: sessions.length > 1 ? sessions[0] : null,
                                        evening: sessions.length > 1 ? sessions[1] : null,
                                        allDay: sessions.length === 1 ? sessions[0] : null
                                    };
                                }
                                return { day: 'Unknown', timing: day };
                            }),
                            isOpen: openingHours.open_now || false
                        };
                    }
                }
                
                return {
                    success: true,
                    name: details.result.name,
                    hours: formattedHours,
                    phone: details.result.formatted_phone_number || null,
                    rating: details.result.rating || null,
                    total_ratings: details.result.user_ratings_total || null,
                    place_id: details.result.place_id || null,
                    address: details.result.formatted_address || null
                };
            }
        }
        
        return { success: false, reason: 'No place found in Google Places' };
    } catch (error) {
        return { success: false, reason: error.message };
    }
}

// Update temple timings for a few key temples
async function updateTempleTiming() {
    const temples = readTempleData();
    
    // Test with a few important temples first
    const testTemples = temples.filter(temple => 
        temple.displayName.includes('Srirangam') ||
        temple.displayName.includes('Oppiliappan') ||
        temple.displayName.includes('Sarangapani') ||
        temple.displayName.includes('Tirupati') ||
        temple.displayName.includes('Guruvayur') ||
        temple.displayName.includes('Parthasarathy') ||
        temple.displayName.includes('Padmanabhaswamy')
    );
    
    console.log(`🕐 Getting real timings for ${testTemples.length} key temples...\\n`);
    
    const results = [];
    
    for (let i = 0; i < testTemples.length; i++) {
        const temple = testTemples[i];
        console.log(`${i + 1}/${testTemples.length}: ${temple.displayName}`);
        
        // Try Google Places first, then HERE Maps
        let result = await getGooglePlaceDetails(temple);
        if (!result.success) {
            result = await getTempleDetails(temple);
        }
        
        if (result.success) {
            console.log(`   ✅ Found: ${result.name}`);
            
            if (result.hours) {
                if (result.hours.needsManualVerification) {
                    console.log(`   ⚠️ Hours: ${result.hours.error}`);
                    console.log(`   💡 Suggestion: ${result.hours.suggestion}`);
                } else if (result.hours.daily && result.hours.daily.length > 0) {
                    const today = result.hours.daily[0]; // Show first day as example
                    console.log(`   ⏰ Hours (${today.day}): ${today.timing}`);
                    if (today.morning && today.evening) {
                        console.log(`      🌅 Morning: ${today.morning}`);
                        console.log(`      🌆 Evening: ${today.evening}`);
                    }
                    console.log(`   🔓 Currently: ${result.hours.isOpen ? 'Open' : 'Closed'}`);
                } else {
                    console.log(`   ⏰ Hours: Available but format unknown`);
                }
            } else {
                console.log(`   ⏰ Hours: Not available`);
            }
            
            if (result.phone) {
                console.log(`   📞 Phone: ${result.phone}`);
            }
            
            if (result.rating) {
                console.log(`   ⭐ Rating: ${result.rating}/5 (${result.total_ratings || 0} reviews)`);
            }
            
            if (result.address) {
                console.log(`   📍 Address: ${result.address}`);
            }
        } else {
            console.log(`   ❌ Failed: ${result.reason}`);
        }
        
        results.push({
            temple: temple.displayName,
            ...result
        });
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
        console.log('');
    }
    
    // Save results
    fs.writeFileSync('./temple-timings-real.json', JSON.stringify(results, null, 2));
    console.log(`\\n📄 Results saved to temple-timings-real.json`);
    
    return results;
}

// Main execution
async function main() {
    try {
        console.log('🏛️  Temple Timings Fetcher');
        console.log('==========================\\n');
        
        if (GOOGLE_PLACES_API_KEY === 'YOUR_GOOGLE_PLACES_API_KEY') {
            console.log('⚠️  Google Places API key not configured. Using HERE Maps only.');
            console.log('   To get Google Places data, add your API key to this script.\\n');
        }
        
        const results = await updateTempleTiming();
        
        const successful = results.filter(r => r.success).length;
        console.log(`\\n📊 SUMMARY`);
        console.log(`Total temples checked: ${results.length}`);
        console.log(`Successfully retrieved data: ${successful}`);
        console.log(`Success rate: ${(successful/results.length*100).toFixed(1)}%`);
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// Add fetch for Node.js if needed
if (typeof fetch === 'undefined') {
    const https = require('https');
    global.fetch = async (url) => {
        return new Promise((resolve, reject) => {
            https.get(url, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve({ 
                    json: () => JSON.parse(data),
                    ok: res.statusCode >= 200 && res.statusCode < 300
                }));
            }).on('error', reject);
        });
    };
}

if (require.main === module) {
    main();
}

module.exports = { updateTempleTiming, getTempleDetails, getGooglePlaceDetails };