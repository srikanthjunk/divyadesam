/**
 * Authentication Routes
 * Handles user signup, login, logout, and password reset
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// JWT secret (should be in .env)
const JWT_SECRET = process.env.JWT_SECRET || 'bhaktimap-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

/**
 * POST /api/auth/signup
 * Create new user account
 */
router.post('/signup', async (req, res) => {
  const { db } = req.app.locals;

  try {
    const { email, password, name, phone } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if email already exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const userId = uuidv4();
    const verificationToken = uuidv4();

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, phone, verification_token)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, email.toLowerCase(), passwordHash, name, phone, verificationToken);

    // Create default family group
    const groupId = uuidv4();
    db.prepare(`
      INSERT INTO family_groups (id, owner_id, name)
      VALUES (?, ?, ?)
    `).run(groupId, userId, name ? `${name}'s Family` : 'My Family');

    // Create default notification preferences
    db.prepare(`
      INSERT INTO notification_preferences (id, user_id)
      VALUES (?, ?)
    `).run(uuidv4(), userId);

    // Generate JWT
    const token = jwt.sign(
      { userId, email: email.toLowerCase() },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    console.log(`✅ New user registered: ${email}`);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token,
      user: {
        id: userId,
        email: email.toLowerCase(),
        name,
        subscription_tier: 'free',
        family_group_id: groupId
      }
    });

  } catch (error) {
    console.error('❌ Signup error:', error);
    res.status(500).json({ error: 'Failed to create account', message: error.message });
  }
});

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', async (req, res) => {
  const { db } = req.app.locals;

  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = db.prepare(`
      SELECT id, email, password_hash, name, phone,
             subscription_tier, subscription_status, subscription_expires
      FROM users WHERE email = ?
    `).get(email.toLowerCase());

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last login
    db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

    // Get family group
    const familyGroup = db.prepare('SELECT id, name FROM family_groups WHERE owner_id = ?').get(user.id);

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    console.log(`✅ User logged in: ${email}`);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        subscription_tier: user.subscription_tier,
        subscription_status: user.subscription_status,
        subscription_expires: user.subscription_expires,
        family_group: familyGroup
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: 'Login failed', message: error.message });
  }
});

/**
 * GET /api/auth/me
 * Get current user profile (requires auth)
 */
router.get('/me', authenticateToken, (req, res) => {
  const { db } = req.app.locals;

  try {
    const user = db.prepare(`
      SELECT id, email, name, phone,
             subscription_tier, subscription_status, subscription_expires,
             created_at, last_login
      FROM users WHERE id = ?
    `).get(req.user.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get family group and members
    const familyGroup = db.prepare('SELECT id, name FROM family_groups WHERE owner_id = ?').get(user.id);

    let familyMembers = [];
    if (familyGroup) {
      familyMembers = db.prepare(`
        SELECT id, name, relationship, email, date_of_birth,
               nakshatra, rashi, current_peyarchi
        FROM family_members WHERE group_id = ?
        ORDER BY created_at
      `).all(familyGroup.id);
    }

    // Get notification preferences
    const preferences = db.prepare('SELECT * FROM notification_preferences WHERE user_id = ?').get(user.id);

    res.json({
      user: {
        ...user,
        family_group: familyGroup,
        family_members: familyMembers,
        notification_preferences: preferences
      }
    });

  } catch (error) {
    console.error('❌ Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile', message: error.message });
  }
});

/**
 * POST /api/auth/forgot-password
 * Request password reset
 */
router.post('/forgot-password', async (req, res) => {
  const { db } = req.app.locals;

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = db.prepare('SELECT id, email, name FROM users WHERE email = ?').get(email.toLowerCase());

    if (!user) {
      // Don't reveal if email exists
      return res.json({ success: true, message: 'If the email exists, a reset link will be sent' });
    }

    // Generate reset token
    const resetToken = uuidv4();
    const resetExpires = new Date(Date.now() + 3600000).toISOString(); // 1 hour

    db.prepare(`
      UPDATE users SET reset_token = ?, reset_token_expires = ?
      WHERE id = ?
    `).run(resetToken, resetExpires, user.id);

    // TODO: Send email with reset link
    // For now, just log it
    console.log(`🔑 Password reset requested for ${email}`);
    console.log(`   Reset token: ${resetToken}`);

    res.json({ success: true, message: 'If the email exists, a reset link will be sent' });

  } catch (error) {
    console.error('❌ Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
router.post('/reset-password', async (req, res) => {
  const { db } = req.app.locals;

  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Find user with valid reset token
    const user = db.prepare(`
      SELECT id FROM users
      WHERE reset_token = ? AND reset_token_expires > datetime('now')
    `).get(token);

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Update password and clear reset token
    db.prepare(`
      UPDATE users
      SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(passwordHash, user.id);

    console.log(`✅ Password reset successful for user ${user.id}`);

    res.json({ success: true, message: 'Password reset successfully' });

  } catch (error) {
    console.error('❌ Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

/**
 * Middleware: Authenticate JWT token
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// Export router and middleware
module.exports = router;
module.exports.authenticateToken = authenticateToken;
