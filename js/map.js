// map.js - Leaflet Map Integration
// Divya Desam Temple Locator v4.0.0

import { CONFIG } from './config.js';
import { log, logError, sanitizeHTML } from './utils.js';

/**
 * Map Module
 * Handles Leaflet map initialization and temple markers
 */
export const MapView = {
  map: null,
  markers: [],
  userMarker: null,

  /**
   * Initialize map
   * @param {string} elementId - Map container element ID
   * @returns {boolean} - True if successful
   */
  init(elementId) {
    try {
      // Check if Leaflet is loaded
      if (typeof L === 'undefined') {
        logError('Leaflet library not loaded');
        return false;
      }

      const mapElement = document.getElementById(elementId);
      if (!mapElement) {
        logError(`Map element not found: ${elementId}`);
        return false;
      }

      log('Initializing map...');

      // Create map centered on Tamil Nadu
      this.map = L.map(elementId, {
        center: [11.0, 78.7],
        zoom: 7,
        zoomControl: true
      });

      // Add OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: CONFIG.MAP_MAX_ZOOM
      }).addTo(this.map);

      log('✅ Map initialized successfully');
      return true;
    } catch (error) {
      logError('Map initialization failed:', error);
      return false;
    }
  },

  /**
   * Add temple markers to map
   * @param {Array} temples - Array of temple objects
   */
  addTempleMarkers(temples) {
    if (!this.map) {
      logError('Map not initialized');
      return;
    }

    // Clear existing markers
    this.clearMarkers();

    if (!temples || temples.length === 0) {
      return;
    }

    log(`Adding ${temples.length} temple markers`);

    // Add marker for each temple
    temples.forEach(temple => {
      const marker = L.marker([temple.lat, temple.lng], {
        title: temple.displayName
      }).addTo(this.map);

      // Create popup content
      const popupContent = `
        <div class="map-popup">
          <strong>${sanitizeHTML(temple.displayName)}</strong><br>
          ${temple.perumal ? sanitizeHTML(temple.perumal) + '<br>' : ''}
          ${temple.distance ? `Distance: ${temple.distance.toFixed(1)}km<br>` : ''}
          <a href="${temple.link}" target="_blank" rel="noopener">Navigate</a>
        </div>
      `;

      marker.bindPopup(popupContent);

      // Add click event
      marker.on('click', () => {
        document.dispatchEvent(new CustomEvent('temple-marker-clicked', {
          detail: { temple }
        }));
      });

      this.markers.push(marker);
    });

    // Fit bounds to show all markers
    if (this.markers.length > 0) {
      const bounds = L.latLngBounds(temples.map(t => [t.lat, t.lng]));
      this.map.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: CONFIG.MAP_DEFAULT_ZOOM
      });
    }
  },

  /**
   * Set user location marker
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @param {string} name - Location name (optional)
   */
  setUserLocation(lat, lng, name = 'Your Location') {
    if (!this.map) {
      logError('Map not initialized');
      return;
    }

    log('Setting user location:', { lat, lng });

    // Remove existing user marker
    if (this.userMarker) {
      this.map.removeLayer(this.userMarker);
    }

    // Create custom blue marker for user location
    const blueIcon = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    // Add user marker
    this.userMarker = L.marker([lat, lng], {
      icon: blueIcon,
      title: name
    }).addTo(this.map);

    this.userMarker.bindPopup(`<strong>${sanitizeHTML(name)}</strong>`).openPopup();

    // Center map on user location
    this.map.setView([lat, lng], CONFIG.MAP_DEFAULT_ZOOM);
  },

  /**
   * Clear all temple markers
   */
  clearMarkers() {
    if (!this.map) return;

    this.markers.forEach(marker => {
      this.map.removeLayer(marker);
    });
    this.markers = [];

    log('Cleared all temple markers');
  },

  /**
   * Clear user location marker
   */
  clearUserLocation() {
    if (this.userMarker && this.map) {
      this.map.removeLayer(this.userMarker);
      this.userMarker = null;
    }
  },

  /**
   * Focus on a specific temple
   * @param {Object} temple - Temple object
   */
  focusTemple(temple) {
    if (!this.map) return;

    this.map.setView([temple.lat, temple.lng], CONFIG.MAP_DEFAULT_ZOOM + 2);

    // Find and open the temple's popup
    const marker = this.markers.find(m => {
      const latlng = m.getLatLng();
      return latlng.lat === temple.lat && latlng.lng === temple.lng;
    });

    if (marker) {
      marker.openPopup();
    }
  },

  /**
   * Reset map to default view
   */
  reset() {
    if (!this.map) return;

    this.clearMarkers();
    this.clearUserLocation();
    this.map.setView([11.0, 78.7], 7);
  }
};
