/**
 * Google Tag Manager API Setup Script for Divya Desam Temple Locator
 * Automatically creates triggers, variables, and tags for comprehensive analytics
 * 
 * Prerequisites:
 * 1. Enable GTM API in Google Cloud Console
 * 2. Create service account with GTM Admin permissions
 * 3. Download service account key JSON file
 * 4. Install dependencies: npm install googleapis
 */

const { google } = require('googleapis');
const path = require('path');

// Configuration
const GTM_CONTAINER_ID = 'GTM-M5DT9W42';
const GA4_MEASUREMENT_ID = 'G-2XQ47PGXLG';
const SERVICE_ACCOUNT_KEY_PATH = './service-account-key.json'; // Download from Google Cloud Console

// Initialize GTM API client
async function initializeGTMClient() {
    const auth = new google.auth.GoogleAuth({
        keyFile: SERVICE_ACCOUNT_KEY_PATH,
        scopes: ['https://www.googleapis.com/auth/tagmanager.edit.containers']
    });

    const authClient = await auth.getClient();
    const tagmanager = google.tagmanager({ version: 'v2', auth: authClient });
    
    return tagmanager;
}

// GTM Configuration for Temple Locator
const GTM_CONFIG = {
    // Variables to capture temple-specific data
    variables: [
        {
            name: 'DL - Temple Name',
            type: 'v',
            parameter: [
                { type: 'TEMPLATE', key: 'name', value: 'templeName' }
            ]
        },
        {
            name: 'DL - Search Query',
            type: 'v',
            parameter: [
                { type: 'TEMPLATE', key: 'name', value: 'searchQuery' }
            ]
        },
        {
            name: 'DL - Route Start',
            type: 'v',
            parameter: [
                { type: 'TEMPLATE', key: 'name', value: 'routeStart' }
            ]
        },
        {
            name: 'DL - Route End',
            type: 'v',
            parameter: [
                { type: 'TEMPLATE', key: 'name', value: 'routeEnd' }
            ]
        },
        {
            name: 'DL - Temples Found',
            type: 'v',
            parameter: [
                { type: 'TEMPLATE', key: 'name', value: 'templesFound' }
            ]
        }
    ],

    // Triggers for temple locator interactions
    triggers: [
        {
            name: 'Find My Location Click',
            type: 'CLICK',
            filter: [
                {
                    type: 'EQUALS',
                    parameter: [
                        { type: 'TEMPLATE', key: 'arg0', value: '{{Click Element}}' },
                        { type: 'TEMPLATE', key: 'arg1', value: '.btn-locate' }
                    ]
                }
            ]
        },
        {
            name: 'Route Planning Button Click',
            type: 'CLICK',
            filter: [
                {
                    type: 'CONTAINS',
                    parameter: [
                        { type: 'TEMPLATE', key: 'arg0', value: '{{Click Text}}' },
                        { type: 'TEMPLATE', key: 'arg1', value: 'Find Temples Along Route' }
                    ]
                }
            ]
        },
        {
            name: 'Get Directions Click',
            type: 'CLICK',
            filter: [
                {
                    type: 'CSS_SELECTOR',
                    parameter: [
                        { type: 'TEMPLATE', key: 'arg0', value: '{{Click Element}}' },
                        { type: 'TEMPLATE', key: 'arg1', value: '.btn-navigate' }
                    ]
                }
            ]
        },
        {
            name: 'Tab Switch Click',
            type: 'CLICK',
            filter: [
                {
                    type: 'CSS_SELECTOR',
                    parameter: [
                        { type: 'TEMPLATE', key: 'arg0', value: '{{Click Element}}' },
                        { type: 'TEMPLATE', key: 'arg1', value: '.tab-btn' }
                    ]
                }
            ]
        },
        {
            name: 'Location Search Form Submit',
            type: 'FORM_SUBMIT',
            filter: [
                {
                    type: 'CSS_SELECTOR',
                    parameter: [
                        { type: 'TEMPLATE', key: 'arg0', value: '{{Form Element}}' },
                        { type: 'TEMPLATE', key: 'arg1', value: '#locationSearch' }
                    ]
                }
            ]
        }
    ],

    // GA4 Event Tags for temple interactions
    tags: [
        {
            name: 'GA4 - Temple Search',
            type: 'gaawe',
            parameter: [
                { key: 'measurementId', type: 'TEMPLATE', value: GA4_MEASUREMENT_ID },
                { key: 'eventName', type: 'TEMPLATE', value: 'temple_search' },
                {
                    key: 'eventParameters',
                    type: 'LIST',
                    list: [
                        {
                            type: 'MAP',
                            map: [
                                { key: 'parameter_name', type: 'TEMPLATE', value: 'search_term' },
                                { key: 'parameter_value', type: 'TEMPLATE', value: '{{DL - Search Query}}' }
                            ]
                        },
                        {
                            type: 'MAP',
                            map: [
                                { key: 'parameter_name', type: 'TEMPLATE', value: 'event_category' },
                                { key: 'parameter_value', type: 'TEMPLATE', value: 'Temple Locator' }
                            ]
                        }
                    ]
                }
            ],
            firingTriggerId: ['Find My Location Click', 'Location Search Form Submit']
        },
        {
            name: 'GA4 - Route Calculated',
            type: 'gaawe',
            parameter: [
                { key: 'measurementId', type: 'TEMPLATE', value: GA4_MEASUREMENT_ID },
                { key: 'eventName', type: 'TEMPLATE', value: 'route_calculated' },
                {
                    key: 'eventParameters',
                    type: 'LIST',
                    list: [
                        {
                            type: 'MAP',
                            map: [
                                { key: 'parameter_name', type: 'TEMPLATE', value: 'start_location' },
                                { key: 'parameter_value', type: 'TEMPLATE', value: '{{DL - Route Start}}' }
                            ]
                        },
                        {
                            type: 'MAP',
                            map: [
                                { key: 'parameter_name', type: 'TEMPLATE', value: 'end_location' },
                                { key: 'parameter_value', type: 'TEMPLATE', value: '{{DL - Route End}}' }
                            ]
                        },
                        {
                            type: 'MAP',
                            map: [
                                { key: 'parameter_name', type: 'TEMPLATE', value: 'temples_found' },
                                { key: 'parameter_value', type: 'TEMPLATE', value: '{{DL - Temples Found}}' }
                            ]
                        },
                        {
                            type: 'MAP',
                            map: [
                                { key: 'parameter_name', type: 'TEMPLATE', value: 'event_category' },
                                { key: 'parameter_value', type: 'TEMPLATE', value: 'Route Planning' }
                            ]
                        }
                    ]
                }
            ],
            firingTriggerId: ['Route Planning Button Click']
        },
        {
            name: 'GA4 - Directions Clicked',
            type: 'gaawe',
            parameter: [
                { key: 'measurementId', type: 'TEMPLATE', value: GA4_MEASUREMENT_ID },
                { key: 'eventName', type: 'TEMPLATE', value: 'directions_clicked' },
                {
                    key: 'eventParameters',
                    type: 'LIST',
                    list: [
                        {
                            type: 'MAP',
                            map: [
                                { key: 'parameter_name', type: 'TEMPLATE', value: 'temple_name' },
                                { key: 'parameter_value', type: 'TEMPLATE', value: '{{DL - Temple Name}}' }
                            ]
                        },
                        {
                            type: 'MAP',
                            map: [
                                { key: 'parameter_name', type: 'TEMPLATE', value: 'event_category' },
                                { key: 'parameter_value', type: 'TEMPLATE', value: 'Navigation' }
                            ]
                        }
                    ]
                }
            ],
            firingTriggerId: ['Get Directions Click']
        },
        {
            name: 'GA4 - Tab Switch',
            type: 'gaawe',
            parameter: [
                { key: 'measurementId', type: 'TEMPLATE', value: GA4_MEASUREMENT_ID },
                { key: 'eventName', type: 'TEMPLATE', value: 'tab_switched' },
                {
                    key: 'eventParameters',
                    type: 'LIST',
                    list: [
                        {
                            type: 'MAP',
                            map: [
                                { key: 'parameter_name', type: 'TEMPLATE', value: 'tab_name' },
                                { key: 'parameter_value', type: 'TEMPLATE', value: '{{Click Text}}' }
                            ]
                        },
                        {
                            type: 'MAP',
                            map: [
                                { key: 'parameter_name', type: 'TEMPLATE', value: 'event_category' },
                                { key: 'parameter_value', type: 'TEMPLATE', value: 'Navigation' }
                            ]
                        }
                    ]
                }
            ],
            firingTriggerId: ['Tab Switch Click']
        }
    ]
};

