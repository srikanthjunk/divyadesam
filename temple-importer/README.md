# Temple Importer - Complete Setup Guide

## 🎯 Current Status: FULLY FUNCTIONAL

### 📊 Database Summary
- ✅ **137 temples** total (108 Divya Desam + 29 Abhimana)
- ✅ **67 temples** with Wikidata QIDs (49% coverage)
- ✅ **7 traditions** configured
- ✅ **8 deities** mapped
- ✅ **Alert system** operational
- 🔧 **Paadal Petra import** in progress

## 🚀 Available Scripts

### Core Import Scripts
```bash
# Import Paadal Petra Sthalams (276 Shiva temples)
node import_paadal_petra.mjs

# Fix missing Wikidata QIDs
node retry_missing_qids.mjs

# Add multilingual names (requires manual SQL first)
node add_multilingual_support.mjs
```

### Database Setup
```bash
# Test all functionality
node test_all_functionality.mjs

# Verify database integrity  
node final_verification.mjs

# Setup database schema
node run_all_setup.mjs
```

### Email & Alerts
```bash
# Send scheduled alerts
node create_scheduled_alerts.mjs

# Test unsubscribe functionality
node handle_unsubscribe.mjs

# Send test email
node send_test_email.mjs
```

### Trail Management
```bash
# Seed temple trails
node seed_trails.mjs
```

## 📋 Manual SQL Required

Run these in Supabase SQL Editor:

```sql
-- Add multilingual columns
ALTER TABLE temples 
ADD COLUMN IF NOT EXISTS name_ta TEXT,
ADD COLUMN IF NOT EXISTS name_te TEXT,
ADD COLUMN IF NOT EXISTS name_kn TEXT,
ADD COLUMN IF NOT EXISTS name_ml TEXT,
ADD COLUMN IF NOT EXISTS name_hi TEXT;

-- Create trails tables (if not exists)
CREATE TABLE IF NOT EXISTS trails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  total_temples INTEGER DEFAULT 0,
  estimated_duration_days INTEGER,
  difficulty_level TEXT CHECK (difficulty_level IN ('easy', 'moderate', 'difficult', 'extreme')),
  region TEXT,
  state TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS temple_trails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trail_id UUID NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
  temple_id UUID NOT NULL REFERENCES temples(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  is_optional BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trail_id, temple_id),
  UNIQUE(trail_id, position)
);
```

## 📊 Data Format for Additional Imports

### Paadal Petra Sthalams (JSON format)
```json
[
  {
    "name": "Temple Name",
    "alt_names": ["Alternative Name"],
    "locality": "City/Town", 
    "district": "District",
    "state": "State",
    "lat": 12.345,
    "lng": 78.901,
    "deity": "Shiva",
    "primary_deity": "Specific Deity Name",
    "name_ta": "தமிழ் பெயர்"
  }
]
```

Save as `paadal_petra.json` in parent directory.

## 🔧 Environment Setup

Required `.env` file:
```
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
RESEND_API_KEY=your_resend_key
ALERTS_FROM="Temple Alerts <alerts@example.com>"
```

## 📈 Next Steps

1. **Complete Paadal Petra import**: Import remaining batches
2. **Run multilingual enrichment**: Add Tamil/Telugu names
3. **Setup trails**: Seed pilgrimage routes
4. **Schedule alerts**: Setup daily alert sending
5. **Monitor & maintain**: Regular QID updates

## ✅ All Systems Ready!

The temple importer is fully functional with all core features implemented.