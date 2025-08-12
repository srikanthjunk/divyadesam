# 🔑 API Key Setup Guide

## ✅ Current Status
The app is now using **HERE Maps API** with your provided API key for both routing and geocoding services.

## 🌟 Current Setup: HERE Maps (Active)

### Why HERE Maps?
- ✅ **Production-ready API key provided**
- ✅ **CORS-friendly** (works directly from browsers)
- ✅ **Fast and reliable**
- ✅ **No proxy needed**
- ✅ **Comprehensive geocoding and routing**

### Current Configuration:
```javascript
here: {
    key: 'zKgxlEjQH_RLWBmqTViWQtVIBsxZZAQE0erZEsoMXuQ',
    routeUrl: 'https://router.hereapi.com/v8/routes',
    geocodeUrl: 'https://geocode.search.hereapi.com/v1/geocode',
    enabled: true // Currently active
},
```

## 🔄 Alternative Options (If Needed)

### Option 1: MapBox
- ✅ **100,000 free requests/month**
- ✅ **CORS-friendly**

### Setup Steps:
1. **Sign up**: https://mapbox.com/
2. **Get API key**: Dashboard → Access Tokens
3. **Update code** in `divya-desam-locator.html`:
   ```javascript
   mapbox: {
       key: 'pk.your_actual_mapbox_key_here',
       url: 'https://api.mapbox.com/directions/v5/mapbox/driving',
       enabled: true // Change to true
   },
   here: {
       enabled: false // Disable HERE Maps
   }
   ```

## 🌐 Alternative: OpenRoute Service

### Why OpenRoute?
- ✅ **2,000 free requests/day**
- ✅ **Open source**
- ⚠️ **Requires CORS proxy** (already implemented)

### Setup Steps:
1. **Sign up**: https://openrouteservice.org/
2. **Get API key**: Dashboard → API Key
3. **Update code** in `divya-desam-locator.html`:
   ```javascript
   openroute: {
       key: 'your_actual_openroute_key_here',
       url: 'https://api.openrouteservice.org/v2/directions/driving-car',
       enabled: true // Change to true
   },
   demo: {
       enabled: false // Disable demo key
   }
   ```

## 🔧 Quick Setup Commands

### For MapBox:
```bash
# Edit the HTML file
# Find this line:
key: 'YOUR_MAPBOX_API_KEY',
enabled: false

# Replace with:
key: 'pk.your_actual_key_here',
enabled: true

# And disable demo:
demo: {
    enabled: false
}
```

### For OpenRoute Service:
```bash
# Edit the HTML file  
# Find this line:
key: 'YOUR_OPENROUTE_API_KEY',
enabled: false

# Replace with:
key: 'your_actual_key_here',
enabled: true

# And disable demo:
demo: {
    enabled: false
}
```

## 🧪 Testing

After setup, check the browser console:
- ✅ Should see: "Using [API_NAME] for routing"
- ❌ Should NOT see: "USING DEMO API KEY" warning

## 📊 Usage Estimates

**Typical Usage:**
- Finding 10 nearby temples = ~10 API calls
- Route planning = ~20 API calls  
- Location search = ~5 API calls per search

**API Limits:**
- **HERE Maps**: Check your HERE developer dashboard for current limits
- **MapBox**: ~3,300 location searches OR ~10,000 nearby temple searches (100k/month)
- **OpenRoute**: ~200 location searches OR ~400 nearby temple searches (2k/day)

## 🔒 Security Notes

- ✅ API keys in frontend code are normal for these services
- ✅ Both services expect browser usage
- ✅ Rate limiting prevents abuse
- ⚠️ Don't use server-side keys in frontend code

## 🆘 Troubleshooting

**CORS Errors?**
- MapBox: Should work directly
- OpenRoute: Uses proxy automatically

**Rate Limit Hit?**
- App falls back to estimated distances
- Get your own key for higher limits

**API Not Working?**
- Check console for errors
- Verify API key is correct
- Check if service is enabled in code