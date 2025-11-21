/**
 * Prokerala API Service using Direct HTTP Calls
 * Handles all Prokerala API calls with rate limiting
 * Rate limit: 5 requests/minute, 5000 credits/month
 */

const axios = require('axios');

class ProkerolaService {
  constructor(clientId, clientSecret) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.accessToken = null;
    this.tokenExpiry = null;

    // Rate limiting: Max 5 requests per minute
    this.lastRequestTime = 0;
    this.minRequestInterval = 12000; // 12 seconds between requests (5 per minute)
  }

  /**
   * Get OAuth2 access token from Prokerala
   */
  async getAccessToken() {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      console.log('🔑 Getting Prokerala access token...');

      // Use URLSearchParams for form-encoded data
      const params = new URLSearchParams();
      params.append('grant_type', 'client_credentials');
      params.append('client_id', this.clientId);
      params.append('client_secret', this.clientSecret);

      const response = await axios.post('https://api.prokerala.com/token', params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      });

      this.accessToken = response.data.access_token;
      // Set expiry 5 minutes before actual expiry for safety
      this.tokenExpiry = Date.now() + ((response.data.expires_in - 300) * 1000);

      console.log('✅ Prokerala access token obtained');
      return this.accessToken;
    } catch (error) {
      console.error('❌ Prokerala token error:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with Prokerala API');
    }
  }

  /**
   * Rate-limited API call wrapper
   */
  async rateLimitedRequest(apiCall) {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      console.log(`⏳ Rate limiting: waiting ${waitTime}ms before next request`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
    return await apiCall();
  }

  /**
   * Calculate birth chart (Kundli) using Prokerala API
   * Returns: nakshatra, rashi, lagna, and other birth details
   */
  async getBirthChart(dateOfBirth, timeOfBirth, latitude, longitude) {
    try {
      console.log(`📊 Fetching birth chart from Prokerala...`);

      const result = await this.rateLimitedRequest(async () => {
        const token = await this.getAccessToken();

        // Format datetime for API (ISO 8601 with timezone)
        const datetime = `${dateOfBirth}T${timeOfBirth}:00+05:30`; // IST timezone

        const response = await axios.get('https://api.prokerala.com/v2/astrology/kundli', {
          params: {
            ayanamsa: 1, // Lahiri
            coordinates: `${latitude},${longitude}`,
            datetime: datetime
          },
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });

        return response.data;
      });

      console.log('✅ Birth chart received from Prokerala');

      // Extract relevant data from API response
      // Structure: result.data.nakshatra_details contains all birth chart info
      const apiData = result.data || result;
      const details = apiData.nakshatra_details || {};

      return {
        nakshatra: details.nakshatra?.name || 'Unknown',
        nakshatra_pada: details.nakshatra?.pada || null,
        nakshatra_lord: details.nakshatra?.lord?.vedic_name || details.nakshatra?.lord?.name || null,
        rashi: details.chandra_rasi?.name || 'Unknown',
        rashi_lord: details.chandra_rasi?.lord?.vedic_name || details.chandra_rasi?.lord?.name || null,
        lagna: details.chandra_rasi?.name || 'Unknown', // Using moon sign as primary
        lagna_lord: details.chandra_rasi?.lord?.vedic_name || null,
        moon_sign: details.chandra_rasi?.name || null,
        sun_sign: details.soorya_rasi?.name || null,
        zodiac: details.zodiac?.name || null,
        raw_data: apiData
      };
    } catch (error) {
      console.error('❌ Prokerala birth chart error:', error.response?.data || error.message);

      // Use fallback calculation if API fails
      console.log('⚠️ Using fallback birth chart calculation...');
      return this.calculateBirthChartFallback(dateOfBirth);
    }
  }

  /**
   * Fallback birth chart calculation when API fails
   * Uses basic astronomical calculations
   */
  calculateBirthChartFallback(dateOfBirth) {
    const date = new Date(dateOfBirth);
    const month = date.getMonth();
    const day = date.getDate();

    // Simple sun sign calculation
    const sunSigns = [
      'Capricorn', 'Aquarius', 'Pisces', 'Aries', 'Taurus', 'Gemini',
      'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius'
    ];

    const signDates = [20, 19, 21, 20, 21, 21, 23, 23, 23, 23, 22, 22];
    let sunSignIndex = month;
    if (day < signDates[month]) {
      sunSignIndex = (month + 11) % 12;
    }

    // Nakshatras (27 lunar mansions)
    const nakshatras = [
      'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra',
      'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
      'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
      'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha',
      'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'
    ];

    // Approximate nakshatra based on day of year
    const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
    const nakshatraIndex = Math.floor((dayOfYear / 365) * 27) % 27;

    return {
      nakshatra: nakshatras[nakshatraIndex],
      nakshatra_pada: (dayOfYear % 4) + 1,
      nakshatra_lord: null,
      rashi: sunSigns[sunSignIndex],
      rashi_lord: null,
      lagna: sunSigns[(sunSignIndex + 3) % 12], // Approximate
      lagna_lord: null,
      moon_sign: null,
      sun_sign: sunSigns[sunSignIndex],
      raw_data: { source: 'fallback_calculation' }
    };
  }

  /**
   * Format date as dd-MMM-yyyy (e.g., 01-JAN-2025)
   */
  formatDate(dateStr) {
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  /**
   * Manual peyarchi calculation based on current planetary positions
   */
  calculatePeyarchiManually(birthRashi) {
    const today = new Date();

    // Current peyarchi positions (updated November 2025)
    const allTransits = {
      Sani: {
        rashi: 'Pisces', // Meena - Saturn entered Pisces on March 29, 2025
        start: '2025-03-29',
        end: '2028-02-23',
        description: 'Saturn in Pisces'
      },
      Guru: {
        rashi: 'Gemini', // Mithuna - Jupiter entered Gemini on May 14, 2025
        start: '2025-05-14',
        end: '2026-06-14',
        description: 'Jupiter in Gemini'
      },
      Rahu: {
        rashi: 'Aquarius', // Kumbha - Rahu entered Aquarius on May 18, 2025
        start: '2025-05-18',
        end: '2027-01-29',
        description: 'Rahu in Aquarius'
      },
      Ketu: {
        rashi: 'Leo', // Simha - Ketu entered Leo on May 18, 2025
        start: '2025-05-18',
        end: '2027-01-29',
        description: 'Ketu in Leo'
      }
    };

    // Calculate effects based on house positions from birth rashi
    const rashiOrder = [
      'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
      'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
    ];

    const effects = {};

    for (const [planet, transit] of Object.entries(allTransits)) {
      const endDate = new Date(transit.end);

      // Skip transits that have already ended
      if (endDate < today) {
        continue;
      }

      const birthRashiIndex = rashiOrder.indexOf(birthRashi);
      const transitRashiIndex = rashiOrder.indexOf(transit.rashi);
      const housePosition = ((transitRashiIndex - birthRashiIndex + 12) % 12) + 1;

      effects[planet] = {
        ...transit,
        start: this.formatDate(transit.start),
        end: this.formatDate(transit.end),
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
}

module.exports = ProkerolaService;
