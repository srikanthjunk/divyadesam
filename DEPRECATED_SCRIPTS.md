# Deprecated Scripts - Removed for Security

**Date**: October 13, 2025

## 🗑️ Removed Files

The following development scripts have been **permanently removed** from this repository:

### 1. `update-all-coordinates.js` ❌ DELETED
- **Purpose**: Batch update temple coordinates using HERE Maps API
- **Why Removed**:
  - Contained exposed HERE Maps API key
  - No longer needed - app uses FREE Nominatim/OSRM APIs
  - Development-only tool, not needed for production

### 2. `coordinate-update-script.js` ❌ DELETED
- **Purpose**: Verify and update temple coordinates
- **Why Removed**:
  - Contained exposed HERE Maps API key
  - Redundant with Supabase database updates
  - Development-only tool

### 3. `location-search-test.html` ❌ DELETED
- **Purpose**: Debug/test location search functionality
- **Why Removed**:
  - Contained exposed OpenRoute API key
  - Development/debugging tool, not needed in production
  - Main app has built-in location search

---

## ✅ Current Architecture (No API Keys Needed!)

The **production application** (`divya-desam-locator.html`) uses **100% FREE APIs**:

### Free APIs Used:
1. **Nominatim (OpenStreetMap)** - Geocoding
   - FREE, unlimited
   - No API key required
   - https://nominatim.openstreetmap.org

2. **OSRM (Open Source Routing Machine)** - Routing
   - FREE, unlimited
   - No API key required
   - https://router.project-osrm.org

3. **Supabase** - Temple Database
   - Public ANON key (read-only, RLS protected)
   - Designed to be exposed in frontend
   - Safe to commit to repository

---

## 📊 Coordinate Management Going Forward

### For Temple Coordinate Updates:

**Option 1: Supabase Database (Recommended)**
```sql
-- Update temple coordinates directly in Supabase
UPDATE temples
SET lat = 10.8620, lng = 78.6960
WHERE name = 'ThiruArangam';
```

**Option 2: Edit Static File**
```javascript
// Edit temple-data.js directly
{
    name: "ThiruArangam",
    displayName: "Sri Ranganathaswamy Temple, Srirangam",
    lat: 10.8620,  // Update here
    lng: 78.6960,  // Update here
    ...
}
```

**Option 3: Manual Research**
- Use Google Maps to find accurate coordinates
- Visit temple's official website
- Consult with temple authorities

---

## 🔒 Security Improvement

### Before:
❌ 3 files with exposed API keys
❌ HERE Maps API key in public repository
❌ OpenRoute API key in public repository
❌ Potential for API abuse and billing charges

### After:
✅ Zero API keys in repository
✅ All APIs are free and keyless
✅ No exposure risk
✅ No billing risk
✅ Simpler architecture

---

## 🎯 Migration Complete

### What Changed:
- ✅ Removed all scripts using HERE Maps API
- ✅ Removed development/test scripts with API keys
- ✅ App continues to work perfectly with free APIs
- ✅ No functionality lost for end users

### What Stayed the Same:
- ✅ All 401 temples still searchable
- ✅ Location search still works (via Nominatim)
- ✅ Route planning still works (via OSRM)
- ✅ Temple timings still available
- ✅ Interactive map still functional

---

## 📝 For Future Developers

If you need to update temple coordinates in bulk:

1. **Export from Supabase:**
   ```bash
   cd temple-importer
   node export_all_temples.mjs > temples.json
   ```

2. **Use Free Nominatim API for geocoding** (no key needed):
   ```bash
   curl "https://nominatim.openstreetmap.org/search?format=json&q=Srirangam%20Temple"
   ```

3. **Update Supabase with new coordinates:**
   ```bash
   cd temple-importer
   # Edit your update script to use env variables
   node update_coordinates.mjs
   ```

**Never hardcode API keys in scripts again!**

---

**Removed in commit**: Security: Remove scripts with exposed API keys
**Alternative**: Use Supabase for coordinate management
**Documentation**: See SUPABASE_SECURITY_GUIDE.md for database operations
