import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Camera,
  Check,
  Coins,
  Coffee,
  ExternalLink,
  Gift,
  History,
  LogIn,
  Minus,
  Phone,
  Plus,
  RefreshCcw,
  RotateCw,
  Save,
  Search,
  Settings,
  Shield,
  Stamp,
  Ticket,
  User,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { clearCreatorConfig, getResolvedAppConfig, saveCreatorConfig } from './lib/appConfig.js';
import {
  COUPON_STATUS_LABELS,
  currencyPoints,
  formatDateTime,
  formatPhone,
  formatRouletteRewardLabel,
  normalizeExternalUrl,
  normalizePhone,
} from './lib/domain.js';
import { createRepository } from './lib/repository.js';

const repo = createRepository();
const ADMIN_EMAIL = 'admin@bluedia.local';
const ADMIN_PASSWORD = 'admin1234';

const primaryTabs = [
  { id: 'customer', label: '고객', icon: User },
  { id: 'signup', label: '가입', icon: UserPlus },
];

function App() {
  const [activeScreen, setActiveScreen] = useState('customer');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customer, setCustomer] = useState(null);
  const [customerMessage, setCustomerMessage] = useState('');
  const [signupOpen, setSignupOpen] = useState(false);
  const [signupForm, setSignupForm] = useState({ name: '', phone: '', privacyConsent: false, marketingConsent: false });
  const [signupMessage, setSignupMessage] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [staffResults, setStaffResults] = useState([]);
  const [staffCustomer, setStaffCustomer] = useState(null);
  const [staffPin, setStaffPin] = useState('');
  const [drinkQty, setDrinkQty] = useState(1);
  const [staffMessage, setStaffMessage] = useState('');
  const [couponRequests, setCouponRequests] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [rewardDrafts, setRewardDrafts] = useState([]);
  const [dailyLimitDraft, setDailyLimitDraft] = useState(3);
  const [reviewCouponDraft, setReviewCouponDraft] = useState(1);
  const [reviewUrlDraft, setReviewUrlDraft] = useState('https://map.naver.com/');
  const [staffPinDrafts, setStaffPinDrafts] = useState({});
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  const [adminForm, setAdminForm] = useState({ email: '', password: '' });
  const [adminMessage, setAdminMessage] = useState('');
  const [creatorConfig, setCreatorConfig] = useState(() => getResolvedAppConfig());
  const [creatorMessage, setCreatorMessage] = useState('');
  const [lastReward, setLastReward] = useState(null);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [isCouponRequesting, setIsCouponRequesting] = useState(false);
  const [isCouponEarnRequesting, setIsCouponEarnRequesting] = useState(false);

  const activeRewards = useMemo(() => rewardDrafts.filter((reward) => reward.active), [rewardDrafts]);

  useEffect(() => {
    refreshDashboard();
    refreshCouponRequests();
  }, []);

  useEffect(() => {
    if (activeScreen !== 'staff') return undefined;
    refreshCouponRequests();
    const timer = window.setInterval(refreshCouponRequests, 4500);
    return () => window.clearInterval(timer);
  }, [activeScreen]);

  async function refreshDashboard() {
    try {
      const next = await repo.getDashboard();
      setDashboard(next);
      setRewardDrafts(next.rewards || []);
      setDailyLimitDraft(next.store?.daily_roulette_limit || 3);
      setReviewCouponDraft(next.store?.review_coupon_count || 1);
      setReviewUrlDraft(next.store?.review_url || 'https://map.naver.com/');
    } catch (error) {
      setAdminMessage(error.message);
    }
  }

  async function refreshCouponRequests() {
    try {
      setCouponRequests((await repo.listPendingCouponRequests()) || []);
    } catch {
      setCouponRequests([]);
    }
  }

  async function lookupCustomer(phone = customerPhone, options = {}) {
    try {
      const summary = await repo.lookupCustomer(to010Phone(phone));
      setCustomer(summary);
      setCustomerPhone(toLocalPhoneInput(summary.phone_normalized || phone));
      setCustomerMessage(options.silent ? '' : '고객 정보를 불러왔습니다.');
    } catch (error) {
      setCustomer(null);
      setCustomerMessage(error.message);
    }
  }

  async function handleSignup(event) {
    event.preventDefault();
    try {
      const result = await repo.signupCustomer({ ...signupForm, phone: to010Phone(signupForm.phone) });
      setSignupMessage(result.message);
      setCustomer(result.customer);
      setCustomerPhone(toLocalPhoneInput(result.customer?.phone_normalized || signupForm.phone));
      setSignupForm({ name: '', phone: '', privacyConsent: false, marketingConsent: false });
      setSignupOpen(false);
      setActiveScreen('customer');
      await refreshDashboard();
    } catch (error) {
      setSignupMessage(error.message);
    }
  }

  async function spinRoulette() {
    if (!customer || isSpinning) return;
    setIsSpinning(true);
    try {
      const result = await repo.spinRoulette(customer.id);
      const rewards = activeRewards.length ? activeRewards : dashboard?.rewards || [];
      const index = Math.max(0, rewards.findIndex((reward) => reward.id === result.reward.id));
      setWheelRotation((rotation) => rotation + 1800 + index * 31);
      window.setTimeout(async () => {
        setLastReward(result.reward);
        setCustomer(result.customer);
        setCustomerMessage(`${formatRouletteRewardLabel(result.reward)} 결과가 저장되었습니다.`);
        await refreshDashboard();
        setIsSpinning(false);
      }, 1200);
    } catch (error) {
      setCustomerMessage(error.message);
      setIsSpinning(false);
    }
  }

  async function requestFreeDrinkCoupon() {
    if (!customer || isCouponRequesting) return;
    setIsCouponRequesting(true);
    try {
      const result = await repo.requestFreeDrinkCoupon(customer.id);
      if (result.customer) setCustomer(result.customer);
      setCustomerMessage(result.message || '직원 화면에 쿠폰 요청을 보냈습니다.');
      await refreshCouponRequests();
    } catch (error) {
      setCustomerMessage(error.message);
    } finally {
      setIsCouponRequesting(false);
    }
  }

  async function requestCouponEarn() {
    if (!customer || isCouponEarnRequesting) return;
    setIsCouponEarnRequesting(true);
    try {
      const result = await repo.requestCouponEarn(customer.id);
      if (result.customer) setCustomer(result.customer);
      setCustomerMessage(result.message || '직원 화면에 쿠폰 적립 요청을 보냈습니다.');
      await refreshCouponRequests();
    } catch (error) {
      setCustomerMessage(error.message);
    } finally {
      setIsCouponEarnRequesting(false);
    }
  }

  async function searchStaffCustomers(value = staffSearch) {
    const results = await repo.searchCustomersByLast4(value);
    setStaffResults(results);
    setStaffCustomer(results.length === 1 ? results[0] : null);
  }

  function appendDigit(value) {
    if (staffSearch.length >= 4) return;
    const next = `${staffSearch}${value}`;
    setStaffSearch(next);
    searchStaffCustomers(next);
  }

  function backspaceDigit() {
    const next = staffSearch.slice(0, -1);
    setStaffSearch(next);
    searchStaffCustomers(next);
  }

  async function runStaffAction(action) {
    if (!staffCustomer) return setStaffMessage('먼저 고객을 선택해 주세요.');
    try {
      let updated;
      if (action === 'earn') updated = await repo.staffAdjustStamps({ customerId: staffCustomer.id, pin: staffPin, quantity: drinkQty, direction: 1 });
      if (action === 'deduct') updated = await repo.staffAdjustStamps({ customerId: staffCustomer.id, pin: staffPin, quantity: 1, direction: -1 });
      if (action === 'reset') updated = await repo.resetOrderCouponCount({ customerId: staffCustomer.id, pin: staffPin });
      setStaffCustomer(updated);
      if (customer?.id === updated.id) setCustomer(updated);
      setStaffMessage('직원 처리가 완료되었습니다.');
      await refreshDashboard();
    } catch (error) {
      setStaffMessage(error.message);
    }
  }

  async function runCouponMileageAction(action) {
    if (!staffCustomer) return setStaffMessage('먼저 고객을 선택해 주세요.');
    try {
      let updated;
      let message = '처리되었습니다.';
      if (action === 'freeDrink') {
        updated = await repo.redeemFreeDrinkWithCoupons({ customerId: staffCustomer.id, pin: staffPin });
        message = '무료음료 쿠폰 사용 처리 완료. 쿠폰 10개가 차감되었습니다.';
      }
      if (action === 'convertToPoints') {
        updated = await repo.convertMileageCouponToPoints({ customerId: staffCustomer.id, pin: staffPin });
        message = '쿠폰 1개가 200P로 전환되었습니다.';
      }
      if (action === 'usePoints') {
        updated = await repo.redeemPoints({ customerId: staffCustomer.id, pin: staffPin, points: 1000 });
        message = '1000P를 사용 처리했습니다.';
      }
      setStaffCustomer(updated);
      if (customer?.id === updated.id) setCustomer(updated);
      setStaffMessage(message);
      await refreshCouponRequests();
      await refreshDashboard();
    } catch (error) {
      setStaffMessage(error.message);
    }
  }

  async function applyCouponRequest(request) {
    try {
      const result = await repo.applyCouponRequest({ requestId: request.id, pin: staffPin });
      if (result.customer) {
        setStaffCustomer(result.customer);
        if (customer?.id === result.customer.id) setCustomer(result.customer);
      }
      setCouponRequests(result.requests || []);
      setStaffMessage(result.message || '쿠폰 요청을 적용했습니다.');
      await refreshDashboard();
    } catch (error) {
      setStaffMessage(error.message);
    }
  }

  async function saveRewards(event) {
    event.preventDefault();
    try {
      const total = rewardDrafts.filter((reward) => reward.active).reduce((sum, reward) => sum + Number(reward.probability || 0), 0);
      if (total <= 0) return setAdminMessage('활성 룰렛 보상의 확률 합계가 1 이상이어야 합니다.');
      const next = await repo.updateRouletteSettings({ rewards: rewardDrafts, dailyLimit: dailyLimitDraft, reviewCouponCount: reviewCouponDraft, reviewUrl: normalizeExternalUrl(reviewUrlDraft) });
      setDashboard(next);
      setRewardDrafts(next.rewards || []);
      setAdminMessage(`운영 설정이 저장되었습니다. 활성 확률 합계 ${total}%`);
      if (customer) await lookupCustomer(customer.phone_normalized || customer.phone, { silent: true });
    } catch (error) {
      setAdminMessage(error.message);
    }
  }

  async function updateStaffPin(staffId) {
    try {
      const next = await repo.updateStaffPin({ staffId, pin: staffPinDrafts[staffId] || '' });
      setDashboard(next);
      setStaffPinDrafts((drafts) => ({ ...drafts, [staffId]: '' }));
      setAdminMessage('직원 PIN이 변경되었습니다.');
    } catch (error) {
      setAdminMessage(error.message);
    }
  }

  async function resetStaffPin(staffId) {
    try {
      const next = await repo.resetStaffPin({ staffId });
      setDashboard(next);
      setStaffPin('');
      setAdminMessage('직원 PIN이 초기화되었습니다.');
    } catch (error) {
      setAdminMessage(error.message);
    }
  }

  function loginAdmin(event) {
    event.preventDefault();
    if (adminForm.email.trim() === ADMIN_EMAIL && adminForm.password === ADMIN_PASSWORD) {
      setAdminLoggedIn(true);
      setAdminMessage('관리자 모드가 열렸습니다.');
    } else {
      setAdminMessage('관리자 이메일 또는 비밀번호가 올바르지 않습니다.');
    }
  }

  function resetDemoData() {
    if (!repo.resetDemoData) return setAdminMessage('Supabase 모드에서는 화면에서 로컬 초기화를 지원하지 않습니다.');
    repo.resetDemoData();
    window.location.reload();
  }

  async function saveCreatorSettings(event) {
    event.preventDefault();
    setCreatorConfig(saveCreatorConfig(creatorConfig));
    setCreatorMessage('제작관리자 설정이 이 브라우저에 저장되었습니다.');
    await refreshDashboard();
  }

  async function resetCreatorSettings() {
    setCreatorConfig(clearCreatorConfig());
    setCreatorMessage('브라우저 제작관리자 설정이 초기화되었습니다.');
    await refreshDashboard();
  }

  return (
    <div className="pageShell">
      <main className="appShell">
        <header className="topBar">
          <div>
            <div className="eyebrow">BLUEDIA COFFEE</div>
            <h1 className="brand">BLUEDIA</h1>
            <p className="subline">쿠폰 · 스탬프 · 룰렛</p>
          </div>
          <div className="topActions">
            <button className={`utilityPill ${activeScreen === 'staff' ? 'active' : ''}`} onClick={() => setActiveScreen('staff')} type="button"><Coffee size={13} />직원</button>
            <button className={`utilityPill ${activeScreen === 'admin' ? 'active' : ''}`} onClick={() => setActiveScreen('admin')} type="button"><Shield size={13} />관리</button>
          </div>
        </header>

        <nav className="tabs">
          {primaryTabs.map((tab) => {
            const Icon = tab.icon;
            return <button key={tab.id} type="button" className={`tab ${activeScreen === tab.id ? 'active' : ''}`} onClick={() => setActiveScreen(tab.id)}><Icon size={16} /><span>{tab.label}</span></button>;
          })}
        </nav>

        {activeScreen === 'customer' && <CustomerScreen {...{ customer, customerPhone, setCustomerPhone, lookupCustomer, customerMessage, activeRewards, wheelRotation, spinRoulette, isSpinning, lastReward, dashboard, requestCouponEarn, isCouponEarnRequesting, requestFreeDrinkCoupon, isCouponRequesting }} />}
        {activeScreen === 'signup' && <SignupScreen {...{ signupOpen, setSignupOpen, signupForm, setSignupForm, signupMessage, handleSignup }} />}
        {activeScreen === 'staff' && <StaffScreen {...{ staffSearch, staffResults, staffCustomer, setStaffCustomer, appendDigit, backspaceDigit, searchStaffCustomers, staffPin, setStaffPin, drinkQty, setDrinkQty, runStaffAction, runCouponMileageAction, couponRequests, applyCouponRequest, staffMessage }} />}
        {activeScreen === 'admin' && <AdminScreen {...{ dashboard, adminLoggedIn, adminForm, setAdminForm, loginAdmin, adminMessage, rewardDrafts, setRewardDrafts, dailyLimitDraft, setDailyLimitDraft, reviewCouponDraft, setReviewCouponDraft, reviewUrlDraft, setReviewUrlDraft, saveRewards, resetDemoData, staffPinDrafts, setStaffPinDrafts, updateStaffPin, resetStaffPin, creatorConfig, setCreatorConfig, saveCreatorSettings, resetCreatorSettings, creatorMessage }} />}
      </main>
      <aside className="contactFooter">쿠폰 및 기타 제작문의 카카오톡ID: <strong>directorseul</strong></aside>
    </div>
  );
}

