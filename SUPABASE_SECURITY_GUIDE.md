# 🔐 Supabase Security Guide - Divya Desam Project

**Date**: 2025-10-09
**Status**: ✅ Security measures implemented
**Priority**: 🔴 Must apply after revoking exposed keys

---

## 📋 Overview

This guide helps you secure your Supabase database after the API key exposure incident. By implementing Row Level Security (RLS), you create a defense-in-depth strategy that protects your data even if API keys are compromised.

---

## 🎯 Security Strategy

### **Two-Key System**

Your Supabase project has two types of API keys:

#### 1️⃣ **Anon Key** (Public Key) ✅ Safe to Expose
```
Location: Supabase Dashboard > Settings > API
Usage: Frontend JavaScript, public websites
Access: Read-only (with proper RLS policies)
Risk if exposed: LOW - Can only read public data
```

#### 2️⃣ **Service Role Key** (Secret Key) 🔒 Must Keep Secret
```
Location: Supabase Dashboard > Settings > API
Usage: Backend scripts, admin operations
Access: Full admin access (bypasses RLS)
Risk if exposed: CRITICAL - Full database access
```

### **The Problem Before**
- You exposed the **Service Role Key** in Git
- This gave anyone full admin access to your database
- No protection if keys were stolen

### **The Solution Now**
- Revoke the old Service Role Key
- Generate a new Service Role Key (keep secret)
- Implement Row Level Security (RLS)
- Use Anon Key in frontend (safe to expose)
- Even if Anon Key is exposed, attackers can only read public data

---

## ⚡ Quick Start - 3 Steps

### Step 1: Revoke Old Keys & Generate New Ones

```
1. Go to: https://supabase.com/dashboard/project/yxsnfxiebolatzhkhbyi/settings/api

2. Find "Service Role Key" section
   - Click "Reset" to generate new key
   - Copy the NEW key

3. Find "Anon Key" section
   - Copy this key (it's safe to use in frontend)

4. Update your local .env file:
```

```bash
cd divyadesam/temple-importer
nano .env  # or your preferred editor
```

```env
# NEW keys after revocation
SUPABASE_URL=https://yxsnfxiebolatzhkhbyi.supabase.co
SUPABASE_SERVICE_KEY=your_NEW_service_key_here
SUPABASE_ANON_KEY=your_anon_key_here  # Add this line
RESEND_API_KEY=re_your_NEW_resend_key_here
ALERTS_FROM="Temple Alerts <alerts@communityforge.info>"
```

### Step 2: Apply Row Level Security

```
1. Go to: https://supabase.com/dashboard/project/yxsnfxiebolatzhkhbyi/sql

2. Click "New Query"

3. Copy the ENTIRE contents of: temple-importer/setup_rls_security.sql

4. Paste into SQL editor

5. Click "Run" to execute

6. Verify: Should see "Success" messages
```

### Step 3: Update Frontend to Use Anon Key

Your frontend code should use the **Anon Key** (safe), not Service Key:

```javascript
// GOOD ✅ - Safe to use in frontend
const supabaseUrl = 'https://yxsnfxiebolatzhkhbyi.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // Anon key
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// BAD ❌ - Never use service key in frontend
const supabaseServiceKey = 'eyJhbGci...'; // Service key - NEVER IN FRONTEND!
```

---

## 🛡️ What RLS Protects

After applying the SQL script, your database will have these protections:

### **Temples Table**
| Action | Anon Key | Service Key |
|--------|----------|-------------|
| Read (SELECT) | ✅ Allowed | ✅ Allowed |
| Insert | ❌ Denied | ✅ Allowed |
| Update | ❌ Denied | ✅ Allowed |
| Delete | ❌ Denied | ✅ Allowed |

### **Alert Events Table**
| Action | Anon Key | Service Key |
|--------|----------|-------------|
| Read (SELECT) | ✅ Allowed | ✅ Allowed |
| Insert | ❌ Denied | ✅ Allowed |
| Update | ❌ Denied | ✅ Allowed |
| Delete | ❌ Denied | ✅ Allowed |

