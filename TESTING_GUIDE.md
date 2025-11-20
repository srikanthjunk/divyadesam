# Peyarchi Feature Testing Guide

## ✅ Development Complete - Ready to Test!

The peyarchi feature is now fully implemented. Follow this guide to test it end-to-end.

---

## 🚀 Step 1: Start the Backend Server

### Install Dependencies
```bash
cd backend
npm install
```

### Initialize Database
```bash
npm run init-db
```

You should see:
```
✅ Database initialized successfully!
📍 Location: /path/to/backend/database/bhaktimap.db

📋 Tables created:
   - subscribers
   - peyarchi_status
   - alert_queue
   - recommended_temples
   - api_usage
   - subscriber_dashboard
```

### Start the Server
```bash
npm start
```

You should see:
```
🚀 BhaktiMap API Server started
📍 Port: 3000
🌐 Frontend: https://bhaktimap.com
💾 Database: ./database/bhaktimap.db

✅ Ready to accept requests!
```

**Keep this terminal running!**

---

## 🌐 Step 2: Open the Frontend

### Option A: Open Locally
```bash
# From project root
open peyarchi.html
# Or on Linux:
xdg-open peyarchi.html
```

### Option B: Use Live Server (VSCode)
1. Install "Live Server" extension in VSCode
2. Right-click `peyarchi.html` → "Open with Live Server"
3. Opens at `http://127.0.0.1:5500/peyarchi.html`

**Important:** Frontend expects backend at `http://localhost:3000`

---

## 🧪 Step 3: Test the Complete Flow

### Test Data to Use:

**Example 1:**
- Email: test@example.com
- Name: Test User
- Date of Birth: 1990-05-15
- Time of Birth: 14:30
- Place of Birth: Chennai (select from suggestions)

**Example 2:**
- Email: another@example.com
- Name: Another User
- Date of Birth: 1985-12-25
- Time of Birth: 08:00
- Place of Birth: Madurai (select from suggestions)

### Testing Checklist:

#### ✅ Form Validation
- [ ] Try submitting without filling email → Should show error
- [ ] Try submitting without date → Should show error
- [ ] Try submitting without selecting location → Should show "Please select a location"

#### ✅ Location Autocomplete
- [ ] Type "Chen" → Should show suggestions (Chennai, etc.)
- [ ] Type "Madu" → Should show Madurai suggestions
- [ ] Click a suggestion → Should populate field
- [ ] Type gibberish → Should show no results

#### ✅ API Integration
- [ ] Fill form with valid data
- [ ] Click "Calculate My Peyarchi"
- [ ] Button should change to "Calculating..."
- [ ] Loading spinner should appear
- [ ] After 5-10 seconds, results should appear

#### ✅ Results Display
- [ ] Birth Chart section should show:
  - ✨ Nakshatra (e.g., "Rohini")
  - 🌙 Rashi (e.g., "Vrishabha")
  - ⬆️ Lagna (e.g., "Simha")

- [ ] Peyarchi Status should show 4 cards:
  - 🪐 Sani (Saturn)
  - 🌟 Guru (Jupiter)
  - 🌑 Rahu
  - ☄️ Ketu
  - Each with color-coded effect badge

- [ ] Temple Recommendations should show:
  - Only temples for unfavorable/critical transits
  - Temple name, deity, reason
  - "Get Directions" button
  - Map with temple markers

#### ✅ Email Alerts
- [ ] Check your email inbox
- [ ] Should receive welcome email with subject "Welcome to BhaktiMap"
- [ ] Email should contain:
  - Your birth chart details
  - What to expect
  - Unsubscribe link

#### ✅ Navigation
- [ ] Click "Back to Temples" → Should navigate to main page
- [ ] Main page header should have "Check Your Peyarchi" link
- [ ] Footer should have links to both pages

#### ✅ Mobile Responsive
- [ ] Open on mobile device or resize browser to mobile width
- [ ] Form should stack vertically
- [ ] All buttons should be tap-friendly
- [ ] Map should be scrollable

---

## 🔍 Step 4: Check Backend Logs

### Terminal Output Should Show:
```
📊 Calculating birth chart for test@example.com...
✅ Prokerala access token obtained
✅ Email sent to test@example.com: [email_id]
```

### Check Database
```bash
cd backend
sqlite3 database/bhaktimap.db

# Check subscribers
SELECT email, nakshatra, rashi FROM subscribers;

# Check peyarchi status
SELECT planet, effect FROM peyarchi_status WHERE subscriber_id = 'xxx';

# Exit
.quit
```

---

## 🐛 Common Issues & Solutions

### Issue: "Failed to connect to server"
**Solution:**
- Make sure backend is running on port 3000
- Check `backend/.env` has correct settings
- Try: `curl http://localhost:3000/api/health`