function CustomerScreen({ customer, customerPhone, setCustomerPhone, lookupCustomer, customerMessage, activeRewards, wheelRotation, spinRoulette, isSpinning, lastReward, dashboard, requestCouponEarn, isCouponEarnRequesting, requestFreeDrinkCoupon, isCouponRequesting }) {
  const activeCoupons = customer?.coupons?.filter((coupon) => coupon.status === 'active') || [];
  const reviewUrl = normalizeExternalUrl(dashboard?.store?.review_url || 'https://map.naver.com/');
  return <section className="screenStack">
    <article className="panel"><div className="eyebrow">MY PAGE LOGIN</div><h2 className="sectionTitle">전화번호로 내 쿠폰 확인</h2><form className="inputRow" onSubmit={(event) => { event.preventDefault(); lookupCustomer(); }}><label className="fieldLabel"><span>휴대폰 번호</span><Fixed010PhoneInput value={customerPhone} onChange={setCustomerPhone} /></label><button className="primaryButton" type="submit"><Search size={18} />조회</button></form>{customerMessage && <StatusLine tone={successTone(customerMessage) ? 'success' : 'danger'}>{customerMessage}</StatusLine>}<SummaryGrid customer={customer} /></article>
    <article className="panel reviewEventPanel"><a className="reviewEventButton" href={reviewUrl}><Camera size={18} /><span>사진리뷰 써주시면 쿠폰 {dashboard?.store?.review_coupon_count || 1}개 적립</span><ExternalLink size={15} /></a></article>
    <article className="panel"><PanelTitle icon={Ticket} title="내 쿠폰 지갑" />{activeCoupons.length ? <div className="couponList">{activeCoupons.map((coupon) => <CouponRow key={coupon.id} coupon={coupon} readonly />)}</div> : <EmptyState text="보유 중인 쿠폰이 없습니다." />}<p className="guardText">고객은 확인만 가능 · 사용과 전환은 직원이 처리합니다.</p><div className="couponRequestActions"><button className="couponRequestButton" type="button" onClick={requestCouponEarn} disabled={!customer || isCouponEarnRequesting}><Plus size={17} />{isCouponEarnRequesting ? '요청 보내는 중' : '쿠폰 적립 요청'}</button><button className="couponRequestButton gold" type="button" onClick={requestFreeDrinkCoupon} disabled={!customer || Number(customer?.stamps || 0) < 10 || isCouponRequesting}><Gift size={17} />{isCouponRequesting ? '요청 보내는 중' : '무료음료 쿠폰 요청'}</button></div></article>
    <article className="panel wheelPanel"><Wheel rewards={activeRewards} rotation={wheelRotation} /><div className="resultBox"><span>이번 결과</span><strong>{lastReward ? formatRouletteRewardLabel(lastReward) : '룰렛 결과가 여기에 표시됩니다'}</strong></div><button className="primaryButton wide" type="button" onClick={spinRoulette} disabled={!customer || isSpinning}><RotateCw size={18} />{isSpinning ? '룰렛 회전 중' : '쿠폰 1개 사용하고 룰렛 참여'}</button></article>
    <article className="panel"><PanelTitle icon={History} title="사용내역" /><HistoryList logs={customer?.history || []} /></article>
  </section>;
}

