# Divya Desam Locator - Complete Rewrite Specification

**Version**: 4.0.0 (Complete Rewrite)
**Target**: GitHub Pages Static Hosting
**Date**: November 19, 2025

---

## Goals

### Primary Goals
1. ✅ **FIX BROKEN SEARCH** - Temple and location search must work
2. ✅ **FIX GEOLOCATION** - "Find My Location" button must work
3. ✅ **REDUCE COMPLEXITY** - From 3,400 lines to ~1,500 lines (60% reduction)
4. ✅ **MODULAR ARCHITECTURE** - Separate concerns into logical files
5. ✅ **MAINTAINABLE CODE** - Easy to debug and extend

### Secondary Goals
1. ⚡ **PERFORMANCE** - Faster load times, lazy loading
2. 📱 **MOBILE-FIRST** - Optimized for Indian smartphone users
3. ♿ **ACCESSIBILITY** - ARIA labels, keyboard navigation
4. 🔧 **DEBUGGING** - Clear error messages, logging

---

## Architecture Overview

### New File Structure
```
divyadesam/
├── index.html              (150 lines - clean structure)
├── css/
│   ├── variables.css       (50 lines - CSS custom properties)
│   ├── base.css            (100 lines - global styles)
│   ├── components.css      (150 lines - reusable UI components)
│   └── responsive.css      (80 lines - media queries)
├── js/
│   ├── config.js           (50 lines - configuration)
│   ├── data.js             (100 lines - data loading & management)
│   ├── search.js           (200 lines - temple & location search)
│   ├── geolocation.js      (120 lines - GPS & location services)
│   ├── map.js              (150 lines - Leaflet map integration)
│   ├── routing.js          (180 lines - OSRM route planning)
│   ├── ui.js               (150 lines - DOM manipulation & display)
│   ├── utils.js            (100 lines - helper functions)
│   └── app.js              (100 lines - initialization & orchestration)
├── data/
│   ├── temples.json        (179KB - temple database)
│   └── timings.json        (25KB - temple timings)
└── assets/
    └── (images, if any)

Total JavaScript: ~1,150 lines (down from 2,700+)
Total CSS: ~380 lines (down from 465)
Total HTML: ~150 lines (down from 565)
TOTAL: ~1,680 lines (60% reduction from 3,730)
```

---

## Module Specifications

### 1. `config.js` - Configuration & Constants

**Purpose**: Centralized configuration
**Exports**: `CONFIG` object
**Dependencies**: None

```javascript
// config.js
export const CONFIG = {
  // API Configuration
  NOMINATIM_URL: 'https://nominatim.openstreetmap.org',
  OSRM_URL: 'https://router.project-osrm.org',
  USER_AGENT: 'DivyaDesamLocator/4.0.0',

  // Search Configuration
  SEARCH_MIN_CHARS: 2,
  SEARCH_DEBOUNCE_MS: 300,
  SEARCH_MAX_RESULTS: 8,

  // Distance & Routing
  MAX_AIR_DISTANCE_KM: 50,
  MAX_NEAREST_TEMPLES: 10,
  DEFAULT_DETOUR_KM: 25,
  BATCH_SIZE: 2,

  // API Rate Limiting
  API_TIMEOUT_MS: 15000,
  NOMINATIM_DELAY_MS: 1000, // Be respectful

  // UI
  MAP_DEFAULT_ZOOM: 13,
  MAP_MAX_ZOOM: 18,

  // Debug
  DEBUG: true
};

export const FALLBACK_CITIES = [
  { name: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lng: 80.2707 },
  { name: 'Madurai', state: 'Tamil Nadu', lat: 9.9252, lng: 78.1198 },
  // ... 50 major cities
];
```

**Size**: ~50 lines

---

### 2. `utils.js` - Utility Functions

**Purpose**: Reusable helper functions
**Exports**: Multiple utility functions
**Dependencies**: None

```javascript
// utils.js

// Distance calculation (Haversine formula)
export function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a = Math.sin(dLat/2) ** 2 +
            Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
            Math.sin(dLng/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Coordinate validation
export function isValidCoordinates(lat, lng) {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

// HTML sanitization
export function sanitizeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Debounce function
export function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Format distance
export function formatDistance(km) {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
}

// Format duration
export function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

// Delay (for rate limiting)
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Logger
export function log(...args) {
  if (CONFIG.DEBUG) console.log('[DD]', ...args);
}

export function logError(...args) {
  console.error('[DD ERROR]', ...args);
}

function toRadians(degrees) {
  return degrees * Math.PI / 180;
}
```

