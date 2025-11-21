/**
 * Family Management Routes
 * Handles family groups and family members CRUD
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken } = require('./auth');

const router = express.Router();

// All family routes require authentication
router.use(authenticateToken);

/**
 * GET /api/family
 * Get user's family group with all members
 */
router.get('/', (req, res) => {
  const { db, prokerola, cerebras } = req.app.locals;

  try {
    // Get family group
    const familyGroup = db.prepare(`
      SELECT id, name, created_at FROM family_groups WHERE owner_id = ?
    `).get(req.user.userId);

    if (!familyGroup) {
      return res.status(404).json({ error: 'Family group not found' });
    }

    // Get family members with peyarchi
    const members = db.prepare(`
      SELECT id, name, relationship, email, date_of_birth, time_of_birth,
             place_of_birth, nakshatra, rashi, lagna, current_peyarchi,
             peyarchi_calculated_at, created_at
      FROM family_members
      WHERE group_id = ?
      ORDER BY
        CASE relationship
          WHEN 'self' THEN 1
          WHEN 'spouse' THEN 2
          WHEN 'child' THEN 3
          WHEN 'parent' THEN 4
          ELSE 5
        END,
        created_at
    `).all(familyGroup.id);

    // Parse peyarchi JSON for each member
    const membersWithPeyarchi = members.map(m => ({
      ...m,
      current_peyarchi: m.current_peyarchi ? JSON.parse(m.current_peyarchi) : null
    }));

    res.json({
      family_group: familyGroup,
      members: membersWithPeyarchi,
      member_count: members.length
    });

  } catch (error) {
    console.error('❌ Get family error:', error);
    res.status(500).json({ error: 'Failed to get family', message: error.message });
  }
});

/**
 * PUT /api/family
 * Update family group name
 */
router.put('/', (req, res) => {
  const { db } = req.app.locals;

  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Family name is required' });
    }

    db.prepare(`
      UPDATE family_groups SET name = ? WHERE owner_id = ?
    `).run(name, req.user.userId);

    res.json({ success: true, message: 'Family name updated' });

  } catch (error) {
    console.error('❌ Update family error:', error);
    res.status(500).json({ error: 'Failed to update family' });
  }
});

/**
 * POST /api/family/members
 * Add a new family member
 */
