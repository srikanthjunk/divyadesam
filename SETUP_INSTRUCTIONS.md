# 🚀 Divya Desam Project - Complete Setup Guide

**Date**: 2025-10-09
**Status**: ✅ Ready for setup
**Time Required**: 10-15 minutes

---

## 📋 Prerequisites Checklist

- [x] Git repository cloned
- [x] `.env` file updated with NEW API keys
- [x] Supabase project created (kcuvbgahpghzrazztlmb)
- [x] Resend API key generated
- [x] GitHub secret scanning enabled

---

## 🎯 Step-by-Step Setup

### **Step 1: Set Up Supabase Database** (5 minutes)

1. **Open Supabase SQL Editor**:
   ```
   https://supabase.com/dashboard/project/kcuvbgahpghzrazztlmb/sql
   ```

2. **Click "New Query"**

3. **Copy the entire SQL script**:
   - Open file: `temple-importer/complete_database_setup.sql`
   - Select all (Ctrl+A)
   - Copy (Ctrl+C)

4. **Paste into SQL Editor** and click "Run"

5. **Verify Success**:
   - You should see success messages for each step
   - Check the verification queries at the bottom show:
     - 6 tables created
     - RLS enabled on all tables
     - Multiple policies per table

✅ **Done!** Your database is now set up with Row Level Security.

---

### **Step 2: Import Temple Data** (3 minutes)

1. **Open terminal** in the project directory:
   ```bash
   cd divyadesam/temple-importer
   ```

2. **Verify .env file** has all NEW keys:
   ```bash
   cat .env
   # Should show:
   # - SUPABASE_URL (kcuvbgahpghzrazztlmb)
   # - SUPABASE_SERVICE_KEY (starts with eyJhbGci...)
   # - SUPABASE_ANON_KEY (starts with eyJhbGci...)
   # - RESEND_API_KEY (starts with re_4G2b...)
   ```

3. **Install dependencies** (if needed):
   ```bash
   npm install
   ```

4. **Import all 108 Divya Desam temples**:
   ```bash
   node import_divyadesam.mjs
   ```

5. **Verify import**:
   - Go to: https://supabase.com/dashboard/project/kcuvbgahpghzrazztlmb/editor
   - Click on "temples" table
   - Should see 108 temple records

✅ **Done!** All temple data is now in your database.

---

### **Step 3: Test Security** (2 minutes)

1. **Test public read access** (should work):
   - Go to Supabase SQL Editor
   - Run this query using Anon Key:
   ```sql
   SELECT COUNT(*) FROM temples;
   ```
   - Should return: 108

2. **Test write protection** (should fail):
   - Try to insert with Anon Key:
   ```sql
   INSERT INTO temples (name, display_name)
   VALUES ('test', 'Test Temple');
   ```
   - Should get error: "permission denied" ✅ Good!

3. **Test admin access** (should work with Service Key):
   - Your backend scripts use Service Key
   - They should have full read/write access

✅ **Done!** Row Level Security is working correctly.

---

### **Step 4: Set Up Email Alerts** (Optional - 5 minutes)

If you want to use the email alert system:

1. **Import alert events**:
   ```bash
   cd temple-importer
   node seed_alert_events.mjs
   ```

2. **Test email sending** (dry run):
   ```bash
   node send_upcoming_alerts.mjs --dry-run
   ```

3. **Set up cron job** for automated alerts:
   - Use GitHub Actions, Vercel Cron, or similar
   - Run daily: `node send_upcoming_alerts.mjs`

✅ **Done!** Email alerts are configured.

---

## 🔐 Security Verification Checklist

Complete this checklist to ensure everything is secure:

### API Keys
- [x] Old Resend API key revoked
- [x] Old Supabase Service key revoked (or new project created)
- [x] GitHub PAT revoked
- [x] NEW keys stored in .env file
- [x] .env file in .gitignore (verify: `git check-ignore temple-importer/.env`)
- [x] .env file NOT in git history

### Database Security
- [ ] Row Level Security (RLS) enabled on all tables
- [ ] Public read access works for temples
- [ ] Public write access blocked for temples
- [ ] Admin access works with Service Key
- [ ] Subscribers table is private (no public access)

### Account Security
- [ ] 2FA enabled on GitHub account
- [ ] 2FA enabled on Supabase account
- [ ] 2FA enabled on Resend account
- [ ] Strong passwords on all accounts

### Repository Security
- [ ] GitHub secret scanning enabled
- [ ] Push protection verified (tested when trying to push secrets)
- [ ] .gitignore properly configured
- [ ] No secrets in any committed files