**Size**: ~100 lines

---

### 3. `data.js` - Data Loading & Management

**Purpose**: Load and manage temple data
**Exports**: `TempleData` object
**Dependencies**: `utils.js`

```javascript
// data.js
import { log, logError } from './utils.js';

class TempleDataManager {
  constructor() {
    this.temples = [];
    this.timings = {};
    this.loaded = false;
  }

  async loadTemples() {
    try {
      log('Loading temple data...');

      // Load from external JS file (already included in HTML)
      if (window.divyaDesams && Array.isArray(window.divyaDesams)) {
        this.temples = window.divyaDesams;
        log(`Loaded ${this.temples.length} temples`);
        this.loaded = true;
        return true;
      }

      // Fallback: Load dynamically
      await this.loadScript('./data/temples.js');
      this.temples = window.divyaDesams || [];
      this.loaded = this.temples.length > 0;
      return this.loaded;
    } catch (error) {
      logError('Failed to load temple data:', error);
      return false;
    }
  }

  async loadTimings() {
    try {
      log('Loading temple timings...');
      const response = await fetch('./data/timings.json');
      this.timings = await response.json();
      log(`Loaded timings for ${Object.keys(this.timings).length} temples`);
      return true;
    } catch (error) {
      logError('Failed to load timings:', error);
      return false;
    }
  }

  async init() {
    const [templesOk, timingsOk] = await Promise.all([
      this.loadTemples(),
      this.loadTimings()
    ]);
    return templesOk; // Timings are optional
  }

  getAll() {
    return this.temples;
  }

  getById(id) {
    return this.temples.find(t => t.name === id);
  }

  search(query) {
    const term = query.toLowerCase();
    return this.temples.filter(t =>
      t.displayName.toLowerCase().includes(term) ||
      t.name.toLowerCase().includes(term) ||
      (t.perumal || '').toLowerCase().includes(term) ||
      (t.thaayaar || '').toLowerCase().includes(term)
    );
  }

  filterByRegion(region) {
    if (region === 'all') return this.temples;
    return this.temples.filter(t =>
      t.region && t.region.toLowerCase().includes(region.toLowerCase())
    );
  }

  getTimings(templeId) {
    return this.timings[templeId] || {
      hours: ['Morning: 6:00 AM - 12:00 PM', 'Evening: 4:00 PM - 8:00 PM'],
      note: 'Generic temple hours - please verify',
      status: 'generic'
    };
  }

  loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
}

export const TempleData = new TempleDataManager();
```

**Size**: ~100 lines

---

### 4. `search.js` - Search Functionality

**Purpose**: Temple search and location search
**Exports**: `TempleSearch`, `LocationSearch`
**Dependencies**: `config.js`, `utils.js`, `data.js`, `ui.js`