function SignupScreen({ signupOpen, setSignupOpen, signupForm, setSignupForm, signupMessage, handleSignup }) {
  return <section className="screenStack"><article className="panel"><div className="eyebrow">NEW MEMBER</div><h2 className="sectionTitle">처음 방문이신가요?</h2><button className="primaryButton wide" type="button" onClick={() => setSignupOpen(true)}><UserPlus size={18} />가입하기</button>{signupMessage && <StatusLine tone={successTone(signupMessage) ? 'success' : 'danger'}>{signupMessage}</StatusLine>}</article>{signupOpen && <article className="panel"><PanelTitle icon={BadgeCheck} title="회원가입" /><form className="formStack" onSubmit={handleSignup}><label className="fieldLabel"><span>이름</span><input value={signupForm.name} onChange={(event) => setSignupForm({ ...signupForm, name: event.target.value })} /></label><label className="fieldLabel"><span>휴대폰 번호</span><Fixed010PhoneInput value={signupForm.phone} onChange={(phone) => setSignupForm({ ...signupForm, phone })} /></label><CheckboxRow checked={signupForm.privacyConsent} onChange={(checked) => setSignupForm({ ...signupForm, privacyConsent: checked })} label="[필수] 개인정보 수집·이용에 동의합니다." /><CheckboxRow checked={signupForm.marketingConsent} onChange={(checked) => setSignupForm({ ...signupForm, marketingConsent: checked })} label="[선택] 이벤트·혜택·쿠폰 알림 수신에 동의합니다." /><button className="primaryButton wide" type="submit"><Gift size={18} />회원가입하고 웰컴 쿠폰 받기</button><button className="secondaryButton wide" type="button" onClick={() => setSignupOpen(false)}><X size={18} />취소</button></form></article>}</section>;
}

