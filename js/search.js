// search.js - Search Functionality
// Divya Desam Temple Locator v4.0.0

import { CONFIG, FALLBACK_CITIES } from './config.js';
import { debounce, delay, log, logError, sanitizeHTML, escapeHtmlAttribute } from './utils.js';
import { TempleData } from './data.js';

/**
 * Temple Search Module
 * Handles temple name/deity search with autocomplete
 */
export const TempleSearch = {
  inputEl: null,
  suggestionsEl: null,
  currentFilter: 'all',

  /**
   * Initialize temple search
   * @param {string} inputId - Input element ID
   * @param {string} suggestionsId - Suggestions container ID
   */
  init(inputId, suggestionsId) {
    this.inputEl = document.getElementById(inputId);
    this.suggestionsEl = document.getElementById(suggestionsId);

    if (!this.inputEl || !this.suggestionsEl) {
      throw new Error(`Temple search elements not found: ${inputId}, ${suggestionsId}`);
    }

    // Attach input event with debounce
    this.inputEl.addEventListener('input', debounce(() => {
      this.handleInput();
    }, CONFIG.SEARCH_DEBOUNCE_MS));

    // Click outside to close suggestions
    document.addEventListener('click', (e) => {
      if (!this.inputEl.contains(e.target) && !this.suggestionsEl.contains(e.target)) {
        this.hideSuggestions();
      }
    });

    log('Temple search initialized');
  },

  /**
   * Handle input event
   */
  handleInput() {
    const query = this.inputEl.value.trim();
    log('Temple search query:', query);

    if (query.length < CONFIG.SEARCH_MIN_CHARS) {
      this.hideSuggestions();
      return;
    }

    this.search(query);
  },

  /**
   * Search temples
   * @param {string} query - Search query
   */
  search(query) {
    if (!TempleData.isLoaded()) {
      this.showError('Temple data not loaded yet');
      return;
    }

    // Get matching temples
    let results = TempleData.search(query);

    // Apply current filter
    if (this.currentFilter !== 'all') {
      results = TempleData.filterByRegion(this.currentFilter).filter(t =>
        (t.displayName || '').toLowerCase().includes(query.toLowerCase()) ||
        (t.name || '').toLowerCase().includes(query.toLowerCase()) ||
        (t.perumal || '').toLowerCase().includes(query.toLowerCase())
      );
    }

    // Limit results
    results = results.slice(0, CONFIG.SEARCH_MAX_RESULTS);

    log(`Found ${results.length} matching temples`);
    this.displayResults(results);
  },

  /**
   * Display search results
   * @param {Array} temples - Array of temple objects
   */
  displayResults(temples) {
    if (temples.length === 0) {
      this.suggestionsEl.innerHTML = '<div class="search-item">No temples found</div>';
      this.showSuggestions();
      return;
    }

    this.suggestionsEl.innerHTML = temples.map(temple => `
      <div class="search-item" data-temple-id="${escapeHtmlAttribute(temple.name)}">
        <div class="search-item-name">${sanitizeHTML(temple.displayName)}</div>
        <div class="search-item-details">
          ${temple.perumal ? '🕉️ ' + sanitizeHTML(temple.perumal) : ''}
          ${temple.perumal && temple.region ? '•' : ''}
          ${temple.region ? sanitizeHTML(temple.region) : ''}
        </div>
      </div>
    `).join('');

    // Add click handlers
    this.suggestionsEl.querySelectorAll('.search-item').forEach(item => {
      item.addEventListener('click', () => {
        const templeId = item.dataset.templeId;
        this.selectTemple(templeId);
      });
    });

    this.showSuggestions();
  },

  /**
   * Select a temple
   * @param {string} templeId - Temple ID
   */
  selectTemple(templeId) {
    const temple = TempleData.getById(templeId);
    if (temple) {
      this.inputEl.value = temple.displayName;
      this.hideSuggestions();

      // Dispatch event for other modules to react
      document.dispatchEvent(new CustomEvent('temple-selected', {
        detail: { temple }
      }));

      log('Temple selected:', temple.displayName);
    }
  },

  /**
   * Set region filter
   * @param {string} filter - Region filter
   */
  setFilter(filter) {
    this.currentFilter = filter;
    log('Temple filter set to:', filter);

    // Re-run search if there's a query
    if (this.inputEl.value.trim().length >= CONFIG.SEARCH_MIN_CHARS) {
      this.handleInput();
    }
  },

  /**
   * Show suggestions dropdown
   */
  showSuggestions() {
    this.suggestionsEl.classList.add('active');
    this.suggestionsEl.style.display = 'block';
  },

  /**
   * Hide suggestions dropdown
   */
  hideSuggestions() {
    this.suggestionsEl.classList.remove('active');
    this.suggestionsEl.style.display = 'none';
  },

  /**
   * Show error message
   * @param {string} message - Error message
   */
  showError(message) {
    this.suggestionsEl.innerHTML = `<div class="search-item error">${sanitizeHTML(message)}</div>`;
    this.showSuggestions();
  },

  /**
   * Clear search
   */
  clear() {
    this.inputEl.value = '';
    this.hideSuggestions();
  }
};

/**
 * Location Search Module
 * Handles location/city search with Nominatim API and fallback
 */
