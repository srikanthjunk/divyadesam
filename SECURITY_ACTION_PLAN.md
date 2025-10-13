# 🚨 IMMEDIATE SECURITY ACTION PLAN

**Date**: October 13, 2025
**Status**: ⚠️ **CRITICAL - API KEYS EXPOSED IN PUBLIC GITHUB REPOSITORY**

---

## ✅ CONFIRMED EXPOSED KEYS

### **HERE Maps API Key**
```
Key: zKgxlEjQH_RLWBmqTViWQtVIBsxZZAQE0erZEsoMXuQ
Exposed in:
  - update-all-coordinates.js (line 25)
  - coordinate-update-script.js (line 8)
  - location-search-test.html (OpenRoute key also exposed)
```

These files ARE tracked by git and ARE on public GitHub at:
https://github.com/srikanthjunk/divyadesam

---

## 🔴 IMMEDIATE ACTIONS (Do RIGHT NOW - Next 30 minutes)

### **Step 1: REVOKE the Exposed HERE Maps API Key** (5 minutes)

1. Go to: **https://platform.here.com/admin/apps**
2. Log in to your HERE account
3. Find the app with key: `zKgxlEjQH_RLWBmqTViWQtVIBsxZZAQE0erZEsoMXuQ`
4. Click **DELETE** or **DISABLE** immediately
5. Generate a **NEW** API key
6. Save the new key temporarily (you'll add it to .env file)

---

### **Step 2: Remove Keys from Files** (5 minutes)

Open and edit these 3 files to remove the hardcoded keys:

#### **File 1: update-all-coordinates.js**
```bash
nano update-all-coordinates.js
```

**Change line 25 from:**
```javascript
const HERE_API_KEY = 'zKgxlEjQH_RLWBmqTViWQtVIBsxZZAQE0erZEsoMXuQ';
```

**To:**
```javascript
const HERE_API_KEY = process.env.HERE_API_KEY || '';
```

#### **File 2: coordinate-update-script.js**
```bash
nano coordinate-update-script.js
```

**Change line 8 from:**
```javascript
const HERE_API_KEY = 'zKgxlEjQH_RLWBmqTViWQtVIBsxZZAQE0erZEsoMXuQ';
```

**To:**
```javascript
const HERE_API_KEY = process.env.HERE_API_KEY || '';
```

#### **File 3: location-search-test.html**
```bash
nano location-search-test.html
```

**Find the line with:**
```javascript
const OPENROUTE_API_KEY = 'eyJvcmciO...';
```

**Change to:**
```javascript
// This file is for testing only - configure API key in browser console
const OPENROUTE_API_KEY = prompt('Enter OpenRoute API key:') || '';
```

---

### **Step 3: Update .env File with NEW Keys** (2 minutes)

```bash
nano divyadesam/temple-importer/.env
```

**Add your NEW HERE Maps key:**
```bash
HERE_API_KEY=YOUR_NEW_HERE_MAPS_KEY_HERE
```

---

### **Step 4: Commit the Changes** (3 minutes)

```bash
cd /Users/srikpart/Downloads/github/divyadesam

# Add the modified files
git add update-all-coordinates.js coordinate-update-script.js location-search-test.html

# Commit
git commit -m "Security: Remove hardcoded API keys, use environment variables

- Remove exposed HERE Maps API key from update-all-coordinates.js
- Remove exposed HERE Maps API key from coordinate-update-script.js
- Remove exposed OpenRoute API key from location-search-test.html
- All keys now loaded from environment variables

BREAKING CHANGE: Scripts require HERE_API_KEY environment variable"
```

---

### **Step 5: Rewrite Git History** (10 minutes)

This removes the old keys from ALL past commits:

```bash
cd /Users/srikpart/Downloads/github/divyadesam

# Use BFG Repo-Cleaner (fastest method)
# If not installed: brew install bfg

# Create a backup first
cd ..
cp -r divyadesam divyadesam-backup-$(date +%Y%m%d-%H%M%S)
cd divyadesam

# Remove the old keys from history
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch update-all-coordinates.js coordinate-update-script.js location-search-test.html' \
  --prune-empty --tag-name-filter cat -- --all

# Clean up
rm -rf .git/refs/original/
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

---

### **Step 6: Re-add the Fixed Files** (2 minutes)

```bash
# Add the cleaned files back
git add update-all-coordinates.js coordinate-update-script.js location-search-test.html

# Commit them with keys removed
git commit -m "Add coordinate update scripts with environment variable support"
```

---

### **Step 7: Force Push to GitHub** (2 minutes)

⚠️ **WARNING: This rewrites public history!**

```bash
cd /Users/srikpart/Downloads/github/divyadesam

# Force push (overwrites GitHub history)
git push origin --force --all
git push origin --force --tags
```

---

### **Step 8: Verify on GitHub** (2 minutes)

1. Visit: https://github.com/srikanthjunk/divyadesam
2. Click on `update-all-coordinates.js`
3. Click **"History"** button
4. Check old commits - the key should be GONE from all commits
5. Verify current file shows `process.env.HERE_API_KEY`

---

### **Step 9: Monitor API Usage** (ongoing)

1. **HERE Maps Dashboard:** https://platform.here.com/admin
   - Check for unauthorized API calls
   - Look for unusual spikes in usage
   - Review access logs

2. **Check for any charges:**
   - Review billing section
   - Look for unexpected usage

---

## 📋 QUICK CHECKLIST

Use this checklist to track your progress:

- [ ] **CRITICAL:** Revoked old HERE Maps API key
- [ ] **CRITICAL:** Generated new HERE Maps API key
- [ ] Edited update-all-coordinates.js (removed hardcoded key)
- [ ] Edited coordinate-update-script.js (removed hardcoded key)
- [ ] Edited location-search-test.html (removed hardcoded key)
- [ ] Updated divyadesam/temple-importer/.env with NEW key
- [ ] Committed changes locally
- [ ] Rewrote git history (removed keys from all commits)
- [ ] Re-added cleaned files
- [ ] Force pushed to GitHub
- [ ] Verified on GitHub that keys are gone
- [ ] Checked HERE Maps dashboard for unauthorized usage
- [ ] No unexpected charges on HERE Maps account

---

## ⏱️ TIMELINE

| Action | Time | Priority |
|--------|------|----------|
| Revoke old key | 5 min | 🔴 CRITICAL |
| Remove hardcoded keys | 5 min | 🔴 CRITICAL |
| Update .env | 2 min | 🔴 CRITICAL |
| Commit changes | 3 min | 🔴 HIGH |
| Rewrite history | 10 min | 🔴 HIGH |
| Force push | 2 min | 🔴 HIGH |
| Verify | 2 min | 🟡 MEDIUM |
| Monitor | Ongoing | 🟡 MEDIUM |

**TOTAL TIME: ~30 minutes**

---

## ⚠️ IMPORTANT NOTES

### About the Main App (divya-desam-locator.html)

**GOOD NEWS:** The main application does NOT use HERE Maps API!

According to your CLAUDE.md documentation, the app uses:
- ✅ **Nominatim (OpenStreetMap)** - FREE, no API key required
- ✅ **OSRM** - FREE, no API key required
- ✅ **Supabase ANON key** - Public, read-only (safe to expose)

The HERE Maps key is only used in:
- Backend coordinate update scripts (not public-facing)
- These scripts are for DEVELOPMENT/MAINTENANCE only
- Users never see or use these scripts

### Risk Assessment

**Exposure Duration:** Unknown (check GitHub commit dates)
**Visibility:** Public repository - anyone can see the key
**Impact:** Medium - HERE Maps has usage limits and billing
**Likelihood of Abuse:** Medium - depends on GitHub traffic

### What Could Someone Do With This Key?

1. ✅ **Use your HERE Maps quota** until exhausted
2. ✅ **Potentially rack up charges** (if you have billing enabled)
3. ❌ Cannot access your database
4. ❌ Cannot modify your temple data
5. ❌ Cannot affect the live website (uses free APIs)

---

## 📞 NEED HELP?

If you encounter any issues:

1. **Git history rewrite fails:** Try BFG Repo-Cleaner instead
   ```bash
   brew install bfg
   bfg --delete-files 'update-all-coordinates.js' .
   ```

2. **Force push blocked:** Check GitHub branch protection rules

3. **Keys still visible:** May need to contact GitHub Support to purge cache

---

## ✅ AFTER COMPLETION

Once done, the repository will be secure:
- ✅ No API keys in any files
- ✅ No API keys in git history
- ✅ Old keys revoked and useless
- ✅ New keys safely in .env (never committed)
- ✅ Future commits will never include keys

---

**Start with Step 1 NOW - Revoke the old key immediately!**

*Generated: October 13, 2025*
