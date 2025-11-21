/**
 * BhaktiMap Backend API Server
 * Handles peyarchi calculations and alert notifications
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');

const ProkerolaService = require('../services/prokerala');
const EmailService = require('../services/email');

// Initialize services
const prokerola = new ProkerolaService(
  process.env.PROKERALA_CLIENT_ID,
  process.env.PROKERALA_CLIENT_SECRET
);

const emailService = new EmailService(process.env.RESEND_API_KEY);

// Initialize database
const db = new Database(process.env.DB_PATH || './database/bhaktimap.db');
db.pragma('foreign_keys = ON');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for reverse proxies
app.set('trust proxy', 1);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*'
}));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// ========================================
// API Routes
// ========================================

/**
 * POST /api/subscribe
 * Submit birth details and subscribe to alerts
 */
app.post('/api/subscribe', async (req, res) => {
  try {
    const {
      email,
      name,
      dateOfBirth,
      timeOfBirth,
      placeOfBirth,
      latitude,
      longitude,
      timezone
    } = req.body;

    // Validation
    if (!email || !dateOfBirth || !timeOfBirth || !latitude || !longitude) {
      return res.status(400).json({
        error: 'Missing required fields'
      });
    }

    // Check if email already exists
    const existing = db.prepare('SELECT id FROM subscribers WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({
        error: 'Email already registered',
        subscriberId: existing.id
      });
    }

    // Calculate birth chart using Prokerala
    console.log(`📊 Calculating birth chart for ${email}...`);
    const birthChart = await prokerola.getBirthChart(
      dateOfBirth,
      timeOfBirth,
      latitude,
      longitude
    );

    // Create subscriber
    const subscriberId = uuidv4();
    const unsubscribeToken = uuidv4();

    const stmt = db.prepare(`
      INSERT INTO subscribers (
        id, email, name, date_of_birth, time_of_birth, place_of_birth,
        latitude, longitude, timezone,
        nakshatra, nakshatra_pada, nakshatra_lord,
        rashi, rashi_lord, lagna, lagna_lord,
        unsubscribe_token, last_calculated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    stmt.run(
      subscriberId, email, name, dateOfBirth, timeOfBirth, placeOfBirth,
      latitude, longitude, timezone,
      birthChart.nakshatra, birthChart.nakshatra_pada, birthChart.nakshatra_lord,
      birthChart.rashi, birthChart.rashi_lord, birthChart.lagna, birthChart.lagna_lord,
      unsubscribeToken
    );

    // Calculate current peyarchi
    const peyarchiEffects = prokerola.calculatePeyarchiManually(birthChart.rashi);

    // Store peyarchi status
    for (const [planet, data] of Object.entries(peyarchiEffects)) {
      const peyarchiStmt = db.prepare(`
        INSERT INTO peyarchi_status (
          id, subscriber_id, planet, to_rashi, effect, effect_score,
          effect_description, start_date, end_date, is_current
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `);

      peyarchiStmt.run(
        uuidv4(),
        subscriberId,
        planet,
        data.rashi,
        data.effect.effect,
        data.effect_score,
        data.effect.desc,
        data.start,
        data.end
      );
    }

    // Send welcome email
    const subscriber = {
      email,
      name,
      nakshatra: birthChart.nakshatra,
      rashi: birthChart.rashi,
      lagna: birthChart.lagna,
      place_of_birth: placeOfBirth,
      unsubscribe_token: unsubscribeToken
    };

    await emailService.sendWelcomeEmail(subscriber);

    // Return response
    res.json({
      success: true,
      subscriberId,
      birthChart: {
        nakshatra: birthChart.nakshatra,
        nakshatra_pada: birthChart.nakshatra_pada,
        rashi: birthChart.rashi,
        lagna: birthChart.lagna
      },
      currentPeyarchi: peyarchiEffects
    });

  } catch (error) {
    console.error('❌ Subscribe error:', error);
    res.status(500).json({
      error: 'Failed to process subscription',
      message: error.message
    });
  }
});

/**
 * GET /api/peyarchi/:subscriberId
 * Get current peyarchi status for subscriber
 */
app.get('/api/peyarchi/:subscriberId', (req, res) => {
  try {
    const { subscriberId } = req.params;

    // Get subscriber
    const subscriber = db.prepare('SELECT * FROM subscribers WHERE id = ?').get(subscriberId);
    if (!subscriber) {
      return res.status(404).json({ error: 'Subscriber not found' });
    }

    // Get current peyarchi
    const peyarchi = db.prepare(`
      SELECT * FROM peyarchi_status
      WHERE subscriber_id = ? AND is_current = 1
      ORDER BY planet
    `).all(subscriberId);

    res.json({
      subscriber: {
        email: subscriber.email,
        name: subscriber.name,
        nakshatra: subscriber.nakshatra,
        rashi: subscriber.rashi,
        lagna: subscriber.lagna
      },
      peyarchi
    });

  } catch (error) {
    console.error('❌ Get peyarchi error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/temples/recommended/:subscriberId
 * Get recommended temples based on peyarchi
 */
app.get('/api/temples/recommended/:subscriberId', (req, res) => {
  try {
    const { subscriberId } = req.params;

    // Get unfavorable/critical peyarchi
    const badPeyarchi = db.prepare(`
      SELECT planet, effect FROM peyarchi_status
      WHERE subscriber_id = ? AND is_current = 1
      AND effect IN ('unfavorable', 'critical')
    `).all(subscriberId);

    const navagrahaTemples = {
      Sani: 'Thirunallar',
      Guru: 'Alangudi',
      Rahu: 'Thirunageswaram',
      Ketu: 'Keezhaperumpallam'
    };

    const recommendations = badPeyarchi.map(p => ({
      planet: p.planet,
      temple: navagrahaTemples[p.planet],
      reason: `${p.planet} ${p.effect} - pariharam needed`,
      priority: p.effect === 'critical' ? 1 : 2
    }));

    res.json({ recommendations });

  } catch (error) {
    console.error('❌ Get temples error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/unsubscribe
 * Unsubscribe from alerts
 */
app.post('/api/unsubscribe', (req, res) => {
  try {
    const { token } = req.body;

    const result = db.prepare(`
      UPDATE subscribers SET send_alerts = 0
      WHERE unsubscribe_token = ?
    `).run(token);

    if (result.changes > 0) {
      res.json({ success: true, message: 'Unsubscribed successfully' });
    } else {
      res.status(404).json({ error: 'Invalid unsubscribe token' });
    }

  } catch (error) {
    console.error('❌ Unsubscribe error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: db.open ? 'connected' : 'disconnected'
  });
});

/**
 * GET /api/test/prokerala
 * Test Prokerala API connection
 */
app.get('/api/test/prokerala', async (req, res) => {
  try {
    const token = await prokerola.getAccessToken();
    res.json({
      success: true,
      message: 'Prokerala API connected',
      hasToken: !!token
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/test/email
 * Test email service
 */
app.get('/api/test/email', async (req, res) => {
  try {
    const testResult = {
      success: true,
      message: 'Email service configured',
      hasApiKey: !!process.env.RESEND_API_KEY
    };
    res.json(testResult);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/test/env
 * Check environment variables (without exposing secrets)
 */
app.get('/api/test/env', (req, res) => {
  res.json({
    hasProkerolaCreds: !!(process.env.PROKERALA_CLIENT_ID && process.env.PROKERALA_CLIENT_SECRET),
    hasResendKey: !!process.env.RESEND_API_KEY,
    nodeEnv: process.env.NODE_ENV,
    frontendUrl: process.env.FRONTEND_URL,
    dbPath: process.env.DB_PATH || './database/bhaktimap.db'
  });
});

// ========================================
// Start Server
// ========================================

app.listen(PORT, () => {
  console.log('🚀 BhaktiMap API Server started');
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 Frontend: ${process.env.FRONTEND_URL}`);
  console.log(`💾 Database: ${process.env.DB_PATH}`);
  console.log('\n✅ Ready to accept requests!');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  db.close();
  process.exit(0);
});

module.exports = app;
