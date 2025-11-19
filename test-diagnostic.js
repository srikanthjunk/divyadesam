// Diagnostic test for search functionality
const fs = require('fs');

// Load temple data
console.log('Loading temple-data.js...');
const templeDataContent = fs.readFileSync('temple-data.js', 'utf-8');

// Create a mock window object
global.window = {};

// Execute the temple data script
try {
    eval(templeDataContent);
    console.log('✅ Temple data loaded successfully');
    console.log(`   Found ${window.divyaDesams.length} temples`);

    // Test temple search
    console.log('\nTesting temple search for "Srirangam"...');
    const searchTerm = 'srirangam';
    const matches = window.divyaDesams.filter(temple =>
        temple.displayName.toLowerCase().includes(searchTerm) ||
        (temple.perumal || '').toLowerCase().includes(searchTerm) ||
        (temple.name || '').toLowerCase().includes(searchTerm)
    );

    console.log(`✅ Found ${matches.length} matches:`);
    matches.slice(0, 5).forEach(temple => {
        console.log(`   - ${temple.displayName} (${temple.perumal})`);
    });

    // Test data structure
    console.log('\nTesting data structure of first temple:');
    const first = window.divyaDesams[0];
    console.log(`   Name: ${first.name}`);
    console.log(`   Display Name: ${first.displayName}`);
    console.log(`   Lat: ${first.lat}, Lng: ${first.lng}`);
    console.log(`   Perumal: ${first.perumal}`);
    console.log(`   Region: ${first.region}`);

} catch (error) {
    console.error('❌ Error loading temple data:');
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
}

console.log('\n✅ All basic tests passed!');
