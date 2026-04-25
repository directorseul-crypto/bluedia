import React, { useEffect, useMemo, useState } from 'react';

const STAFF_PASS = '1234';
const OWNER_PASS = '9258';
const BAG_SIZE = 180;
const DAILY_CUSTOMER_SPIN_LIMIT = 3;

const SUPABASE_URL = 'https://ovkhokqqcauyyrqwrcpw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_lxSUZss5XF24tDP05urG2g_WcZX0Lu7';
const SUPABASE_READY = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const defaultRewards = [
  { name: '아쉽지만 다음기회!', prob: 0.5, type: 'none' },
  { name: '스탬프 +2', prob: 0.2, type: 'stamp', value: 2 },
  { name: '스탬프 +3', prob: 0.1, type: 'stamp', value: 3 },
  { name: '1000원 할인쿠폰', prob: 0.08, type: 'coupon', couponType: 'discount', couponLabel: '1000원 할인쿠폰' },
  { name: '사이즈업 쿠폰', prob: 0.054, type: 'coupon', couponType: 'upgrade', couponLabel: '사이즈업 쿠폰' },
  { name: '무료음료 쿠폰', prob: 0.066, type: 'coupon', couponType: 'free', couponLabel: '무료음료 쿠폰' },
];

const wheelColors = ['#1f326d', '#c7a27a', '#3d56a6', '#e7d9ca', '#8d6a4a', '#5a74c7'];

async function supabaseRequest(path, options = {}) {
  if (!SUPABASE_READY) return { data: null, error: 'Supabase 연결값이 없습니다.' };

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...options,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        ...(options.headers || {}),
      },
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      console.error('Supabase error:', data);
      return { data: null, error: data };
    }
    return { data, error: null };
  } catch (error) {
    console.error('Supabase request failed:', error);
    return { data: null, error };
  }
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function makeTimeLabel() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

function toAppHistory(row) {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    time: row.created_at ? row.created_at.slice(0, 16).replace('T', ' ') : makeTimeLabel(),
  };
}

function toAppCoupon(row) {
  return {
    id: row.id,
    type: row.type,
    label: row.label,
    status: row.status,
    createdAt: row.created_at,
  };
}

function normalize(rewards) {
  const sum = rewards.reduce((acc, item) => acc + Number(item.prob || 0), 0);
  if (sum <= 0) return rewards.map((item) => ({ ...item, normalizedProb: 0 }));
  return rewards.map((item) => ({ ...item, normalizedProb: Number(item.prob || 0) / sum }));
}

function buildRewardBag(rewards, bagSize = BAG_SIZE) {
  const normalized = normalize(rewards);
  const idealCounts = normalized.map((item) => item.normalizedProb * bagSize);
  const counts = idealCounts.map((value) => Math.floor(value));
  let allocated = counts.reduce((acc, value) => acc + value, 0);

  while (allocated < bagSize) {
    let bestIndex = 0;
    let bestRemainder = -1;
    for (let i = 0; i < idealCounts.length; i += 1) {
      const remainder = idealCounts[i] - counts[i];
      if (remainder > bestRemainder) {
        bestRemainder = remainder;
        bestIndex = i;
      }
    }
    counts[bestIndex] += 1;
    allocated += 1;
  }

  const bag = [];
  counts.forEach((count, index) => {
    for (let i = 0; i < count; i += 1) bag.push(index);
  });
  return bag;
}

function createShuffledBag(rewards) {
  const bag = buildRewardBag(rewards);
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatPhone(value) {
  const numbers = String(value || '').replace(/\D/g, '').slice(0, 11);
  if (numbers.length < 4) return numbers;
  if (numbers.length < 8) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
}

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
}

function runSelfTests() {
  const normalized = normalize(defaultRewards);
  const total = normalized.reduce((acc, item) => acc + item.normalizedProb, 0);
  console.assert(Math.abs(total - 1) < 0.000001, 'normalize() should make probability sum equal to 1');
  console.assert(buildRewardBag(defaultRewards, 30).length === 30, 'buildRewardBag() should respect bag size');
  console.assert(formatPhone('01011112222') === '010-1111-2222', 'formatPhone() should format Korean mobile numbers');
}

function RouletteWheel({ rewards, angle, compact = false }) {
  const size = compact ? 330 : 420;
  const radius = compact ? 145 : 186;
  const center = size / 2;
  const slice = 360 / rewards.length;

  return (
    <div style={compact ? styles.rouletteStageCompact : styles.rouletteStage}>
      <div style={styles.pointerWrap}>
        <div style={styles.pointer} />
      </div>
      <div style={{ ...styles.wheelShell, width: size, height: size, transform: `rotate(${angle}deg)` }}>
        <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%" style={styles.wheelSvg}>
          <circle cx={center} cy={center} r={radius + 12} fill="#f7efe7" />
          <circle cx={center} cy={center} r={radius + 6} fill="#d5b89a" />
          <circle cx={center} cy={center} r={radius} fill="#ffffff" />
          {rewards.map((reward, index) => {
            const start = index * slice;
            const end = start + slice;
            const mid = start + slice / 2;
            const labelPoint = polarToCartesian(center, center, radius * 0.66, mid);
            const bg = wheelColors[index % wheelColors.length];
            const textColor = index % 2 === 0 ? '#ffffff' : '#1c2340';
            return (
              <g key={`${reward.name}-${index}`}>
                <path d={describeArc(center, center, radius, start, end)} fill={bg} stroke="#ffffff" strokeWidth="3" />
                <g transform={`translate(${labelPoint.x}, ${labelPoint.y}) rotate(${mid - 90})`}>
                  <text x="0" y="0" textAnchor="middle" dominantBaseline="middle" fill={textColor} fontSize={compact ? '12' : '15'} fontWeight="800">
                    {reward.name.length > 9 ? `${reward.name.slice(0, 9)}…` : reward.name}
                  </text>
                </g>
              </g>
            );
          })}
          <circle cx={center} cy={center} r={compact ? 42 : 50} fill="#ffffff" stroke="#d8c0a8" strokeWidth="8" />
          <circle cx={center} cy={center} r={compact ? 32 : 39} fill="#1f326d" />
          <text x={center} y={center - 4} textAnchor="middle" fill="#ffffff" fontSize={compact ? '14' : '18'} fontWeight="900">BLUEDIA</text>
          <text x={center} y={center + 15} textAnchor="middle" fill="#d9c2ab" fontSize="10" fontWeight="800">ROULETTE</text>
        </svg>
      </div>
    </div>
  );
}

