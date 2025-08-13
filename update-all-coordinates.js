#!/usr/bin/env node

// Update ALL Divya Desam Temple Coordinates using HERE Maps API
// This script systematically updates all 106 temple coordinates

const fs = require('fs');

// Add fetch for Node.js (if not available)
if (typeof fetch === 'undefined') {
    global.fetch = require('node-fetch') || (async (url) => {
        const https = require('https');
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
    });
}

const HERE_API_KEY = 'zKgxlEjQH_RLWBmqTViWQtVIBsxZZAQE0erZEsoMXuQ';

// Read current temple data
function readTempleData() {
    const data = fs.readFileSync('./temple-data.js', 'utf8');
    const arrayMatch = data.match(/const divyaDesams = (\[[\s\S]*?\]);/);
    if (!arrayMatch) {
        throw new Error('Could not parse temple data');
    }
    return JSON.parse(arrayMatch[1]);
}

// Search for temple coordinates using HERE Maps API
async function getHereCoordinates(displayName) {
    const query = encodeURIComponent(displayName);
    const url = `https://geocode.search.hereapi.com/v1/geocode?q=${query}&limit=5&in=countryCode:IND&types=area,city,place&apikey=${HERE_API_KEY}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.items && data.items.length > 0) {
            const best = data.items[0];
            return {
                success: true,
                lat: best.position.lat,
                lng: best.position.lng,
                confidence: best.scoring?.queryScore || 0,
                address: best.address?.label || best.title
            };
        }
        return { success: false, reason: 'No results found' };
    } catch (error) {
        return { success: false, reason: error.message };
    }
}

// Update all temple coordinates
async function updateAllCoordinates() {
    const temples = readTempleData();
    const updatedTemples = [];
    const failures = [];
    
    console.log(`🚀 Updating coordinates for ${temples.length} Divya Desam temples using HERE Maps API`);
    console.log(`This will take approximately ${Math.ceil(temples.length * 0.2)} seconds...\n`);
    
    for (let i = 0; i < temples.length; i++) {
        const temple = temples[i];
        const progress = `${i + 1}/${temples.length}`;
        
        console.log(`${progress}: ${temple.displayName}`);
        console.log(`   Current: lat: ${temple.lat}, lng: ${temple.lng}`);
        
        const result = await getHereCoordinates(temple.displayName);
        
        if (result.success) {
            const latDiff = Math.abs(result.lat - temple.lat);
            const lngDiff = Math.abs(result.lng - temple.lng);
            
            const updatedTemple = {
                ...temple,
                lat: result.lat,
                lng: result.lng
            };
            
            updatedTemples.push(updatedTemple);
            
            console.log(`   HERE Maps: lat: ${result.lat}, lng: ${result.lng}`);
            console.log(`   Difference: lat: ${latDiff.toFixed(6)}, lng: ${lngDiff.toFixed(6)} (confidence: ${result.confidence})`);
            
            if (latDiff > 0.01 || lngDiff > 0.01) {
                console.log(`   🔄 SIGNIFICANT UPDATE`);
            } else {
                console.log(`   ✅ Minor adjustment`);
            }
        } else {
            // Keep original coordinates if HERE Maps fails
            updatedTemples.push(temple);
            failures.push({
                name: temple.name,
                displayName: temple.displayName,
                reason: result.reason
            });
            console.log(`   ❌ Failed: ${result.reason} - keeping original coordinates`);
        }
        
        // Rate limiting - 200ms between requests to be respectful
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    return { updatedTemples, failures };
}

// Generate updated temple-data.js file
function generateUpdatedFile(updatedTemples) {
    const header = `// Comprehensive Divya Desam temple database
// 108 temples with complete information including Perumal, Thaayaar, and Regional classification
// Coordinates updated on ${new Date().toISOString().split('T')[0]} using HERE Maps Geocoding API

const divyaDesams = `;

    const footer = `
// Make temples available globally for the web app
if (typeof window !== 'undefined') {
    window.divyaDesams = divyaDesams;
}

// Make available for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = divyaDesams;
}`;

    const templeArrayString = JSON.stringify(updatedTemples, null, 4);
    const content = header + templeArrayString + ';' + footer;
    
    // Backup original file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync('./temple-data.js', `./temple-data-backup-${timestamp}.js`);
    console.log(`📄 Original file backed up as temple-data-backup-${timestamp}.js`);
    
    // Write updated file
    fs.writeFileSync('./temple-data.js', content);
    console.log(`📄 Updated temple-data.js with new coordinates`);
}

// Generate summary report
function generateReport(updatedTemples, originalTemples, failures) {
    let significantUpdates = 0;
    let minorUpdates = 0;
    
    for (let i = 0; i < updatedTemples.length; i++) {
        const original = originalTemples[i];
        const updated = updatedTemples[i];
        
        const latDiff = Math.abs(updated.lat - original.lat);
        const lngDiff = Math.abs(updated.lng - original.lng);
        
        if (latDiff > 0.01 || lngDiff > 0.01) {
            significantUpdates++;
        } else if (latDiff > 0.001 || lngDiff > 0.001) {
            minorUpdates++;
        }
    }
    
    console.log(`\n\n📊 UPDATE SUMMARY`);
    console.log(`==================`);
    console.log(`Total temples: ${updatedTemples.length}`);
    console.log(`Significant updates (>1km): ${significantUpdates}`);
    console.log(`Minor updates: ${minorUpdates}`);
    console.log(`Failed updates: ${failures.length}`);
    console.log(`Success rate: ${((updatedTemples.length - failures.length) / updatedTemples.length * 100).toFixed(1)}%`);
    
    if (failures.length > 0) {
        console.log(`\n❌ Failed temples:`);
        failures.forEach(f => console.log(`   - ${f.displayName}: ${f.reason}`));
    }
    
    console.log(`\n✅ All temple coordinates have been updated with HERE Maps data!`);
    console.log(`Distance calculations should now be much more accurate.`);
}

// Main execution
async function main() {
    try {
        console.log('🗺️  Divya Desam Coordinate Update System');
        console.log('========================================\n');
        
        const originalTemples = readTempleData();
        const { updatedTemples, failures } = await updateAllCoordinates();
        
        generateUpdatedFile(updatedTemples);
        generateReport(updatedTemples, originalTemples, failures);
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { updateAllCoordinates, getHereCoordinates };