```javascript
// search.js
import { CONFIG, FALLBACK_CITIES } from './config.js';
import { debounce, delay, log, sanitizeHTML } from './utils.js';
import { TempleData } from './data.js';
import { UI } from './ui.js';

// Temple Search Module
export const TempleSearch = {
  inputEl: null,
  suggestionsEl: null,
  currentFilter: 'all',

  init(inputId, suggestionsId) {
    this.inputEl = document.getElementById(inputId);
    this.suggestionsEl = document.getElementById(suggestionsId);

    if (!this.inputEl || !this.suggestionsEl) {
      throw new Error('Temple search elements not found');
    }

    this.inputEl.addEventListener('input', debounce(() => {
      this.handleInput();
    }, CONFIG.SEARCH_DEBOUNCE_MS));

    // Click outside to close
    document.addEventListener('click', (e) => {
      if (!this.inputEl.contains(e.target) && !this.suggestionsEl.contains(e.target)) {
        this.hideSuggestions();
      }
    });

    log('Temple search initialized');
  },

  handleInput() {
    const query = this.inputEl.value.trim();
    log('Temple search query:', query);

    if (query.length < CONFIG.SEARCH_MIN_CHARS) {
      this.hideSuggestions();
      return;
    }

    this.search(query);
  },

  search(query) {
    if (!TempleData.loaded) {
      this.showError('Temple data not loaded');
      return;
    }

    let results = TempleData.search(query);

    // Apply filter
    if (this.currentFilter !== 'all') {
      results = results.filter(t =>
        t.region && t.region.toLowerCase().includes(this.currentFilter.toLowerCase())
      );
    }

    results = results.slice(0, CONFIG.SEARCH_MAX_RESULTS);
    log(`Found ${results.length} temples`);

    this.displayResults(results);
  },

  displayResults(temples) {
    if (temples.length === 0) {
      this.suggestionsEl.innerHTML = '<div class="search-item">No temples found</div>';
      this.showSuggestions();
      return;
    }

    this.suggestionsEl.innerHTML = temples.map(temple => `
      <div class="search-item" data-temple-id="${sanitizeHTML(temple.name)}">
        <div class="search-item-name">${sanitizeHTML(temple.displayName)}</div>
        <div class="search-item-details">
          ${temple.perumal ? sanitizeHTML(temple.perumal) : ''} •
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

  selectTemple(templeId) {
    const temple = TempleData.getById(templeId);
    if (temple) {
      this.inputEl.value = temple.displayName;
      this.hideSuggestions();
      document.dispatchEvent(new CustomEvent('temple-selected', { detail: { temple } }));
    }
  },

  setFilter(filter) {
    this.currentFilter = filter;
    if (this.inputEl.value.trim().length >= CONFIG.SEARCH_MIN_CHARS) {
      this.handleInput();
    }
  },

  showSuggestions() {
    this.suggestionsEl.classList.add('active');
  },

  hideSuggestions() {
    this.suggestionsEl.classList.remove('active');
  },

  showError(message) {
    this.suggestionsEl.innerHTML = `<div class="search-item error">${sanitizeHTML(message)}</div>`;
    this.showSuggestions();
  }
};

