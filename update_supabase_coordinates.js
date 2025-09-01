#!/usr/bin/env node

// Script to update Supabase database with new coordinates
const fs = require('fs');
const path = require('path');

// Supabase configuration
const SUPABASE_URL = 'https://yxsnfxiebolatzhkhbyi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4c25meGllYm9sYXR6aGtoYnlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1Nzk0NjYsImV4cCI6MjA3MjE1NTQ2Nn0.sx_tPbAiqg7yU16_sPghsoWQ6tBKz5k5vuiuJxe8_hg';

async function updateSupabaseCoordinates() {
    console.log('🚀 Starting Supabase coordinate updates...\n');

    // Read the SQL file
    const sqlFile = path.join(__dirname, 'update_coordinates_supabase_improved.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');

    // Split into individual statements
    const statements = sqlContent.split(';').map(stmt => stmt.trim()).filter(stmt => stmt.length > 0);

    console.log(`📋 Found ${statements.length} UPDATE statements to execute\n`);

    let successCount = 0;
    let errorCount = 0;

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        console.log(`🔄 Executing ${i + 1}/${statements.length}: ${statement.substring(0, 60)}...`);

        try {
            // Parse the UPDATE statement to extract values
            const match = statement.match(/UPDATE temples SET lat = ([^,]+), lng = ([^ ]+) WHERE name = '([^']+)'/);
            if (!match) {
                console.log(`❌ Could not parse statement: ${statement}`);
                errorCount++;
                continue;
            }

            const [, latStr, lngStr, name] = match;
            const lat = parseFloat(latStr);
            const lng = parseFloat(lngStr);

            // Update via Supabase REST API
            const response = await fetch(`${SUPABASE_URL}/rest/v1/temples?name=eq.${encodeURIComponent(name)}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'apikey': SUPABASE_ANON_KEY
                },
                body: JSON.stringify({
                    lat: lat,
                    lng: lng
                })
            });

            if (response.ok) {
                console.log(`✅ Updated: ${name} (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
                successCount++;
            } else {
                const errorText = await response.text();
                console.log(`❌ Failed: ${name} - ${response.status}: ${errorText}`);
                errorCount++;
            }

        } catch (error) {
            console.error(`❌ Error updating ${name}:`, error.message);
            errorCount++;
        }

        // Small delay between requests
        if (i < statements.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }

    console.log('\n📊 Update Summary:');
    console.log(`✅ Successfully updated: ${successCount} temples`);
    console.log(`❌ Failed to update: ${errorCount} temples`);
    console.log(`\n🎉 Supabase coordinate update process completed!`);

    if (successCount > 0) {
        console.log('\n📝 Next steps:');
        console.log('1. Verify the updates in your Supabase dashboard');
        console.log('2. Test the application to ensure all temples appear on the map');
        console.log('3. Commit the updated temple-data.js file to your repository');
    }
}

// Run the script
updateSupabaseCoordinates().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
});