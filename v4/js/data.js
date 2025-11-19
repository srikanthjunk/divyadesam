// data.js - Data Loading & Management
// Divya Desam Temple Locator v4.0.0

import { log, logError, logWarn } from './utils.js';

/**
 * Temple Data Manager
 * Handles loading and accessing temple data and timings
 */
class TempleDataManager {
  constructor() {
    this.temples = [];
    this.timings = {};
    this.loaded = false;
  }

  /**
   * Load temple data from external JS file
   * @returns {Promise<boolean>} - True if successful
   */
  async loadTemples() {
    try {
      log('Loading temple data...');

      // Check if already loaded by script tag in HTML
      if (window.divyaDesams && Array.isArray(window.divyaDesams) && window.divyaDesams.length > 0) {
        this.temples = window.divyaDesams;
        log(`✅ Loaded ${this.temples.length} temples from window.divyaDesams`);
        this.loaded = true;
        return true;
      }

      // Fallback: Try to load dynamically
      log('Attempting to load temple data dynamically...');
      await this.loadScript('./data/temples.js');

      // Wait a bit for script to execute
      await new Promise(resolve => setTimeout(resolve, 100));

      if (window.divyaDesams && Array.isArray(window.divyaDesams) && window.divyaDesams.length > 0) {
        this.temples = window.divyaDesams;
        log(`✅ Loaded ${this.temples.length} temples dynamically`);
        this.loaded = true;
        return true;
      }

      logError('Temple data not available in window.divyaDesams');
      return false;
    } catch (error) {
      logError('Failed to load temple data:', error);
      return false;
    }
  }

  /**
   * Load temple timings from JSON file
   * @returns {Promise<boolean>} - True if successful
   */
  async loadTimings() {
    try {
      log('Loading temple timings...');
      const response = await fetch('./data/timings.json');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      this.timings = await response.json();
      log(`✅ Loaded timings for ${Object.keys(this.timings).length} temples`);
      return true;
    } catch (error) {
      logWarn('Failed to load timings (non-critical):', error);
      return false; // Timings are optional
    }
  }

  /**
   * Load script dynamically
   * @param {string} src - Script source URL
   * @returns {Promise} - Promise that resolves when script loads
   */
  loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => {
        log(`Script loaded: ${src}`);
        resolve();
      };
      script.onerror = () => {
        logError(`Failed to load script: ${src}`);
        reject(new Error(`Could not load ${src}`));
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Initialize - load all data
   * @returns {Promise<boolean>} - True if temple data loaded successfully
   */
  async init() {
    const [templesOk, timingsOk] = await Promise.all([
      this.loadTemples(),
      this.loadTimings()
    ]);

    if (!templesOk) {
      logError('❌ Critical: Temple data failed to load');
      return false;
    }

    if (!timingsOk) {
      logWarn('⚠️ Temple timings not available (will use defaults)');
    }

    log('✅ Data manager initialized successfully');
    return true;
  }

  /**
   * Get all temples
   * @returns {Array} - Array of temple objects
   */
  getAll() {
    return this.temples;
  }

  /**
   * Get temple by ID (name field)
   * @param {string} id - Temple ID
   * @returns {Object|undefined} - Temple object or undefined
   */
  getById(id) {
    return this.temples.find(t => t.name === id);
  }

  /**
   * Search temples by query
   * @param {string} query - Search query
   * @returns {Array} - Matching temples
   */
  search(query) {
    const term = query.toLowerCase().trim();
    if (!term) return [];

    return this.temples.filter(t =>
      (t.displayName || '').toLowerCase().includes(term) ||
      (t.name || '').toLowerCase().includes(term) ||
      (t.perumal || '').toLowerCase().includes(term) ||
      (t.thaayaar || '').toLowerCase().includes(term) ||
      (t.locality || '').toLowerCase().includes(term)
    );
  }

  /**
   * Filter temples by region/tradition
   * @param {string} region - Region filter ('all', 'divya-desam', etc.)
   * @returns {Array} - Filtered temples
   */
  filterByRegion(region) {
    if (!region || region === 'all') {
      return this.temples;
    }

    const regionLower = region.toLowerCase();

    return this.temples.filter(t => {
      const templeRegion = (t.region || '').toLowerCase();

      switch (regionLower) {
        case 'divya-desam':
          return templeRegion.includes('divya desam');
        case 'paadal-petra':
          return templeRegion.includes('paadal petra');
        case 'abhimana':
          return templeRegion.includes('abhimana');
        default:
          return templeRegion.includes(regionLower);
      }
    });
  }

  /**
   * Get temple timings
   * @param {string} templeId - Temple ID
   * @returns {Object} - Timing information
   */
  getTimings(templeId) {
    const timing = this.timings[templeId];

    if (timing) {
      return {
        hours: timing.hours || [],
        phone: timing.phone || null,
        website: timing.website || null,
        note: timing.note || null,
        status: timing.status || 'available',
        source: timing.source || 'curated'
      };
    }

    // Return default timings
    return {
      hours: ['Morning: 6:00 AM - 12:00 PM', 'Evening: 4:00 PM - 8:00 PM'],
      note: 'Generic temple hours - please verify with temple',
      status: 'generic',
      source: 'fallback'
    };
  }

  /**
   * Check if data is loaded
   * @returns {boolean}
   */
  isLoaded() {
    return this.loaded;
  }

  /**
   * Get temple count
   * @returns {number}
   */
  count() {
    return this.temples.length;
  }
}

// Export singleton instance
export const TempleData = new TempleDataManager();
