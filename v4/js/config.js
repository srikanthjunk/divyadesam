// config.js - Configuration & Constants
// Divya Desam Temple Locator v4.0.0

export const CONFIG = {
  // API Configuration
  NOMINATIM_URL: 'https://nominatim.openstreetmap.org',
  OSRM_URL: 'https://router.project-osrm.org',
  USER_AGENT: 'DivyaDesamLocator/4.0.0 (Temple Locator App)',

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
  NOMINATIM_DELAY_MS: 1000, // Be respectful to free service

  // UI
  MAP_DEFAULT_ZOOM: 13,
  MAP_MAX_ZOOM: 18,

  // Debug
  DEBUG: true
};

// Fallback cities for location search
export const FALLBACK_CITIES = [
  // Tamil Nadu
  { name: "Chennai", state: "Tamil Nadu", lat: 13.0827, lng: 80.2707 },
  { name: "Madurai", state: "Tamil Nadu", lat: 9.9252, lng: 78.1198 },
  { name: "Coimbatore", state: "Tamil Nadu", lat: 11.0168, lng: 76.9558 },
  { name: "Thanjavur", state: "Tamil Nadu", lat: 10.7870, lng: 79.1378 },
  { name: "Trichy", state: "Tamil Nadu", lat: 10.8505, lng: 78.6967 },
  { name: "Tiruchirappalli", state: "Tamil Nadu", lat: 10.8505, lng: 78.6967 },
  { name: "Kumbakonam", state: "Tamil Nadu", lat: 10.9617, lng: 79.3881 },
  { name: "Kanchipuram", state: "Tamil Nadu", lat: 12.8185, lng: 79.6947 },
  { name: "Srirangam", state: "Tamil Nadu", lat: 10.8620, lng: 78.6960 },
  { name: "Tirunelveli", state: "Tamil Nadu", lat: 8.7139, lng: 77.7567 },
  { name: "Rameswaram", state: "Tamil Nadu", lat: 9.2885, lng: 79.3129 },
  { name: "Kanyakumari", state: "Tamil Nadu", lat: 8.0883, lng: 77.5385 },
  { name: "Vellore", state: "Tamil Nadu", lat: 12.9165, lng: 79.1325 },
  { name: "Salem", state: "Tamil Nadu", lat: 11.6643, lng: 78.1460 },
  { name: "Erode", state: "Tamil Nadu", lat: 11.3410, lng: 77.7172 },
  { name: "Chidambaram", state: "Tamil Nadu", lat: 11.3992, lng: 79.6935 },
  { name: "Mayiladuthurai", state: "Tamil Nadu", lat: 11.1018, lng: 79.6520 },
  { name: "Srivilliputhur", state: "Tamil Nadu", lat: 9.5120, lng: 77.6337 },
  { name: "Thoothukudi", state: "Tamil Nadu", lat: 8.7642, lng: 78.1348 },

  // Kerala
  { name: "Thiruvananthapuram", state: "Kerala", lat: 8.5241, lng: 76.9366 },
  { name: "Trivandrum", state: "Kerala", lat: 8.5241, lng: 76.9366 },
  { name: "Kochi", state: "Kerala", lat: 9.9312, lng: 76.2673 },
  { name: "Cochin", state: "Kerala", lat: 9.9312, lng: 76.2673 },
  { name: "Kozhikode", state: "Kerala", lat: 11.2588, lng: 75.7804 },
  { name: "Calicut", state: "Kerala", lat: 11.2588, lng: 75.7804 },
  { name: "Thrissur", state: "Kerala", lat: 10.5276, lng: 76.2144 },
  { name: "Kollam", state: "Kerala", lat: 8.8932, lng: 76.6141 },
  { name: "Alappuzha", state: "Kerala", lat: 9.4981, lng: 76.3388 },
  { name: "Tiruvalla", state: "Kerala", lat: 9.3816, lng: 76.5775 },

  // Karnataka
  { name: "Bangalore", state: "Karnataka", lat: 12.9716, lng: 77.5946 },
  { name: "Bengaluru", state: "Karnataka", lat: 12.9716, lng: 77.5946 },
  { name: "Mysore", state: "Karnataka", lat: 12.2958, lng: 76.6394 },
  { name: "Mysuru", state: "Karnataka", lat: 12.2958, lng: 76.6394 },
  { name: "Mangalore", state: "Karnataka", lat: 12.9141, lng: 74.8560 },

  // Other States
  { name: "Hyderabad", state: "Telangana", lat: 17.3850, lng: 78.4867 },
  { name: "Mumbai", state: "Maharashtra", lat: 19.0760, lng: 72.8777 },
  { name: "Pune", state: "Maharashtra", lat: 18.5204, lng: 73.8567 },
  { name: "Delhi", state: "Delhi", lat: 28.7041, lng: 77.1025 },
  { name: "Ahmedabad", state: "Gujarat", lat: 23.0225, lng: 72.5714 }
];
