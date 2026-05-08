import { getResolvedAppConfig } from './appConfig.js';
import { normalizeExternalUrl, STORE_SLUG } from './domain.js';

function getEnv() {
  const config = getResolvedAppConfig();
  return {
    url: config.supabaseUrl,
    anonKey: config.supabaseAnonKey,
    dataMode: config.dataMode,
  };
}

async function rpc(functionName, payload = {}) {
  const { url, anonKey } = getEnv();
  if (!url || !anonKey) {
    throw new Error('Supabase 환경변수가 설정되지 않았습니다.');
  }

  const response = await fetch(`${url}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Supabase 요청에 실패했습니다.');
  }

  return response.json();
}

export function canUseSupabaseRpc() {
  const { url, anonKey, dataMode } = getEnv();
  return Boolean(url && anonKey && dataMode === 'supabase');
}

export function createSupabaseRpcRepository() {
  return {
    mode: 'supabase',

    async getDashboard() {
      return rpc('get_admin_dashboard', { p_store_slug: STORE_SLUG });
    },

    async lookupCustomer(phone) {
      return rpc('lookup_customer', { p_store_slug: STORE_SLUG, p_phone: phone });
    },

    async signupCustomer({ name, phone, privacyConsent, marketingConsent }) {
      return rpc('signup_customer', {
        p_store_slug: STORE_SLUG,
        p_name: name,
        p_phone: phone,
        p_privacy_consent: privacyConsent,
        p_marketing_consent: marketingConsent,
      });
    },

    async searchCustomersByLast4(last4) {
      return rpc('search_customers_by_last4', {
        p_store_slug: STORE_SLUG,
        p_last4: last4,
      });
    },

    async requestFreeDrinkCoupon(customerId) {
      return rpc('request_free_drink_coupon', {
        p_store_slug: STORE_SLUG,
        p_customer_id: customerId,
      });
    },

    async requestCouponEarn(customerId) {
      return rpc('request_coupon_earn', {
        p_store_slug: STORE_SLUG,
        p_customer_id: customerId,
      });
    },

    async listPendingCouponRequests() {
      return rpc('list_pending_coupon_requests', {
        p_store_slug: STORE_SLUG,
      });
    },

    async applyCouponRequest({ requestId, pin }) {
      return rpc('apply_coupon_request', {
        p_store_slug: STORE_SLUG,
        p_request_id: requestId,
        p_staff_pin: pin,
      });
    },

    async staffAdjustStamps({ customerId, pin, quantity, direction }) {
      return rpc('staff_adjust_stamps', {
        p_store_slug: STORE_SLUG,
        p_customer_id: customerId,
        p_staff_pin: pin,
        p_quantity: quantity,
        p_direction: direction,
      });
    },

    async issueStaffCoupon({ customerId, templateId, pin }) {
      return rpc('staff_issue_coupon', {
        p_store_slug: STORE_SLUG,
        p_customer_id: customerId,
        p_coupon_template_code: templateId === 'tpl_free_drink' ? 'free_drink' : templateId,
        p_staff_pin: pin,
      });
    },

    async redeemFreeDrinkWithCoupons({ customerId, pin }) {
      return rpc('redeem_free_drink_with_coupons', {
        p_store_slug: STORE_SLUG,
        p_customer_id: customerId,
        p_staff_pin: pin,
      });
    },

    async convertMileageCouponToPoints({ customerId, pin }) {
      return rpc('convert_mileage_coupon_to_points', {
        p_store_slug: STORE_SLUG,
        p_customer_id: customerId,
        p_staff_pin: pin,
      });
    },

    async redeemPoints({ customerId, pin, points }) {
      return rpc('redeem_points', {
        p_store_slug: STORE_SLUG,
        p_customer_id: customerId,
        p_staff_pin: pin,
        p_points: points,
      });
    },

    async redeemCoupon({ customerId, couponId, pin }) {
      return rpc('redeem_coupon', {
        p_store_slug: STORE_SLUG,
        p_customer_id: customerId,
        p_coupon_id: couponId,
        p_staff_pin: pin,
      });
    },

    async convertCouponToPoints({ customerId, couponId, pin }) {
      return rpc('convert_coupon_to_points', {
        p_store_slug: STORE_SLUG,
        p_customer_id: customerId,
        p_coupon_id: couponId,
        p_staff_pin: pin,
      });
    },

    async grantRouletteAccess({ customerId, pin }) {
      return rpc('grant_roulette_access', {
        p_store_slug: STORE_SLUG,
        p_customer_id: customerId,
        p_staff_pin: pin,
      });
    },

    async resetOrderCouponCount({ customerId, pin }) {
      return rpc('reset_order_coupon_count', {
        p_store_slug: STORE_SLUG,
        p_customer_id: customerId,
        p_staff_pin: pin,
      });
    },

    async spinRoulette(customerId) {
      return rpc('spin_roulette', {
        p_store_slug: STORE_SLUG,
        p_customer_id: customerId,
      });
    },

    async updateRouletteSettings({ rewards, dailyLimit, reviewCouponCount, reviewUrl }) {
      return rpc('admin_update_roulette_rewards', {
        p_store_slug: STORE_SLUG,
        p_rewards: rewards,
        p_daily_limit: dailyLimit,
        p_review_coupon_count: reviewCouponCount,
        p_review_url: normalizeExternalUrl(reviewUrl),
      });
    },

    async updateStaffPin({ staffId, pin }) {
      return rpc('admin_update_staff_pin', {
        p_store_slug: STORE_SLUG,
        p_staff_id: staffId,
        p_new_pin: pin,
      });
    },

    async resetStaffPin({ staffId }) {
      return rpc('admin_reset_staff_pin', {
        p_store_slug: STORE_SLUG,
        p_staff_id: staffId,
      });
    },
  };
}