---

## 📊 What's Been Set Up

### **Database Tables**

| Table | Purpose | Public Access |
|-------|---------|---------------|
| `temples` | 108 Divya Desam temples | ✅ Read only |
| `alert_events` | Festival/event notifications | ✅ Read only |
| `subscribers` | Email subscriptions | ❌ Admin only |
| `sent_alerts` | Sent email tracking | ❌ Admin only |
| `trails` | Pilgrimage routes | ✅ Read only |
| `temple_trails` | Trail-temple associations | ✅ Read only |

### **Security Features**

1. **Row Level Security (RLS)** - Enabled on all tables
2. **Public Read Access** - Anyone can view temple data
3. **Protected Writes** - Only admin (Service Key) can modify data
4. **Private Data** - Subscriber emails are completely private
5. **Automatic Timestamps** - All tables track created_at/updated_at

### **Sample Data**

- **5 pilgrimage trails** created:
  - Pancha Ranga Kshetram
  - Nava Tirupati
  - Kanchipuram Circuit
  - Chola Nadu Trail
  - Kerala Divya Desams

---

## 🧪 Testing Your Setup

### Test 1: View Temples (Public)
```bash
# Using Anon Key (safe to expose in frontend)
curl -X GET \
  'https://kcuvbgahpghzrazztlmb.supabase.co/rest/v1/temples?select=*&limit=5' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### Test 2: Try to Modify (Should Fail)
```bash
# Using Anon Key - should be denied
curl -X POST \
  'https://kcuvbgahpghzrazztlmb.supabase.co/rest/v1/temples' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"test","display_name":"Test"}'
```

Expected: `{"code":"42501","message":"new row violates row-level security policy"}`

✅ If you see this error, RLS is working correctly!

---

## 🔧 Troubleshooting

### Problem: Import script fails with "permission denied"
**Solution**: Make sure you're using SUPABASE_SERVICE_KEY, not SUPABASE_ANON_KEY in your .env file for backend scripts.

### Problem: Can't see temples in Supabase Table Editor
**Solution**: RLS is blocking the Table Editor view. Use SQL Editor instead:
```sql
SELECT * FROM temples LIMIT 10;
```

### Problem: "relation temples does not exist"
**Solution**: Run the complete_database_setup.sql script again in Supabase SQL Editor.

### Problem: Git won't let me push (secret detected)
**Solution**: This is GitHub push protection working! Remove the secret from your files before committing.

---

## 📁 Project Structure

```
divyadesam/
├── .gitignore                          # Prevents .env from being committed
├── SETUP_INSTRUCTIONS.md               # This file
├── SECURITY_REMEDIATION.md             # Security incident documentation
├── SUPABASE_SECURITY_GUIDE.md          # Detailed security guide
├── CRITICAL_NEXT_STEPS.md              # Post-incident actions
├── temple-importer/
│   ├── .env                            # SECRET - Never commit!
│   ├── .env.example                    # Safe template
│   ├── complete_database_setup.sql     # Run this in Supabase
│   ├── setup_rls_security.sql          # Security policies (included in above)
│   ├── import_divyadesam.mjs           # Import temple data
│   ├── seed_alert_events.mjs           # Import festival events
│   └── send_upcoming_alerts.mjs        # Send email notifications
└── divya-desam-locator.html            # Frontend application
```

---

## 🎯 Next Steps

After completing setup:

1. **Update frontend** to use NEW Supabase URL and Anon Key
2. **Test the web application** locally
3. **Deploy to production** (Vercel, Netlify, GitHub Pages)
4. **Set up automated backups** in Supabase
5. **Configure custom domain** (optional)
6. **Enable monitoring** in Supabase dashboard

---

## 📞 Support Resources

- **Supabase Docs**: https://supabase.com/docs
- **Supabase Dashboard**: https://supabase.com/dashboard/project/kcuvbgahpghzrazztlmb
- **GitHub Repository**: https://github.com/srikanthjunk/divyadesam
- **Security Guide**: See SUPABASE_SECURITY_GUIDE.md

---

## ✅ Setup Complete!

If you've completed all steps above, your Divya Desam project is now:

- ✅ **Secure**: All API keys updated, RLS enabled
- ✅ **Functional**: Database set up with 108 temples
- ✅ **Protected**: Defense-in-depth security measures
- ✅ **Scalable**: Ready for production use
- ✅ **Maintainable**: Clear documentation and structure

**Congratulations! Your temple locator is ready to use! 🎉**

---

*Generated: 2025-10-09*
*Version: 1.0*
*Project: Divya Desam Temple Locator*
