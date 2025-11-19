# 🔑 API Keys Guide - What You Actually Need

Based on your application architecture, here's what API keys you need and where to put them.

---

## 🎯 **Summary: What Keys Do You Actually Need?**

### **For the Main Website (Production):**
✅ **NO API KEYS NEEDED!**
- The website at https://divyadesam.communityforge.info uses **100% free APIs**
- Nominatim (OpenStreetMap) - No key required
- OSRM (Routing) - No key required
- Supabase ANON key - Already in code (public, safe to expose)

### **For Backend Development (Optional):**
⚠️ **Only needed if you're developing backend scripts**
- Supabase Service Key - For database admin tasks
- Resend API Key - For email alerts (if you use this feature)
- ~~Google Gemini~~ - Not needed anymore (one-time data enrichment done)
- ~~HERE Maps~~ - Not needed (removed, app uses free APIs)
- ~~OpenRoute~~ - Not needed (removed, app uses free APIs)

---

## 📍 **Where to Put Keys**

### **File Location:**
```
/Users/srikpart/Downloads/github/divyadesam/temple-importer/.env
```

This file already exists with placeholders. You only need to fill in what you'll actually use.

---

## 🔑 **Keys Breakdown**

### **1. Supabase ANON Key** ✅ **ALREADY SET**

**Status:** ✅ Already configured, no action needed

**Current Value in `.env`:**
```bash
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**What it does:**
- Public key for frontend to read temple data
- Safe to expose in frontend code (protected by Row Level Security)
- Already used in `divya-desam-locator.html`

**Action Required:** ✅ **None - Already set and working**

---

### **2. Supabase Service Key** ⚠️ **OPTIONAL**

**Status:** ⚠️ Only needed for backend admin tasks

**Where to get:**
1. Go to: https://supabase.com/dashboard/project/yxsnfxiebolatzhkhbyi/settings/api
2. Find "Service Role Key" section
3. Copy the key
4. Paste in `.env` file:
```bash
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.YOUR_SERVICE_KEY_HERE
```

**What it does:**
- Full admin access to Supabase database
- Bypass Row Level Security policies
- Used for backend scripts in `temple-importer/` folder

**When you need it:**
- ✅ Adding/updating temple data in bulk
- ✅ Running database migrations
- ✅ Backend maintenance scripts
- ❌ NOT needed for the website to work

**Action Required:**
- If you plan to run backend scripts: Get and paste key
- If you just want the website to work: Skip this

---

### **3. Resend API Key** ⚠️ **OPTIONAL**

**Status:** ⚠️ Only needed if you want email alerts

**Where to get:**
1. Go to: https://resend.com/api-keys
2. Create account (if you don't have one)
3. Generate new API key
4. Paste in `.env` file:
```bash
RESEND_API_KEY=re_your_new_resend_key_here
```

**What it does:**
- Send email alerts/notifications
- Used for temple update notifications (if enabled)

**When you need it:**
- ✅ If you want email notifications for temple updates
- ❌ NOT needed for the website to work

**Action Required:**
- If you want email alerts: Get and paste key
- If you don't need emails: Skip this

---

### **4. Google Gemini API Key** ❌ **NOT NEEDED**

**Status:** ❌ No longer needed

**Why not needed:**
- Was used for one-time AI data enrichment
- All temple data already enriched and stored in Supabase
- No ongoing need for this API

**Action Required:** ❌ **None - Remove from .env or leave as placeholder**

---

### **5. HERE Maps API Key** ❌ **NOT NEEDED**

**Status:** ❌ Removed - app doesn't use it

**Why not needed:**
- App uses free Nominatim API instead
- HERE Maps scripts were removed for security
- No functionality requires HERE Maps

**Action Required:** ❌ **None - Ignore this line in .env**

---

### **6. OpenRoute API Key** ❌ **NOT NEEDED**

**Status:** ❌ Removed - app doesn't use it

**Why not needed:**
- App uses free OSRM API instead
- OpenRoute test scripts were removed
- No functionality requires OpenRoute

**Action Required:** ❌ **None - Ignore this line in .env**

---

## 📝 **Quick Setup Guide**

### **For Website Only (Production):**

**No setup needed!** Your website works without any keys because:
- ✅ Supabase ANON key already in code
- ✅ Free APIs don't need keys
- ✅ Everything is configured

**Verification:**
```bash
# Just check the website is live
curl -I https://divyadesam.communityforge.info
```

---

### **For Backend Development:**

**Only if you need to run backend scripts:**

1. **Open the `.env` file:**
```bash
cd /Users/srikpart/Downloads/github/divyadesam/temple-importer
nano .env
```

2. **Update only what you need:**
```bash
# Required for backend admin
SUPABASE_SERVICE_KEY=<get_from_supabase_dashboard>