// Main setup function
async function setupGTMTracking() {
    console.log('🚀 Starting GTM setup for Divya Desam Temple Locator...');
    
    try {
        const gtm = await initializeGTMClient();
        const accountPath = `accounts/${await getAccountId(gtm)}`;
        const containerPath = `${accountPath}/containers/${GTM_CONTAINER_ID}`;
        const workspacePath = `${containerPath}/workspaces/${await getDefaultWorkspace(gtm, containerPath)}`;

        console.log('✅ GTM API client initialized');
        console.log('📦 Container:', GTM_CONTAINER_ID);

        // Create variables
        console.log('\n📊 Creating GTM Variables...');
        for (const variable of GTM_CONFIG.variables) {
            await createVariable(gtm, workspacePath, variable);
        }

        // Create triggers
        console.log('\n🎯 Creating GTM Triggers...');
        for (const trigger of GTM_CONFIG.triggers) {
            await createTrigger(gtm, workspacePath, trigger);
        }

        // Create tags
        console.log('\n🏷️ Creating GTM Tags...');
        for (const tag of GTM_CONFIG.tags) {
            await createTag(gtm, workspacePath, tag);
        }

        console.log('\n✨ GTM setup completed successfully!');
        console.log('\n📋 Next steps:');
        console.log('1. Go to GTM container: https://tagmanager.google.com/');
        console.log('2. Preview and test the setup');
        console.log('3. Publish the container when ready');
        console.log('\n🎉 Your temple locator will now track:');
        console.log('   • Temple searches and location requests');
        console.log('   • Route planning and calculations');
        console.log('   • Navigation clicks to Google Maps');
        console.log('   • Tab switches and user interactions');

    } catch (error) {
        console.error('❌ GTM setup failed:', error.message);
        console.error('Full error:', error);
    }
}