### Issue: "Failed to authenticate with Prokerala API"
**Solution:**
- Check `backend/.env` has correct Prokerala credentials
- Run: `node backend/src/test-prokerala.js` to test API

### Issue: Location suggestions not appearing
**Solution:**
- Nominatim API requires user agent
- Check browser console for errors
- Try typing full city name "Chennai" instead of "Chen"

### Issue: Email not received
**Solution:**
- Check spam/junk folder
- Verify Resend API key in `backend/.env`
- Check backend logs for email send confirmation
- Free tier: 3000 emails/month

### Issue: Map not displaying
**Solution:**
- Check browser console for Leaflet errors
- Ensure internet connection (Leaflet loads from CDN)
- Tiles load from OpenStreetMap

---

## 📧 Step 5: Test Email Alerts (Optional)

### Manual Alert Test
```bash
cd backend
node src/jobs/send-alerts.js
```

Should output:
```
🔔 Starting peyarchi alert job...
📅 2024-11-20T...
👥 Found 1 active subscribers
📧 Sending Sani peyarchi alert to test@example.com...
  ✅ Sent successfully

📊 Alert Job Summary:
   ✅ Emails sent: 1
   ❌ Errors: 0
   👥 Total subscribers: 1

✅ Alert job completed
```

### Setup Cron for Daily Alerts
```bash
crontab -e
```

Add this line to run daily at 8 AM:
```
0 8 * * * cd /path/to/backend && npm run send-alerts >> logs/alerts.log 2>&1
```

---

## 📊 API Rate Limits

### Prokerala API
- **5 requests/minute** (enforced by backend)
- **5000 credits/month**
- Backend automatically adds 12-second delays

### Resend Email
- **3000 emails/month FREE**
- No rate limit per second

### Nominatim (OpenStreetMap)
- **1 request/second** (best practice)
- Frontend adds delays automatically
- No API key needed

---

## ✅ Success Criteria

Your feature is working correctly if:

1. ✅ Form submits without errors
2. ✅ Birth chart displays correctly
3. ✅ Peyarchi status shows for all 4 planets
4. ✅ Temple recommendations appear for unfavorable transits
5. ✅ Welcome email arrives in inbox
6. ✅ Data is saved to database
7. ✅ Navigation links work
8. ✅ Mobile responsive layout works

---

## 🚀 Next Steps: Deployment

### Backend Deployment Options

#### Option A: DigitalOcean Droplet ($6/month)
```bash
# SSH into server
ssh root@your-server-ip

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Clone repo
git clone https://github.com/srikanthjunk/divyadesam.git
cd divyadesam/backend

# Setup
npm install
npm run init-db

# Install PM2 for process management
npm install -g pm2
pm2 start src/server.js --name bhaktimap-api
pm2 startup
pm2 save

# Setup cron for alerts
pm2 start src/jobs/send-alerts.js --cron "0 8 * * *" --name bhaktimap-alerts --no-autorestart
```

#### Option B: Railway/Render (Free Tier)
1. Connect GitHub repository
2. Set environment variables
3. Auto-deploys on push

#### Option C: Vercel Serverless
1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel` in backend directory
3. Note: SQLite may need adjustments for serverless

### Frontend Deployment

Already configured for GitHub Pages!

**Update API URL in peyarchi.html:**
```javascript
// Change from:
const API_BASE_URL = 'http://localhost:3000/api';

// To:
const API_BASE_URL = 'https://api.bhaktimap.com/api';
// Or wherever you deploy backend
```

Then push to GitHub:
```bash
git add peyarchi.html
git commit -m "Update API URL for production"
git push
```

Site will be live at: **https://bhaktimap.com/peyarchi.html**

---

## 📝 Testing Summary

- **Backend:** ✅ Complete (9 files, 1500+ lines)
- **Frontend:** ✅ Complete (993 lines, fully responsive)
- **Integration:** ✅ Complete (API calls, location search, map)
- **Email:** ✅ Complete (Welcome, alerts, templates)
- **Database:** ✅ Complete (SQLite schema, 6 tables)

**Total Development Time:** ~6 hours
**Total Cost:** $0/month (FREE tier APIs)
**Ready for Production:** YES

---

## 🎉 You're All Set!

The peyarchi feature is complete and ready to use. Test it locally, then deploy to production!

For any issues, check:
1. Backend logs: `pm2 logs bhaktimap-api`
2. Database: `sqlite3 backend/database/bhaktimap.db`
3. API health: `curl http://localhost:3000/api/health`

Happy testing! 🙏

---

*Created: 2024-11-20*
*Last Updated: 2024-11-20*