function StaffScreen({ staffSearch, staffResults, staffCustomer, setStaffCustomer, appendDigit, backspaceDigit, searchStaffCustomers, staffPin, setStaffPin, drinkQty, setDrinkQty, runStaffAction, runCouponMileageAction, couponRequests, applyCouponRequest, staffMessage }) {
  return <section className="screenStack"><CouponRequestPopup requests={couponRequests} staffPin={staffPin} setStaffPin={setStaffPin} onApply={applyCouponRequest} /><article className="panel"><PanelTitle icon={Phone} title="전화번호 뒷자리 검색" /><div className="searchBox">{staffSearch}</div><div className="keypad">{[1,2,3,4,5,6,7,8,9].map((digit) => <button key={digit} className="keyButton" type="button" onClick={() => appendDigit(digit)}>{digit}</button>)}<button className="keyButton" type="button" onClick={backspaceDigit}>←</button><button className="keyButton" type="button" onClick={() => appendDigit(0)}>0</button><button className="keyButton primaryKey" type="button" onClick={() => searchStaffCustomers(staffSearch)}>검색</button></div><div className="resultList">{staffResults.map((result) => <button className={`resultItem ${staffCustomer?.id === result.id ? 'active' : ''}`} key={result.id} type="button" onClick={() => setStaffCustomer(result)}><span>{result.name}</span><small>{result.phone}</small></button>)}</div></article><article className="panel">{staffCustomer ? <><div className="staffHeader"><div><h2 className="sectionTitle compact">{staffCustomer.name}</h2><p className="subline">{staffCustomer.phone}</p></div><span className="badge">고객 선택됨</span></div><SummaryGrid customer={staffCustomer} compact mode="staff" /><div className="staffControls"><label className="fieldLabel"><span>직원 PIN</span><input type="password" value={staffPin} onChange={(event) => setStaffPin(event.target.value)} /></label><label className="fieldLabel"><span>음료 수량</span><input type="number" min="1" value={drinkQty} onChange={(event) => setDrinkQty(event.target.value)} /></label></div><div className="actions"><button className="actionButton primary" onClick={() => runStaffAction('earn')} type="button"><Plus size={16} />적립</button><button className="actionButton" onClick={() => runStaffAction('deduct')} type="button"><Minus size={16} />-1 조정</button><button className="actionButton gold" onClick={() => runStaffAction('reset')} type="button"><RefreshCcw size={16} />재주문 리셋</button></div><div className="staffCouponTools"><div className="couponToolTitle"><Gift size={16} /><span>쿠폰/포인트 처리</span></div><button className="actionButton gold" type="button" onClick={() => runCouponMileageAction('freeDrink')}>무료음료 쿠폰 사용 (-10)</button><button className="actionButton" type="button" onClick={() => runCouponMileageAction('convertToPoints')}>포인트로 전환하기 (-1/+200P)</button><button className="actionButton primary" type="button" onClick={() => runCouponMileageAction('usePoints')}>1000P 사용</button></div></> : <EmptyState text="전화번호 뒷자리로 고객을 검색해 주세요." />}{staffMessage && <StatusLine tone={successTone(staffMessage) ? 'success' : 'danger'}>{staffMessage}</StatusLine>}</article></section>;
}

