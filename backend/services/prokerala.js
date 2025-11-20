/**
 * Prokerala API Service using Official SDK
 * Handles all Prokerala API calls with rate limiting
 * Rate limit: 5 requests/minute, 5000 credits/month
 */

const Prokerala = require('@prokerala/astrology-sdk');

class ProkerolaService {
  constructor(clientId, clientSecret) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;

    // Initialize Prokerala client with credentials
    this.client = new Prokerala.Client(clientId, clientSecret);

    // Rate limiting: Max 5 requests per minute
    this.lastRequestTime = 0;
    this.minRequestInterval = 12000; // 12 seconds between requests (5 per minute)
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
   * Calculate birth chart (Kundli)
   * Returns: nakshatra, rashi, lagna, and other birth details
   */
  async getBirthChart(dateOfBirth, timeOfBirth, latitude, longitude) {
    try {
      console.log(`📊 Fetching birth chart from Prokerala...`);

      const result = await this.rateLimitedRequest(async () => {
        // Create location object
        const location = new Prokerala.Location(latitude, longitude);

        // Create datetime object
        const datetime = new Date(`${dateOfBirth}T${timeOfBirth}`);

        // Get Kundli (birth chart)
        const kundli = await this.client.kundli({
          datetime,
          location,
          ayanamsa: 1 // Lahiri ayanamsa
        });

        return kundli;
      });

      console.log('✅ Birth chart received from Prokerala');

      // Extract relevant data
      return {
        nakshatra: result.nakshatra?.name || 'Unknown',
        nakshatra_pada: result.nakshatra?.pada || null,
        nakshatra_lord: result.nakshatra?.lord || null,
        rashi: result.rasi?.name || 'Unknown',
        rashi_lord: result.rasi?.lord || null,
        lagna: result.lagna?.name || 'Unknown',
        lagna_lord: result.lagna?.lord || null,
        moon_sign: result.moon_sign || null,
        sun_sign: result.sun_sign || null,
        raw_data: result
      };
    } catch (error) {
      console.error('❌ Prokerala birth chart error:', error.message);
      throw new Error('Failed to fetch birth chart from Prokerala');
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
}

module.exports = ProkerolaService;
