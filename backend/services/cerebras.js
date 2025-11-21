/**
 * Cerebras LLM Service
 * Generates personalized peyarchi explanations with temple and pariharam recommendations
 */

const axios = require('axios');

class CerebrasService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.cerebras.ai/v1';
    this.model = 'llama-3.3-70b';
  }

  /**
   * Generate peyarchi explanation with temple and pariharam
   */
  async generatePeyarchiExplanation(planet, rashi, housePosition, effect, birthRashi) {
    try {
      const prompt = this.buildPrompt(planet, rashi, housePosition, effect, birthRashi);

      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: `You are an expert Vedic astrologer who explains planetary transits (peyarchi) in a helpful, compassionate way.
Always use Tamil astrological terms:
- Rashi names: Mesham (Aries), Rishabam (Taurus), Mithunam (Gemini), Kadagam (Cancer), Simmam (Leo), Kanni (Virgo), Thulam (Libra), Viruchigam (Scorpio), Dhanusu (Sagittarius), Makaram (Capricorn), Kumbam (Aquarius), Meenam (Pisces)
- Planet names: Sani (Saturn), Guru (Jupiter), Rahu, Ketu, Surya (Sun), Chandra (Moon), Sevvai (Mars), Budhan (Mercury), Sukran (Venus)
Provide practical advice and specific temple recommendations from the Navagraha temples in Tamil Nadu.`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 500,
          temperature: 0.7
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('❌ Cerebras API error:', error.response?.data || error.message);
      // Return fallback explanation
      return this.getFallbackExplanation(planet, rashi, housePosition, effect);
    }
  }

  /**
   * Build prompt for LLM
   */
  buildPrompt(planet, rashi, housePosition, effect, birthRashi) {
    const tamilRashi = this.getTamilRashi(rashi);
    const tamilBirthRashi = this.getTamilRashi(birthRashi);

    return `A person with Moon in ${tamilBirthRashi} rashi is experiencing ${planet} peyarchi (transit) in ${tamilRashi} rashi, which is their ${housePosition}th house. The effect is "${effect.effect}" - "${effect.desc}".

Please provide in 3-4 sentences:
1. What this transit means for them (using Tamil terms)
2. Which Navagraha temple they should visit for pariharam
3. Specific pariharam (remedy) they should perform

Keep the response concise and practical.`;
  }

  /**
   * Get Tamil name for rashi
   */
  getTamilRashi(englishRashi) {
    const tamilNames = {
      'Aries': 'Mesham',
      'Taurus': 'Rishabam',
      'Gemini': 'Mithunam',
      'Cancer': 'Kadagam',
      'Leo': 'Simmam',
      'Virgo': 'Kanni',
      'Libra': 'Thulam',
      'Scorpio': 'Viruchigam',
      'Sagittarius': 'Dhanusu',
      'Capricorn': 'Makaram',
      'Aquarius': 'Kumbam',
      'Pisces': 'Meenam'
    };
    return tamilNames[englishRashi] || englishRashi;
  }

  /**
   * Get Navagraha temple for planet
   */
  getNavagrahaTemple(planet) {
    const temples = {
      'Sani': {
        name: 'Thirunallar Saniswaran Temple',
        location: 'Thirunallar, Karaikal',
        deity: 'Sani Bhagavan',
        coordinates: { lat: 10.8779, lng: 79.8471 }
      },
      'Guru': {
        name: 'Alangudi Guru Temple',
        location: 'Alangudi, Thanjavur',
        deity: 'Dakshinamurthy (Guru Bhagavan)',
        coordinates: { lat: 10.8961, lng: 79.4242 }
      },
      'Rahu': {
        name: 'Thirunageswaram Rahu Temple',
        location: 'Thirunageswaram, Kumbakonam',
        deity: 'Rahu Bhagavan',
        coordinates: { lat: 10.9631, lng: 79.3833 }
      },
      'Ketu': {
        name: 'Keezhperumpallam Ketu Temple',
        location: 'Keezhperumpallam, Nagapattinam',
        deity: 'Ketu Bhagavan',
        coordinates: { lat: 10.9403, lng: 79.7608 }
      },
      'Surya': {
        name: 'Suryanar Kovil',
        location: 'Suryanar Kovil, Thanjavur',
        deity: 'Surya Bhagavan',
        coordinates: { lat: 10.9589, lng: 79.4028 }
      },
      'Chandra': {
        name: 'Thingalur Chandra Temple',
        location: 'Thingalur, Thanjavur',
        deity: 'Chandra Bhagavan',
        coordinates: { lat: 10.9833, lng: 79.4167 }
      },
      'Sevvai': {
        name: 'Vaitheeswaran Kovil',
        location: 'Vaitheeswaran Kovil, Nagapattinam',
        deity: 'Sevvai Bhagavan (Angarakan)',
        coordinates: { lat: 11.2306, lng: 79.6731 }
      },
      'Budhan': {
        name: 'Thiruvenkadu Budhan Temple',
        location: 'Thiruvenkadu, Nagapattinam',
        deity: 'Budhan Bhagavan',
        coordinates: { lat: 11.2500, lng: 79.7000 }
      },
      'Sukran': {
        name: 'Kanjanur Sukran Temple',
        location: 'Kanjanur, Thanjavur',
        deity: 'Sukra Bhagavan',
        coordinates: { lat: 10.9833, lng: 79.4500 }
      }
    };
    return temples[planet] || temples['Sani'];
  }

  /**
   * Get standard pariharam for planet
   */
  getPariharam(planet, effect) {
    const pariharams = {
      'Sani': {
        favorable: {
          rituals: ['Light gingelly oil lamp on Saturdays', 'Offer black sesame to Sani'],
          mantras: ['Om Sham Shanaishcharaya Namaha (108 times)'],
          donations: ['Donate black cloth, iron items to the needy'],
          fasting: 'Fast on Saturdays'
        },
        unfavorable: {
          rituals: ['Visit Thirunallar temple', 'Perform Sani Shanti Pooja', 'Light 9 gingelly oil lamps'],
          mantras: ['Sani Gayatri Mantra', 'Om Sham Shanaishcharaya Namaha (23,000 times)'],
          donations: ['Donate black cloth, black sesame, iron vessels', 'Feed crows on Saturdays'],
          fasting: 'Strict fast on Saturdays, avoid salt'
        },
        critical: {
          rituals: ['Perform Sani Graha Shanti Homam', 'Visit Thirunallar on Sani Peyarchi day', 'Abhishekam with gingelly oil'],
          mantras: ['Sani Kavacham daily', 'Dasaratha Shani Stotram'],
          donations: ['Donate black cow', 'Feed 108 people on Saturday', 'Donate to handicapped'],
          fasting: 'Observe strict Saturday fasts for 2.5 years'
        }
      },
      'Guru': {
        favorable: {
          rituals: ['Visit Alangudi temple on Thursdays', 'Offer yellow flowers'],
          mantras: ['Om Graam Greem Graum Sah Gurave Namaha'],
          donations: ['Donate yellow cloth, turmeric, bananas'],
          fasting: 'Fast on Thursdays'
        },
        unfavorable: {
          rituals: ['Perform Guru Pooja', 'Visit Alangudi temple', 'Offer chana dal prasad'],
          mantras: ['Guru Gayatri Mantra', 'Brihaspati Stotram'],
          donations: ['Donate to Brahmins, teachers', 'Give yellow items'],
          fasting: 'Thursday fasts, eat only once'
        },
        critical: {
          rituals: ['Guru Graha Shanti Homam', 'Special abhishekam at Alangudi'],
          mantras: ['Guru Kavacham', 'Vishnu Sahasranamam on Thursdays'],
          donations: ['Donate gold, yellow sapphire if possible', 'Support education'],
          fasting: 'Strict Thursday fasts'
        }
      },
      'Rahu': {
        favorable: {
          rituals: ['Visit Thirunageswaram on Rahu Kalam', 'Offer milk abhishekam'],
          mantras: ['Om Raam Rahave Namaha'],
          donations: ['Donate blue/black cloth'],
          fasting: 'No specific fast needed'
        },
        unfavorable: {
          rituals: ['Visit Thirunageswaram temple', 'Perform Rahu Ketu Sarpa Dosha Pooja', 'Naga Pratishta'],
          mantras: ['Rahu Kavacham', 'Om Raam Rahave Namaha (18,000 times)'],
          donations: ['Donate blankets to poor', 'Feed birds'],
          fasting: 'Avoid non-veg on Tuesdays and Saturdays'
        },
        critical: {
          rituals: ['Rahu Graha Shanti Homam', 'Sarpa Samskara at Kalahasti', 'Milk abhishekam to Naga'],
          mantras: ['Rahu Kavacham daily', 'Kala Sarpa Dosha Nivaran Mantra'],
          donations: ['Donate to snake catchers', 'Support orphanages'],
          fasting: 'Strict vegetarian diet'
        }
      },
      'Ketu': {
        favorable: {
          rituals: ['Visit Keezhperumpallam temple', 'Offer arugampul (grass)'],
          mantras: ['Om Kem Ketave Namaha'],
          donations: ['Donate multi-colored cloth'],
          fasting: 'No specific fast needed'
        },
        unfavorable: {
          rituals: ['Visit Keezhperumpallam', 'Perform Ketu Shanti Pooja', 'Offer flag to temple'],
          mantras: ['Ketu Kavacham', 'Om Kem Ketave Namaha (7,000 times)'],
          donations: ['Donate to spiritual causes', 'Give blankets'],
          fasting: 'Observe Tuesday fasts'
        },
        critical: {
          rituals: ['Ketu Graha Shanti Homam', 'Sarpa Dosha Pooja'],
          mantras: ['Ketu Kavacham daily', 'Ganesha Atharvashirsha'],
          donations: ['Support spiritual institutions', 'Donate to old age homes'],
          fasting: 'Tuesday and Saturday fasts'
        }
      }
    };

    const planetPariharam = pariharams[planet] || pariharams['Sani'];
    return planetPariharam[effect] || planetPariharam['neutral'] || planetPariharam['favorable'];
  }

  /**
   * Fallback explanation when LLM fails
   */
  getFallbackExplanation(planet, rashi, housePosition, effect) {
    const tamilRashi = this.getTamilRashi(rashi);
    const temple = this.getNavagrahaTemple(planet);

    const effectDescriptions = {
      favorable: `${planet} in ${tamilRashi} (${housePosition}th house) brings positive energy. This is a good period for growth and progress.`,
      neutral: `${planet} in ${tamilRashi} (${housePosition}th house) has moderate effects. Maintain regular prayers and rituals.`,
      unfavorable: `${planet} in ${tamilRashi} (${housePosition}th house) may bring challenges. Pariharam is recommended.`,
      critical: `${planet} in ${tamilRashi} (${housePosition}th house) requires attention. Visit ${temple.name} for relief.`
    };

    return effectDescriptions[effect.effect] || effectDescriptions['neutral'];
  }

  /**
   * Generate complete peyarchi report with explanations
   */
  async generateFullReport(peyarchiData, birthRashi) {
    const report = {};

    for (const [planet, data] of Object.entries(peyarchiData)) {
      const temple = this.getNavagrahaTemple(planet);
      const pariharam = this.getPariharam(planet, data.effect.effect);

      // Generate LLM explanation
      let explanation;
      try {
        explanation = await this.generatePeyarchiExplanation(
          planet,
          data.rashi,
          data.house_from_moon,
          data.effect,
          birthRashi
        );
      } catch (error) {
        explanation = this.getFallbackExplanation(planet, data.rashi, data.house_from_moon, data.effect);
      }

      report[planet] = {
        ...data,
        rashi_tamil: this.getTamilRashi(data.rashi),
        explanation: explanation,
        temple: temple,
        pariharam: pariharam
      };
    }

    return report;
  }
}

module.exports = CerebrasService;
