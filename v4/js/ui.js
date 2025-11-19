// ui.js - DOM Manipulation & Display
// Divya Desam Temple Locator v4.0.0

import { sanitizeHTML, formatDistance, formatDuration, escapeHtmlAttribute } from './utils.js';
import { TempleData } from './data.js';

/**
 * UI Module
 * Handles all UI updates and DOM manipulation
 */
export const UI = {
  elements: {
    loading: null,
    error: null,
    results: null
  },

  /**
   * Initialize UI elements
   */
  init() {
    this.elements.loading = document.getElementById('loading');
    this.elements.error = document.getElementById('error');
    this.elements.results = document.getElementById('results');

    if (!this.elements.loading || !this.elements.error || !this.elements.results) {
      console.warn('Some UI elements not found (may not be critical)');
    }
  },

  /**
   * Show loading message
   * @param {string} message - Loading message
   */
  showLoading(message = 'Loading...') {
    if (this.elements.loading) {
      this.elements.loading.textContent = message;
      this.elements.loading.style.display = 'block';
    }
  },

  /**
   * Hide loading message
   */
  hideLoading() {
    if (this.elements.loading) {
      this.elements.loading.style.display = 'none';
    }
  },

  /**
   * Show error message
   * @param {string} message - Error message
   */
  showError(message) {
    if (this.elements.error) {
      this.elements.error.textContent = message;
      this.elements.error.style.display = 'block';
    }
  },

  /**
   * Hide error message
   */
  hideError() {
    if (this.elements.error) {
      this.elements.error.style.display = 'none';
    }
  },

  /**
   * Display list of temples
   * @param {Array} temples - Array of temple objects
   */
  displayTemples(temples) {
    if (!this.elements.results) return;

    this.hideError();

    if (temples.length === 0) {
      this.elements.results.innerHTML = '<div class="no-results">No temples found nearby</div>';
      return;
    }

    this.elements.results.innerHTML = temples.map(temple =>
      this.createTempleCard(temple)
    ).join('');
  },

  /**
   * Create temple card HTML
   * @param {Object} temple - Temple object
   * @returns {string} - HTML string
   */
  createTempleCard(temple) {
    const timings = TempleData.getTimings(temple.name);
    const distanceText = temple.distance ? formatDistance(temple.distance) : '';
    const durationText = temple.duration ? formatDuration(temple.duration) : '';

    return `
      <div class="temple-card" data-temple-id="${escapeHtmlAttribute(temple.name)}">
        <div class="temple-header">
          <h3 class="temple-name">${sanitizeHTML(temple.displayName)}</h3>
          ${distanceText ? `<span class="temple-distance">${distanceText}</span>` : ''}
        </div>

        <div class="temple-details">
          <div class="temple-deity">
            <strong>🕉️ Deity:</strong> ${sanitizeHTML(temple.perumal || 'Unknown')}
          </div>

          ${temple.thaayaar ? `
            <div class="temple-consort">
              <strong>Consort:</strong> ${sanitizeHTML(temple.thaayaar)}
            </div>
          ` : ''}

          <div class="temple-location">
            <strong>📍 Location:</strong>
            ${[temple.locality, temple.district, temple.state].filter(Boolean).map(sanitizeHTML).join(', ')}
          </div>

          ${temple.region ? `
            <div class="temple-tradition">
              <strong>Tradition:</strong> ${sanitizeHTML(temple.region)}
            </div>
          ` : ''}

          ${durationText ? `
            <div class="temple-travel-time">
              <strong>⏱️ Travel Time:</strong> ${durationText} (approx)
            </div>
          ` : ''}

          <div class="temple-timings">
            <strong>⏰ Timings:</strong>
            ${timings.hours.length > 0 ?
        timings.hours.map(h => `<div>${sanitizeHTML(h)}</div>`).join('') :
        '<div>Not available</div>'
      }
          </div>

          ${timings.phone ? `
            <div class="temple-phone">
              <strong>📞 Phone:</strong> <a href="tel:${escapeHtmlAttribute(timings.phone)}">${sanitizeHTML(timings.phone)}</a>
            </div>
          ` : ''}

          ${timings.note ? `
            <div class="temple-note">
              <em>${sanitizeHTML(timings.note)}</em>
            </div>
          ` : ''}
        </div>

        <div class="temple-actions">
          <a href="${escapeHtmlAttribute(temple.link)}"
             target="_blank"
             rel="noopener noreferrer"
             class="btn-navigate">
            📍 Navigate with Google Maps
          </a>
        </div>
      </div>
    `;
  },

  /**
   * Display single temple (e.g., from search selection)
   * @param {Object} temple - Temple object
   */
  displaySingleTemple(temple) {
    this.displayTemples([temple]);
  },

  /**
   * Clear results
   */
  clearResults() {
    if (this.elements.results) {
      this.elements.results.innerHTML = '';
    }
  },

  /**
   * Update filter button states
   * @param {string} activeFilter - Active filter name
   */
  updateFilterButtons(activeFilter) {
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.remove('active');
    });

    const activeBtn = document.querySelector(`[data-filter="${activeFilter}"]`);
    if (activeBtn) {
      activeBtn.classList.add('active');
    }
  }
};
