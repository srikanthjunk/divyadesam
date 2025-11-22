/**
 * Cashfree Payment Gateway Service
 * Handles payment orders, verification, and subscription management
 */

const { Cashfree } = require('cashfree-pg');

class CashfreeService {
  constructor(clientId, clientSecret, isProduction = true) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;

    // Configure Cashfree SDK
    Cashfree.XClientId = clientId;
    Cashfree.XClientSecret = clientSecret;
    Cashfree.XEnvironment = isProduction
      ? Cashfree.Environment.PRODUCTION
      : Cashfree.Environment.SANDBOX;

    // Subscription plans
    this.plans = {
      family_monthly: {
        id: 'family_monthly',
        name: 'Family Plan (Monthly)',
        amount: 99,
        currency: 'INR',
        tier: 'family',
        duration: 30 // days
      },
      family_yearly: {
        id: 'family_yearly',
        name: 'Family Plan (Yearly)',
        amount: 999,
        currency: 'INR',
        tier: 'family',
        duration: 365
      },
      joint_family_monthly: {
        id: 'joint_family_monthly',
        name: 'Joint Family Plan (Monthly)',
        amount: 199,
        currency: 'INR',
        tier: 'joint_family',
        duration: 30
      },
      joint_family_yearly: {
        id: 'joint_family_yearly',
        name: 'Joint Family Plan (Yearly)',
        amount: 1999,
        currency: 'INR',
        tier: 'joint_family',
        duration: 365
      }
    };
  }

  /**
   * Get available subscription plans
   */
  getPlans() {
    return this.plans;
  }

  /**
   * Create a payment order for subscription
   */
  async createOrder(userId, userEmail, userName, userPhone, planId) {
    const plan = this.plans[planId];
    if (!plan) {
      throw new Error(`Invalid plan: ${planId}`);
    }

    const orderId = `bhaktimap_${userId.substring(0, 8)}_${Date.now()}`;

    const request = {
      order_id: orderId,
      order_amount: plan.amount,
      order_currency: plan.currency,
      customer_details: {
        customer_id: userId,
        customer_email: userEmail,
        customer_phone: userPhone || '9999999999',
        customer_name: userName || 'BhaktiMap User'
      },
      order_meta: {
        return_url: `https://bhaktimap.com/dashboard.html?order_id=${orderId}&status={order_status}`,
        notify_url: 'https://api.bhaktimap.com/api/payments/webhook'
      },
      order_note: `BhaktiMap ${plan.name} Subscription`
    };

    try {
      console.log('📦 Creating Cashfree order:', orderId);
      const response = await Cashfree.PGCreateOrder("2023-08-01", request);

      console.log('✅ Cashfree order created:', response.data.order_id);

      return {
        success: true,
        order_id: response.data.order_id,
        payment_session_id: response.data.payment_session_id,
        order_status: response.data.order_status,
        plan: plan
      };
    } catch (error) {
      console.error('❌ Cashfree create order error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to create payment order');
    }
  }

  /**
   * Verify payment status
   */
  async verifyPayment(orderId) {
    try {
      console.log('🔍 Verifying Cashfree payment:', orderId);
      const response = await Cashfree.PGOrderFetchPayments("2023-08-01", orderId);

      const payments = response.data;

      if (payments && payments.length > 0) {
        // Find successful payment
        const successfulPayment = payments.find(p => p.payment_status === 'SUCCESS');

        if (successfulPayment) {
          console.log('✅ Payment verified:', successfulPayment.cf_payment_id);
          return {
            success: true,
            payment_id: successfulPayment.cf_payment_id,
            payment_status: successfulPayment.payment_status,
            payment_amount: successfulPayment.payment_amount,
            payment_method: successfulPayment.payment_method
          };
        }
      }

      return {
        success: false,
        message: 'No successful payment found'
      };
    } catch (error) {
      console.error('❌ Cashfree verify error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to verify payment');
    }
  }

  /**
   * Get order status
   */
  async getOrderStatus(orderId) {
    try {
      const response = await Cashfree.PGFetchOrder("2023-08-01", orderId);
      return {
        success: true,
        order_id: response.data.order_id,
        order_status: response.data.order_status,
        order_amount: response.data.order_amount
      };
    } catch (error) {
      console.error('❌ Cashfree get order error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to get order status');
    }
  }

  /**
   * Calculate subscription expiry date
   */
  calculateExpiry(planId) {
    const plan = this.plans[planId];
    if (!plan) return null;

    const expiry = new Date();
    expiry.setDate(expiry.getDate() + plan.duration);
    return expiry.toISOString();
  }

  /**
   * Get plan tier from planId
   */
  getPlanTier(planId) {
    const plan = this.plans[planId];
    return plan ? plan.tier : null;
  }
}

module.exports = CashfreeService;
