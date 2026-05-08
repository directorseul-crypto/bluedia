import {
  COUPON_TEMPLATES,
  DEFAULT_REWARDS,
  STORE_ID,
  STORE_SLUG,
  STORAGE_KEY,
  buildActivityTitle,
  formatPhone,
  getCouponTemplate,
  makeId,
  normalizeExternalUrl,
  normalizePhone,
  todayKey,
} from './domain.js';

function nowIso() {
  return new Date().toISOString();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function seedState() {
  const createdAt = nowIso();
  return {
    stores: [{ id: STORE_ID, slug: STORE_SLUG, name: 'BLUEDIA COFFEE', daily_roulette_limit: 3, review_coupon_count: 1, review_url: 'https://map.naver.com/', created_at: createdAt }],
    customers: [{ id: 'cust_seed', store_id: STORE_ID, name: '김진돌', phone_normalized: '01011112222', privacy_consent: true, marketing_consent: true, created_at: createdAt }],
    staff_members: [{ id: 'staff_a', store_id: STORE_ID, name: '직원A', pin_hash: '', active: true, created_at: createdAt }],
    coupon_templates: COUPON_TEMPLATES,
    issued_coupons: [],
    stamp_ledger: [{ id: 'stamp_seed', store_id: STORE_ID, customer_id: 'cust_seed', amount: 12, source: 'seed', note: '초기 데이터', created_at: createdAt }],
    point_ledger: [{ id: 'point_seed', store_id: STORE_ID, customer_id: 'cust_seed', amount: 600, source: 'seed', note: '초기 데이터', created_at: createdAt }],
    roulette_rewards: DEFAULT_REWARDS,
    roulette_spins: [],
    roulette_bonus_grants: [],
    order_resets: [],
    coupon_requests: [],
    activity_logs: [],
  };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = seedState();
    saveState(seeded);
    return seeded;
  }
  try {
    return { ...seedState(), ...JSON.parse(raw) };
  } catch {
    const seeded = seedState();
    saveState(seeded);
    return seeded;
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getStore(state) {
  return state.stores.find((store) => store.id === STORE_ID);
}

function findCustomer(state, customerId) {
  return state.customers.find((customer) => customer.id === customerId && customer.store_id === STORE_ID);
}

function balance(rows, customerId) {
  return rows.filter((row) => row.customer_id === customerId).reduce((sum, row) => sum + Number(row.amount || 0), 0);
}

function activeCoupons(state, customerId) {
  return state.issued_coupons
    .filter((coupon) => coupon.customer_id === customerId)
    .map((coupon) => {
      const template = getCouponTemplate(state.coupon_templates, coupon.template_id);
      return { ...coupon, name: template?.name || '쿠폰', convert_points: template?.convert_points || 200 };
    })
    .sort((a, b) => new Date(b.issued_at) - new Date(a.issued_at));
}

function todaySpins(state, customerId) {
  return state.roulette_spins.filter((spin) => spin.customer_id === customerId && spin.spin_date === todayKey()).length;
}

function currentOrderCouponUses(state, customerId) {
  return state.stamp_ledger.filter((row) => row.customer_id === customerId && Number(row.amount) < 0 && ['free_drink_redeem', 'coupon_to_points'].includes(row.source)).reduce((sum, row) => sum + Math.abs(Number(row.amount || 0)), 0);
}

function logs(state, customerId) {
  return state.activity_logs.filter((log) => log.customer_id === customerId).slice(0, 12).map((log) => ({ ...log, title: buildActivityTitle(log) }));
}

function customerSummary(state, customerId) {
  const customer = findCustomer(state, customerId);
  const store = getStore(state);
  if (!customer) return null;
  const spins = todaySpins(state, customerId);
  return {
    id: customer.id,
    store_id: customer.store_id,
    name: customer.name,
    phone: formatPhone(customer.phone_normalized),
    phone_normalized: customer.phone_normalized,
    stamps: balance(state.stamp_ledger, customerId),
    points: balance(state.point_ledger, customerId),
    coupons: activeCoupons(state, customerId),
    today_spins: spins,
    daily_limit: store?.daily_roulette_limit || 3,
    remaining_spins: Math.max(0, (store?.daily_roulette_limit || 3) - spins),
    coupon_uses_current_order: currentOrderCouponUses(state, customerId),
    history: logs(state, customerId),
  };
}

function appendLog(state, payload) {
  state.activity_logs.unshift({ id: makeId('log'), store_id: STORE_ID, created_at: nowIso(), ...payload });
}

function verifyStaffPin(state, pin) {
  const cleaned = String(pin || '').trim();
  const hasPin = state.staff_members.some((staff) => staff.active && staff.pin_hash);
  if (!hasPin) throw new Error('관리자 모드에서 직원 PIN을 먼저 설정해 주세요.');
  const staff = state.staff_members.find((item) => item.active && item.pin_hash === `demo:${cleaned}`);
  if (!staff) throw new Error('직원 PIN이 올바르지 않습니다.');
  return staff;
}

function pendingRequests(state) {
  return state.coupon_requests
    .filter((request) => request.store_id === STORE_ID && request.status === 'pending')
    .map((request) => {
      const customer = findCustomer(state, request.customer_id);
      return { ...request, customer_name: customer?.name || '고객', customer_phone: customer ? formatPhone(customer.phone_normalized) : '', customer_stamps: customer ? balance(state.stamp_ledger, customer.id) : 0 };
    });
}

function pickReward(rewards) {
  const active = rewards.filter((reward) => reward.active && Number(reward.probability) > 0);
  const total = active.reduce((sum, reward) => sum + Number(reward.probability || 0), 0);
  let roll = Math.random() * total;
  for (const reward of active) {
    roll -= Number(reward.probability || 0);
    if (roll <= 0) return reward;
  }
  return active[0];
}

function addStamp(state, customerId, amount, source, note) {
  state.stamp_ledger.unshift({ id: makeId('stamp'), store_id: STORE_ID, customer_id: customerId, amount, source, note, created_at: nowIso() });
}

export function createLocalRepository() {
  return {
    mode: 'local',
    resetDemoData() { const seeded = seedState(); saveState(seeded); return seeded; },
    async getDashboard() {
      const state = loadState();
      return {
        store: getStore(state),
        rewards: clone(state.roulette_rewards),
        staff: state.staff_members.map((staff) => ({ id: staff.id, name: staff.name, active: staff.active, has_pin: Boolean(staff.pin_hash) })),
        logs: state.activity_logs.slice(0, 30).map((log) => ({ ...log, title: buildActivityTitle(log) })),
      };
    },
    async lookupCustomer(phone) {
      const state = loadState();
      const normalized = normalizePhone(phone);
      const customer = state.customers.find((row) => row.store_id === STORE_ID && row.phone_normalized === normalized);
      if (!customer) throw new Error('해당 전화번호로 등록된 고객이 없습니다.');
      return customerSummary(state, customer.id);
    },
    async signupCustomer({ name, phone, privacyConsent, marketingConsent }) {
      const state = loadState();
      const normalized = normalizePhone(phone);
      if (!name.trim()) throw new Error('이름을 입력해 주세요.');
      if (!privacyConsent) throw new Error('필수 개인정보 동의가 필요합니다.');
      const duplicate = state.customers.find((customer) => customer.store_id === STORE_ID && customer.phone_normalized === normalized);
      if (duplicate) return { duplicate: true, message: '이미 가입된 고객입니다. 고객 화면에서 전화번호로 조회해 주세요.', customer: customerSummary(state, duplicate.id) };
      const customer = { id: makeId('cust'), store_id: STORE_ID, name: name.trim(), phone_normalized: normalized, privacy_consent: true, marketing_consent: Boolean(marketingConsent), created_at: nowIso() };
      state.customers.unshift(customer);
      appendLog(state, { actor_type: 'customer', customer_id: customer.id, customer_name: customer.name, action: 'signup', detail: '웰컴 쿠폰 자동 발급' });
      saveState(state);
      return { duplicate: false, message: '가입이 완료되었습니다. 웰컴 쿠폰이 발급되었습니다.', customer: customerSummary(state, customer.id) };
    },
    async searchCustomersByLast4(last4) {
      const state = loadState();
      const query = normalizePhone(last4).slice(-4);
      if (query.length < 2) return [];
      return state.customers.filter((customer) => customer.store_id === STORE_ID && customer.phone_normalized.endsWith(query)).map((customer) => customerSummary(state, customer.id));
    },
    async requestCouponEarn(customerId) {
      const state = loadState();
      const customer = findCustomer(state, customerId);
      if (!customer) throw new Error('고객을 먼저 조회해 주세요.');
      state.coupon_requests.unshift({ id: makeId('request'), store_id: STORE_ID, customer_id: customerId, request_type: 'earn_coupon', request_amount: 1, status: 'pending', requested_at: nowIso() });
      appendLog(state, { actor_type: 'customer', customer_id: customer.id, customer_name: customer.name, action: 'coupon_earn_request', detail: '쿠폰 적립 요청' });
      saveState(state);
      return { customer: customerSummary(state, customerId), message: '직원 화면에 쿠폰 적립 요청을 보냈습니다.' };
    },
    async requestFreeDrinkCoupon(customerId) {
      const state = loadState();
      const customer = findCustomer(state, customerId);
      if (!customer) throw new Error('고객을 먼저 조회해 주세요.');
      if (balance(state.stamp_ledger, customerId) < 10) throw new Error('무료음료 요청에는 쿠폰 10개가 필요합니다.');
      state.coupon_requests.unshift({ id: makeId('request'), store_id: STORE_ID, customer_id: customerId, request_type: 'free_drink', request_amount: 10, status: 'pending', requested_at: nowIso() });
      appendLog(state, { actor_type: 'customer', customer_id: customer.id, customer_name: customer.name, action: 'coupon_request', detail: '무료음료 쿠폰 요청' });
      saveState(state);
      return { customer: customerSummary(state, customerId), message: '직원 화면에 쿠폰 요청을 보냈습니다.' };
    },
    async listPendingCouponRequests() { return pendingRequests(loadState()); },
    async applyCouponRequest({ requestId, pin }) {
      const state = loadState();
      const staff = verifyStaffPin(state, pin);
      const request = state.coupon_requests.find((row) => row.id === requestId && row.status === 'pending');
      if (!request) throw new Error('쿠폰 요청을 찾을 수 없습니다.');
      const customer = findCustomer(state, request.customer_id);
      if (request.request_type === 'earn_coupon') addStamp(state, customer.id, 1, 'customer_earn_request', '고객 요청 쿠폰 적립');
      if (request.request_type === 'free_drink') {
        if (balance(state.stamp_ledger, customer.id) < 10) throw new Error('무료음료 사용에는 쿠폰 10개가 필요합니다.');
        addStamp(state, customer.id, -10, 'free_drink_redeem', '고객 요청 무료음료 쿠폰 적용');
      }
      request.status = 'applied';
      request.resolved_at = nowIso();
      request.staff_id = staff.id;
      appendLog(state, { actor_type: 'staff', staff_id: staff.id, staff_name: staff.name, customer_id: customer.id, customer_name: customer.name, action: request.request_type === 'earn_coupon' ? 'coupon_earn_request_apply' : 'coupon_request_apply', detail: request.request_type === 'earn_coupon' ? '쿠폰 적립 요청 적용 · +1' : '쿠폰 요청 적용 · 쿠폰 10개 차감' });
      saveState(state);
      return { customer: customerSummary(state, customer.id), requests: pendingRequests(state), message: '쿠폰 요청을 적용했습니다.' };
    },
    async staffAdjustStamps({ customerId, pin, quantity, direction = 1 }) {
      const state = loadState();
      const staff = verifyStaffPin(state, pin);
      const customer = findCustomer(state, customerId);
      const amount = Math.max(1, Number(quantity || 1)) * Number(direction);
      if (balance(state.stamp_ledger, customerId) + amount < 0) throw new Error('쿠폰이 0개보다 적어질 수 없습니다.');
      addStamp(state, customerId, amount, amount > 0 ? 'drink_purchase' : 'staff_adjust', amount > 0 ? `음료 ${amount}잔 적립` : '직원 조정');
      appendLog(state, { actor_type: 'staff', staff_id: staff.id, staff_name: staff.name, customer_id: customer.id, customer_name: customer.name, action: 'stamp_adjust', detail: `쿠폰 ${amount > 0 ? '+' : ''}${amount}` });
      saveState(state);
      return customerSummary(state, customerId);
    },
    async redeemFreeDrinkWithCoupons({ customerId, pin }) {
      const state = loadState();
      const staff = verifyStaffPin(state, pin);
      const customer = findCustomer(state, customerId);
      if (balance(state.stamp_ledger, customerId) < 10) throw new Error('무료음료 사용에는 쿠폰 10개가 필요합니다.');
      addStamp(state, customerId, -10, 'free_drink_redeem', '무료음료 쿠폰 사용');
      appendLog(state, { actor_type: 'staff', staff_id: staff.id, staff_name: staff.name, customer_id: customer.id, customer_name: customer.name, action: 'free_drink_redeem', detail: '쿠폰 10개 차감' });
      saveState(state);
      return customerSummary(state, customerId);
    },
    async convertMileageCouponToPoints({ customerId, pin }) {
      const state = loadState();
      const staff = verifyStaffPin(state, pin);
      const customer = findCustomer(state, customerId);
      if (balance(state.stamp_ledger, customerId) < 1) throw new Error('포인트 전환에는 쿠폰 1개가 필요합니다.');
      addStamp(state, customerId, -1, 'coupon_to_points', '쿠폰 1개 200P 전환');
      state.point_ledger.unshift({ id: makeId('point'), store_id: STORE_ID, customer_id: customerId, amount: 200, source: 'coupon_to_points', note: '쿠폰 1개 200P 전환', created_at: nowIso() });
      appendLog(state, { actor_type: 'staff', staff_id: staff.id, staff_name: staff.name, customer_id: customer.id, customer_name: customer.name, action: 'coupon_to_points', detail: '쿠폰 1개 → 200P' });
      saveState(state);
      return customerSummary(state, customerId);
    },
    async redeemPoints({ customerId, pin, points = 1000 }) {
      const state = loadState();
      const staff = verifyStaffPin(state, pin);
      const customer = findCustomer(state, customerId);
      const amount = Number(points || 1000);
      if (balance(state.point_ledger, customerId) < amount) throw new Error(`${amount}P 사용에 필요한 포인트가 부족합니다.`);
      state.point_ledger.unshift({ id: makeId('point'), store_id: STORE_ID, customer_id: customerId, amount: -amount, source: 'point_redeem', note: `${amount}P 사용`, created_at: nowIso() });
      appendLog(state, { actor_type: 'staff', staff_id: staff.id, staff_name: staff.name, customer_id: customer.id, customer_name: customer.name, action: 'point_redeem', detail: `${amount}P 사용` });
      saveState(state);
      return customerSummary(state, customerId);
    },
    async resetOrderCouponCount({ customerId, pin }) {
      const state = loadState();
      const staff = verifyStaffPin(state, pin);
      const customer = findCustomer(state, customerId);
      state.order_resets.unshift({ id: makeId('reset'), store_id: STORE_ID, customer_id: customerId, staff_id: staff.id, created_at: nowIso() });
      appendLog(state, { actor_type: 'staff', staff_id: staff.id, staff_name: staff.name, customer_id: customer.id, customer_name: customer.name, action: 'order_reset', detail: '총 쿠폰사용/오늘참여 초기화' });
      saveState(state);
      return customerSummary(state, customerId);
    },
    async spinRoulette(customerId) {
      const state = loadState();
      const customer = findCustomer(state, customerId);
      if (balance(state.stamp_ledger, customerId) < 1) throw new Error('룰렛 참여에는 쿠폰 1개가 필요합니다.');
      if (todaySpins(state, customerId) >= Number(getStore(state)?.daily_roulette_limit || 3)) throw new Error('오늘 룰렛 참여 가능 횟수를 모두 사용했습니다.');
      const reward = pickReward(state.roulette_rewards);
      addStamp(state, customerId, -1, 'roulette_spin', '룰렛 참여');
      if (reward.reward_type === 'stamp') addStamp(state, customerId, Number(reward.reward_value || 0), 'roulette_reward', reward.label);
      state.roulette_spins.unshift({ id: makeId('spin'), store_id: STORE_ID, customer_id: customerId, reward_id: reward.id, reward_label: reward.label, spent_stamps: 1, spin_date: todayKey(), created_at: nowIso() });
      appendLog(state, { actor_type: 'customer', customer_id: customer.id, customer_name: customer.name, action: 'roulette_spin', detail: reward.label });
      saveState(state);
      return { reward: clone(reward), customer: customerSummary(state, customerId) };
    },
    async updateRouletteSettings({ rewards, dailyLimit, reviewCouponCount = 1, reviewUrl = 'https://map.naver.com/' }) {
      const state = loadState();
      const store = getStore(state);
      store.daily_roulette_limit = Math.max(1, Number(dailyLimit || 3));
      store.review_coupon_count = Math.max(1, Number(reviewCouponCount || 1));
      store.review_url = normalizeExternalUrl(reviewUrl);
      state.roulette_rewards = rewards.map((reward) => ({ ...reward, reward_value: Math.max(0, Number(reward.reward_value || 0)), probability: Math.max(0, Number(reward.probability || 0)), active: Boolean(reward.active) }));
      saveState(state);
      return this.getDashboard();
    },
    async updateStaffPin({ staffId, pin }) {
      const state = loadState();
      const cleaned = String(pin || '').trim();
      if (!/^\d{4,8}$/.test(cleaned)) throw new Error('직원 PIN은 숫자 4~8자리로 입력해 주세요.');
      const staff = state.staff_members.find((member) => member.id === staffId);
      staff.pin_hash = `demo:${cleaned}`;
      saveState(state);
      return this.getDashboard();
    },
    async resetStaffPin({ staffId }) {
      const state = loadState();
      const staff = state.staff_members.find((member) => member.id === staffId);
      staff.pin_hash = '';
      saveState(state);
      return this.getDashboard();
    },
    async redeemCoupon() { throw new Error('이 쿠폰 처리는 운영 쿠폰 화면에서 지원됩니다.'); },
    async convertCouponToPoints() { throw new Error('이 쿠폰 처리는 운영 쿠폰 화면에서 지원됩니다.'); },
    async grantRouletteAccess() { throw new Error('참여권 재발급은 Supabase 운영 모드에서 사용해 주세요.'); },
  };
}