router.post('/members', async (req, res) => {
  const { db, prokerola, cerebras } = req.app.locals;

  try {
    const {
      name,
      relationship,
      email,
      dateOfBirth,
      timeOfBirth,
      placeOfBirth,
      latitude,
      longitude,
      timezone
    } = req.body;

    // Validation
    if (!name || !dateOfBirth || !timeOfBirth) {
      return res.status(400).json({
        error: 'Name, date of birth, and time of birth are required'
      });
    }

    // Get family group
    const familyGroup = db.prepare('SELECT id FROM family_groups WHERE owner_id = ?').get(req.user.userId);
    if (!familyGroup) {
      return res.status(404).json({ error: 'Family group not found' });
    }

    // Check member limit based on subscription
    const user = db.prepare('SELECT subscription_tier FROM users WHERE id = ?').get(req.user.userId);
    const memberCount = db.prepare('SELECT COUNT(*) as count FROM family_members WHERE group_id = ?').get(familyGroup.id).count;

    const limits = {
      'free': 1,
      'family': 5,
      'joint_family': 15
    };

    const limit = limits[user.subscription_tier] || 1;
    if (memberCount >= limit) {
      return res.status(403).json({
        error: `Member limit reached (${limit}). Upgrade your subscription to add more family members.`,
        current_count: memberCount,
        limit: limit
      });
    }

    // Calculate birth chart using Prokerala
    let birthChart = {};
    if (latitude && longitude) {
      try {
        console.log(`📊 Calculating birth chart for ${name}...`);
        birthChart = await prokerola.getBirthChart(dateOfBirth, timeOfBirth, latitude, longitude);
      } catch (error) {
        console.error('⚠️ Birth chart calculation failed:', error.message);
      }
    }

    // Calculate peyarchi if we have rashi
    let peyarchiData = null;
    if (birthChart.rashi) {
      try {
        const peyarchiEffects = prokerola.calculatePeyarchiManually(birthChart.rashi);
        peyarchiData = await cerebras.generateFullReport(peyarchiEffects, birthChart.rashi);
      } catch (error) {
        console.error('⚠️ Peyarchi calculation failed:', error.message);
      }
    }

    // Create member
    const memberId = uuidv4();

    db.prepare(`
      INSERT INTO family_members (
        id, group_id, name, relationship, email,
        date_of_birth, time_of_birth, place_of_birth,
        latitude, longitude, timezone,
        nakshatra, nakshatra_pada, nakshatra_lord,
        rashi, rashi_lord, lagna, lagna_lord,
        current_peyarchi, peyarchi_calculated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      memberId, familyGroup.id, name, relationship || 'other', email,
      dateOfBirth, timeOfBirth, placeOfBirth,
      latitude, longitude, timezone || 'Asia/Kolkata',
      birthChart.nakshatra, birthChart.nakshatra_pada, birthChart.nakshatra_lord,
      birthChart.rashi, birthChart.rashi_lord, birthChart.lagna, birthChart.lagna_lord,
      peyarchiData ? JSON.stringify(peyarchiData) : null
    );

    console.log(`✅ Family member added: ${name}`);

    // Get Tamil rashi name
    const tamilRashi = birthChart.rashi ? cerebras.getTamilRashi(birthChart.rashi) : null;

    res.status(201).json({
      success: true,
      member: {
        id: memberId,
        name,
        relationship: relationship || 'other',
        email,
        date_of_birth: dateOfBirth,
        nakshatra: birthChart.nakshatra,
        rashi: birthChart.rashi,
        rashi_tamil: tamilRashi,
        lagna: birthChart.lagna,
        current_peyarchi: peyarchiData
      }
    });

  } catch (error) {
    console.error('❌ Add member error:', error);
    res.status(500).json({ error: 'Failed to add family member', message: error.message });
  }
});

/**
 * GET /api/family/members/:memberId
 * Get a specific family member
 */
router.get('/members/:memberId', (req, res) => {
  const { db, cerebras } = req.app.locals;

  try {
    const { memberId } = req.params;

    // Get family group first to verify ownership
    const familyGroup = db.prepare('SELECT id FROM family_groups WHERE owner_id = ?').get(req.user.userId);
    if (!familyGroup) {
      return res.status(404).json({ error: 'Family group not found' });
    }

    // Get member
    const member = db.prepare(`
      SELECT * FROM family_members WHERE id = ? AND group_id = ?
    `).get(memberId, familyGroup.id);

    if (!member) {
      return res.status(404).json({ error: 'Family member not found' });
    }

    res.json({
      member: {
        ...member,
        rashi_tamil: member.rashi ? cerebras.getTamilRashi(member.rashi) : null,
        current_peyarchi: member.current_peyarchi ? JSON.parse(member.current_peyarchi) : null
      }
    });

  } catch (error) {
    console.error('❌ Get member error:', error);
    res.status(500).json({ error: 'Failed to get family member' });
  }
});

/**
 * PUT /api/family/members/:memberId
 * Update a family member
 */
router.put('/members/:memberId', (req, res) => {
  const { db } = req.app.locals;

  try {
    const { memberId } = req.params;
    const { name, relationship, email } = req.body;

    // Verify ownership
    const familyGroup = db.prepare('SELECT id FROM family_groups WHERE owner_id = ?').get(req.user.userId);
    if (!familyGroup) {
      return res.status(404).json({ error: 'Family group not found' });
    }

    const member = db.prepare('SELECT id FROM family_members WHERE id = ? AND group_id = ?').get(memberId, familyGroup.id);
    if (!member) {
      return res.status(404).json({ error: 'Family member not found' });
    }

    // Update member
    const updates = [];
    const values = [];

    if (name) { updates.push('name = ?'); values.push(name); }
    if (relationship) { updates.push('relationship = ?'); values.push(relationship); }
    if (email !== undefined) { updates.push('email = ?'); values.push(email); }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(memberId);

      db.prepare(`
        UPDATE family_members SET ${updates.join(', ')} WHERE id = ?
      `).run(...values);
    }

    res.json({ success: true, message: 'Family member updated' });

  } catch (error) {
    console.error('❌ Update member error:', error);
    res.status(500).json({ error: 'Failed to update family member' });
  }
});

/**
 * DELETE /api/family/members/:memberId
 * Remove a family member
 */
router.delete('/members/:memberId', (req, res) => {
  const { db } = req.app.locals;

  try {
    const { memberId } = req.params;

    // Verify ownership
    const familyGroup = db.prepare('SELECT id FROM family_groups WHERE owner_id = ?').get(req.user.userId);
    if (!familyGroup) {
      return res.status(404).json({ error: 'Family group not found' });
    }

    const result = db.prepare('DELETE FROM family_members WHERE id = ? AND group_id = ?').run(memberId, familyGroup.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Family member not found' });
    }

    res.json({ success: true, message: 'Family member removed' });

  } catch (error) {
    console.error('❌ Delete member error:', error);
    res.status(500).json({ error: 'Failed to remove family member' });
  }
});

/**
 * POST /api/family/members/:memberId/recalculate
 * Recalculate peyarchi for a family member
 */
router.post('/members/:memberId/recalculate', async (req, res) => {
  const { db, prokerola, cerebras } = req.app.locals;

  try {
    const { memberId } = req.params;

    // Verify ownership
    const familyGroup = db.prepare('SELECT id FROM family_groups WHERE owner_id = ?').get(req.user.userId);
    if (!familyGroup) {
      return res.status(404).json({ error: 'Family group not found' });
    }

    const member = db.prepare(`
      SELECT * FROM family_members WHERE id = ? AND group_id = ?
    `).get(memberId, familyGroup.id);

    if (!member) {
      return res.status(404).json({ error: 'Family member not found' });
    }

    if (!member.rashi) {
      return res.status(400).json({ error: 'Member does not have rashi data' });
    }

    // Recalculate peyarchi
    console.log(`🔄 Recalculating peyarchi for ${member.name}...`);
    const peyarchiEffects = prokerola.calculatePeyarchiManually(member.rashi);
    const peyarchiData = await cerebras.generateFullReport(peyarchiEffects, member.rashi);

    // Update member
    db.prepare(`
      UPDATE family_members
      SET current_peyarchi = ?, peyarchi_calculated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(JSON.stringify(peyarchiData), memberId);

    res.json({
      success: true,
      message: 'Peyarchi recalculated',
      current_peyarchi: peyarchiData
    });

  } catch (error) {
    console.error('❌ Recalculate peyarchi error:', error);
    res.status(500).json({ error: 'Failed to recalculate peyarchi' });
  }
});

module.exports = router;
