#!/usr/bin/env node

// Improved script to update coordinates for temples with null lat/lng values
// Uses multiple geocoding strategies and fallback coordinates

const fs = require('fs');
const path = require('path');

// Free geocoding API (Nominatim)
async function geocodeTemple(templeName, locality, state) {
    try {
        // Be respectful to free API
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Try multiple search strategies
        const searchStrategies = [
            `${templeName} ${locality} ${state}`,
            `${templeName} ${state}`,
            `${locality} ${state}`,
            templeName,
            locality
        ];

        for (const query of searchStrategies) {
            if (!query.trim()) continue;

            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query.trim() + ', India')}&limit=1&countrycodes=in`;

            console.log(`🔍 Trying: "${query}"`);

            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'DivyaDesamLocator/3.3.4 (Temple Locator App)',
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) continue;

            const data = await response.json();

            if (data && data.length > 0) {
                const result = data[0];
                return {
                    lat: parseFloat(result.lat),
                    lng: parseFloat(result.lon),
                    confidence: 0.9,
                    source: 'nominatim',
                    query: query
                };
            }
        }

        return null;
    } catch (error) {
        console.error(`❌ Geocoding failed for ${templeName}:`, error.message);
        return null;
    }
}

// Fallback coordinates for temples that can't be geocoded
const fallbackCoordinates = {
    // Tamil Nadu districts with approximate coordinates
    "Thanjavur": { lat: 10.7870, lng: 79.1378 },
    "Kumbakonam": { lat: 10.9617, lng: 79.3881 },
    "Nagapattinam": { lat: 10.7672, lng: 79.8449 },
    "Thiruvarur": { lat: 10.7725, lng: 79.6358 },
    "Mayiladuthurai": { lat: 11.1018, lng: 79.6520 },
    "Cuddalore": { lat: 11.7480, lng: 79.7714 },
    "Viluppuram": { lat: 11.9369, lng: 79.4919 },
    "Kanchipuram": { lat: 12.8342, lng: 79.7036 },
    "Chennai": { lat: 13.0827, lng: 80.2707 },
    "Tiruvallur": { lat: 13.1231, lng: 79.9080 },
    "Madurai": { lat: 9.9252, lng: 78.1198 },
    "Sivaganga": { lat: 9.8667, lng: 78.4833 },
    "Pudukkottai": { lat: 10.3833, lng: 78.8000 },
    "Ramanathapuram": { lat: 9.3667, lng: 78.8333 },
    "Namakkal": { lat: 11.2333, lng: 78.1667 },
    "Salem": { lat: 11.6643, lng: 78.1460 },
    "Erode": { lat: 11.3410, lng: 77.7172 },
    "Tiruppur": { lat: 11.1085, lng: 77.3411 },
    "Coimbatore": { lat: 11.0168, lng: 76.9558 },
    "Tiruchirappalli": { lat: 10.8505, lng: 78.6967 },
    "Theni": { lat: 10.0104, lng: 77.4768 },
    "Dindigul": { lat: 10.3673, lng: 77.9803 },
    "Karur": { lat: 10.9601, lng: 78.0766 },
    "Perambalur": { lat: 11.2333, lng: 78.8833 },
    "Ariyalur": { lat: 11.1333, lng: 79.0667 },
    "Kallakurichi": { lat: 11.7400, lng: 78.9600 },

    // Other states
    "Bangalore": { lat: 12.9716, lng: 77.5946 },
    "Mysore": { lat: 12.2958, lng: 76.6394 },
    "Hyderabad": { lat: 17.3850, lng: 78.4867 },
    "Tirupati": { lat: 13.6288, lng: 79.4192 },
    "Delhi": { lat: 28.6139, lng: 77.2090 },
    "Ahmedabad": { lat: 23.0225, lng: 72.5714 },
    "Jaipur": { lat: 26.9124, lng: 75.7873 },
    "Lucknow": { lat: 26.8467, lng: 80.9462 },
    "Varanasi": { lat: 25.3176, lng: 82.9739 },
    "Haridwar": { lat: 29.9457, lng: 78.1642 },
    "Rishikesh": { lat: 30.0869, lng: 78.2676 },
    "Badrinath": { lat: 30.7433, lng: 79.4938 },
    "Kedarnath": { lat: 30.7346, lng: 79.0669 }
};

function getFallbackCoordinates(locality, state) {
    // Try to find coordinates based on locality or district
    if (fallbackCoordinates[locality]) {
        return fallbackCoordinates[locality];
    }

    // Try to find coordinates based on district (extract from locality if it contains district name)
    for (const [district, coords] of Object.entries(fallbackCoordinates)) {
        if (locality && locality.toLowerCase().includes(district.toLowerCase())) {
            return coords;
        }
    }

    // Default fallback based on state
    const stateDefaults = {
        "Tamil Nadu": { lat: 11.1271, lng: 78.6569 }, // Center of Tamil Nadu
        "Karnataka": { lat: 15.3173, lng: 75.7139 }, // Center of Karnataka
        "Andhra Pradesh": { lat: 15.9129, lng: 79.7400 }, // Center of Andhra Pradesh
        "Uttarakhand": { lat: 30.0668, lng: 79.0193 }, // Center of Uttarakhand
        "Gujarat": { lat: 22.2587, lng: 71.1924 }, // Center of Gujarat
        "Uttar Pradesh": { lat: 26.8467, lng: 80.9462 }, // Center of Uttar Pradesh
        "Delhi": { lat: 28.6139, lng: 77.2090 }
    };

    return stateDefaults[state] || { lat: 20.5937, lng: 78.9629 }; // Center of India
}

// Main function
async function updateNullCoordinates() {
    console.log('🚀 Starting improved coordinate update for temples with null values...\n');

    // Read temple data
    const templeDataPath = path.join(__dirname, 'temple-data.js');
    const templeDataContent = fs.readFileSync(templeDataPath, 'utf8');

    // Extract the JSON array from the file
    const jsonMatch = templeDataContent.match(/window\.divyaDesams\s*=\s*(\[[\s\S]*?\]);/);
    if (!jsonMatch) {
        console.error('❌ Could not parse temple-data.js file');
        return;
    }

    let temples = JSON.parse(jsonMatch[1]);
    console.log(`📊 Loaded ${temples.length} temples from file`);

    // Find temples with null coordinates
    const templesWithNullCoords = temples.filter(temple =>
        temple.lat === null || temple.lng === null
    );

    console.log(`🎯 Found ${templesWithNullCoords.length} temples with null coordinates:\n`);

    templesWithNullCoords.forEach((temple, index) => {
        console.log(`${index + 1}. ${temple.displayName} (${temple.locality}, ${temple.state})`);
    });

    console.log('\n🔄 Starting geocoding process...\n');

    let updatedCount = 0;
    let fallbackCount = 0;
    let failedCount = 0;

    // Update coordinates for each temple
    for (const temple of templesWithNullCoords) {
        console.log(`\n📍 Processing: ${temple.displayName}`);

        const coordinates = await geocodeTemple(
            temple.displayName,
            temple.locality,
            temple.state
        );

        if (coordinates) {
            // Update the temple in the array
            const templeIndex = temples.findIndex(t => t.name === temple.name);
            if (templeIndex !== -1) {
                temples[templeIndex].lat = coordinates.lat;
                temples[templeIndex].lng = coordinates.lng;

                console.log(`✅ Updated: ${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)} (via ${coordinates.query})`);
                updatedCount++;
            }
        } else {
            // Use fallback coordinates
            const fallbackCoords = getFallbackCoordinates(temple.locality, temple.state);

            const templeIndex = temples.findIndex(t => t.name === temple.name);
            if (templeIndex !== -1) {
                temples[templeIndex].lat = fallbackCoords.lat;
                temples[templeIndex].lng = fallbackCoords.lng;

                console.log(`🔄 Using fallback: ${fallbackCoords.lat.toFixed(4)}, ${fallbackCoords.lng.toFixed(4)} (based on ${temple.locality || temple.state})`);
                fallbackCount++;
            } else {
                console.log(`❌ Failed to update: ${temple.displayName}`);
                failedCount++;
            }
        }
    }

    // Write updated data back to file
    const updatedContent = templeDataContent.replace(
        /window\.divyaDesams\s*=\s*(\[[\s\S]*?\]);/,
        `window.divyaDesams = ${JSON.stringify(temples, null, 2)};`
    );

    fs.writeFileSync(templeDataPath, updatedContent, 'utf8');

    console.log('\n📊 Update Summary:');
    console.log(`✅ Successfully geocoded: ${updatedCount} temples`);
    console.log(`🔄 Used fallback coordinates: ${fallbackCount} temples`);
    console.log(`❌ Failed to update: ${failedCount} temples`);
    console.log(`📁 Updated temple-data.js file`);

    // Generate SQL for Supabase update
    const updatedTemples = templesWithNullCoords.filter(temple =>
        temple.lat !== null && temple.lng !== null
    );

    if (updatedTemples.length > 0) {
        console.log('\n🗄️ Generating SQL for Supabase update...\n');

        const sqlStatements = updatedTemples.map(temple => {
            return `UPDATE temples SET lat = ${temple.lat}, lng = ${temple.lng} WHERE name = '${temple.name.replace(/'/g, "''")}';`;
        });

        const sqlFile = path.join(__dirname, 'update_coordinates_supabase_improved.sql');
        fs.writeFileSync(sqlFile, sqlStatements.join('\n'), 'utf8');

        console.log(`📄 Generated SQL file: update_coordinates_supabase_improved.sql`);
        console.log(`📋 Contains ${sqlStatements.length} UPDATE statements`);
    }

    console.log('\n🎉 Coordinate update process completed!');
    console.log(`\n📍 All ${templesWithNullCoords.length} temples now have coordinates!`);
}

// Run the script
updateNullCoordinates().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
});