function AdminScreen({ dashboard, adminLoggedIn, adminForm, setAdminForm, loginAdmin, adminMessage, rewardDrafts, setRewardDrafts, dailyLimitDraft, setDailyLimitDraft, reviewCouponDraft, setReviewCouponDraft, reviewUrlDraft, setReviewUrlDraft, saveRewards, resetDemoData, staffPinDrafts, setStaffPinDrafts, updateStaffPin, resetStaffPin, creatorConfig, setCreatorConfig, saveCreatorSettings, resetCreatorSettings, creatorMessage }) {
  const activeTotal = rewardDrafts.filter((reward) => reward.active).reduce((sum, reward) => sum + Number(reward.probability || 0), 0);
  if (!adminLoggedIn) return <section className="screenStack"><article className="panel"><div className="eyebrow">ADMIN LOGIN</div><h2 className="sectionTitle">최고관리자 화면</h2><form className="formStack" onSubmit={loginAdmin}><label className="fieldLabel"><span>관리자 이메일</span><input value={adminForm.email} onChange={(event) => setAdminForm({ ...adminForm, email: event.target.value })} /></label><label className="fieldLabel"><span>비밀번호</span><input type="password" value={adminForm.password} onChange={(event) => setAdminForm({ ...adminForm, password: event.target.value })} /></label><button className="primaryButton wide" type="submit"><LogIn size={18} />관리자 로그인</button></form>{adminMessage && <StatusLine tone="danger">{adminMessage}</StatusLine>}</article></section>;
  return <section className="screenStack"><article className="panel"><div className="adminTitleRow"><PanelTitle icon={Settings} title="운영/룰렛 설정" /><span className="badge muted">관리자</span></div><form className="formStack" onSubmit={saveRewards}><label className="fieldLabel"><span>기본 일일 참여 제한</span><input type="number" min="1" value={dailyLimitDraft} onChange={(event) => setDailyLimitDraft(event.target.value)} /></label><div className="settingsGrid"><label className="fieldLabel"><span>사진리뷰 적립 쿠폰</span><input type="number" min="1" value={reviewCouponDraft} onChange={(event) => setReviewCouponDraft(event.target.value)} /></label><label className="fieldLabel"><span>네이버 리뷰 URL</span><input value={reviewUrlDraft} onChange={(event) => setReviewUrlDraft(event.target.value)} /></label></div><div className="rewardList">{rewardDrafts.map((reward, index) => <div className="rewardEditor" key={reward.id}><CheckboxRow checked={reward.active} onChange={(checked) => { const next = [...rewardDrafts]; next[index] = { ...reward, active: checked }; setRewardDrafts(next); }} label={formatRouletteRewardLabel(reward)} /><input value={reward.label} onChange={(event) => { const next = [...rewardDrafts]; next[index] = { ...reward, label: event.target.value }; setRewardDrafts(next); }} /><input type="number" min="0" value={reward.reward_value} onChange={(event) => { const next = [...rewardDrafts]; next[index] = { ...reward, reward_value: event.target.value }; setRewardDrafts(next); }} /><input type="number" min="0" value={reward.probability} onChange={(event) => { const next = [...rewardDrafts]; next[index] = { ...reward, probability: event.target.value }; setRewardDrafts(next); }} /></div>)}</div><div className="adminMeta">활성 확률 합계 {activeTotal}%</div><button className="primaryButton wide" type="submit"><Save size={18} />운영 설정 저장</button><button className="secondaryButton wide" type="button" onClick={resetDemoData}><RefreshCcw size={18} />로컬 데이터 초기화</button></form>{adminMessage && <StatusLine tone={successTone(adminMessage) ? 'success' : 'danger'}>{adminMessage}</StatusLine>}</article><article className="panel"><PanelTitle icon={Shield} title="제작관리자" /><form className="formStack" onSubmit={saveCreatorSettings}><label className="fieldLabel"><span>데이터 모드</span><select value={creatorConfig.dataMode} onChange={(event) => setCreatorConfig({ ...creatorConfig, dataMode: event.target.value })}><option value="">로컬 저장</option><option value="supabase">Supabase 저장</option></select></label><label className="fieldLabel"><span>Supabase URL</span><input value={creatorConfig.supabaseUrl} onChange={(event) => setCreatorConfig({ ...creatorConfig, supabaseUrl: event.target.value })} /></label><label className="fieldLabel"><span>Supabase Anon Key</span><input value={creatorConfig.supabaseAnonKey} onChange={(event) => setCreatorConfig({ ...creatorConfig, supabaseAnonKey: event.target.value })} /></label><label className="fieldLabel"><span>Google Sheets Webhook URL</span><input value={creatorConfig.googleSheetsWebhookUrl} onChange={(event) => setCreatorConfig({ ...creatorConfig, googleSheetsWebhookUrl: event.target.value })} /></label><button className="primaryButton wide" type="submit"><Save size={18} />제작 설정 저장</button><button className="secondaryButton wide" type="button" onClick={resetCreatorSettings}>제작 설정 초기화</button></form>{creatorMessage && <StatusLine tone="success">{creatorMessage}</StatusLine>}</article><article className="panel"><PanelTitle icon={Shield} title="직원 PIN 관리" /><div className="staffAdminList">{(dashboard?.staff || []).map((staff) => <div className="staffAdminRow" key={staff.id}><div className="staffAdminMeta"><strong>{staff.name}</strong><span className={`badge ${staff.has_pin ? 'green' : 'muted'}`}>{staff.has_pin ? 'PIN 설정됨' : 'PIN 미설정'}</span></div><label className="fieldLabel staffPinField"><span>새 PIN</span><input type="password" value={staffPinDrafts[staff.id] || ''} onChange={(event) => setStaffPinDrafts({ ...staffPinDrafts, [staff.id]: event.target.value })} /></label><div className="staffAdminActions"><button className="actionButton primary" type="button" onClick={() => updateStaffPin(staff.id)}>변경</button><button className="actionButton" type="button" onClick={() => resetStaffPin(staff.id)}>초기화</button></div></div>)}</div></article><article className="panel"><PanelTitle icon={History} title="전체 로그" /><HistoryList logs={dashboard?.logs || []} /></article></section>;
}

