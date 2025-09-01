# GTM API Setup for Divya Desam Temple Locator

This script automatically creates Google Tag Manager triggers, variables, and tags for comprehensive analytics tracking of your temple locator application.

## 🎯 What This Creates

### **Variables (Data Layer)**
- `DL - Temple Name` - Captures selected temple names
- `DL - Search Query` - Captures user search terms
- `DL - Route Start` - Captures route planning start locations
- `DL - Route End` - Captures route planning end locations
- `DL - Temples Found` - Captures number of temples found

### **Triggers (User Interactions)**
- `Find My Location Click` - When users click location discovery
- `Route Planning Button Click` - When users start route planning
- `Get Directions Click` - When users click directions to temples
- `Tab Switch Click` - When users switch between Map/Route tabs
- `Location Search Form Submit` - When users search for locations

### **GA4 Event Tags (Analytics)**
- `GA4 - Temple Search` - Tracks temple and location searches
- `GA4 - Route Calculated` - Tracks route planning usage
- `GA4 - Directions Clicked` - Tracks navigation to temples
- `GA4 - Tab Switch` - Tracks user interface navigation

## 🚀 Setup Instructions

### **Step 1: Google Cloud Console Setup**

1. **Enable GTM API:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Navigate to APIs & Services > Library
   - Search for "Tag Manager API" and enable it

2. **Create Service Account:**
   - Go to IAM & Admin > Service Accounts
   - Create new service account: `gtm-temple-locator`
   - Download JSON key file as `service-account-key.json`

3. **Grant GTM Permissions:**
   - Go to [Google Tag Manager](https://tagmanager.google.com/)
   - Select your container (GTM-M5DT9W42)
   - Go to Admin > User Management
   - Add service account email with "Edit" permissions

### **Step 2: Run the Setup Script**

```bash
# Install dependencies
npm install

# Place your service account key
# Download service-account-key.json to this directory

# Run the GTM setup
npm run setup-gtm
```

### **Step 3: Verify and Publish**

1. **Preview in GTM:**
   - Go to GTM container > Preview mode
   - Test on your temple locator website
   - Verify triggers fire correctly

2. **Check GA4 Events:**
   - Go to GA4 > Configure > Events
   - Should see new events: `temple_search`, `route_calculated`, etc.

3. **Publish Container:**
   - Click "Submit" in GTM
   - Add version notes: "Temple Locator Analytics Setup"
   - Publish changes

## 📊 Events That Will Be Tracked

### **Temple Search Events**
```javascript
Event: temple_search
Parameters:
- search_term: "Chennai" | "Tirupati" | etc.
- event_category: "Temple Locator"
```

### **Route Planning Events**
```javascript
Event: route_calculated  
Parameters:
- start_location: "Chennai"
- end_location: "Bangalore"
- temples_found: 12
- event_category: "Route Planning"
```

### **Navigation Events**
```javascript
Event: directions_clicked
Parameters:
- temple_name: "Sri Ranganathaswamy Temple"
- event_category: "Navigation"
```

### **Interface Events**
```javascript
Event: tab_switched
Parameters:
- tab_name: "Route Planner" | "Map"
- event_category: "Navigation"
```

## 🔧 Troubleshooting

### **Common Issues:**

**Authentication Error:**
```
Error: Could not load the default credentials
```
**Solution:** Ensure `service-account-key.json` is in the script directory

**Permission Error:**
```
Error: The caller does not have permission
```
**Solution:** Add service account email to GTM with Edit permissions

**Container Not Found:**
```
Error: Container GTM-M5DT9W42 not found
```
**Solution:** Verify container ID in script matches your GTM container

### **Testing Events:**

1. **GTM Preview Mode:**
   - Enable preview in GTM
   - Visit your temple locator
   - Perform actions (search, route planning, etc.)
   - Check if triggers fire in preview panel

2. **GA4 Debug View:**
   - Go to GA4 > Configure > DebugView
   - Enable debug mode
   - Test events appear in real-time

## 📈 Expected Analytics Data

After setup, you'll get insights on:

- **Most searched temples** and locations
- **Popular route combinations** (Chennai to Bangalore, etc.)
- **User engagement patterns** (Map vs Route Planner usage)
- **Geographic distribution** of users
- **Mobile vs Desktop usage** for temple searches
- **Peak usage times** for pilgrimage planning

## 🎉 Benefits

- **Zero code changes** to your temple locator
- **Automatic event tracking** for all user interactions
- **Rich analytics data** for improving user experience
- **Easy maintenance** through GTM interface
- **Performance optimized** - no impact on page load speed

## 📞 Support

If you need help:
1. Check GTM Preview mode for trigger testing
2. Verify service account permissions
3. Test with GA4 DebugView for event validation

Your temple locator will have comprehensive analytics without any performance impact! 🛕📊