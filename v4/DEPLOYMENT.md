# Deployment Guide - Divya Desam Locator v4.0.0

## GitHub Pages Deployment

### Option 1: Replace Current Site (Direct)

**⚠️ WARNING**: This will immediately replace your live site. Test locally first!

```bash
# From the repository root
cd /Users/srikpart/Downloads/github/divyadesam

# Move old version to backup
mv divya-desam-locator.html divya-desam-locator.v3.3.13.backup.html

# Copy v4 files to root
cp v4/index.html divya-desam-locator.html
cp -r v4/css .
cp -r v4/js .
# data/ already exists in root

# Commit and push
git add .
git commit -m "Deploy v4.0.0 - Complete rewrite with modular architecture

- Fix: Temple search now working (autocomplete with filters)
- Fix: Location search now working (Nominatim + fallback)
- Fix: Geolocation 'Find My Location' now working
- Refactor: 60% code reduction (3,730 → 2,609 lines)
- Refactor: Modular ES6 architecture (14 focused files)
- Improve: Better error handling and user feedback
- Improve: Mobile-first responsive design"

git push origin main
```

**Result**: Live in ~1 minute at https://divyadesam.communityforge.info

---

### Option 2: Side-by-Side Testing (Recommended)

Deploy v4 to a separate URL for testing first.

```bash
# Create a v4 branch
git checkout -b v4-deploy

# Copy v4 folder to root
cp -r v4/* .

# Create index.html redirect
cat > index.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <meta http-equiv="refresh" content="0; url=v4/">
    <title>Redirecting...</title>
</head>
<body>
    <p>Redirecting to v4...</p>
    <a href="v4/">Click here if not redirected</a>
</body>
</html>
EOF

# Commit and push
git add .
git commit -m "Add v4.0.0 for testing"
git push origin v4-deploy
```

**Test URL**: Create a separate subdomain or use GitHub Pages branches feature.

---

### Option 3: Gradual Rollout (Feature Flag)

Add a version switcher to the old site.

```bash
# In old divya-desam-locator.html, add at the top:
# <div id="version-banner" style="background:#ff6b35;color:white;padding:10px;text-align:center;">
#   🆕 Try the new v4.0.0! <a href="v4/" style="color:white;font-weight:bold;">Click here</a>
# </div>

# Keep both versions live
# Let users choose for a week
# Monitor feedback
# Then make v4 default
```

---

## Pre-Deployment Checklist

### ✅ Testing

- [ ] Temple search works (type "Srirangam")
- [ ] Location search works (type "Chennai")
- [ ] Find My Location button works
- [ ] Map displays with markers
- [ ] Temple cards display with timings
- [ ] Responsive on mobile (test iPhone, Android)
- [ ] Works in Safari (iOS)
- [ ] Works in Chrome (Desktop & Mobile)
- [ ] No console errors
- [ ] All external resources load (Leaflet, data files)

### ✅ Files

- [ ] All CSS files present
- [ ] All JS files present
- [ ] Temple data (temples.js) present
- [ ] Temple timings (timings.json) present
- [ ] index.html loads correctly
- [ ] Paths are relative (no /Users/ or localhost)

### ✅ Performance

- [ ] Page loads in < 3 seconds (3G)
- [ ] No memory leaks
- [ ] Search is responsive (< 300ms)
- [ ] Map renders smoothly

### ✅ SEO & Metadata

- [ ] Title tag present
- [ ] Meta description present
- [ ] Favicon (optional)
- [ ] robots.txt (optional)
- [ ] sitemap.xml (optional)

---

## File Structure for Deployment

```
divyadesam/ (GitHub Pages root)
├── index.html (or divya-desam-locator.html)
├── css/
│   ├── variables.css
│   ├── base.css
│   ├── components.css
│   └── responsive.css
├── js/
│   ├── config.js
│   ├── utils.js
│   ├── data.js
│   ├── search.js
│   ├── geolocation.js
│   ├── map.js
│   ├── routing.js
│   ├── ui.js
│   └── app.js
├── data/
│   ├── temples.js
│   └── timings.json
├── CNAME (for custom domain)
└── README.md
```

---

## Testing Locally Before Deploy