### **Subscriptions Table** (Most Sensitive)
| Action | Anon Key | Service Key |
|--------|----------|-------------|
| Read (SELECT) | ❌ Denied | ✅ Allowed |
| Insert | ❌ Denied | ✅ Allowed |
| Update | ❌ Denied | ✅ Allowed |
| Delete | ❌ Denied | ✅ Allowed |

### **Trails & Trail Temples**
| Action | Anon Key | Service Key |
|--------|----------|-------------|
| Read (SELECT) | ✅ Allowed | ✅ Allowed |
| Insert | ❌ Denied | ✅ Allowed |
| Update | ❌ Denied | ✅ Allowed |
| Delete | ❌ Denied | ✅ Allowed |

---

## 🔍 Testing Your Security

After applying RLS, test that it works:

### Test 1: Read Access (Should Work with Anon Key)
```javascript
// Using Anon Key in frontend
const { data, error } = await supabase
  .from('temples')
  .select('*')
  .limit(5);

console.log(data); // ✅ Should return temple data
```

### Test 2: Write Access (Should Fail with Anon Key)
```javascript
// Using Anon Key in frontend
const { data, error } = await supabase
  .from('temples')
  .insert({ name: 'test', display_name: 'Test Temple' });

console.log(error); // ❌ Should return permission error
```

### Test 3: Admin Access (Should Work with Service Key)
```javascript
// Using Service Key in backend script
const { data, error } = await supabase
  .from('temples')
  .insert({ name: 'test', display_name: 'Test Temple' });

console.log(data); // ✅ Should successfully insert
```

---

## 📦 Updated Project Structure

### **Backend Scripts** (Use Service Key)
```
temple-importer/
├── .env (contains SERVICE_ROLE_KEY - keep secret!)
├── import_divyadesam.mjs
├── gemini_comprehensive_enricher.mjs
├── seed_alert_events.mjs
├── send_upcoming_alerts.mjs
└── All other .mjs files
```

These scripts need full admin access, so they use the Service Role Key.

### **Frontend Code** (Use Anon Key)
```
divya-desam-locator.html
└── Supabase client initialized with ANON KEY
```

This is publicly accessible, so it should ONLY use the Anon Key.

---

## 🔄 Migration Guide for Existing Code

### Before (Insecure):
```javascript
// Old insecure approach - service key in frontend
const SUPABASE_KEY = 'eyJhbGciOiJI...[service_key]'; // ❌ Bad!
```

### After (Secure):
```javascript
// New secure approach - anon key in frontend
const SUPABASE_ANON_KEY = 'eyJhbGciOiJI...[anon_key]'; // ✅ Good!
```

### Update Frontend Files

Find and replace in your HTML/JS files:

```bash
# Check which files use Supabase
cd divyadesam
grep -r "supabase" --include="*.html" --include="*.js"
```

Update each file to use Anon Key instead of Service Key.

---

## 🚨 Emergency Response Plan

If your Service Key is exposed again in the future:

### Immediate Actions (Within 1 hour):
1. ✅ Go to Supabase Dashboard
2. ✅ Reset Service Role Key
3. ✅ Update local .env file
4. ✅ Restart any running backend services

### Why This is Better Now:
- ❌ **Before**: Exposed key = Full database access forever
- ✅ **After**: Exposed anon key = Only read public data (limited damage)
- ✅ **After**: RLS protects data even if service key exposed temporarily

---

## 📊 Security Checklist

Complete this after revoking keys:

### Initial Setup
- [ ] Revoked old Supabase Service Key
- [ ] Generated NEW Service Key
- [ ] Copied Anon Key from dashboard
- [ ] Updated temple-importer/.env with NEW keys
- [ ] Verified .env is in .gitignore
- [ ] Applied RLS SQL script in Supabase SQL Editor

### Testing
- [ ] Tested read access with Anon Key (should work)
- [ ] Tested write access with Anon Key (should fail)
- [ ] Tested admin operations with Service Key (should work)
- [ ] Verified subscriptions table is protected

