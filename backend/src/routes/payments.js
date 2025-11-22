/**
 * Payment Routes
 * Handles subscription payments via Cashfree
 */

const express = require('express');
const { authenticateToken } = require('./auth');

const router = express.Router();

/**
 * GET /api/payments/plans
 * Get available subscription plans
 */
router.get('/plans', (req, res) => {
  const { cashfree } = req.app.locals;

  try {
    const plans = cashfree.getPlans();
    res.json({ plans });
  } catch (error) {
    console.error('❌ Get plans error:', error);
    res.status(500).json({ error: 'Failed to get plans' });
  }
});

/**
 * POST /api/payments/create-order
 * Create a payment order for subscription upgrade
 */
router.post('/create-order', authenticateToken, async (req, res) => {
  const { db, cashfree } = req.app.locals;

  try {
    const { planId } = req.body;

    if (!planId) {
      return res.status(400).json({ error: 'Plan ID is required' });
    }

    // Get user details
    const user = db.prepare('SELECT id, email, name, phone FROM users WHERE id = ?').get(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create Cashfree order
    const order = await cashfree.createOrder(
      user.id,
      user.email,
      user.name,
      user.phone,
      planId
    );

    // Store order in database for tracking
    db.prepare(`
      INSERT INTO payment_orders (id, user_id, plan_id, amount, currency, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
    `).run(order.order_id, user.id, planId, order.plan.amount, order.plan.currency);

    res.json({
      success: true,
      order_id: order.order_id,
      payment_session_id: order.payment_session_id,
      plan: order.plan
    });

  } catch (error) {
    console.error('❌ Create order error:', error);
    res.status(500).json({ error: error.message || 'Failed to create order' });
  }
});

/**
 * POST /api/payments/verify
 * Verify payment and activate subscription
 */
router.post('/verify', authenticateToken, async (req, res) => {
  const { db, cashfree } = req.app.locals;

  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    // Get order from database
    const order = db.prepare('SELECT * FROM payment_orders WHERE id = ? AND user_id = ?')
      .get(orderId, req.user.userId);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status === 'completed') {
      return res.json({ success: true, message: 'Payment already verified', already_processed: true });
    }

    // Verify with Cashfree
    const verification = await cashfree.verifyPayment(orderId);

    if (verification.success) {
      // Calculate expiry
      const expiry = cashfree.calculateExpiry(order.plan_id);
      const tier = cashfree.getPlanTier(order.plan_id);

      // Update user subscription
      db.prepare(`
        UPDATE users SET
          subscription_tier = ?,
          subscription_status = 'active',
          subscription_expires = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(tier, expiry, req.user.userId);

      // Update order status
      db.prepare(`
        UPDATE payment_orders SET
          status = 'completed',
          payment_id = ?,
          completed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(verification.payment_id, orderId);

      console.log(`✅ Subscription activated: ${req.user.email} -> ${tier} until ${expiry}`);

      res.json({
        success: true,
        message: 'Payment verified and subscription activated',
        subscription: {
          tier,
          expires: expiry
        }
      });
    } else {
      res.json({
        success: false,
        message: 'Payment not successful'
      });
    }

  } catch (error) {
    console.error('❌ Verify payment error:', error);
    res.status(500).json({ error: error.message || 'Failed to verify payment' });
  }
});

/**
 * POST /api/payments/webhook
 * Handle Cashfree webhook callbacks
 */
router.post('/webhook', async (req, res) => {
  const { db, cashfree } = req.app.locals;

  try {
    console.log('📥 Cashfree webhook received:', JSON.stringify(req.body));

    const { data } = req.body;

    if (!data || !data.order || !data.order.order_id) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    const orderId = data.order.order_id;
    const orderStatus = data.order.order_status;

    // Get order from database
    const order = db.prepare('SELECT * FROM payment_orders WHERE id = ?').get(orderId);

    if (!order) {
      console.log('⚠️ Webhook: Order not found:', orderId);
      return res.status(200).json({ message: 'Order not found, but acknowledged' });
    }

    if (order.status === 'completed') {
      return res.status(200).json({ message: 'Already processed' });
    }

    if (orderStatus === 'PAID') {
      // Verify payment
      const verification = await cashfree.verifyPayment(orderId);

      if (verification.success) {
        // Calculate expiry
        const expiry = cashfree.calculateExpiry(order.plan_id);
        const tier = cashfree.getPlanTier(order.plan_id);

        // Update user subscription
        db.prepare(`
          UPDATE users SET
            subscription_tier = ?,
            subscription_status = 'active',
            subscription_expires = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(tier, expiry, order.user_id);

        // Update order status
        db.prepare(`
          UPDATE payment_orders SET
            status = 'completed',
            payment_id = ?,
            completed_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(verification.payment_id, orderId);

        console.log(`✅ Webhook: Subscription activated for user ${order.user_id}`);
      }
    } else if (orderStatus === 'EXPIRED' || orderStatus === 'CANCELLED') {
      db.prepare('UPDATE payment_orders SET status = ? WHERE id = ?').run(orderStatus.toLowerCase(), orderId);
    }

    res.status(200).json({ message: 'Webhook processed' });

  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * GET /api/payments/subscription
 * Get current user's subscription status
 */
router.get('/subscription', authenticateToken, (req, res) => {
  const { db, cashfree } = req.app.locals;

  try {
    const user = db.prepare(`
      SELECT subscription_tier, subscription_status, subscription_expires
      FROM users WHERE id = ?
    `).get(req.user.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if subscription expired
    const isExpired = user.subscription_expires &&
      new Date(user.subscription_expires) < new Date();

    const limits = { free: 1, family: 5, joint_family: 15 };

    res.json({
      tier: isExpired ? 'free' : user.subscription_tier,
      status: isExpired ? 'expired' : user.subscription_status,
      expires: user.subscription_expires,
      member_limit: limits[isExpired ? 'free' : user.subscription_tier] || 1,
      plans: cashfree.getPlans()
    });

  } catch (error) {
    console.error('❌ Get subscription error:', error);
    res.status(500).json({ error: 'Failed to get subscription status' });
  }
});

module.exports = router;