// Helper functions
async function getAccountId(gtm) {
    const accounts = await gtm.accounts.list();
    return accounts.data.account[0].accountId;
}

async function getDefaultWorkspace(gtm, containerPath) {
    const workspaces = await gtm.accounts.containers.workspaces.list({
        parent: containerPath
    });
    return workspaces.data.workspace.find(w => w.name === 'Default Workspace').workspaceId;
}

async function createVariable(gtm, workspacePath, variableConfig) {
    try {
        const result = await gtm.accounts.containers.workspaces.variables.create({
            parent: workspacePath,
            requestBody: variableConfig
        });
        console.log(`   ✅ Created variable: ${variableConfig.name}`);
        return result.data;
    } catch (error) {
        console.log(`   ⚠️ Variable may already exist: ${variableConfig.name}`);
    }
}

async function createTrigger(gtm, workspacePath, triggerConfig) {
    try {
        const result = await gtm.accounts.containers.workspaces.triggers.create({
            parent: workspacePath,
            requestBody: triggerConfig
        });
        console.log(`   ✅ Created trigger: ${triggerConfig.name}`);
        return result.data;
    } catch (error) {
        console.log(`   ⚠️ Trigger may already exist: ${triggerConfig.name}`);
    }
}

async function createTag(gtm, workspacePath, tagConfig) {
    try {
        const result = await gtm.accounts.containers.workspaces.tags.create({
            parent: workspacePath,
            requestBody: tagConfig
        });
        console.log(`   ✅ Created tag: ${tagConfig.name}`);
        return result.data;
    } catch (error) {
        console.log(`   ⚠️ Tag may already exist: ${tagConfig.name}`);
    }
}

// Enhanced data layer pushes (add to temple locator if needed)
function generateDataLayerScript() {
    return `
<!-- Add these data layer pushes to your temple locator for better tracking -->
<script>
// Push search data when user searches for temples
function pushTempleSearch(query, results) {
    window.dataLayer = window.dataLayer || [];
    dataLayer.push({
        event: 'temple_search',
        searchQuery: query,
        resultsCount: results
    });
}

// Push route data when user calculates route
function pushRouteCalculation(start, end, temples) {
    window.dataLayer = window.dataLayer || [];
    dataLayer.push({
        event: 'route_calculated',
        routeStart: start,
        routeEnd: end,
        templesFound: temples
    });
}

// Push temple selection data
function pushTempleSelection(templeName, region) {
    window.dataLayer = window.dataLayer || [];
    dataLayer.push({
        event: 'temple_selected',
        templeName: templeName,
        templeRegion: region
    });
}
</script>
    `;
}

// Run the setup
if (require.main === module) {
    setupGTMTracking();
}

module.exports = {
    setupGTMTracking,
    generateDataLayerScript,
    GTM_CONFIG
};