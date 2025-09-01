#!/usr/bin/env node

// Script to update coordinates for temples with null lat/lng values
// Uses Nominatim (OpenStreetMap) geocoding API - completely free

const fs = require('fs');
const path = require('path');

// Free geocoding API (Nominatim)
async function geocodeTemple(templeName, locality, state) {
    try {
        // Be respectful to free API
        await new Promise(resolve => setTimeout(resolve, 1000));

        const query = `${templeName} ${locality} ${state}`.trim();
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', India')}&limit=1&countrycodes=in`;

        console.log(`🔍 Geocoding: "${query}"`);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'DivyaDesamLocator/3.3.4 (Temple Locator App)',
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data && data.length > 0) {
            const result = data[0];
            return {
                lat: parseFloat(result.lat),
                lng: parseFloat(result.lon),
                confidence: 0.9,
                source: 'nominatim'
            };
        }

        return null;
    } catch (error) {
        console.error(`❌ Geocoding failed for ${templeName}:`, error.message);
        return null;
    }
}

// Main function
async function updateNullCoordinates() {
    console.log('🚀 Starting coordinate update for temples with null values...\n');

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

                console.log(`✅ Updated: ${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)}`);
                updatedCount++;
            }
        } else {
            console.log(`❌ Failed to geocode: ${temple.displayName}`);
            failedCount++;
        }
    }

    // Write updated data back to file
    const updatedContent = templeDataContent.replace(
        /window\.divyaDesams\s*=\s*(\[[\s\S]*?\]);/,
        `window.divyaDesams = ${JSON.stringify(temples, null, 2)};`
    );

    fs.writeFileSync(templeDataPath, updatedContent, 'utf8');

    console.log('\n📊 Update Summary:');
    console.log(`✅ Successfully updated: ${updatedCount} temples`);
    console.log(`❌ Failed to update: ${failedCount} temples`);
    console.log(`📁 Updated temple-data.js file`);

    // Generate SQL for Supabase update
    if (updatedCount > 0) {
        console.log('\n🗄️ Generating SQL for Supabase update...\n');

        const sqlStatements = templesWithNullCoords
            .filter(temple => temple.lat !== null && temple.lng !== null)
            .map(temple => {
                return `UPDATE temples SET lat = ${temple.lat}, lng = ${temple.lng} WHERE name = '${temple.name.replace(/'/g, "''")}';`;
            });

        const sqlFile = path.join(__dirname, 'update_coordinates_supabase.sql');
        fs.writeFileSync(sqlFile, sqlStatements.join('\n'), 'utf8');

        console.log(`📄 Generated SQL file: update_coordinates_supabase.sql`);
        console.log(`📋 Contains ${sqlStatements.length} UPDATE statements`);
    }

    console.log('\n🎉 Coordinate update process completed!');
}

// Run the script
updateNullCoordinates().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
});