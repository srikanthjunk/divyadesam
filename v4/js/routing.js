// routing.js - OSRM Route Planning
// Divya Desam Temple Locator v4.0.0

import { CONFIG } from './config.js';
import { delay, log, logError, calculateDistance } from './utils.js';

/**
 * Routing Module
 * Handles route calculation using OSRM API with fallback
 */
export const Routing = {
  /**
   * Get route between two points
   * @param {number} startLat - Start latitude
   * @param {number} startLng - Start longitude
   * @param {number} endLat - End latitude
   * @param {number} endLng - End longitude
   * @returns {Promise<Object>} - Route information
   */
  async getRoute(startLat, startLng, endLat, endLng) {
    try {
      // Rate limiting - be respectful to free service
      await delay(500);

      const url = `${CONFIG.OSRM_URL}/route/v1/driving/` +
        `${startLng},${startLat};${endLng},${endLat}?` +
        `overview=false&steps=false`;

      log('Fetching route from OSRM:', url);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT_MS);

      const response = await fetch(url, {
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        return {
          distance: Math.round(route.distance / 1000), // Convert to km
          duration: Math.round(route.duration / 60),   // Convert to minutes
          source: 'osrm',
          type: 'driving'
        };
      }

      throw new Error('No route found');
    } catch (error) {
      if (error.name === 'AbortError') {
        logError('OSRM request timed out');
      } else {
        logError('OSRM routing error:', error.message);
      }

      // Fallback to estimated distance
      return this.getEstimatedRoute(startLat, startLng, endLat, endLng);
    }
  },

  /**
   * Get estimated route using straight-line distance
   * @param {number} startLat - Start latitude
   * @param {number} startLng - Start longitude
   * @param {number} endLat - End latitude
   * @param {number} endLng - End longitude
   * @returns {Object} - Estimated route information
   */
  getEstimatedRoute(startLat, startLng, endLat, endLng) {
    const straightDistance = calculateDistance(startLat, startLng, endLat, endLng);

    // Add 30% to account for road distance
    const estimatedRoadDistance = straightDistance * 1.3;

    // Rough estimate: 40 km/h average speed in India
    const estimatedDuration = (estimatedRoadDistance / 40) * 60;

    log('Using estimated route (fallback)');

    return {
      distance: Math.round(estimatedRoadDistance),
      duration: Math.round(estimatedDuration),
      source: 'estimated',
      type: 'straight-line'
    };
  },

  /**
   * Calculate routes to multiple temples
   * @param {number} startLat - Start latitude
   * @param {number} startLng - Start longitude
   * @param {Array} temples - Array of temple objects
   * @returns {Promise<Array>} - Temples with route information
   */
  async calculateMultipleRoutes(startLat, startLng, temples) {
    log(`Calculating routes to ${temples.length} temples...`);

    const routePromises = temples.map(async (temple, index) => {
      // Stagger requests to avoid rate limiting
      await delay(index * 600);

      try {
        const route = await this.getRoute(startLat, startLng, temple.lat, temple.lng);
        return {
          ...temple,
          ...route
        };
      } catch (error) {
        logError(`Route calculation failed for ${temple.displayName}:`, error);
        // Return temple with estimated distance
        const estimated = this.getEstimatedRoute(startLat, startLng, temple.lat, temple.lng);
        return {
          ...temple,
          ...estimated
        };
      }
    });

    return await Promise.all(routePromises);
  },

  /**
   * Plan multi-temple route
   * @param {number} startLat - Start latitude
   * @param {number} startLng - Start longitude
   * @param {Array} temples - Array of temple objects
   * @param {number} maxDetourKm - Maximum detour in kilometers
   * @returns {Promise<Array>} - Filtered temples within detour range
   */
  async planMultiTempleRoute(startLat, startLng, temples, maxDetourKm) {
    log(`Planning multi-temple route with ${maxDetourKm}km detour limit`);

    // Calculate routes to all temples
    const templesWithRoutes = await this.calculateMultipleRoutes(startLat, startLng, temples);

    // Filter by detour range
    const withinRange = templesWithRoutes.filter(t => t.distance <= maxDetourKm);

    // Sort by distance
    withinRange.sort((a, b) => a.distance - b.distance);

    log(`Found ${withinRange.length} temples within ${maxDetourKm}km`);

    return withinRange;
  }
};
