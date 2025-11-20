/**
 * Scheduled Job: Send Peyarchi Alerts
 * Run this daily (via cron) to send email alerts to subscribers
 *
 * Usage: node src/jobs/send-alerts.js
 */

require('dotenv').config();
const Database = require('better-sqlite3');
const EmailService = require('../../services/email');

const db = new Database(process.env.DB_PATH || './database/bhaktimap.db');
const emailService = new EmailService(process.env.RESEND_API_KEY);

async function sendPeyarchiAlerts() {
  console.log('🔔 Starting peyarchi alert job...');
  console.log(`📅 ${new Date().toISOString()}`);

  try {
    // Get all subscribers who want alerts
    const subscribers = db.prepare(`
      SELECT * FROM subscribers
      WHERE send_alerts = 1
    `).all();

    console.log(`👥 Found ${subscribers.length} active subscribers`);

    let emailsSent = 0;
    let errors = 0;

    for (const subscriber of subscribers) {
      try {
        // Check if enough time has passed since last alert
        const lastAlert = subscriber.last_alert_sent;
        const daysSinceLastAlert = lastAlert
          ? Math.floor((Date.now() - new Date(lastAlert)) / (1000 * 60 * 60 * 24))
          : 999;

        const alertIntervalDays = {
          'daily': 1,
          'weekly': 7,
          'monthly': 30,
          'quarterly': 90,
          'major_only': 180
        }[subscriber.alert_frequency] || 30;

        if (daysSinceLastAlert < alertIntervalDays) {
          console.log(`⏭️  Skipping ${subscriber.email} (last alert ${daysSinceLastAlert} days ago)`);
          continue;
        }

        // Get current unfavorable/critical peyarchi
        const badPeyarchi = db.prepare(`
          SELECT * FROM peyarchi_status
          WHERE subscriber_id = ? AND is_current = 1
          AND effect IN ('unfavorable', 'critical')
          ORDER BY effect_score ASC
          LIMIT 1
        `).get(subscriber.id);

        if (!badPeyarchi) {
          console.log(`✅ No alerts needed for ${subscriber.email}`);
          continue;
        }

        // Parse remedies
        badPeyarchi.remedies = JSON.parse(badPeyarchi.remedies || '[]');

        // Send alert email
        console.log(`📧 Sending ${badPeyarchi.planet} peyarchi alert to ${subscriber.email}...`);

        const result = await emailService.sendPeyarchiAlert(subscriber, badPeyarchi);

        if (result.success) {
          // Update last alert sent
          db.prepare(`
            UPDATE subscribers
            SET last_alert_sent = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(subscriber.id);

          // Log to alert queue
          db.prepare(`
            INSERT INTO alert_queue (
              id, subscriber_id, alert_type, planet, subject,
              html_content, scheduled_date, status, sent_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'sent', CURRENT_TIMESTAMP)
          `).run(
            require('uuid').v4(),
            subscriber.id,
            'peyarchi_current',
            badPeyarchi.planet,
            `${badPeyarchi.planet} Peyarchi Alert`,
            'Email sent',
            new Date().toISOString()
          );

          emailsSent++;
          console.log(`  ✅ Sent successfully`);
        } else {
          errors++;
          console.error(`  ❌ Failed: ${result.error}`);
        }

        // Respectful delay between emails
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        errors++;
        console.error(`❌ Error sending to ${subscriber.email}:`, error.message);
      }
    }

    console.log('\n📊 Alert Job Summary:');
    console.log(`   ✅ Emails sent: ${emailsSent}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   👥 Total subscribers: ${subscribers.length}`);

  } catch (error) {
    console.error('❌ Alert job failed:', error);
  } finally {
    db.close();
  }
}

// Run the job
sendPeyarchiAlerts()
  .then(() => {
    console.log('✅ Alert job completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Alert job failed:', error);
    process.exit(1);
  });