```bash
# Test with Python server
cd v4
python3 -m http.server 8080
open http://localhost:8080

# Test all features:
# 1. Click "Find My Location" (allow permission)
# 2. Type "Srirangam" in temple search
# 3. Type "Chennai" in location search
# 4. Check map markers appear
# 5. Click temple card "Navigate" button
# 6. Check mobile view (Chrome DevTools)
```

---

## Rollback Plan

If v4 has issues:

```bash
# Quick rollback to v3.3.13
git revert HEAD
git push origin main

# Or restore from backup
cp divya-desam-locator.v3.3.13.backup.html divya-desam-locator.html
git add divya-desam-locator.html
git commit -m "Rollback to v3.3.13"
git push origin main
```

**Rollback time**: < 2 minutes

---

## Post-Deployment Verification

1. **Visit live site**: https://divyadesam.communityforge.info
2. **Check all features work**:
   - [ ] Temple search
   - [ ] Location search
   - [ ] Find My Location
   - [ ] Map loads
   - [ ] Temple details display
3. **Test on mobile device** (real phone, not emulator)
4. **Check browser console** (F12) for errors
5. **Monitor for 24 hours** for user reports

---

## Monitoring & Maintenance

### Browser Console Monitoring

Check for errors:
```javascript
// In browser console (F12)
console.log('App version:', document.querySelector('footer strong').textContent);
console.log('Temples loaded:', window.divyaDesams?.length);
```

### Performance Monitoring

```javascript
// Check load time
window.addEventListener('load', () => {
  const perfData = window.performance.timing;
  const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
  console.log('Page load time:', (pageLoadTime / 1000).toFixed(2), 'seconds');
});
```

### Error Tracking (Optional)

Add simple error logging:
```javascript
window.addEventListener('error', (e) => {
  console.error('Global error:', e.message, e.filename, e.lineno);
  // Optional: Send to analytics or error tracking service
});
```

---

## Custom Domain Setup (Already Configured)

Your custom domain `divyadesam.communityforge.info` is already configured.

**DNS Settings** (for reference):
```
Type: CNAME
Name: divyadesam
Value: srikanthjunk.github.io
```

**CNAME File** (in repository root):
```
divyadesam.communityforge.info
```

**HTTPS**: Automatically enabled by GitHub Pages

---

## Performance Optimization (Optional)

### Enable Caching

Add `.htaccess` (if supported):
```apache
# Cache CSS, JS for 7 days
<filesMatch "\\.(css|js)$">
  Header set Cache-Control "max-age=604800, public"
</filesMatch>

# Cache data files for 1 day
<filesMatch "\\.(json|js)$">
  Header set Cache-Control "max-age=86400, public"
</filesMatch>
```

**Note**: GitHub Pages doesn't support `.htaccess`. Caching is automatic.

### Service Worker (Future Enhancement)

Add for offline support:
```javascript
// service-worker.js
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('divyadesam-v4').then((cache) => {
      return cache.addAll([
        '/',
        '/css/variables.css',
        '/css/base.css',
        '/js/app.js',
        '/data/temples.js'
      ]);
    })
  );
});
```

---

## Support & Troubleshooting

### Common Issues

**1. "Temple data not loaded"**
- Check: `data/temples.js` file exists
- Check: Browser console for 404 errors
- Fix: Verify file paths in `index.html`

**2. "Map not displaying"**
- Check: Leaflet.js CDN loaded
- Check: `#map` element exists
- Check: CSS `height` is set

**3. "Search not working"**
- Check: ES6 modules supported (modern browser)
- Check: JavaScript errors in console
- Check: Event listeners attached

**4. "Geolocation permission denied"**
- This is normal - users must allow location
- Provide fallback: location search

---

## Version History

### v4.0.0 (2025-11-19)
- ✅ Complete rewrite with modular architecture
- ✅ Fixed all search functionality
- ✅ Fixed geolocation
- ✅ 60% code reduction

### v3.3.13 (2024-08-14)
- Last version before rewrite
- Known issues: Search broken, complex codebase

---

**Questions?** Check console logs (DEBUG mode enabled)

**Deployment Ready!** 🚀
