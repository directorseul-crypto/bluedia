export const STORE_ID = 'store_bluedia';
export const STORE_SLUG = 'bluedia-coffee';
export const STORAGE_KEY = 'bluedia-mvp-state-v1';

export const COUPON_STATUS_LABELS = {
  active: '보유중',
  used: '사용완료',
  converted: '전환완료',
  expired: '만료',
};

export const COUPON_TEMPLATES = [
  {
    id: 'tpl_welcome',
    store_id: STORE_ID,
    name: '첫 가입 웰컴 쿠폰',
    convert_points: 200,
    active: true,
  },
  {
    id: 'tpl_free_drink',
    store_id: STORE_ID,
    name: '무료음료 쿠폰',
    convert_points: 200,
    active: true,
  },
  {
    id: 'tpl_size_up',
    store_id: STORE_ID,
    name: '사이즈업 쿠폰',
    convert_points: 200,
    active: true,
  },
  {
    id: 'tpl_discount_1000',
    store_id: STORE_ID,
    name: '1000원 할인 쿠폰',
    convert_points: 200,
    active: true,
  },
];

export const DEFAULT_REWARDS = [
  {
    id: 'reward_none',
    store_id: STORE_ID,
    label: '다음기회',
    reward_type: 'none',
    reward_value: 0,
    coupon_template_id: null,
    probability: 30,
    active: true,
    color: '#1f326d',
    textColor: '#ffffff',
  },
  {
    id: 'reward_stamp_2',
    store_id: STORE_ID,
    label: '쿠폰 적립',
    reward_type: 'stamp',
    reward_value: 2,
    coupon_template_id: null,
    probability: 25,
    active: true,
    color: '#c7a27a',
    textColor: '#172447',
  },
  {
    id: 'reward_stamp_3',
    store_id: STORE_ID,
    label: '쿠폰 적립',
    reward_type: 'stamp',
    reward_value: 3,
    coupon_template_id: null,
    probability: 10,
    active: true,
    color: '#405cb2',
    textColor: '#ffffff',
  },
  {
    id: 'reward_discount_1000',
    store_id: STORE_ID,
    label: '1000원',
    reward_type: 'coupon',
    reward_value: 1000,
    coupon_template_id: 'tpl_discount_1000',
    probability: 15,
    active: true,
    color: '#e7d9ca',
    textColor: '#172447',
  },
  {
    id: 'reward_size_up',
    store_id: STORE_ID,
    label: '사이즈업',
    reward_type: 'coupon',
    reward_value: 1,
    coupon_template_id: 'tpl_size_up',
    probability: 15,
    active: true,
    color: '#8d6a4a',
    textColor: '#ffffff',
  },
  {
    id: 'reward_free_drink',
    store_id: STORE_ID,
    label: '무료음료',
    reward_type: 'coupon',
    reward_value: 1,
    coupon_template_id: 'tpl_free_drink',
    probability: 5,
    active: true,
    color: '#5a74c7',
    textColor: '#ffffff',
  },
];

export function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

export function normalizeExternalUrl(value, fallback = 'https://map.naver.com/') {
  const url = String(value || '').trim();
  if (!url) return fallback;
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

export function formatPhone(value) {
  const digits = normalizePhone(value);
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return value || '';
}

export function todayKey(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function formatDateTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function currencyPoints(value) {
  return `${Number(value || 0).toLocaleString('ko-KR')}P`;
}

export function formatRouletteRewardLabel(reward) {
  if (!reward) return '';

  const rawLabel = String(reward.label || '').trim();
  const value = Number(reward.reward_value || 0);

  if (reward.reward_type === 'stamp') {
    const baseLabel = rawLabel
      .replace(/\s*[+＋]\s*\d+\s*(개)?\s*$/u, '')
      .replace(/^스탬프$/u, '쿠폰 적립')
      .trim() || '쿠폰 적립';

    return value > 0 ? `${baseLabel} ${value}개` : baseLabel;
  }

  return rawLabel || '보상';
}

export function makeId(prefix) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function getCouponTemplate(templates, id) {
  return templates.find((template) => template.id === id);
}

export function buildActivityTitle(log) {
  const customer = log.customer_name ? `${log.customer_name} · ` : '';
  const staff = log.staff_name ? `[${log.staff_name}] ` : '';
  const detail = log.detail ? ` · ${log.detail}` : '';

  const labels = {
    signup: '회원가입',
    lookup: '고객 조회',
    stamp_adjust: '스탬프 조정',
    coupon_issue: '쿠폰 발급',
    free_drink_redeem: '무료음료 쿠폰 사용',
    coupon_to_points: '쿠폰 포인트 전환',
    point_redeem: '포인트 사용',
    coupon_redeem: '쿠폰 사용',
    coupon_convert: '쿠폰 포인트 전환',
    coupon_request: '쿠폰 요청',
    coupon_request_apply: '쿠폰 요청 적용',
    coupon_earn_request: '쿠폰 적립 요청',
    coupon_earn_request_apply: '쿠폰 적립 요청 적용',
    roulette_spin: '룰렛 참여',
    roulette_grant: '룰렛 참여권 재발급',
    order_reset: '재주문 리셋',
    admin_update: '관리자 설정 변경',
  };

  return `${staff}${customer}${labels[log.action] || log.action}${detail}`;
}