// Location Search Module
export const LocationSearch = {
  inputEl: null,
  suggestionsEl: null,

  init(inputId, suggestionsId) {
    this.inputEl = document.getElementById(inputId);
    this.suggestionsEl = document.getElementById(suggestionsId);

    if (!this.inputEl || !this.suggestionsEl) {
      throw new Error('Location search elements not found');
    }

    this.inputEl.addEventListener('input', debounce(() => {
      this.handleInput();
    }, CONFIG.SEARCH_DEBOUNCE_MS * 2)); // Longer delay for API calls

    // Click outside to close
    document.addEventListener('click', (e) => {
      if (!this.inputEl.contains(e.target) && !this.suggestionsEl.contains(e.target)) {
        this.hideSuggestions();
      }
    });

    log('Location search initialized');
  },

  async handleInput() {
    const query = this.inputEl.value.trim();
    log('Location search query:', query);

    if (query.length < CONFIG.SEARCH_MIN_CHARS) {
      this.hideSuggestions();
      return;
    }

    await this.search(query);
  },

  async search(query) {
    try {
      // Try Nominatim first
      const results = await this.searchNominatim(query);

      if (results.length > 0) {
        this.displayResults(results);
        return;
      }

      // Fallback to cities
      this.searchFallbackCities(query);
    } catch (error) {
      logError('Location search error:', error);
      this.searchFallbackCities(query);
    }
  },

  async searchNominatim(query) {
    await delay(CONFIG.NOMINATIM_DELAY_MS); // Rate limiting

    const url = `${CONFIG.NOMINATIM_URL}/search?` +
                `format=json&q=${encodeURIComponent(query + ', India')}&` +
                `limit=${CONFIG.SEARCH_MAX_RESULTS}&countrycodes=in`;

    const response = await fetch(url, {
      headers: { 'User-Agent': CONFIG.USER_AGENT }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.map(item => ({
      name: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      type: 'nominatim'
    }));
  },

  searchFallbackCities(query) {
    const term = query.toLowerCase();
    const results = FALLBACK_CITIES
      .filter(city => city.name.toLowerCase().includes(term))
      .slice(0, CONFIG.SEARCH_MAX_RESULTS)
      .map(city => ({
        name: `${city.name}, ${city.state}`,
        lat: city.lat,
        lng: city.lng,
        type: 'city'
      }));

    this.displayResults(results);
  },

  displayResults(locations) {
    if (locations.length === 0) {
      this.suggestionsEl.innerHTML = '<div class="search-item">No locations found</div>';
      this.showSuggestions();
      return;
    }

    this.suggestionsEl.innerHTML = locations.map(loc => `
      <div class="search-item" data-lat="${loc.lat}" data-lng="${loc.lng}">
        <div class="search-item-name">${sanitizeHTML(loc.name)}</div>
        <div class="search-item-details">${loc.type === 'nominatim' ? 'Map Data' : 'City'}</div>
      </div>
    `).join('');

    // Add click handlers
    this.suggestionsEl.querySelectorAll('.search-item').forEach(item => {
      item.addEventListener('click', () => {
        const lat = parseFloat(item.dataset.lat);
        const lng = parseFloat(item.dataset.lng);
        this.selectLocation(lat, lng, item.querySelector('.search-item-name').textContent);
      });
    });

    this.showSuggestions();
  },

  selectLocation(lat, lng, name) {
    this.inputEl.value = name;
    this.inputEl.dataset.lat = lat;
    this.inputEl.dataset.lng = lng;
    this.hideSuggestions();
    document.dispatchEvent(new CustomEvent('location-selected', {
      detail: { lat, lng, name }
    }));
  },

  showSuggestions() {
    this.suggestionsEl.classList.add('active');
  },

  hideSuggestions() {
    this.suggestionsEl.classList.remove('active');
  }
};
```

**Size**: ~200 lines

---

### 5. `geolocation.js` - GPS & Location Services

**Purpose**: Handle geolocation and find nearest temples
**Exports**: `Geolocation`
**Dependencies**: `config.js`, `utils.js`, `data.js`, `ui.js`

```javascript
// geolocation.js
import { CONFIG } from './config.js';
import { calculateDistance, log, logError, isValidCoordinates } from './utils.js';
import { TempleData } from './data.js';
import { UI } from './ui.js';

export const Geolocation = {
  async getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      UI.showLoading('Getting your location...');

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          log('GPS coordinates:', latitude, longitude);

          if (!isValidCoordinates(latitude, longitude)) {
            reject(new Error('Invalid GPS coordinates'));
            return;
          }

          resolve({ lat: latitude, lng: longitude });
        },
        (error) => {
          let message = 'Unable to get your location';
          if (error.code === error.PERMISSION_DENIED) {
            message = 'Location access denied. Please enable location services.';
          }
          reject(new Error(message));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      );
    });
  },

  async findNearest() {
    try {
      UI.showLoading('Finding nearest temples...');

      const position = await this.getCurrentPosition();
      const nearest = this.calculateNearestTemples(position.lat, position.lng);

      UI.hideLoading();
      document.dispatchEvent(new CustomEvent('nearest-temples-found', {
        detail: { position, temples: nearest }
      }));

      return nearest;
    } catch (error) {
      logError('Geolocation error:', error);
      UI.hideLoading();
      UI.showError(error.message);
      throw error;
    }
  },

  calculateNearestTemples(lat, lng) {
    if (!TempleData.loaded) {
      throw new Error('Temple data not loaded');
    }

    const temples = TempleData.getAll().map(temple => ({
      ...temple,
      distance: calculateDistance(lat, lng, temple.lat, temple.lng)
    }));

    // Filter by max distance and sort
    return temples
      .filter(t => t.distance <= CONFIG.MAX_AIR_DISTANCE_KM)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, CONFIG.MAX_NEAREST_TEMPLES);
  }
};
```

**Size**: ~120 lines

---

### 6. `ui.js` - DOM Manipulation & Display

**Purpose**: All UI updates and DOM manipulation
**Exports**: `UI`
**Dependencies**: `utils.js`, `data.js`

```javascript
// ui.js
import { sanitizeHTML, formatDistance, formatDuration } from './utils.js';
import { TempleData } from './data.js';