export const LocationSearch = {
  inputEl: null,
  suggestionsEl: null,

  /**
   * Initialize location search
   * @param {string} inputId - Input element ID
   * @param {string} suggestionsId - Suggestions container ID
   */
  init(inputId, suggestionsId) {
    this.inputEl = document.getElementById(inputId);
    this.suggestionsEl = document.getElementById(suggestionsId);

    if (!this.inputEl || !this.suggestionsEl) {
      throw new Error(`Location search elements not found: ${inputId}, ${suggestionsId}`);
    }

    // Attach input event with longer debounce for API calls
    this.inputEl.addEventListener('input', debounce(() => {
      this.handleInput();
    }, CONFIG.SEARCH_DEBOUNCE_MS * 2));

    // Click outside to close suggestions
    document.addEventListener('click', (e) => {
      if (!this.inputEl.contains(e.target) && !this.suggestionsEl.contains(e.target)) {
        this.hideSuggestions();
      }
    });

    log('Location search initialized');
  },

  /**
   * Handle input event
   */
  async handleInput() {
    const query = this.inputEl.value.trim();
    log('Location search query:', query);

    if (query.length < CONFIG.SEARCH_MIN_CHARS) {
      this.hideSuggestions();
      return;
    }

    await this.search(query);
  },

  /**
   * Search for location
   * @param {string} query - Search query
   */
  async search(query) {
    try {
      // Show loading state
      this.suggestionsEl.innerHTML = '<div class="search-item">Searching...</div>';
      this.showSuggestions();

      // Try Nominatim API first
      const results = await this.searchNominatim(query);

      if (results.length > 0) {
        this.displayResults(results);
        return;
      }

      // Fallback to local cities
      log('No Nominatim results, using fallback cities');
      this.searchFallbackCities(query);
    } catch (error) {
      logError('Location search error:', error);
      // Use fallback on error
      this.searchFallbackCities(query);
    }
  },

  /**
   * Search using Nominatim API
   * @param {string} query - Search query
   * @returns {Promise<Array>} - Array of location objects
   */
  async searchNominatim(query) {
    // Rate limiting - be respectful
    await delay(CONFIG.NOMINATIM_DELAY_MS);

    const url = `${CONFIG.NOMINATIM_URL}/search?` +
      `format=json&q=${encodeURIComponent(query + ', India')}&` +
      `limit=${CONFIG.SEARCH_MAX_RESULTS}&countrycodes=in`;

    log('Fetching from Nominatim:', url);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': CONFIG.USER_AGENT,
          'Accept': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      log(`Nominatim returned ${data.length} results`);

      return data.map(item => ({
        name: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        type: 'nominatim'
      }));
    } catch (error) {
      if (error.name === 'AbortError') {
        logError('Nominatim request timed out');
      } else {
        logError('Nominatim error:', error.message);
      }
      return [];
    }
  },

  /**
   * Search in fallback cities
   * @param {string} query - Search query
   */
  searchFallbackCities(query) {
    const term = query.toLowerCase().trim();
    const results = FALLBACK_CITIES
      .filter(city =>
        city.name.toLowerCase().includes(term) ||
        city.state.toLowerCase().includes(term)
      )
      .slice(0, CONFIG.SEARCH_MAX_RESULTS)
      .map(city => ({
        name: `${city.name}, ${city.state}`,
        lat: city.lat,
        lng: city.lng,
        type: 'city'
      }));

    log(`Fallback search found ${results.length} cities`);
    this.displayResults(results);
  },

  /**
   * Display search results
   * @param {Array} locations - Array of location objects
   */
  displayResults(locations) {
    if (locations.length === 0) {
      this.suggestionsEl.innerHTML = '<div class="search-item">No locations found</div>';
      this.showSuggestions();
      return;
    }

    this.suggestionsEl.innerHTML = locations.map(loc => `
      <div class="search-item"
           data-lat="${escapeHtmlAttribute(String(loc.lat))}"
           data-lng="${escapeHtmlAttribute(String(loc.lng))}"
           data-name="${escapeHtmlAttribute(loc.name)}">
        <div class="search-item-name">📍 ${sanitizeHTML(loc.name)}</div>
        <div class="search-item-details">${loc.type === 'nominatim' ? 'Map Data' : 'Major City'}</div>
      </div>
    `).join('');

    // Add click handlers
    this.suggestionsEl.querySelectorAll('.search-item').forEach(item => {
      item.addEventListener('click', () => {
        const lat = parseFloat(item.dataset.lat);
        const lng = parseFloat(item.dataset.lng);
        const name = item.dataset.name;
        this.selectLocation(lat, lng, name);
      });
    });

    this.showSuggestions();
  },

  /**
   * Select a location
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @param {string} name - Location name
   */
  selectLocation(lat, lng, name) {
    this.inputEl.value = name;
    this.inputEl.dataset.lat = lat;
    this.inputEl.dataset.lng = lng;
    this.hideSuggestions();

    // Dispatch event for other modules to react
    document.dispatchEvent(new CustomEvent('location-selected', {
      detail: { lat, lng, name }
    }));

    log('Location selected:', name, { lat, lng });
  },

  /**
   * Show suggestions dropdown
   */
  showSuggestions() {
    this.suggestionsEl.classList.add('active');
    this.suggestionsEl.style.display = 'block';
  },

  /**
   * Hide suggestions dropdown
   */
  hideSuggestions() {
    this.suggestionsEl.classList.remove('active');
    this.suggestionsEl.style.display = 'none';
  },

  /**
   * Clear search
   */
  clear() {
    this.inputEl.value = '';
    delete this.inputEl.dataset.lat;
    delete this.inputEl.dataset.lng;
    this.hideSuggestions();
  }
};
