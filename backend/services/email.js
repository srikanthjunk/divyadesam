/**
 * Email Service using Resend
 * Sends peyarchi alerts and notifications
 */

const axios = require('axios');

class EmailService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.resend.com';
    this.fromEmail = 'BhaktiMap <alerts@bhaktimap.com>';
  }

  /**
   * Send email via Resend API
   */
  async sendEmail({ to, subject, html }) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/emails`,
        {
          from: this.fromEmail,
          to: [to],
          subject,
          html
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`✅ Email sent to ${to}: ${response.data.id}`);
      return { success: true, id: response.data.id };
    } catch (error) {
      console.error('❌ Email send failed:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send peyarchi alert email
   */
  async sendPeyarchiAlert(subscriber, peyarchiData) {
    const subject = `🔔 ${peyarchiData.planet} Peyarchi Alert - BhaktiMap`;

    const html = this.generatePeyarchiAlertHTML(subscriber, peyarchiData);

    return this.sendEmail({
      to: subscriber.email,
      subject,
      html
    });
  }

  /**
   * Send upcoming peyarchi notification
   */
  async sendUpcomingPeyarchi(subscriber, peyarchiData) {
    const daysUntil = Math.ceil(
      (new Date(peyarchiData.start_date) - new Date()) / (1000 * 60 * 60 * 24)
    );

    const subject = `⚠️ ${peyarchiData.planet} Peyarchi in ${daysUntil} days - BhaktiMap`;

    const html = this.generateUpcomingPeyarchiHTML(subscriber, peyarchiData, daysUntil);

    return this.sendEmail({
      to: subscriber.email,
      subject,
      html
    });
  }

  /**
   * Send welcome email with birth chart details
   */
  async sendWelcomeEmail(subscriber) {
    const subject = `🕉️ Welcome to BhaktiMap - Your Birth Chart Details`;

    const html = this.generateWelcomeHTML(subscriber);

    return this.sendEmail({
      to: subscriber.email,
      subject,
      html
    });
  }

  /**
   * Generate HTML for peyarchi alert
   */
  generatePeyarchiAlertHTML(subscriber, peyarchi) {
    const effectColor = {
      favorable: '#10b981',
      neutral: '#f59e0b',
      unfavorable: '#ef4444',
      critical: '#dc2626'
    }[peyarchi.effect] || '#6b7280';

    const remedies = JSON.parse(peyarchi.remedies || '[]');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
    .alert-box { background: white; border-left: 4px solid ${effectColor}; padding: 20px; margin: 20px 0; border-radius: 5px; }
    .temple-card { background: white; padding: 15px; margin: 10px 0; border-radius: 5px; border: 1px solid #e5e7eb; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 0.9em; }
    ul { padding-left: 20px; }
    li { margin: 8px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🕉️ BhaktiMap</h1>
    <p>Peyarchi Alert Notification</p>
  </div>

  <div class="content">
    <p>Namaste ${subscriber.name || 'Devotee'},</p>

    <div class="alert-box">
      <h2 style="margin-top: 0; color: ${effectColor};">
        ${peyarchi.planet} Peyarchi: ${peyarchi.effect.toUpperCase()}
      </h2>
      <p><strong>Transit:</strong> ${peyarchi.from_rashi || 'Previous'} → ${peyarchi.to_rashi}</p>
      <p><strong>Period:</strong> ${new Date(peyarchi.start_date).toLocaleDateString('en-IN')} to ${new Date(peyarchi.end_date).toLocaleDateString('en-IN')}</p>
      <p><strong>Your Birth Star:</strong> ${subscriber.nakshatra}</p>
      <p><strong>Your Rashi:</strong> ${subscriber.rashi}</p>
    </div>

    <h3>Effect Description:</h3>
    <p>${peyarchi.effect_description}</p>

    ${remedies.length > 0 ? `
      <h3>🙏 Recommended Pariharams:</h3>
      <ul>
        ${remedies.map(remedy => `<li>${remedy}</li>`).join('')}
      </ul>
    ` : ''}

    <div class="temple-card">
      <h3 style="margin-top: 0;">📍 Recommended Temple Visit</h3>
      <p>Visit the nearest Navagraha temple for ${peyarchi.planet}:</p>
      <p><strong>${this.getNavagrahaTemple(peyarchi.planet)}</strong></p>
      <a href="https://bhaktimap.com?planet=${peyarchi.planet}" class="button">Find Temple Near You</a>
    </div>

    <p>May the divine bless you with peace and prosperity.</p>

    <p style="margin-top: 30px;">
      <small>
        <a href="https://bhaktimap.com/unsubscribe?token=${subscriber.unsubscribe_token}" style="color: #6b7280;">Unsubscribe from alerts</a>
      </small>
    </p>
  </div>

  <div class="footer">
    <p>© 2024 BhaktiMap | In memory of Kokila & RP Sarathy</p>
    <p><a href="https://bhaktimap.com" style="color: #667eea;">bhaktimap.com</a></p>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Generate HTML for upcoming peyarchi notification
   */
  generateUpcomingPeyarchiHTML(subscriber, peyarchi, daysUntil) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
    .warning-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 5px; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>⚠️ Upcoming Peyarchi Alert</h1>
  </div>

  <div class="content">
    <p>Namaste ${subscriber.name || 'Devotee'},</p>

    <div class="warning-box">
      <h2 style="margin-top: 0;">
        ${peyarchi.planet} Peyarchi in ${daysUntil} days
      </h2>
      <p><strong>Starting Date:</strong> ${new Date(peyarchi.start_date).toLocaleDateString('en-IN')}</p>
      <p><strong>Transit to:</strong> ${peyarchi.to_rashi}</p>
      <p><strong>Expected Effect:</strong> ${peyarchi.effect}</p>
    </div>

    <h3>Prepare with Pariharams:</h3>
    <p>It's recommended to perform pariharams before the peyarchi begins for best results.</p>

    <p><strong>Recommended Temple:</strong> ${this.getNavagrahaTemple(peyarchi.planet)}</p>

    <a href="https://bhaktimap.com" class="button">Plan Your Temple Visit</a>

    <p style="margin-top: 30px;">
      <small><a href="https://bhaktimap.com/unsubscribe?token=${subscriber.unsubscribe_token}">Unsubscribe</a></small>
    </p>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Generate welcome email HTML
   */
  generateWelcomeHTML(subscriber) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
    .info-card { background: white; padding: 20px; margin: 15px 0; border-radius: 5px; border: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🕉️ Welcome to BhaktiMap!</h1>
  </div>

  <div class="content">
    <p>Namaste ${subscriber.name || 'Devotee'},</p>

    <p>Thank you for subscribing to BhaktiMap's Peyarchi alerts! We'll notify you about important planetary transits based on your birth details.</p>

    <div class="info-card">
      <h3>Your Birth Details:</h3>
      <p><strong>Birth Star (Nakshatra):</strong> ${subscriber.nakshatra}</p>
      <p><strong>Moon Sign (Rashi):</strong> ${subscriber.rashi}</p>
      <p><strong>Ascendant (Lagna):</strong> ${subscriber.lagna}</p>
      <p><strong>Birth Place:</strong> ${subscriber.place_of_birth}</p>
    </div>

    <h3>What to Expect:</h3>
    <ul>
      <li>Alerts about major peyarchi (Sani, Guru, Rahu, Ketu)</li>
      <li>Personalized temple recommendations</li>
      <li>Remedy suggestions (pariharams)</li>
      <li>Updates ${subscriber.alert_frequency || 'monthly'}</li>
    </ul>

    <p>May your spiritual journey be blessed!</p>

    <p style="margin-top: 30px;">
      <small><a href="https://bhaktimap.com/unsubscribe?token=${subscriber.unsubscribe_token}">Unsubscribe</a></small>
    </p>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Get Navagraha temple name for planet
   */
  getNavagrahaTemple(planet) {
    const temples = {
      'Sani': 'Thirunallar Temple (Saturn)',
      'Guru': 'Alangudi Temple (Jupiter)',
      'Rahu': 'Thirunageswaram Temple (Rahu)',
      'Ketu': 'Keezhaperumpallam Temple (Ketu)',
      'Surya': 'Suryanar Kovil (Sun)',
      'Chandra': 'Thingalur Temple (Moon)',
      'Sevvai': 'Vaitheeswaran Koil (Mars)',
      'Budha': 'Thiruvenkadu Temple (Mercury)',
      'Shukra': 'Kanjanur Temple (Venus)'
    };

    return temples[planet] || 'Navagraha Temple';
  }
}

module.exports = EmailService;