function CouponRequestPopup({ requests, staffPin, setStaffPin, onApply }) {
  if (!requests?.length) return null;
  return <article className="couponRequestPopup"><div className="requestPopupHeader"><div><span className="eyebrow">COUPON REQUEST</span><h2>쿠폰 요청 {requests.length}건</h2></div><span className="badge gold">직원 확인</span></div><label className="fieldLabel"><span>직원 PIN</span><input type="password" value={staffPin} onChange={(event) => setStaffPin(event.target.value)} placeholder="PIN 입력 후 쿠폰 적용" /></label><div className="requestPopupList">{requests.map((request) => <div className="requestPopupItem" key={request.id}><div className="requestCustomer"><strong>{request.customer_name}</strong><span>{formatPhone(request.customer_phone)} · 보유 쿠폰 {request.customer_stamps}개</span><small>{request.request_type === 'earn_coupon' ? '쿠폰 적립 요청' : '무료음료 요청'} · {formatDateTime(request.requested_at)}</small></div><button className="actionButton primary" type="button" onClick={() => onApply(request)}><Check size={16} />{request.request_type === 'earn_coupon' ? '적립 적용' : '쿠폰 적용'}</button></div>)}</div></article>;
}

function SummaryGrid({ customer, compact = false, mode = 'customer' }) {
  const stats = [
    { label: '쿠폰', value: `${customer?.stamps || 0}개`, icon: Stamp },
    { label: '포인트', value: currencyPoints(customer?.points || 0), icon: Coins },
    { label: '오늘 참여', value: `${customer?.today_spins || 0}/${customer?.daily_limit || 3}회`, icon: RotateCw },
    mode === 'staff' ? { label: '총 쿠폰사용', value: `${customer?.coupon_uses_current_order || 0}개`, icon: Ticket } : { label: '다음 혜택까지', value: nextBenefitValue(customer), icon: Gift },
  ];
  return <div className={`summaryGrid ${compact ? 'compact' : ''}`}>{stats.map((stat) => { const Icon = stat.icon; return <div className="stat" key={stat.label}><div className="statLabel"><Icon size={14} />{stat.label}</div><div className="statValue">{stat.value}</div></div>; })}</div>;
}

