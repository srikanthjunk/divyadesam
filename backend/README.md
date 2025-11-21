# BhaktiMap Backend API

Backend server for BhaktiMap's Peyarchi (planetary transit) feature with email alerts.

## Features

- ✅ Birth chart calculation using Prokerala API
- ✅ Peyarchi (transit) effect analysis
- ✅ Automated email alerts via Resend
- ✅ SQLite database (no external DB needed)
- ✅ Rate limiting (respects Prokerala's 5/min limit)
- ✅ Scheduled alert jobs

## Tech Stack

- **Node.js** + Express
- **SQLite** (better-sqlite3)
- **Prokerala API** (Vedic astrology calculations)
- **Resend** (email service)

## Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Environment Configuration

The `.env` file is already configured with your API credentials:

```env
PROKERALA_CLIENT_ID=ad98d709-7542-4042-9e07-2a2014f0afb2
PROKERALA_CLIENT_SECRET=HktwWE0fb7xiV8QgOuoiDZGe2YBeDhrwQ3amEyTx
RESEND_API_KEY=re_if2n9KJf_78Sqc6WLWeHaBxZidyCzscAJ
PORT=3000
```

### 3. Initialize Database

```bash
npm run init-db
```

This creates `database/bhaktimap.db` with all required tables.

### 4. Start Server

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

Server will run on `http://localhost:3000`

## API Endpoints

### POST /api/subscribe
Submit birth details and subscribe to alerts.

**Request:**
```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "dateOfBirth": "1990-05-15",
  "timeOfBirth": "14:30",
  "placeOfBirth": "Chennai, India",
  "latitude": 13.0827,
  "longitude": 80.2707,
  "timezone": "Asia/Kolkata"
}
```

**Response:**
```json
{
  "success": true,
  "subscriberId": "uuid",
  "birthChart": {
    "nakshatra": "Rohini",
    "nakshatra_pada": 2,
    "rashi": "Vrishabha",
    "lagna": "Simha"
  },
  "currentPeyarchi": {
    "Sani": {
      "rashi": "Aquarius",
      "effect": "favorable",
      "effect_score": 2
    }
  }
}
```

### GET /api/peyarchi/:subscriberId
Get current peyarchi status.

**Response:**
```json
{
  "subscriber": {
    "email": "user@example.com",
    "nakshatra": "Rohini",
    "rashi": "Vrishabha"
  },
  "peyarchi": [
    {
      "planet": "Sani",
      "to_rashi": "Aquarius",
      "effect": "favorable",
      "effect_description": "Good for courage and siblings",
      "start_date": "2023-01-17",
      "end_date": "2025-03-29"
    }
  ]
}
```

### GET /api/temples/recommended/:subscriberId
Get recommended Navagraha temples based on peyarchi.

### POST /api/unsubscribe
Unsubscribe from alerts using token.

### GET /api/health
Health check endpoint.

## Scheduled Jobs

### Send Daily Alerts

Run this daily via cron to send peyarchi alerts:

```bash
npm run send-alerts
```

**Cron setup (runs daily at 8 AM):**
```bash
crontab -e
```

Add:
```
0 8 * * * cd /path/to/backend && npm run send-alerts >> logs/alerts.log 2>&1
```

## Database Schema

### subscribers
- id (PRIMARY KEY)
- email (UNIQUE)
- name
- date_of_birth, time_of_birth, place_of_birth
- latitude, longitude, timezone
- nakshatra, rashi, lagna (calculated)
- send_alerts (boolean)
- alert_frequency (monthly/quarterly/major_only)
- unsubscribe_token

### peyarchi_status
- subscriber_id
- planet (Sani, Guru, Rahu, Ketu)
- to_rashi
- effect (favorable/neutral/unfavorable/critical)
- effect_score (-3 to +3)
- start_date, end_date
- is_current (boolean)

### alert_queue
- subscriber_id
- alert_type
- planet
- scheduled_date
- status (pending/sent/failed)

## Rate Limiting

Prokerala API limits:
- **5 requests/minute**
- **5000 credits/month**

The backend automatically handles rate limiting with 12-second delays between requests.

## Email Templates

Emails include:
- Welcome email with birth chart details
- Peyarchi alert notifications
- Temple recommendations
- Pariharam (remedy) suggestions
- Unsubscribe link

## Testing

Test Prokerala connection:
```bash
node backend/src/test-prokerala.js
```

## Deployment

### Option 1: VPS (DigitalOcean, AWS)
1. Clone repo
2. Install Node.js 18+
3. Run `npm install`
4. Initialize database
5. Use PM2 for process management:
   ```bash
   npm install -g pm2
   pm2 start src/server.js --name bhaktimap-api
   pm2 startup
   pm2 save
   ```

### Option 2: Vercel (Serverless)
- Deploy API routes as serverless functions
- Note: SQLite needs to use `/tmp` directory

### Option 3: Hetzner VPS
- Cost-effective dedicated server
- Install Node.js and dependencies
- Use PM2 for process management

## Monitoring

Check logs:
```bash
pm2 logs bhaktimap-api
```

Database stats:
```bash
sqlite3 database/bhaktimap.db "SELECT COUNT(*) FROM subscribers;"
```

API health:
```bash
curl http://localhost:3000/api/health
```

## Security Notes

- ✅ `.env` file is gitignored
- ✅ API credentials never exposed to frontend
- ✅ Rate limiting enabled
- ✅ CORS configured for frontend domain
- ✅ Input validation on all endpoints

## Support

For issues or questions, contact: srikanthjunk@gmail.com

---

**Last Updated:** 2024-11-20