function ResultBadge({ result, spinning, pendingName }) {
  return (
    <div style={styles.resultCard}>
      <div style={styles.resultLabel}>이번 결과</div>
      <div style={styles.resultValue}>{spinning ? `${pendingName || '고객'} 룰렛 진행 중…` : result || '대기 중'}</div>
    </div>
  );
}

function SettingsModal({ open, rewards, setRewards, totalProb, ownerPassword, setOwnerPassword, ownerUnlocked, unlockOwner, close }) {
  if (!open) return null;
  const normalized = normalize(rewards);

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalCard}>
        <div style={styles.modalHeader}>
          <div>
            <div style={styles.panelEyebrow}>owner only</div>
            <h3 style={styles.modalTitle}>룰렛 이벤트 설정</h3>
          </div>
          <button style={styles.closeBtn} onClick={close}>닫기</button>
        </div>

        {!ownerUnlocked ? (
          <div style={styles.lockBox}>
            <div style={styles.lockTitle}>사장님 전용 비밀번호</div>
            <div style={styles.lockSub}>직원은 이 설정을 변경할 수 없습니다.</div>
            <input type="password" value={ownerPassword} onChange={(event) => setOwnerPassword(event.target.value)} placeholder="설정 비밀번호 입력" style={styles.loginInput} />
            <button style={styles.loginBtn} onClick={unlockOwner}>설정 열기</button>
          </div>
        ) : (
          <div style={styles.panel}>
            <div style={styles.panelHeaderRow}>
              <div>
                <div style={styles.panelEyebrow}>reward config</div>
                <h3 style={styles.panelTitle}>룰렛 이벤트 구성</h3>
              </div>
              <div style={styles.totalPill}>총합 {totalProb.toFixed(3)}</div>
            </div>
            <div style={styles.rewardList}>
              {rewards.map((reward, index) => (
                <div key={`${reward.name}-${index}`} style={styles.rewardRow}>
                  <div style={{ ...styles.colorDot, background: wheelColors[index % wheelColors.length] }} />
                  <input
                    value={reward.name}
                    onChange={(event) => {
                      const next = rewards.map((item, itemIndex) => (
                        itemIndex === index
                          ? { ...item, name: event.target.value, couponLabel: item.type === 'coupon' ? event.target.value : item.couponLabel }
                          : item
                      ));
                      setRewards(next);
                    }}
                    style={styles.rewardNameInput}
                  />
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={reward.prob}
                    onChange={(event) => {
                      const next = rewards.map((item, itemIndex) => (itemIndex === index ? { ...item, prob: Number(event.target.value) } : item));
                      setRewards(next);
                    }}
                    style={styles.rewardProbInput}
                  />
                  <div style={styles.percentText}>{formatPercent(normalized[index]?.normalizedProb || 0)}</div>
                </div>
              ))}
            </div>
            <div style={styles.helperText}>직원용과 고객용 룰렛에 동일하게 적용됩니다. 무료음료는 0.066 근처면 약 15번에 1번 수준입니다.</div>
          </div>
        )}
      </div>
    </div>
  );
}

