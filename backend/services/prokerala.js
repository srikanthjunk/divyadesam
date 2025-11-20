/**
 * Prokerala API Service
 * Handles all Prokerala API calls with rate limiting
 * Rate limit: 5 requests/minute, 5000 credits/month
 */

const axios = require('axios');

class ProkerolaService {
  constructor(clientId, clientSecret) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.baseUrl = 'https://api.prokerala.com/v2';
    this.accessToken = null;
    this.tokenExpiry = null;

    // Rate limiting: Max 5 requests per minute
    this.requestQueue = [];
    this.lastRequestTime = 0;
    this.minRequestInterval = 12000; // 12 seconds between requests (5 per minute)
  }

  /**
   * Get OAuth access token
   */
  async getAccessToken() {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      // Prokerala requires form-encoded data, not JSON
      const params = new URLSearchParams();
      params.append('grant_type', 'client_credentials');
      params.append('client_id', this.clientId);
      params.append('client_secret', this.clientSecret);

      const response = await axios.post(`${this.baseUrl}/token`, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);

      console.log('✅ Prokerala access token obtained');
      return this.accessToken;
    } catch (error) {
      console.error('❌ Failed to get Prokerala token:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with Prokerala API');
    }
  }

  /**
   * Rate-limited API call
   */
  async rateLimitedRequest(url, params) {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      console.log(`⏳ Rate limiting: waiting ${waitTime}ms before next request`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();

    const token = await this.getAccessToken();
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      params
    });

    return response.data;
  }

  /**
   * Calculate birth chart (Kundli)
   * Returns: nakshatra, rashi, lagna, and other birth details
   */
  async getBirthChart(dateOfBirth, timeOfBirth, latitude, longitude) {
    const url = `${this.baseUrl}/astrology/kundli`;

    const params = {
      ayanamsa: 1, // Lahiri ayanamsa (most common for Indian astrology)
      datetime: `${dateOfBirth}T${timeOfBirth}`,
      coordinates: `${latitude},${longitude}`,
      la: 'en' // Language: English
    };

    try {
      const data = await this.rateLimitedRequest(url, params);

      return {
        nakshatra: data.nakshatra?.name,
        nakshatra_pada: data.nakshatra?.pada,
        nakshatra_lord: data.nakshatra?.lord,
        rashi: data.rasi?.name,
        rashi_lord: data.rasi?.lord,
        lagna: data.lagna?.name,
        lagna_lord: data.lagna?.lord,
        moon_sign: data.moon_sign,
        sun_sign: data.sun_sign,
        raw_data: data
      };
    } catch (error) {
      console.error('❌ Prokerala birth chart error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get current planetary positions (Panchang)
   */
  async getCurrentPanchang(latitude, longitude) {
    const url = `${this.baseUrl}/astrology/panchang`;

    const now = new Date();
    const datetime = now.toISOString().split('.')[0]; // Remove milliseconds

    const params = {
      ayanamsa: 1,
      datetime,
      coordinates: `${latitude},${longitude}`,
      la: 'en'
    };

    try {
      const data = await this.rateLimitedRequest(url, params);
      return data;
    } catch (error) {
      console.error('❌ Prokerala panchang error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get planetary positions (for peyarchi calculation)
   */
  async getPlanetaryPositions(datetime, latitude, longitude) {
    const url = `${this.baseUrl}/astrology/planet-position`;

    const params = {
      datetime,
      coordinates: `${latitude},${longitude}`,
      la: 'en'
    };

    try {
      const data = await this.rateLimitedRequest(url, params);
      return data;
    } catch (error) {
      console.error('❌ Prokerala planetary positions error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Calculate peyarchi (transit) effects for a person
   */
  async getPeyarchiEffects(birthRashi, birthNakshatra, currentDate = new Date()) {
    // This is a simplified version - you may need to adjust based on Prokerala's actual API
    const url = `${this.baseUrl}/astrology/transit-prediction`;

    const params = {
      birth_rasi: birthRashi,
      birth_nakshatra: birthNakshatra,
      date: currentDate.toISOString().split('T')[0],
      la: 'en'
    };

    try {
      const data = await this.rateLimitedRequest(url, params);
      return this.parsePeyarchiData(data);
    } catch (error) {
      console.error('❌ Prokerala peyarchi error:', error.response?.data || error.message);
      // If specific API doesn't exist, we'll calculate manually
      return this.calculatePeyarchiManually(birthRashi);
    }
  }

  /**
   * Manual peyarchi calculation based on current planetary positions
   * (Fallback if Prokerala doesn't have direct peyarchi API)
   */
  calculatePeyarchiManually(birthRashi) {
    // Current peyarchi positions (as of 2024 - update periodically)
    const currentTransits = {
      Sani: {
        rashi: 'Aquarius', // Kumbha
        start: '2023-01-17',
        end: '2025-03-29',
        description: 'Saturn in Aquarius'
      },
      Guru: {
        rashi: 'Taurus', // Vrishabha
        start: '2024-05-01',
        end: '2025-05-14',
        description: 'Jupiter in Taurus'
      },
      Rahu: {
        rashi: 'Pisces', // Meena
        start: '2023-10-30',
        end: '2025-05-18',
        description: 'Rahu in Pisces'
      },
      Ketu: {
        rashi: 'Virgo', // Kanya
        start: '2023-10-30',
        end: '2025-05-18',
        description: 'Ketu in Virgo'
      }
    };

    // Calculate effects based on house positions from birth rashi
    const rashiOrder = [
      'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
      'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
    ];

    const effects = {};

    for (const [planet, transit] of Object.entries(currentTransits)) {
      const birthRashiIndex = rashiOrder.indexOf(birthRashi);
      const transitRashiIndex = rashiOrder.indexOf(transit.rashi);
      const housePosition = ((transitRashiIndex - birthRashiIndex + 12) % 12) + 1;

      effects[planet] = {
        ...transit,
        house_from_moon: housePosition,
        effect: this.getEffectByHouse(planet, housePosition),
        effect_score: this.getEffectScore(planet, housePosition)
      };
    }

    return effects;
  }

  /**
   * Get effect description based on planet and house position
   */
  getEffectByHouse(planet, house) {
    const effectMap = {
      Sani: {
        1: { effect: 'unfavorable', desc: 'Sade Sati - Phase 3' },
        2: { effect: 'unfavorable', desc: 'Sade Sati - Financial challenges' },
        4: { effect: 'critical', desc: 'Ardhaashtama Shani - Property/vehicle issues' },
        8: { effect: 'critical', desc: 'Ashtama Shani - Health and obstacles' },
        12: { effect: 'unfavorable', desc: 'Sade Sati - Phase 1' },
        3: { effect: 'favorable', desc: 'Good for courage and siblings' },
        6: { effect: 'favorable', desc: 'Victory over enemies' },
        11: { effect: 'favorable', desc: 'Good gains and income' }
      },
      Guru: {
        1: { effect: 'favorable', desc: 'Personal growth and wisdom' },
        2: { effect: 'favorable', desc: 'Wealth and family happiness' },
        5: { effect: 'favorable', desc: 'Children and education' },
        7: { effect: 'favorable', desc: 'Partnership and marriage' },
        9: { effect: 'favorable', desc: 'Fortune and spirituality' },
        11: { effect: 'favorable', desc: 'Fulfillment of desires' },
        6: { effect: 'unfavorable', desc: 'Guru chandala yoga' },
        8: { effect: 'unfavorable', desc: 'Obstacles in fortune' }
      }
    };

    const map = effectMap[planet];
    if (map && map[house]) {
      return map[house];
    }

    return { effect: 'neutral', desc: `${planet} in house ${house}` };
  }

  /**
   * Get numeric effect score (-3 to +3)
   */
  getEffectScore(planet, house) {
    const scoreMap = {
      Sani: { 1: -2, 2: -2, 4: -3, 8: -3, 12: -2, 3: 2, 6: 2, 11: 2 },
      Guru: { 1: 2, 2: 2, 5: 3, 7: 2, 9: 3, 11: 2, 6: -2, 8: -2 }
    };

    return scoreMap[planet]?.[house] || 0;
  }

  /**
   * Parse peyarchi data from Prokerala response
   */
  parsePeyarchiData(data) {
    // Adjust based on actual Prokerala API response structure
    return {
      current_transits: data.transits || {},
      predictions: data.predictions || [],
      remedies: data.remedies || []
    };
  }
}

module.exports = ProkerolaService;
