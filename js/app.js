// app.js - Application Initialization & Orchestration
// Divya Desam Temple Locator v4.0.0

import { log, logError } from './utils.js';
import { TempleData } from './data.js';
import { TempleSearch, LocationSearch } from './search.js';
import { Geolocation } from './geolocation.js';
import { MapView } from './map.js';
import { UI } from './ui.js';
import { Routing } from './routing.js';

/**
 * Main Application Class
 */
class DivyaDesamApp {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize application
   */
  async init() {
    try {
      log('🕉️ Initializing Divya Desam Locator v4.0.0');

      // Initialize UI first
      UI.init();
      UI.showLoading('Loading temple data...');
      UI.hideError();

      // Load temple data
      const dataLoaded = await TempleData.init();

      if (!dataLoaded) {
        throw new Error('Failed to load temple data. Please refresh the page.');
      }

      log(`✅ Temple data loaded: ${TempleData.count()} temples`);

      // Initialize map
      const mapInitialized = MapView.init('map');
      if (mapInitialized) {
        log('✅ Map initialized');
      } else {
        log('⚠️ Map initialization failed (non-critical)');
      }

      // Initialize search components
      try {
        TempleSearch.init('templeSearch', 'templeSuggestions');
        log('✅ Temple search initialized');
      } catch (error) {
        logError('Temple search initialization failed:', error);
      }

      try {
        LocationSearch.init('locationSearch', 'locationSuggestions');
        log('✅ Location search initialized');
      } catch (error) {
        logError('Location search initialization failed:', error);
      }

      // Set up event listeners
      this.setupEventListeners();

      // Hide loading
      UI.hideLoading();

      this.initialized = true;
      log('✅ Application initialized successfully');

      // Show initial message
      UI.elements.results.innerHTML = `
        <div class="welcome-message">
          <h2>🕉️ Welcome to Divya Desam Temple Locator</h2>
          <p>Find the nearest sacred temples to your location</p>
          <ul>
            <li>📍 Click "Find My Location" to find temples near you</li>
            <li>🔍 Search for temples by name or deity</li>
            <li>📌 Search by city or location</li>
          </ul>
        </div>
      `;
    } catch (error) {
      logError('❌ Application initialization failed:', error);
      UI.hideLoading();
      UI.showError(error.message || 'Failed to initialize app. Please refresh the page.');
    }
  }

  /**
   * Set up all event listeners
   */
  setupEventListeners() {
    // Temple selected from search
    document.addEventListener('temple-selected', (e) => {
      const { temple } = e.detail;
      log('Event: temple-selected', temple.displayName);

      UI.displaySingleTemple(temple);
      MapView.addTempleMarkers([temple]);
      MapView.focusTemple(temple);
    });

    // Location selected from search
    document.addEventListener('location-selected', async (e) => {
      const { lat, lng, name } = e.detail;
      log('Event: location-selected', name);

      UI.showLoading('Finding nearest temples...');
      UI.hideError();

      try {
        // Calculate nearest temples
        const nearest = Geolocation.calculateNearestTemples(lat, lng);

        if (nearest.length === 0) {
          UI.showError(`No temples found within 50km of ${name}`);
          UI.hideLoading();
          return;
        }

        // Calculate routes to nearest temples
        const templesWithRoutes = await Routing.calculateMultipleRoutes(lat, lng, nearest);

        // Display results
        UI.displayTemples(templesWithRoutes);
        MapView.setUserLocation(lat, lng, name);
        MapView.addTempleMarkers(templesWithRoutes);

        UI.hideLoading();
      } catch (error) {
        logError('Error processing location selection:', error);
        UI.hideLoading();
        UI.showError('Failed to calculate routes. Showing temples by distance only.');

        // Fallback: show temples without routes
        const nearest = Geolocation.calculateNearestTemples(lat, lng);
        UI.displayTemples(nearest);
        MapView.setUserLocation(lat, lng, name);
        MapView.addTempleMarkers(nearest);
      }
    });

    // Geolocation started
    document.addEventListener('geolocation-started', () => {
      log('Event: geolocation-started');
      UI.showLoading('Getting your location...');
      UI.hideError();
    });

    // Nearest temples found (from GPS)
    document.addEventListener('nearest-temples-found', async (e) => {
      const { position, temples } = e.detail;
      log('Event: nearest-temples-found', temples.length, 'temples');

      UI.showLoading('Calculating routes...');

      try {
        // Calculate routes to temples
        const templesWithRoutes = await Routing.calculateMultipleRoutes(
          position.lat,
          position.lng,
          temples
        );

        // Display results
        UI.displayTemples(templesWithRoutes);
        MapView.setUserLocation(position.lat, position.lng);
        MapView.addTempleMarkers(templesWithRoutes);

        UI.hideLoading();
      } catch (error) {
        logError('Error calculating routes:', error);
        UI.hideLoading();

        // Fallback: show temples without routes
        UI.displayTemples(temples);
        MapView.setUserLocation(position.lat, position.lng);
        MapView.addTempleMarkers(temples);
      }
    });

    // Geolocation error
    document.addEventListener('geolocation-error', (e) => {
      const { error } = e.detail;
      log('Event: geolocation-error', error);

      UI.hideLoading();
      UI.showError(error);
    });

    // Temple marker clicked on map
    document.addEventListener('temple-marker-clicked', (e) => {
      const { temple } = e.detail;
      log('Event: temple-marker-clicked', temple.displayName);

      // Scroll to temple card if visible
      const card = document.querySelector(`[data-temple-id="${temple.name}"]`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        card.classList.add('highlight');
        setTimeout(() => card.classList.remove('highlight'), 2000);
      }
    });

    // Global function for Find My Location button
    window.findMyLocation = async () => {
      log('Find My Location button clicked');
      try {
        await Geolocation.findNearest();
      } catch (error) {
        // Error already handled by event listeners
        logError('Find my location failed:', error);
      }
    };

    // Global function for temple filter buttons
    window.setTempleFilter = (filter) => {
      log('Filter changed to:', filter);
      TempleSearch.setFilter(filter);
      UI.updateFilterButtons(filter);

      // Update button styles
      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      const activeBtn = document.querySelector(`[onclick="setTempleFilter('${filter}')"]`);
      if (activeBtn) {
        activeBtn.classList.add('active');
      }
    };

    log('✅ Event listeners configured');
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const app = new DivyaDesamApp();
    app.init();
  });
} else {
  // DOM already loaded
  const app = new DivyaDesamApp();
  app.init();
}