function CouponAndHistory({ member, onUseCoupon }) {
  return (
    <>
      <div style={styles.memberSubSection}>
        <div style={styles.memberSubTitle}>보유 쿠폰</div>
        {member.coupons.length === 0 ? (
          <div style={styles.emptyMini}>보유 쿠폰이 없습니다</div>
        ) : (
          <div style={styles.couponList}>
            {member.coupons.map((coupon) => (
              <button key={coupon.id} style={styles.couponChip} onClick={() => onUseCoupon(member.id, coupon.id)}>
                {coupon.label}<span style={styles.couponChipUse}>사용</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div style={styles.memberSubSection}>
        <div style={styles.memberSubTitle}>최근 사용 이력</div>
        {member.history.length === 0 ? (
          <div style={styles.emptyMini}>아직 사용 이력이 없습니다</div>
        ) : (
          <div style={styles.historyList}>
            {member.history.slice(0, 5).map((item) => (
              <div key={item.id} style={styles.historyRow}>
                <div>
                  <div style={styles.historyTitle}>{item.title}</div>
                  <div style={styles.historyMeta}>{item.time}</div>
                </div>
                <div style={styles.historyType}>{item.kind}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function MemberCard({ member, onAdd, onMinus, onSpin, onUseCoupon, disabled }) {
  return (
    <div style={styles.memberCard}>
      <div style={styles.memberTop}>
        <div>
          <div style={styles.memberName}>{member.name}</div>
          <div style={styles.memberPhone}>{member.phone}</div>
        </div>
        <div style={styles.memberTopRight}>
          <div style={styles.stampPill}>{member.stamps}개</div>
          <div style={styles.couponPill}>쿠폰 {member.coupons.length}개</div>
        </div>
      </div>
      <div style={styles.memberBottom}>
        <button style={styles.secondaryBtn} onClick={() => onAdd(member.id)}>+1 적립</button>
        <button style={styles.secondaryBtn} onClick={() => onMinus(member.id)}>-1 조정</button>
        <button style={{ ...styles.spinBtn, opacity: disabled ? 0.7 : 1 }} onClick={() => onSpin(member.id, 'staff')} disabled={disabled}>🎰 룰렛</button>
      </div>
      <CouponAndHistory member={member} onUseCoupon={onUseCoupon} />
    </div>
  );
}

function CustomerPage({ rewards, customerPhone, setCustomerPhone, customerMember, customerResult, customerSpinning, customerAngle, customerPendingName, onLookup, onSpin, onUseCoupon, onGoStaff }) {
  const spinCountToday = customerMember?.roulettePlays?.[todayKey()] || 0;
  const remaining = Math.max(0, DAILY_CUSTOMER_SPIN_LIMIT - spinCountToday);
  const canSpin = Boolean(customerMember && remaining > 0 && customerMember.stamps > 0 && !customerSpinning);

  return (
    <div style={styles.customerPage}>
      <div style={styles.customerHeader}>
        <div>
          <div style={styles.panelEyebrow}>BLUEDIA COFFEE</div>
          <h1 style={styles.customerTitle}>마이 쿠폰 & 룰렛 이벤트</h1>
          <div style={styles.customerSub}>내 쿠폰, 스탬프, 사용내역을 확인하고 하루 3회까지 룰렛에 참여할 수 있습니다.</div>
        </div>
        <button style={styles.logoutBtn} onClick={onGoStaff}>직원용</button>
      </div>

      <div style={styles.customerGrid}>
        <div style={styles.customerPanel}>
          <div style={styles.panelEyebrow}>my page login</div>
          <h2 style={styles.panelTitle}>전화번호로 내 정보 확인</h2>
          <div style={styles.customerSearchRow}>
            <input value={customerPhone} onChange={(event) => setCustomerPhone(formatPhone(event.target.value))} placeholder="010-0000-0000" style={styles.customerInput} />
            <button style={styles.loginBtn} onClick={onLookup}>조회</button>
          </div>
          <div style={styles.helperText}>테스트 번호: 010-1111-2222 / 010-2222-7777</div>

          {customerMember && (
            <div style={styles.mySummaryCard}>
              <div style={styles.memberName}>{customerMember.name} 고객님</div>
              <div style={styles.mySummaryGrid}>
                <div style={styles.statCard}><div style={styles.statLabel}>스탬프</div><div style={styles.statValue}>{customerMember.stamps}개</div></div>
                <div style={styles.statCard}><div style={styles.statLabel}>보유 쿠폰</div><div style={styles.statValue}>{customerMember.coupons.length}개</div></div>
                <div style={styles.statCard}><div style={styles.statLabel}>오늘 참여</div><div style={styles.statValue}>{spinCountToday}/3회</div></div>
                <div style={styles.statCard}><div style={styles.statLabel}>남은 참여</div><div style={styles.statValue}>{remaining}회</div></div>
              </div>
            </div>
          )}
        </div>

        <div style={styles.customerPanel}>
          <RouletteWheel rewards={rewards} angle={customerAngle} compact />
          <ResultBadge result={customerResult} spinning={customerSpinning} pendingName={customerPendingName} />
          <div style={styles.customerRouletteBox}>
            <div style={styles.lockInfoTitle}>쿠폰을 사용하여 룰렛 이벤트에 참가하시겠습니까?</div>
            <div style={styles.lockInfoText}>참여 시 스탬프 1개가 사용됩니다. 하루 최대 3번까지 참여 가능합니다.</div>
            <button style={{ ...styles.customerSpinBtn, opacity: canSpin ? 1 : 0.55 }} disabled={!canSpin} onClick={() => onSpin(customerMember.id, 'customer')}>
              {customerSpinning ? '룰렛 진행 중...' : '스탬프 1개 사용하고 룰렛 참여'}
            </button>
            {customerMember && customerMember.stamps <= 0 && <div style={styles.customerWarn}>스탬프가 부족합니다.</div>}
            {customerMember && remaining <= 0 && <div style={styles.customerWarn}>오늘 참여 가능 횟수 3회를 모두 사용했습니다.</div>}
          </div>
        </div>
      </div>

      {customerMember && (
        <div style={styles.customerPanelWide}>
          <CouponAndHistory member={customerMember} onUseCoupon={onUseCoupon} />
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [mode, setMode] = useState('customer');
  const [isStaff, setIsStaff] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [rewards, setRewards] = useState(defaultRewards);
  const totalProb = useMemo(() => rewards.reduce((acc, item) => acc + Number(item.prob || 0), 0), [rewards]);
  const [rewardBag, setRewardBag] = useState(() => createShuffledBag(defaultRewards));
  const [bagCursor, setBagCursor] = useState(0);
  const [members, setMembers] = useState([
    { id: '1', name: '김진돌', phone: '010-1111-2222', stamps: 12, coupons: [{ id: 'c-101', type: 'discount', label: '1000원 할인쿠폰', status: 'active', createdAt: '2026-04-22 10:30' }], history: [{ id: 'h-101', kind: '쿠폰사용', title: '1000원 할인쿠폰 사용', time: '2026-04-22 12:05' }], roulettePlays: {} },
    { id: '2', name: '손님A', phone: '010-3333-4444', stamps: 5, coupons: [], history: [], roulettePlays: {} },
    { id: '3', name: '이수현', phone: '010-2222-7777', stamps: 18, coupons: [{ id: 'c-301', type: 'free', label: '무료음료 쿠폰', status: 'active', createdAt: '2026-04-22 14:12' }, { id: 'c-302', type: 'upgrade', label: '사이즈업 쿠폰', status: 'active', createdAt: '2026-04-22 14:13' }], history: [], roulettePlays: {} },
    { id: '4', name: '박민호', phone: '010-9781-1234', stamps: 3, coupons: [], history: [], roulettePlays: {} },
  ]);
  const [result, setResult] = useState('룰렛을 시작해 주세요');
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [pendingName, setPendingName] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ownerPassword, setOwnerPassword] = useState('');
  const [ownerUnlocked, setOwnerUnlocked] = useState(false);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerMemberId, setCustomerMemberId] = useState(null);
  const [customerResult, setCustomerResult] = useState('내 룰렛 결과가 여기에 표시됩니다');
  const [customerAngle, setCustomerAngle] = useState(0);
  const [customerSpinning, setCustomerSpinning] = useState(false);
  const [customerPendingName, setCustomerPendingName] = useState('');

  const customerMember = members.find((member) => member.id === customerMemberId) || null;

  useEffect(() => {
    runSelfTests();
  }, []);

  useEffect(() => {
    async function loadFromSupabase() {
      if (!SUPABASE_READY) return;
      const [{ data: dbMembers }, { data: dbCoupons }, { data: dbHistories }, { data: dbPlays }] = await Promise.all([
        supabaseRequest('members?select=*&order=created_at.asc'),
        supabaseRequest('coupons?select=*&status=eq.active&order=created_at.desc'),
        supabaseRequest('histories?select=*&order=created_at.desc'),
        supabaseRequest(`roulette_plays?select=*&play_date=eq.${todayKey()}`),
      ]);
      if (!dbMembers || dbMembers.length === 0) return;

      const nextMembers = dbMembers.map((member) => {
        const memberCoupons = (dbCoupons || []).filter((coupon) => coupon.member_id === member.id).map(toAppCoupon);
        const memberHistories = (dbHistories || []).filter((history) => history.member_id === member.id).map(toAppHistory);
        const todayPlayCount = (dbPlays || []).filter((play) => play.member_id === member.id).length;
        return {
          id: member.id,
          name: member.name,
          phone: member.phone,
          stamps: member.stamps || 0,
          coupons: memberCoupons,
          history: memberHistories,
          roulettePlays: { [todayKey()]: todayPlayCount },
        };
      });
      setMembers(nextMembers);
    }
    loadFromSupabase();
  }, []);

  const rebuildBag = (nextRewards) => {
    setRewards(nextRewards);
    setRewardBag(createShuffledBag(nextRewards));
    setBagCursor(0);
  };

  const addHistory = (member, entry) => [{ id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, time: makeTimeLabel(), ...entry }, ...member.history];

  const saveHistoryToDb = async (memberId, kind, title) => {
    if (!SUPABASE_READY || String(memberId).startsWith('local')) return;
    await supabaseRequest('histories', { method: 'POST', body: JSON.stringify([{ member_id: memberId, kind, title }]) });
  };

  const updateMemberStampsToDb = async (memberId, stamps) => {
    if (!SUPABASE_READY || String(memberId).length < 10) return;
    await supabaseRequest(`members?id=eq.${memberId}`, { method: 'PATCH', body: JSON.stringify({ stamps }) });
  };

  const createCouponToDb = async (memberId, reward) => {
    if (!SUPABASE_READY || String(memberId).length < 10) return;
    await supabaseRequest('coupons', {
      method: 'POST',
      body: JSON.stringify([{ member_id: memberId, type: reward.couponType, label: reward.couponLabel || reward.name, status: 'active' }]),
    });
  };

  const useCouponToDb = async (couponId) => {
    if (!SUPABASE_READY || String(couponId).startsWith('local')) return;
    await supabaseRequest(`coupons?id=eq.${couponId}`, { method: 'PATCH', body: JSON.stringify({ status: 'used', used_at: new Date().toISOString() }) });
  };

  const createRoulettePlayToDb = async (memberId, resultName) => {
    if (!SUPABASE_READY || String(memberId).length < 10) return;
    await supabaseRequest('roulette_plays', { method: 'POST', body: JSON.stringify([{ member_id: memberId, play_date: todayKey(), result: resultName }]) });
  };

  const getNextRewardIndex = () => {
    if (bagCursor >= rewardBag.length) {
      const nextBag = createShuffledBag(rewards);
      setRewardBag(nextBag);
      setBagCursor(1);
      return nextBag[0] || 0;
    }
    const picked = rewardBag[bagCursor] || 0;
    setBagCursor((prev) => prev + 1);
    return picked;
  };

  const applySpinResult = (memberId, reward, source) => {
    let dbNextStamps = null;
    setMembers((prev) => prev.map((member) => {
      if (member.id !== memberId) return member;
      let nextStamp = member.stamps - 1;
      let nextCoupons = member.coupons;
      const nextRoulettePlays = { ...(member.roulettePlays || {}) };
      if (source === 'customer') nextRoulettePlays[todayKey()] = (nextRoulettePlays[todayKey()] || 0) + 1;
      if (reward.type === 'stamp') nextStamp += Number(reward.value || 0);
      if (reward.type === 'coupon') {
        nextCoupons = [{ id: `local-c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type: reward.couponType, label: reward.couponLabel || reward.name, status: 'active', createdAt: makeTimeLabel() }, ...member.coupons];
      }
      dbNextStamps = Math.max(0, nextStamp);
      const title = reward.type === 'coupon' ? `룰렛 당첨 · ${reward.couponLabel || reward.name} 지급` : `룰렛 당첨 · ${reward.name}`;
      return {
        ...member,
        stamps: dbNextStamps,
        coupons: nextCoupons,
        roulettePlays: nextRoulettePlays,
        history: addHistory(member, { kind: source === 'customer' ? '고객룰렛' : '직원룰렛', title }),
      };
    }));

    const historyKind = source === 'customer' ? '고객룰렛' : '직원룰렛';
    const historyTitle = reward.type === 'coupon' ? `룰렛 당첨 · ${reward.couponLabel || reward.name} 지급` : `룰렛 당첨 · ${reward.name}`;
    updateMemberStampsToDb(memberId, dbNextStamps);
    if (reward.type === 'coupon') createCouponToDb(memberId, reward);
    saveHistoryToDb(memberId, historyKind, historyTitle);
    createRoulettePlayToDb(memberId, reward.name);
  };

  const spinRouletteForMember = (id, source) => {
    const isCustomer = source === 'customer';
    const activeSpinning = isCustomer ? customerSpinning : spinning;
    if (activeSpinning) return;
    const member = members.find((item) => item.id === id);
    if (!member || member.stamps < 1) {
      isCustomer ? setCustomerResult('스탬프가 부족합니다.') : setResult('스탬프가 부족합니다.');
      return;
    }
    if (isCustomer) {
      const played = member.roulettePlays?.[todayKey()] || 0;
      if (played >= DAILY_CUSTOMER_SPIN_LIMIT) {
        setCustomerResult('오늘 참여 가능 횟수 3회를 모두 사용했습니다.');
        return;
      }
    }

    const index = getNextRewardIndex();
    const slice = 360 / rewards.length;
    const selectedMid = index * slice + slice / 2;
    const currentAngle = isCustomer ? customerAngle : angle;
    const finalAngle = 360 - selectedMid;
    const currentNormalized = ((currentAngle % 360) + 360) % 360;
    const deltaToFinal = ((finalAngle - currentNormalized) + 360) % 360;
    const targetRotation = currentAngle + 360 * 6 + deltaToFinal;

    if (isCustomer) {
      setCustomerSpinning(true);
      setCustomerPendingName(member.name);
      setCustomerResult('룰렛을 돌리는 중...');
      setCustomerAngle(targetRotation);
    } else {
      setSpinning(true);
      setPendingName(member.name);
      setResult('룰렛을 돌리는 중...');
      setAngle(targetRotation);
    }

    window.setTimeout(() => {
      const reward = rewards[index] || rewards[0];
      applySpinResult(id, reward, source);
      if (isCustomer) {
        setCustomerResult(`${member.name} 고객님 · ${reward.name}`);
        setCustomerPendingName('');
        setCustomerSpinning(false);
      } else {
        setResult(`${member.name} 고객님 · ${reward.name}`);
        setPendingName('');
        setSpinning(false);
      }
    }, 3600);
  };

  const addStamp = (id, delta) => {
    let nextStampsForDb = null;
    const title = delta > 0 ? `스탬프 +${delta} 적립` : `스탬프 ${delta} 조정`;
    setMembers((prev) => prev.map((member) => {
      if (member.id !== id) return member;
      nextStampsForDb = Math.max(0, member.stamps + delta);
      return { ...member, stamps: nextStampsForDb, history: addHistory(member, { kind: '스탬프', title }) };
    }));
    updateMemberStampsToDb(id, nextStampsForDb);
    saveHistoryToDb(id, '스탬프', title);
  };

  const useCoupon = (memberId, couponId) => {
    let usedLabel = '';
    setMembers((prev) => prev.map((member) => {
      if (member.id !== memberId) return member;
      const targetCoupon = member.coupons.find((coupon) => coupon.id === couponId);
      if (!targetCoupon) return member;
      usedLabel = targetCoupon.label;
      return {
        ...member,
        coupons: member.coupons.filter((coupon) => coupon.id !== couponId),
        history: addHistory(member, { kind: '쿠폰사용', title: `${targetCoupon.label} 사용` }),
      };
    }));
    useCouponToDb(couponId);
    if (usedLabel) saveHistoryToDb(memberId, '쿠폰사용', `${usedLabel} 사용`);
    setResult('쿠폰이 적용되고 소멸되었습니다.');
    setCustomerResult('쿠폰이 적용되고 소멸되었습니다.');
  };

  const lookupCustomer = () => {
    const found = members.find((member) => member.phone === customerPhone);
    if (!found) {
      setCustomerMemberId(null);
      setCustomerResult('등록된 회원을 찾을 수 없습니다.');
      return;
    }
    setCustomerMemberId(found.id);
    setCustomerResult(`${found.name} 고객님 정보를 불러왔습니다.`);
  };

  if (mode === 'customer') {
    return (
      <CustomerPage
        rewards={rewards}
        customerPhone={customerPhone}
        setCustomerPhone={setCustomerPhone}
        customerMember={customerMember}
        customerResult={customerResult}
        customerSpinning={customerSpinning}
        customerAngle={customerAngle}
        customerPendingName={customerPendingName}
        onLookup={lookupCustomer}
        onSpin={spinRouletteForMember}
        onUseCoupon={useCoupon}
        onGoStaff={() => setMode('staff')}
      />
    );
  }

  if (!isStaff) {
    return (
      <div style={styles.loginPage}>
        <div style={styles.loginCard}>
          <div style={styles.loginLogo}>BLUEDIA COFFEE</div>
          <div style={styles.loginSub}>프리미엄 원두의 향미 · 직원 로그인 시스템</div>
          <div style={styles.loginPanel}>
            <div style={styles.panelEyebrow}>staff access</div>
            <h2 style={styles.loginTitle}>직원 로그인</h2>
            <input type="password" placeholder="직원 비밀번호를 입력하세요" value={password} onChange={(event) => { setPassword(event.target.value); setLoginError(''); }} style={styles.loginInput} />
            {loginError ? <div style={styles.loginError}>{loginError}</div> : null}
            <button style={styles.loginBtn} onClick={() => { if (password === STAFF_PASS) setIsStaff(true); else setLoginError('직원 비밀번호가 올바르지 않습니다.'); }}>로그인</button>
            <button style={styles.customerLinkBtn} onClick={() => setMode('customer')}>고객 페이지로 돌아가기</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <div>
          <div style={styles.panelEyebrow}>BLUEDIA COFFEE</div>
          <h1 style={styles.mainTitle}>프리미엄 룰렛 멤버십 시스템</h1>
          <div style={styles.mainSub}>직원은 실행만, 설정은 사장님 비밀번호로만 변경됩니다.</div>
        </div>
        <div style={styles.topActions}>
          <button style={styles.settingsBtn} onClick={() => { setSettingsOpen(true); setOwnerPassword(''); setOwnerUnlocked(false); }}>설정</button>
          <button style={styles.logoutBtn} onClick={() => setMode('customer')}>고객 페이지</button>
          <button style={styles.logoutBtn} onClick={() => setIsStaff(false)}>로그아웃</button>
        </div>
      </div>

      <div style={styles.heroGrid}>
        <div style={styles.heroLeft}>
          <RouletteWheel rewards={rewards} angle={angle} />
          <ResultBadge result={result} spinning={spinning} pendingName={pendingName} />
        </div>
        <div style={styles.heroRight}>
          <div style={styles.statGrid}>
            <div style={styles.statCard}><div style={styles.statLabel}>총 회원</div><div style={styles.statValue}>{members.length}명</div></div>
            <div style={styles.statCard}><div style={styles.statLabel}>이벤트 항목</div><div style={styles.statValue}>{rewards.length}개</div></div>
            <div style={styles.statCard}><div style={styles.statLabel}>무료음료 비중</div><div style={styles.statValue}>{formatPercent(normalize(rewards).find((item) => item.type === 'coupon' && item.couponType === 'free')?.normalizedProb || 0)}</div></div>
            <div style={styles.statCard}><div style={styles.statLabel}>전체 보유 쿠폰</div><div style={styles.statValue}>{members.reduce((sum, member) => sum + member.coupons.length, 0)}개</div></div>
          </div>
          <div style={styles.lockInfoCard}>
            <div style={styles.lockInfoTitle}>설정 보호 모드</div>
            <div style={styles.lockInfoText}>룰렛 이벤트 구성은 상단 설정 버튼에서만 열 수 있고, 사장님 비밀번호를 입력해야 변경됩니다.</div>
          </div>
        </div>
      </div>

      <div style={styles.memberSection}>
        <div style={styles.sectionHeaderRow}>
          <div><div style={styles.panelEyebrow}>회원 관리</div><h3 style={styles.panelTitle}>직원용 빠른 적립 / 룰렛 실행</h3></div>
          <div style={styles.memberGuide}>룰렛은 스탬프 1개를 사용합니다</div>
        </div>
        <div style={styles.memberGrid}>
          {members.map((member) => (
            <MemberCard key={member.id} member={member} onAdd={(memberId) => addStamp(memberId, 1)} onMinus={(memberId) => addStamp(memberId, -1)} onSpin={spinRouletteForMember} onUseCoupon={useCoupon} disabled={spinning} />
          ))}
        </div>
      </div>

      <SettingsModal open={settingsOpen} rewards={rewards} setRewards={rebuildBag} totalProb={totalProb} ownerPassword={ownerPassword} setOwnerPassword={setOwnerPassword} ownerUnlocked={ownerUnlocked} unlockOwner={() => { if (ownerPassword === OWNER_PASS) setOwnerUnlocked(true); }} close={() => setSettingsOpen(false)} />
    </div>
  );
}

const styles = {
  loginPage: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#1f326d,#405cb2)', padding: 24 },
  loginCard: { width: '100%', maxWidth: 460, padding: 30, background: '#fff', borderRadius: 28, boxShadow: '0 30px 90px rgba(0,0,0,0.25)' },
  loginLogo: { fontSize: 28, fontWeight: 900, color: '#1f326d' },
  loginSub: { marginTop: 8, color: '#6a738f', fontSize: 14 },
  loginPanel: { marginTop: 24, padding: 20, borderRadius: 22, background: '#f7f9fd', border: '1px solid #e8ecf5' },
  loginInput: { width: '100%', boxSizing: 'border-box', padding: '14px 16px', borderRadius: 16, border: '1px solid #dbe3f0', background: '#fff', fontSize: 15, outline: 'none' },
  loginBtn: { marginTop: 14, width: '100%', padding: '14px 16px', borderRadius: 16, border: 'none', background: 'linear-gradient(135deg,#1f326d,#405cb2)', color: '#fff', fontSize: 15, fontWeight: 900, cursor: 'pointer' },
  customerLinkBtn: { marginTop: 10, width: '100%', padding: '12px 16px', borderRadius: 16, border: '1px solid #dbe3f0', background: '#fff', color: '#1f326d', fontSize: 14, fontWeight: 900, cursor: 'pointer' },
  loginTitle: { margin: '10px 0 16px', fontSize: 26, color: '#162244' },
  loginError: { marginTop: 10, color: '#b54343', fontSize: 13 },
  page: { minHeight: '100vh', padding: 28, background: 'linear-gradient(180deg,#edf2fb,#f9f5ef)', boxSizing: 'border-box' },
  topBar: { display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 22, flexWrap: 'wrap' },
  topActions: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  panelEyebrow: { fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9d7c61' },
  mainTitle: { margin: '6px 0 8px', fontSize: 36, color: '#172447', letterSpacing: '-1.2px' },
  mainSub: { color: '#63708d', fontSize: 15 },
  settingsBtn: { border: '1px solid #d7dfed', background: '#fff8f0', color: '#7d5b3d', borderRadius: 16, padding: '12px 18px', fontWeight: 800, cursor: 'pointer' },
  logoutBtn: { border: '1px solid #d7dfed', background: '#fff', color: '#1f326d', borderRadius: 16, padding: '12px 18px', fontWeight: 800, cursor: 'pointer' },
  heroGrid: { display: 'grid', gridTemplateColumns: 'minmax(420px,1fr) minmax(360px,1fr)', gap: 22, alignItems: 'start' },
  heroLeft: { background: 'rgba(255,255,255,0.88)', borderRadius: 28, padding: 24, boxShadow: '0 24px 60px rgba(34,55,116,0.12)' },
  heroRight: { display: 'grid', gap: 18 },
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 14 },
  statCard: { background: '#fff', border: '1px solid #ebeff6', borderRadius: 22, padding: 18, boxShadow: '0 18px 40px rgba(49,67,120,0.08)' },
  statLabel: { fontSize: 13, color: '#7b859f', marginBottom: 8 },
  statValue: { fontSize: 22, fontWeight: 900, color: '#1a2549' },
  lockInfoCard: { background: '#fff', border: '1px solid #ebeff6', borderRadius: 24, padding: 22, boxShadow: '0 18px 40px rgba(49,67,120,0.08)' },
  lockInfoTitle: { fontSize: 20, fontWeight: 900, color: '#172447' },
  lockInfoText: { marginTop: 10, fontSize: 14, lineHeight: 1.6, color: '#6d7892' },
  panel: { background: '#fff', border: '1px solid #ebeff6', borderRadius: 24, padding: 20 },
  panelHeaderRow: { display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' },
  panelTitle: { margin: '6px 0 0', fontSize: 24, color: '#172447' },
  totalPill: { borderRadius: 999, padding: '10px 14px', background: '#f7f4ef', border: '1px solid #ead9c8', fontWeight: 800, fontSize: 13 },
  rewardList: { display: 'grid', gap: 10 },
  rewardRow: { display: 'grid', gridTemplateColumns: '14px minmax(0,1fr) 90px 78px', gap: 10, alignItems: 'center', padding: 10, borderRadius: 16, background: '#f8fafc', border: '1px solid #ebeff6' },
  colorDot: { width: 14, height: 14, borderRadius: '50%' },
  rewardNameInput: { width: '100%', boxSizing: 'border-box', borderRadius: 12, border: '1px solid #dbe3f0', background: '#fff', padding: '10px 12px', fontSize: 14 },
  rewardProbInput: { width: '100%', boxSizing: 'border-box', borderRadius: 12, border: '1px solid #dbe3f0', background: '#fff', padding: '10px 12px', fontSize: 14 },
  percentText: { fontSize: 13, fontWeight: 800, color: '#6a738f', textAlign: 'right' },
  helperText: { marginTop: 12, fontSize: 13, color: '#74819d', lineHeight: 1.5 },
  memberSection: { marginTop: 22, background: '#fff', borderRadius: 28, padding: 22, boxShadow: '0 24px 60px rgba(34,55,116,0.1)' },
  sectionHeaderRow: { display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' },
  memberGuide: { borderRadius: 999, padding: '10px 14px', background: '#f6efe7', border: '1px solid #e7d7c7', color: '#875f3d', fontWeight: 800, fontSize: 13 },
  memberGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(270px,1fr))', gap: 14 },
  memberCard: { borderRadius: 22, padding: 18, background: 'linear-gradient(180deg,#fff,#f7f9fd)', border: '1px solid #ebeff6', boxShadow: '0 14px 28px rgba(43,59,111,0.08)' },
  memberTop: { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' },
  memberTopRight: { display: 'grid', gap: 8, justifyItems: 'end' },
  memberName: { fontSize: 20, fontWeight: 900, color: '#172447' },
  memberPhone: { marginTop: 6, color: '#7b859f', fontSize: 13 },
  stampPill: { borderRadius: 999, padding: '10px 12px', minWidth: 74, textAlign: 'center', background: '#1f326d', color: '#fff', fontWeight: 900 },
  couponPill: { borderRadius: 999, padding: '8px 12px', minWidth: 74, textAlign: 'center', background: '#f6efe7', color: '#7d5b3d', fontWeight: 900, fontSize: 13, border: '1px solid #e7d7c7' },
  memberBottom: { display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: 8, marginTop: 18 },
  secondaryBtn: { borderRadius: 14, border: '1px solid #dbe3f0', background: '#fff', padding: '12px 10px', fontWeight: 800, color: '#23325f', cursor: 'pointer' },
  spinBtn: { borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#1f326d,#405cb2)', color: '#fff', padding: '12px 10px', fontWeight: 900, cursor: 'pointer' },
  memberSubSection: { marginTop: 14, paddingTop: 14, borderTop: '1px solid #ebeff6' },
  memberSubTitle: { fontSize: 13, fontWeight: 900, color: '#5f6c88', marginBottom: 10 },
  couponList: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  couponChip: { borderRadius: 999, border: '1px solid #d7dfed', background: '#fff', color: '#23325f', padding: '10px 12px', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', gap: 8, alignItems: 'center' },
  couponChipUse: { background: '#1f326d', color: '#fff', borderRadius: 999, padding: '4px 8px', fontSize: 11, fontWeight: 900 },
  historyList: { display: 'grid', gap: 8 },
  historyRow: { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', borderRadius: 12, padding: '10px 12px', background: '#f8fafc', border: '1px solid #ebeff6' },
  historyTitle: { fontSize: 13, fontWeight: 800, color: '#23325f' },
  historyMeta: { marginTop: 4, fontSize: 11, color: '#7b859f' },
  historyType: { fontSize: 12, fontWeight: 900, color: '#7d5b3d', background: '#f6efe7', border: '1px solid #e7d7c7', borderRadius: 999, padding: '6px 10px', whiteSpace: 'nowrap' },
  emptyMini: { fontSize: 12, color: '#8a95ad' },
  rouletteStage: { position: 'relative', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', paddingTop: 12, paddingBottom: 8 },
  rouletteStageCompact: { position: 'relative', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', paddingTop: 18, paddingBottom: 12 },
  pointerWrap: { position: 'absolute', top: -2, left: '50%', transform: 'translateX(-50%)', zIndex: 4 },
  pointer: { width: 0, height: 0, borderLeft: '18px solid transparent', borderRight: '18px solid transparent', borderTop: '34px solid #c14444', filter: 'drop-shadow(0 8px 12px rgba(0,0,0,0.2))' },
  wheelShell: { borderRadius: '50%', transition: 'transform 3.6s cubic-bezier(0.14,0.8,0.18,1)', willChange: 'transform' },
  wheelSvg: { display: 'block' },
  resultCard: { marginTop: 18, borderRadius: 22, padding: 18, background: 'linear-gradient(135deg,#1b2750,#31478f)', color: '#fff' },
  resultLabel: { fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#d7c1a8', fontWeight: 800 },
  resultValue: { marginTop: 10, fontSize: 24, lineHeight: 1.2, fontWeight: 900 },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(10,16,35,0.5)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, padding: 24 },
  modalCard: { width: '100%', maxWidth: 860, maxHeight: '90vh', overflow: 'auto', borderRadius: 28, background: '#fff', boxShadow: '0 30px 80px rgba(16,25,58,0.3)', padding: 24 },
  modalHeader: { display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 20 },
  modalTitle: { margin: '6px 0 0', fontSize: 28, color: '#172447' },
  closeBtn: { border: '1px solid #d7dfed', background: '#fff', color: '#1f326d', borderRadius: 14, padding: '10px 14px', fontWeight: 800, cursor: 'pointer' },
  lockBox: { borderRadius: 22, padding: 24, background: '#fff', border: '1px solid #e8ecf5' },
  lockTitle: { fontSize: 22, fontWeight: 900, color: '#172447' },
  lockSub: { marginTop: 10, marginBottom: 16, fontSize: 14, lineHeight: 1.6, color: '#6d7892' },
  customerPage: { minHeight: '100vh', padding: 24, background: 'linear-gradient(180deg,#edf2fb,#f9f5ef)', boxSizing: 'border-box', color: '#172447' },
  customerHeader: { maxWidth: 1180, margin: '0 auto 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' },
  customerTitle: { margin: '6px 0 8px', fontSize: 34, lineHeight: 1.08, fontWeight: 900, color: '#172447' },
  customerSub: { fontSize: 15, lineHeight: 1.6, color: '#63708d' },
  customerGrid: { maxWidth: 1180, margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(330px,0.85fr) minmax(360px,1.15fr)', gap: 20, alignItems: 'start' },
  customerPanel: { padding: 24, border: '1px solid rgba(255,255,255,0.95)', borderRadius: 28, background: 'rgba(255,255,255,0.88)', boxShadow: '0 24px 60px rgba(34,55,116,0.12)' },
  customerPanelWide: { maxWidth: 1180, margin: '20px auto 0', padding: 24, border: '1px solid rgba(255,255,255,0.95)', borderRadius: 28, background: 'rgba(255,255,255,0.88)', boxShadow: '0 24px 60px rgba(34,55,116,0.12)' },
  customerSearchRow: { display: 'grid', gridTemplateColumns: '1fr 110px', gap: 12, marginTop: 18, alignItems: 'stretch' },
  customerInput: { width: '100%', boxSizing: 'border-box', padding: '16px 18px', borderRadius: 18, border: '1px solid #dbe3f0', background: '#fff', fontSize: 18, fontWeight: 800, color: '#172447', outline: 'none' },
  mySummaryCard: { marginTop: 20, padding: 20, borderRadius: 24, background: 'linear-gradient(180deg,#fff,#f7f9fd)', border: '1px solid #ebeff6' },
  mySummaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 12, marginTop: 16 },
  customerRouletteBox: { marginTop: 18, padding: 22, borderRadius: 24, background: 'linear-gradient(135deg,#fff8f0,#fff)', border: '1px solid #ead9c8' },
  customerSpinBtn: { marginTop: 16, width: '100%', border: 'none', borderRadius: 18, padding: '17px 18px', background: 'linear-gradient(135deg,#1f326d,#405cb2)', color: '#fff', fontSize: 16, fontWeight: 900, cursor: 'pointer' },
  customerWarn: { marginTop: 12, padding: '10px 12px', borderRadius: 14, background: '#fff1f1', border: '1px solid #ffd0d0', color: '#b54343', fontSize: 13, fontWeight: 900 },
};