function CouponRow({ coupon, readonly = false }) {
  return <div className="couponRow"><div className="couponMain"><strong>{coupon.name}</strong><span>발급 {formatDateTime(coupon.issued_at)} · 전환 {currencyPoints(coupon.convert_points)}</span></div>{readonly && <span className={`badge ${coupon.status === 'active' ? 'green' : 'muted'}`}>{COUPON_STATUS_LABELS[coupon.status] || coupon.status}</span>}</div>;
}

function Fixed010PhoneInput({ value, onChange }) {
  return <div className="fixedPhoneInput"><span>010</span><input value={value} onChange={(event) => onChange(toLocalPhoneInput(event.target.value))} inputMode="numeric" maxLength={9} placeholder="0000-0000" /></div>;
}

function Wheel({ rewards, rotation }) {
  return <div className="wheelWrap"><div className="pointer" /><svg className="wheel" viewBox="0 0 330 330" style={{ transform: `rotate(${rotation}deg)` }}><circle cx="165" cy="165" r="154" fill="#f7efe7" />{(rewards.length ? rewards : []).map((reward, index) => <g key={reward.id} transform={`rotate(${index * (360 / Math.max(1, rewards.length))} 165 165)`}><path d="M165 165 L165 20 A145 145 0 0 1 290 92 Z" fill={reward.color || '#405cb2'} stroke="#fff" strokeWidth="3" /><text x="220" y="88" textAnchor="middle" fill={reward.textColor || '#fff'} fontSize="13" fontWeight="900">{formatRouletteRewardLabel(reward)}</text></g>)}<circle cx="165" cy="165" r="45" fill="white" stroke="#d8c0a8" strokeWidth="8" /><circle cx="165" cy="165" r="33" fill="#1f326d" /><text x="165" y="164" textAnchor="middle" fill="white" fontSize="14" fontWeight="900">BLUEDIA</text></svg></div>;
}

