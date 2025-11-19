// geolocation.js - GPS & Location Services
// Divya Desam Temple Locator v4.0.0

import { CONFIG } from './config.js';
import { calculateDistance, log, logError, isValidCoordinates } from './utils.js';
import { TempleData } from './data.js';

/**
 * Geolocation Module
 * Handles GPS location and finding nearest temples
 */
export const Geolocation = {
  /**
   * Get current GPS position
   * @returns {Promise<Object>} - Promise resolving to {lat, lng}
   */
  async getCurrentPosition() {
    return new Promise((resolve, reject) => {
      // Check if geolocation is supported
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      log('Requesting GPS position...');

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          log('GPS coordinates received:', latitude, longitude);

          // Validate coordinates
          if (!isValidCoordinates(latitude, longitude)) {
            reject(new Error('Invalid GPS coordinates received'));
            return;
          }

          resolve({ lat: latitude, lng: longitude });
        },
        (error) => {
          let message = 'Unable to get your location';

          switch (error.code) {
            case error.PERMISSION_DENIED:
              message = 'Location access denied. Please enable location services in your browser settings.';
              break;
            case error.POSITION_UNAVAILABLE:
              message = 'Location information unavailable. Please try again.';
              break;
            case error.TIMEOUT:
              message = 'Location request timed out. Please try again.';
              break;
          }

          logError('Geolocation error:', error.code, error.message);
          reject(new Error(message));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000, // 10 seconds
          maximumAge: 300000 // 5 minutes cache
        }
      );
    });
  },

  /**
   * Find nearest temples to current GPS location
   * @returns {Promise<Array>} - Promise resolving to array of nearest temples
   */
  async findNearest() {
    try {
      log('Finding nearest temples...');

      // Dispatch loading event
      document.dispatchEvent(new CustomEvent('geolocation-started'));

      // Get current position
      const position = await this.getCurrentPosition();

      // Calculate nearest temples
      const nearest = this.calculateNearestTemples(position.lat, position.lng);

      log(`Found ${nearest.length} nearby temples`);

      // Dispatch success event
      document.dispatchEvent(new CustomEvent('nearest-temples-found', {
        detail: { position, temples: nearest }
      }));

      return nearest;
    } catch (error) {
      logError('Geolocation failed:', error);

      // Dispatch error event
      document.dispatchEvent(new CustomEvent('geolocation-error', {
        detail: { error: error.message }
      }));

      throw error;
    }
  },

  /**
   * Calculate nearest temples to a given location
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @returns {Array} - Sorted array of nearest temples with distance
   */
  calculateNearestTemples(lat, lng) {
    if (!TempleData.isLoaded()) {
      throw new Error('Temple data not loaded');
    }

    if (!isValidCoordinates(lat, lng)) {
      throw new Error('Invalid coordinates provided');
    }

    log('Calculating distances from:', { lat, lng });

    // Calculate distance to each temple
    const templesWithDistance = TempleData.getAll().map(temple => {
      const distance = calculateDistance(lat, lng, temple.lat, temple.lng);
      return {
        ...temple,
        distance: distance
      };
    });

    // Filter by max distance and sort
    const nearest = templesWithDistance
      .filter(t => t.distance <= CONFIG.MAX_AIR_DISTANCE_KM)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, CONFIG.MAX_NEAREST_TEMPLES);

    log(`Filtered to ${nearest.length} temples within ${CONFIG.MAX_AIR_DISTANCE_KM}km`);

    return nearest;
  },

  /**
   * Calculate nearest temples from a selected location (not GPS)
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @param {string} locationName - Name of location
   * @returns {Array} - Sorted array of nearest temples
   */
  findNearestToLocation(lat, lng, locationName) {
    log('Finding nearest temples to:', locationName);

    const nearest = this.calculateNearestTemples(lat, lng);

    // Dispatch event
    document.dispatchEvent(new CustomEvent('nearest-temples-found', {
      detail: {
        position: { lat, lng, name: locationName },
        temples: nearest
      }
    }));

    return nearest;
  }
};