export const UI = {
  elements: {
    loading: null,
    error: null,
    results: null
  },

  init() {
    this.elements.loading = document.getElementById('loading');
    this.elements.error = document.getElementById('error');
    this.elements.results = document.getElementById('results');
  },

  showLoading(message = 'Loading...') {
    if (this.elements.loading) {
      this.elements.loading.textContent = message;
      this.elements.loading.style.display = 'block';
    }
  },

  hideLoading() {
    if (this.elements.loading) {
      this.elements.loading.style.display = 'none';
    }
  },

  showError(message) {
    if (this.elements.error) {
      this.elements.error.textContent = message;
      this.elements.error.style.display = 'block';
    }
  },

  hideError() {
    if (this.elements.error) {
      this.elements.error.style.display = 'none';
    }
  },

  displayTemples(temples) {
    if (!this.elements.results) return;

    if (temples.length === 0) {
      this.elements.results.innerHTML = '<p>No temples found</p>';
      return;
    }

    this.elements.results.innerHTML = temples.map(temple =>
      this.createTempleCard(temple)
    ).join('');
  },

  createTempleCard(temple) {
    const timings = TempleData.getTimings(temple.name);
    const distanceText = temple.distance ? formatDistance(temple.distance) : '';

    return `
      <div class="temple-card" data-temple-id="${sanitizeHTML(temple.name)}">
        <div class="temple-header">
          <h3>${sanitizeHTML(temple.displayName)}</h3>
          ${distanceText ? `<span class="distance">${distanceText}</span>` : ''}
        </div>
        <div class="temple-details">
          <p><strong>Deity:</strong> ${sanitizeHTML(temple.perumal || 'Unknown')}</p>
          ${temple.thaayaar ? `<p><strong>Consort:</strong> ${sanitizeHTML(temple.thaayaar)}</p>` : ''}
          <p><strong>Location:</strong> ${sanitizeHTML(temple.locality || '')}, ${sanitizeHTML(temple.district || '')}</p>
          <div class="temple-timings">
            <strong>Timings:</strong>
            ${timings.hours.map(h => `<div>${sanitizeHTML(h)}</div>`).join('')}
          </div>
          ${timings.phone ? `<p><strong>Phone:</strong> ${sanitizeHTML(timings.phone)}</p>` : ''}
        </div>
        <div class="temple-actions">
          <button onclick="window.open('${temple.link}', '_blank')" class="btn-navigate">
            📍 Navigate
          </button>
        </div>
      </div>
    `;
  }
};
```

**Size**: ~150 lines

---

### 7. `map.js` - Leaflet Map Integration

**Purpose**: Interactive map with temple markers
**Exports**: `MapView`
**Dependencies**: `config.js`, `utils.js`, Leaflet.js (external)

```javascript
// map.js
import { CONFIG } from './config.js';
import { log, logError } from './utils.js';

export const MapView = {
  map: null,
  markers: [],
  userMarker: null,

  init(elementId) {
    try {
      this.map = L.map(elementId).setView([11.0, 78.7], CONFIG.MAP_DEFAULT_ZOOM);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: CONFIG.MAP_MAX_ZOOM
      }).addTo(this.map);

      log('Map initialized');
      return true;
    } catch (error) {
      logError('Map initialization failed:', error);
      return false;
    }
  },

  addTempleMarkers(temples) {
    this.clearMarkers();

    temples.forEach(temple => {
      const marker = L.marker([temple.lat, temple.lng])
        .addTo(this.map)
        .bindPopup(`<b>${temple.displayName}</b><br>${temple.perumal || ''}`);

      marker.on('click', () => {
        document.dispatchEvent(new CustomEvent('temple-marker-clicked', {
          detail: { temple }
        }));
      });

      this.markers.push(marker);
    });

    if (temples.length > 0) {
      const bounds = L.latLngBounds(temples.map(t => [t.lat, t.lng]));
      this.map.fitBounds(bounds);
    }
  },

  setUserLocation(lat, lng) {
    if (this.userMarker) {
      this.map.removeLayer(this.userMarker);
    }

    this.userMarker = L.marker([lat, lng], {
      icon: L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41]
      })
    }).addTo(this.map).bindPopup('Your Location');

    this.map.setView([lat, lng], CONFIG.MAP_DEFAULT_ZOOM);
  },

  clearMarkers() {
    this.markers.forEach(marker => this.map.removeLayer(marker));
    this.markers = [];
  }
};
```

**Size**: ~150 lines

---

### 8. `routing.js` - OSRM Route Planning

**Purpose**: Calculate routes using OSRM API
**Exports**: `Routing`
**Dependencies**: `config.js`, `utils.js`

```javascript
// routing.js
import { CONFIG } from './config.js';
import { delay, log, logError, calculateDistance } from './utils.js';

