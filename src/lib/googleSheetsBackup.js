import { getResolvedAppConfig } from './appConfig.js';

const BACKUP_METHODS = new Set([
  'signupCustomer',
  'requestFreeDrinkCoupon',
  'requestCouponEarn',
  'applyCouponRequest',
  'staffAdjustStamps',
  'redeemFreeDrinkWithCoupons',
  'convertMileageCouponToPoints',
  'redeemPoints',
  'redeemCoupon',
  'convertCouponToPoints',
  'grantRouletteAccess',
  'resetOrderCouponCount',
  'spinRoulette',
  'updateRouletteSettings',
  'updateStaffPin',
  'resetStaffPin',
]);

const SECRET_KEYS = new Set([
  'pin',
  'password',
  'supabaseAnonKey',
  'anonKey',
  'p_staff_pin',
  'p_new_pin',
]);

export function shouldBackUpAction(action) {
  return BACKUP_METHODS.has(action);
}

function sanitize(value) {
  if (Array.isArray(value)) return value.map((item) => sanitize(item));
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SECRET_KEYS.has(key) ? '[hidden]' : sanitize(item),
    ]),
  );
}

function summarizeResult(result) {
  if (!result || typeof result !== 'object') return result;
  if (result.customer) return summarizeResult(result.customer);

  return {
    id: result.id,
    name: result.name,
    phone: result.phone,
    stamps: result.stamps,
    points: result.points,
    today_spins: result.today_spins,
  };
}

export function sendGoogleSheetsBackup(action, payload, result, mode) {
  const { googleSheetsWebhookUrl } = getResolvedAppConfig();
  if (!googleSheetsWebhookUrl || typeof fetch === 'undefined') return;
  const now = new Date();
  const backupDate = now.toISOString().slice(0, 10);

  const body = JSON.stringify({
    timestamp: now.toISOString(),
    backup_date: backupDate,
    app: 'BLUEDIA COFFEE',
    mode,
    action,
    payload: sanitize(payload),
    result: sanitize(summarizeResult(result)),
  });

  fetch(googleSheetsWebhookUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body,
  }).catch(() => {});
}
