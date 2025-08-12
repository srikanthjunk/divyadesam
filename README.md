# Divya Desam Temple Locator

A web-based application for locating and navigating to the 108 Divya Desam temples (sacred Vishnu temples) across India and Nepal.

## 🚀 Live Application

**Main App**: [https://srikanthjunk.github.io/divyadesam/](https://srikanthjunk.github.io/divyadesam/)

**Direct Link**: [divya-desam-locator.html](https://srikanthjunk.github.io/divyadesam/divya-desam-locator.html)

**Debug Tool**: [location-search-test.html](https://srikanthjunk.github.io/divyadesam/location-search-test.html)

## ✨ Features

### v2.2.0 - Latest Release
- **🕒 Integrated Temple Timings**: All temple cards now show opening hours directly
- **🔍 Location Search**: OpenRoute Service search as GPS alternative (perfect for laptops)
- **🏛️ Comprehensive Temple Data**: Perumal (main deity), Thaayaar (consort), and regional information
- **🗺️ Interactive Mapping**: Leaflet.js with OpenStreetMap integration
- **📍 Smart Location**: GPS + fallback location search for better accuracy
- **🛣️ Route Planning**: Real road distances using OpenRoute Service API

### Core Functionality
1. **Nearby Temples Finder**: Uses GPS or location search to find closest temples
2. **Route Planner**: Plan trips with temple stops along your route
3. **Interactive Map**: All 108 temples marked with detailed popups
4. **Real Road Distances**: Actual driving distances, not straight-line

## 🛠️ Technical Stack

- **Frontend**: Pure HTML5, CSS3, JavaScript (ES6+)
- **Mapping**: Leaflet.js v1.9.4 with OpenStreetMap tiles
- **APIs**: OpenRoute Service for routing and geocoding
- **Data**: 108 Divya Desam temples with complete metadata
- **Hosting**: GitHub Pages (static deployment)

## 📊 Temple Data

- **Total Temples**: 108 Divya Desams
- **Regions Covered**: Tamil Nadu (84), Kerala (11), Andhra Pradesh (2), Gujarat (1), UP (4), Uttarakhand (3), Nepal (1)
- **Data Fields**: Name, coordinates, Perumal, Thaayaar, region, temple timings
- **External File**: `temple-data.js` for better maintainability

## 🔧 Files Structure

```
├── index.html                    # Landing page with redirects
├── divya-desam-locator.html     # Main application
├── temple-data.js               # Temple database (108 temples)
├── location-search-test.html    # Debug tool for location search
├── divya-desam-spec.md          # Technical specifications
└── README.md                    # This file
```

## 🚀 Development

### Local Testing
```bash
# Clone repository
git clone https://github.com/srikanthjunk/divyadesam.git
cd divyadesam

# Start local server (required for location search)
python3 -m http.server 8000

# Open in browser
open http://localhost:8000
```

### Requirements
- **HTTPS**: Required for geolocation and OpenRoute Service API
- **Modern Browser**: ES6+ support needed
- **Internet**: For map tiles and API calls

## 🔍 Debugging

Use `location-search-test.html` to debug location search issues:
- Real-time API call logging
- Console output for troubleshooting
- Isolated testing environment

## 📱 Browser Compatibility

- **Desktop**: Chrome, Firefox, Safari, Edge
- **Mobile**: iOS Safari, Chrome Android  
- **Requirements**: ES6+, Geolocation API, Fetch API
- **HTTPS**: Required for location services

## 🙏 About Divya Desams

The Divya Desams are 108 temples mentioned in the works of the Tamil Azhwars (saints). These sacred Vishnu temples span across India and Nepal, representing the most important pilgrimage sites in Vaishnavism.

## 📄 License

This project is open source. Temple data compiled from public sources. Map data © OpenStreetMap contributors.

---

*Last Updated: August 2025 - v2.2.0*