### Code Updates
- [ ] Updated frontend to use Anon Key
- [ ] Verified backend scripts use Service Key
- [ ] Removed any hardcoded keys from code
- [ ] Documented which key to use where

### Monitoring
- [ ] Enabled 2FA on Supabase account
- [ ] Set up email alerts for unusual activity
- [ ] Bookmarked Supabase logs page
- [ ] Scheduled monthly security review

---

## 🔐 Additional Security Measures

### Enable 2FA on Supabase
```
1. Go to: https://app.supabase.com/account/security
2. Enable Two-Factor Authentication
3. Use authenticator app (Google Authenticator, Authy)
```

### Set Up Usage Alerts
```
1. Go to Supabase Dashboard > Settings > Billing
2. Set up email alerts for:
   - High API usage
   - Storage limits
   - Bandwidth alerts
```

### Regular Security Audits
Schedule quarterly checks:
- Review API logs for suspicious activity
- Rotate Service Key every 90 days
- Check RLS policies are still active
- Verify no new .env files in Git

---

## 📚 Resources

### Supabase Documentation
- **RLS Guide**: https://supabase.com/docs/guides/auth/row-level-security
- **API Keys**: https://supabase.com/docs/guides/api/api-keys
- **Security Best Practices**: https://supabase.com/docs/guides/platform/security

### Testing Tools
- **Supabase SQL Editor**: https://supabase.com/dashboard/project/yxsnfxiebolatzhkhbyi/sql
- **API Logs**: https://supabase.com/dashboard/project/yxsnfxiebolatzhkhbyi/logs
- **Table Editor**: https://supabase.com/dashboard/project/yxsnfxiebolatzhkhbyi/editor

---

## ❓ Common Questions

### Q: Can I use the Anon Key in my HTML file?
**A**: Yes! That's exactly what it's designed for. It's safe to expose in frontend code.

### Q: Will my backend scripts still work after applying RLS?
**A**: Yes! Backend scripts using the Service Key have full access and bypass RLS.

### Q: What if someone steals my Anon Key?
**A**: No problem! With RLS enabled, they can only read public temple data. They cannot:
- Modify temples
- Delete data
- Access subscriptions (email addresses)
- Run admin operations

### Q: Do I need to change my backend scripts?
**A**: No! Your .mjs scripts already use the Service Key from .env, which is correct. Just update .env with the NEW key.

### Q: How do I know RLS is working?
**A**: Run the verification query in Supabase SQL Editor:
```sql
SELECT * FROM check_rls_status();
```
All tables should show `rls_enabled = true`.

---

## ✅ Success Criteria

Your Supabase database is properly secured when:

1. ✅ Old Service Key has been revoked
2. ✅ New Service Key is in .env (not in Git)
3. ✅ RLS is enabled on all tables
4. ✅ Anon Key is used in frontend
5. ✅ Service Key is used only in backend scripts
6. ✅ Write operations fail when using Anon Key
7. ✅ Read operations work with Anon Key
8. ✅ 2FA is enabled on Supabase account

---

## 🎯 Summary

### What We Did:
1. ✅ Created comprehensive RLS policies
2. ✅ Separated Anon Key (public) from Service Key (secret)
3. ✅ Protected sensitive data (subscriptions)
4. ✅ Allowed public read access to temple data
5. ✅ Created security audit functions

### What You Need to Do:
1. 🔴 Revoke old Supabase Service Key
2. 🔴 Generate new Service Key
3. 🔴 Update .env with NEW keys
4. 🔴 Run setup_rls_security.sql in Supabase
5. 🔴 Test RLS is working
6. 🔴 Enable 2FA on Supabase account

### Result:
- 🛡️ Defense-in-depth security
- 🔒 Protected sensitive data
- 🌐 Public temple data still accessible
- ✅ Easy to maintain and monitor

---

**Next Steps**: Follow the "Quick Start - 3 Steps" section at the top of this document.

---

*Generated: 2025-10-09*
*Security Level: ✅ HIGH (after applying RLS)*
*Risk Level: 🟢 LOW (after key revocation + RLS)*
