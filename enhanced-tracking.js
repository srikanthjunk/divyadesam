/**
 * Enhanced Data Layer Tracking for Divya Desam Temple Locator
 * Lightweight script to push specific events to GTM data layer
 * 
 * This script adds minimal tracking calls to existing functions
 * without impacting performance or requiring major code changes
 */

// Initialize data layer if not exists
window.dataLayer = window.dataLayer || [];

// Enhanced tracking functions (minimal overhead)
const TempleTracking = {
    
    // Track temple searches with results
    searchPerformed: function(query, results = 0, source = 'search') {
        dataLayer.push({
            event: 'temple_search',
            searchQuery: query?.substring(0, 100) || '', // Limit length
            resultsCount: parseInt(results) || 0,
            searchSource: source, // 'search', 'location', 'gps'
            timestamp: Date.now()
        });
    },

    // Track route calculations
    routeCalculated: function(start, end, templesFound = 0, detourKm = 0) {
        dataLayer.push({
            event: 'route_calculated',
            routeStart: start?.substring(0, 50) || '',
            routeEnd: end?.substring(0, 50) || '',
            templesFound: parseInt(templesFound) || 0,
            maxDetourKm: parseInt(detourKm) || 0,
            timestamp: Date.now()
        });
    },

    // Track temple selections (when user clicks on a temple)
    templeSelected: function(templeName, region, source = 'unknown') {
        dataLayer.push({
            event: 'temple_selected',
            templeName: templeName?.substring(0, 100) || '',
            templeRegion: region || '',
            selectionSource: source, // 'search_result', 'map_marker', 'route_result'
            timestamp: Date.now()
        });
    },

    // Track directions clicks
    directionsClicked: function(templeName, service = 'google_maps') {
        dataLayer.push({
            event: 'directions_clicked',
            templeName: templeName?.substring(0, 100) || '',
            mapService: service,
            timestamp: Date.now()
        });
    },

    // Track user location usage
    locationUsed: function(method, success = true, lat = null, lng = null) {
        dataLayer.push({
            event: 'location_accessed',
            locationMethod: method, // 'gps', 'search', 'manual'
            locationSuccess: success,
            // Only track general area for privacy
            userRegion: lat ? this.getGeneralRegion(lat, lng) : '',
            timestamp: Date.now()
        });
    },

    // Track tab switches for UI analytics
    tabSwitched: function(fromTab, toTab) {
        dataLayer.push({
            event: 'tab_switched',
            fromTab: fromTab || '',
            toTab: toTab || '',
            timestamp: Date.now()
        });
    },

    // Track errors for improvement insights
    errorOccurred: function(errorType, message = '', context = '') {
        dataLayer.push({
            event: 'app_error',
            errorType: errorType, // 'api_failure', 'location_denied', 'temple_load_failed'
            errorMessage: message?.substring(0, 200) || '',
            errorContext: context?.substring(0, 100) || '',
            timestamp: Date.now()
        });
    },

    // Helper function to get general region for privacy
    getGeneralRegion: function(lat, lng) {
        // Rough region mapping for privacy (not exact location)
        if (lat > 8 && lat < 13 && lng > 76 && lng < 80) return 'Tamil Nadu';
        if (lat > 11 && lat < 16 && lng > 74 && lng < 78) return 'Karnataka';
        if (lat > 8 && lat < 12 && lng > 75 && lng < 77) return 'Kerala';
        if (lat > 17 && lat < 20 && lng > 78 && lng < 82) return 'Telangana';
        if (lat > 18 && lat < 22 && lng > 72 && lng < 75) return 'Maharashtra';
        return 'India'; // Fallback
    }
};

// Auto-track page interactions if elements exist
document.addEventListener('DOMContentLoaded', function() {
    
    // Track tab clicks automatically
    document.addEventListener('click', function(event) {
        const element = event.target;
        
        // Tab switching
        if (element.classList.contains('tab-btn')) {
            const tabText = element.textContent?.trim();
            const activeTab = document.querySelector('.tab-btn.active')?.textContent?.trim();
            TempleTracking.tabSwitched(activeTab, tabText);
        }
        
        // Directions buttons
        if (element.classList.contains('btn-navigate')) {
            const templeCard = element.closest('.temple-card');
            const templeName = templeCard?.querySelector('.temple-name')?.textContent?.trim();
            TempleTracking.directionsClicked(templeName);
        }
        
        // Temple selections
        if (element.closest('.temple-card') && !element.classList.contains('btn-navigate')) {
            const templeCard = element.closest('.temple-card');
            const templeName = templeCard?.querySelector('.temple-name')?.textContent?.trim();
            const region = templeCard?.querySelector('[style*="region"]')?.textContent?.replace('Region:', '').trim();
            TempleTracking.templeSelected(templeName, region, 'card_click');
        }
    });
    
    // Track form submissions
    const locationForm = document.querySelector('#locationSearch');
    if (locationForm) {
        locationForm.addEventListener('input', function(event) {
            const query = event.target.value;
            if (query.length > 2) {
                // Debounced tracking to avoid spam
                clearTimeout(window.searchTimeout);
                window.searchTimeout = setTimeout(() => {
                    TempleTracking.searchPerformed(query, 0, 'location_search');
                }, 1000);
            }
        });
    }
});

// Integrate with existing temple locator functions (examples)
/*
Add these calls to your existing functions:

// In findNearestTemplesFromCoords function:
TempleTracking.locationUsed('gps', true, lat, lng);
TempleTracking.searchPerformed('GPS Location', results.length, 'gps');

// In route planning function:
TempleTracking.routeCalculated(startLocation, endLocation, templesFound, maxDetour);

// In error handling:
TempleTracking.errorOccurred('api_failure', 'OSRM API unavailable', 'route_planning');

// In search functions:
TempleTracking.searchPerformed(searchQuery, searchResults.length, 'temple_search');
*/

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TempleTracking;
} else {
    window.TempleTracking = TempleTracking;
}

// Log successful initialization
console.log('📊 Temple Analytics tracking initialized');