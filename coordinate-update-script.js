#!/usr/bin/env node

// Coordinate Update Script for Divya Desam Temples
// Updates temple coordinates using HERE Maps Geocoding API

const fs = require('fs');

const HERE_API_KEY = 'zKgxlEjQH_RLWBmqTViWQtVIBsxZZAQE0erZEsoMXuQ';

// Read current temple data
function readTempleData() {
    const data = fs.readFileSync('./temple-data.js', 'utf8');
    // Extract the array from the file
    const arrayMatch = data.match(/window\.divyaDesams = (\[[\s\S]*?\]);/);
    if (!arrayMatch) {
        throw new Error('Could not parse temple data');
    }
    return JSON.parse(arrayMatch[1]);
}

// Search for temple coordinates using HERE Maps API
async function searchTempleCoordinates(templeName, displayName) {
    const query = encodeURIComponent(displayName);
    const url = `https://geocode.search.hereapi.com/v1/geocode?q=${query}&limit=5&in=countryCode:IND&types=area,city,place&apikey=${HERE_API_KEY}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.items && data.items.length > 0) {
            const best = data.items[0];
            return {
                lat: best.position.lat,
                lng: best.position.lng,
                confidence: best.scoring?.queryScore || 0,
                address: best.address?.label || best.title,
                found: true
            };
        }
        return { found: false };
    } catch (error) {
        console.error(`Error searching for ${templeName}:`, error);
        return { found: false, error: error.message };
    }
}

// Update coordinates for problematic temples
async function updateTempleCoordinates() {
    const temples = readTempleData();
    const updates = [];
    
    // Focus on temples that likely have coordinate issues
    const problematicTemples = temples.filter(temple => {
        // Flag temples that might have rounded coordinates (likely inaccurate)
        const latRounded = Math.abs(temple.lat - Math.round(temple.lat * 100) / 100) < 0.001;
        const lngRounded = Math.abs(temple.lng - Math.round(temple.lng * 100) / 100) < 0.001;
        return latRounded || lngRounded;
    });
    
    console.log(`Found ${problematicTemples.length} temples with potentially inaccurate coordinates`);
    
    for (let i = 0; i < problematicTemples.length; i++) {
        const temple = problematicTemples[i];
        console.log(`\n${i + 1}/${problematicTemples.length}: Checking ${temple.displayName}`);
        console.log(`Current: lat: ${temple.lat}, lng: ${temple.lng}`);
        
        const result = await searchTempleCoordinates(temple.name, temple.displayName);
        
        if (result.found) {
            const latDiff = Math.abs(result.lat - temple.lat);
            const lngDiff = Math.abs(result.lng - temple.lng);
            
            console.log(`HERE Maps: lat: ${result.lat}, lng: ${result.lng}`);
            console.log(`Difference: lat: ${latDiff.toFixed(6)}, lng: ${lngDiff.toFixed(6)}`);
            console.log(`Confidence: ${result.confidence}`);
            
            // If significant difference (>1km roughly), flag for update
            if (latDiff > 0.01 || lngDiff > 0.01) {
                updates.push({
                    name: temple.name,
                    displayName: temple.displayName,
                    oldCoords: { lat: temple.lat, lng: temple.lng },
                    newCoords: { lat: result.lat, lng: result.lng },
                    difference: { lat: latDiff, lng: lngDiff },
                    confidence: result.confidence,
                    address: result.address
                });
                console.log(`🔄 FLAGGED FOR UPDATE`);
            } else {
                console.log(`✅ Coordinates look good`);
            }
        } else {
            console.log(`❌ Could not find coordinates via HERE Maps`);
        }
        
        // Rate limiting - wait 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return updates;
}

// Generate update report
function generateReport(updates) {
    console.log(`\n\n📊 COORDINATE UPDATE REPORT`);
    console.log(`=================================`);
    console.log(`Total temples flagged for update: ${updates.length}`);
    
    updates.forEach((update, i) => {
        console.log(`\n${i + 1}. ${update.displayName}`);
        console.log(`   Old: lat: ${update.oldCoords.lat}, lng: ${update.oldCoords.lng}`);
        console.log(`   New: lat: ${update.newCoords.lat}, lng: ${update.newCoords.lng}`);
        console.log(`   Difference: lat: ${update.difference.lat.toFixed(6)}, lng: ${update.difference.lng.toFixed(6)}`);
        console.log(`   Confidence: ${update.confidence}`);
    });
    
    // Save report to file
    fs.writeFileSync('./coordinate-updates-report.json', JSON.stringify(updates, null, 2));
    console.log(`\n📄 Report saved to coordinate-updates-report.json`);
}

// Main execution
async function main() {
    try {
        console.log('🚀 Starting coordinate verification for Divya Desam temples...');
        const updates = await updateTempleCoordinates();
        generateReport(updates);
        
        if (updates.length > 0) {
            console.log(`\n✨ Found ${updates.length} temples that need coordinate updates.`);
            console.log(`Review the report and run the update process if the changes look correct.`);
        } else {
            console.log(`\n✅ All temple coordinates look accurate!`);
        }
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

if (require.main === module) {
    main();
}

module.exports = { updateTempleCoordinates, searchTempleCoordinates };