export const Routing = {
  async getRoute(startLat, startLng, endLat, endLng) {
    try {
      await delay(500); // Rate limiting

      const url = `${CONFIG.OSRM_URL}/route/v1/driving/` +
                  `${startLng},${startLat};${endLng},${endLat}?` +
                  `overview=false&steps=false`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT_MS);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        return {
          distance: Math.round(route.distance / 1000), // km
          duration: Math.round(route.duration / 60),   // minutes
          source: 'osrm'
        };
      }

      throw new Error('No route found');
    } catch (error) {
      logError('OSRM routing error:', error);

      // Fallback to straight-line distance
      const distance = calculateDistance(startLat, startLng, endLat, endLng);
      return {
        distance: Math.round(distance * 1.3), // Add 30% for road distance
        duration: Math.round(distance * 1.5), // Rough estimate
        source: 'estimated'
      };
    }
  },

  async planMultiTempleRoute(startLat, startLng, temples, detourKm) {
    // Calculate routes to each temple
    const routes = await Promise.all(
      temples.map(async temple => {
        const route = await this.getRoute(startLat, startLng, temple.lat, temple.lng);
        return { ...temple, ...route };
      })
    );

    // Filter by detour range
    return routes.filter(r => r.distance <= detourKm);
  }
};
```

**Size**: ~180 lines

---

### 9. `app.js` - Application Initialization

**Purpose**: Initialize and orchestrate all modules
**Exports**: None (entry point)
**Dependencies**: All other modules

```javascript
// app.js
import { log, logError } from './utils.js';
import { TempleData } from './data.js';
import { TempleSearch, LocationSearch } from './search.js';
import { Geolocation } from './geolocation.js';
import { MapView } from './map.js';
import { UI } from './ui.js';

class DivyaDesamApp {
  async init() {
    try {
      log('Initializing Divya Desam Locator v4.0.0');

      // Initialize UI
      UI.init();
      UI.showLoading('Loading temple data...');

      // Load data
      const dataLoaded = await TempleData.init();
      if (!dataLoaded) {
        throw new Error('Failed to load temple data');
      }

      // Initialize map
      MapView.init('map');

      // Initialize search
      TempleSearch.init('templeSearch', 'templeSuggestions');
      LocationSearch.init('locationSearch', 'locationSuggestions');

      // Set up event listeners
      this.setupEventListeners();

      UI.hideLoading();
      log('App initialized successfully');
    } catch (error) {
      logError('App initialization failed:', error);
      UI.showError('Failed to initialize app. Please refresh the page.');
    }
  }

  setupEventListeners() {
    // Temple selected
    document.addEventListener('temple-selected', (e) => {
      const { temple } = e.detail;
      MapView.addTempleMarkers([temple]);
      UI.displayTemples([temple]);
    });

    // Location selected
    document.addEventListener('location-selected', (e) => {
      const { lat, lng } = e.detail;
      MapView.setUserLocation(lat, lng);
      const nearest = Geolocation.calculateNearestTemples(lat, lng);
      UI.displayTemples(nearest);
      MapView.addTempleMarkers(nearest);
    });

    // Nearest temples found
    document.addEventListener('nearest-temples-found', (e) => {
      const { position, temples } = e.detail;
      MapView.setUserLocation(position.lat, position.lng);
      MapView.addTempleMarkers(temples);
      UI.displayTemples(temples);
    });

    // Find my location button
    window.findMyLocation = () => {
      Geolocation.findNearest();
    };

    // Temple filter buttons
    window.setTempleFilter = (filter) => {
      TempleSearch.setFilter(filter);
    };
  }
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new DivyaDesamApp().init();
  });
} else {
  new DivyaDesamApp().init();
}
```

**Size**: ~100 lines

---

## HTML Structure

### New `index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Divya Desam Temple Locator</title>

    <!-- CSS -->
    <link rel="stylesheet" href="css/variables.css">
    <link rel="stylesheet" href="css/base.css">
    <link rel="stylesheet" href="css/components.css">
    <link rel="stylesheet" href="css/responsive.css">

    <!-- Leaflet CSS -->
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
</head>
<body>
    <div class="container">
        <header>
            <h1>🕉️ Divya Desam Temple Locator</h1>
        </header>

        <main>
            <!-- Geolocation Section -->
            <section class="location-section">
                <button onclick="findMyLocation()" class="btn-primary">
                    📍 Find My Location
                </button>
            </section>

            <!-- Temple Search -->
            <section class="search-section">
                <h2>Search Temples</h2>
                <div class="search-container">
                    <input type="text" id="templeSearch" placeholder="Search by temple or deity name...">
                    <div id="templeSuggestions" class="search-suggestions"></div>
                </div>
                <div class="filter-buttons">
                    <button onclick="setTempleFilter('all')" class="filter-btn active">All</button>
                    <button onclick="setTempleFilter('divya-desam')" class="filter-btn">Divya Desam</button>
                    <button onclick="setTempleFilter('paadal-petra')" class="filter-btn">Paadal Petra</button>
                </div>
            </section>

            <!-- Location Search -->
            <section class="search-section">
                <h2>Search by Location</h2>
                <div class="search-container">
                    <input type="text" id="locationSearch" placeholder="Enter city or location...">
                    <div id="locationSuggestions" class="search-suggestions"></div>
                </div>
            </section>

            <!-- Map -->
            <section class="map-section">
                <div id="map"></div>
            </section>

            <!-- Results -->
            <section class="results-section">
                <div id="loading" class="loading" style="display: none;">Loading...</div>
                <div id="error" class="error" style="display: none;"></div>
                <div id="results" class="results"></div>
            </section>
        </main>

        <footer>
            <p>v4.0.0 - Created in memory of Kokila & RP Sarathy</p>
        </footer>
    </div>

    <!-- External Libraries -->
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

    <!-- Temple Data (external file) -->
    <script src="data/temples.js"></script>

    <!-- App Modules (ES6) -->
    <script type="module" src="js/app.js"></script>