function PanelTitle({ icon: Icon, title }) { return <div className="panelTitle"><Icon size={20} /><h2>{title}</h2></div>; }
function CheckboxRow({ checked, onChange, label }) { return <label className="checkRow"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span>{label}</span></label>; }
function EmptyState({ text }) { return <div className="emptyState">{text}</div>; }
function StatusLine({ tone, children }) { return <p className={`statusLine ${tone}`}>{children}</p>; }
function HistoryList({ logs }) { if (!logs?.length) return <EmptyState text="아직 기록이 없습니다." />; return <div className="historyList">{logs.map((log) => <div className="historyItem" key={log.id}><strong>{log.title || log.detail || log.action}</strong><span className="historyTime">{formatDateTime(log.created_at)}</span><span className="badge muted historyBadge">{log.action}</span></div>)}</div>; }
function nextBenefitValue(customer) { if (!customer) return '조회 후 표시'; const stamps = Number(customer.stamps || 0); const left = 10 - (stamps % 10); return left === 10 ? '혜택 가능' : `${left}개`; }
function to010Phone(value) { const digits = normalizePhone(value); if (!digits) return ''; return digits.startsWith('010') ? digits : `010${digits}`; }
function toLocalPhoneInput(value) { const digits = normalizePhone(value); const local = (digits.startsWith('010') ? digits.slice(3) : digits).slice(0, 8); return local.length > 4 ? `${local.slice(0, 4)}-${local.slice(4)}` : local; }
function successTone(message) { return ['완료', '저장', '초기화', '전환', '사용', '열렸습니다', '불러왔습니다', '보냈습니다', '떠 있습니다', '적용했습니다'].some((word) => String(message || '').includes(word)); }

export default App;