# Optional for email alerts
RESEND_API_KEY=<get_from_resend_if_needed>

# Not needed - leave as is or delete
GEMINI_API_KEY=PASTE_YOUR_NEW_GEMINI_KEY_HERE
HERE_API_KEY=PASTE_YOUR_NEW_HERE_MAPS_KEY_HERE
OPENROUTE_API_KEY=PASTE_YOUR_NEW_OPENROUTE_KEY_HERE
```

3. **Save and test:**
```bash
# Test Supabase connection
cd temple-importer
node -e "require('dotenv').config(); console.log(process.env.SUPABASE_SERVICE_KEY ? 'Connected!' : 'Missing key')"
```

---

## 🔒 **Security Checklist**

- ✅ `.env` file is in `.gitignore` (already done)
- ✅ Old exposed keys removed from GitHub history (already done)
- ✅ Supabase ANON key is public-safe (read-only with RLS)
- ⚠️ Supabase SERVICE key must stay secret (admin access)
- ⚠️ Resend API key must stay secret (billing access)
- ✅ No paid API keys needed for production website

---

## 📋 **Current .env File Status**

**Location:** `/Users/srikpart/Downloads/github/divyadesam/temple-importer/.env`

**Current State:**
```bash
# ✅ Set and working
SUPABASE_URL=https://yxsnfxiebolatzhkhbyi.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (valid)

# ⚠️ Needs setup (only if you use backend scripts)
SUPABASE_SERVICE_KEY=PASTE_YOUR_SUPABASE_SERVICE_KEY_HERE

# ⚠️ Needs setup (only if you want email alerts)
RESEND_API_KEY=PASTE_YOUR_RESEND_API_KEY_HERE

# ❌ Not needed - ignore or remove
GEMINI_API_KEY=PASTE_YOUR_NEW_GEMINI_KEY_HERE
HERE_API_KEY=PASTE_YOUR_NEW_HERE_MAPS_KEY_HERE
OPENROUTE_API_KEY=PASTE_YOUR_NEW_OPENROUTE_KEY_HERE
```

---

## 🎯 **TL;DR - What Should I Do?**

### **If you just want the website to work:**
✅ **Do nothing - it already works!**

### **If you want to run backend scripts:**
1. Get Supabase Service Key from dashboard
2. Paste into `.env` file
3. Optionally get Resend key if you want emails

### **What about the other keys?**
❌ **Ignore them - not needed anymore**

---

## ❓ **FAQ**

**Q: Why doesn't the website need API keys?**
A: It uses free APIs (Nominatim, OSRM) and a public Supabase ANON key.

**Q: Is the Supabase ANON key safe in the frontend?**
A: Yes! It's designed to be public. Row Level Security (RLS) policies protect the data.

**Q: Do I need Google Gemini or HERE Maps keys?**
A: No! Those were removed. The app doesn't use them anymore.

**Q: When do I need the Supabase Service Key?**
A: Only for backend admin tasks like importing temple data or database maintenance.

**Q: Can I delete the unused key placeholders from .env?**
A: Yes! You can delete GEMINI_API_KEY, HERE_API_KEY, and OPENROUTE_API_KEY lines.

---

## 📞 **Need Help?**

If you're still unsure what you need:

1. **For website only:** Nothing to do!
2. **For backend development:** Get Supabase Service Key
3. **For email alerts:** Get Resend API Key

**That's it!**