</body>
</html>
```

**Size**: ~150 lines

---

## CSS Structure

### `css/variables.css`
```css
:root {
  /* Colors */
  --color-primary: #667eea;
  --color-secondary: #764ba2;
  --color-accent: #f093fb;
  --color-text: #333;
  --color-text-light: #666;
  --color-bg: #ffffff;
  --color-bg-light: #f9f9f9;
  --color-border: #ddd;
  --color-success: #4caf50;
  --color-error: #f44336;

  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;

  /* Border Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;

  /* Shadows */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.12);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.1);
  --shadow-lg: 0 10px 20px rgba(0,0,0,0.15);

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-normal: 300ms ease;
}
```

---

## Implementation Plan

### Phase 1: Setup (1 hour)
- [x] Create CODEBASE_ANALYSIS.md
- [ ] Create new folder structure
- [ ] Move temple-data.js to data/temples.js
- [ ] Move temple-timings.json to data/timings.json

### Phase 2: Core Modules (3 hours)
- [ ] Write config.js
- [ ] Write utils.js
- [ ] Write data.js
- [ ] Test data loading

### Phase 3: Search & Location (2 hours)
- [ ] Write search.js
- [ ] Write geolocation.js
- [ ] Test search functionality
- [ ] Test geolocation

### Phase 4: UI & Map (2 hours)
- [ ] Write ui.js
- [ ] Write map.js
- [ ] Write CSS files
- [ ] Test UI interactions

### Phase 5: Routing & Integration (1 hour)
- [ ] Write routing.js
- [ ] Write app.js
- [ ] Test complete flow

### Phase 6: Testing & Deployment (1 hour)
- [ ] Browser testing
- [ ] Mobile testing
- [ ] Deploy to GitHub Pages
- [ ] Verify live site

---

## Success Criteria

### Must Have ✅
- [x] Temple search works (type → see results → select)
- [ ] Location search works (type → see results → select)
- [ ] Geolocation works (click button → get location → show nearest temples)
- [ ] Map displays with markers
- [ ] Responsive on mobile
- [ ] Works on GitHub Pages

### Should Have 🎯
- [ ] Route planning between locations
- [ ] Temple filter buttons work
- [ ] Temple timings display
- [ ] Error messages are clear
- [ ] Loading states are smooth

### Nice to Have ⭐
- [ ] Offline support (service worker)
- [ ] Virtual scrolling for large lists
- [ ] Multi-temple route optimization
- [ ] Share temple links

---

## Rollout Strategy

### Option 1: Direct Replacement (Risky)
1. Push new code to `main` branch
2. Old site immediately replaced
3. Risk: If bugs, site is broken

### Option 2: Side-by-Side (Recommended)
1. Create `v4` branch
2. Deploy to `v4.divyadesam.communityforge.info`
3. Test thoroughly
4. When ready, merge to `main`

### Option 3: Feature Flag (Safest)
1. Add query parameter: `?version=v4`
2. Users can test new version
3. Gather feedback
4. Make v4 default when ready

**Recommendation**: **Option 2** - Side-by-side testing

---

**Ready to proceed with implementation?**
