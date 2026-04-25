# Needed fix: customer read-only coupons + staff history persistence

## Requirements
- Customer page must only show coupons. Customer cannot use coupons.
- Staff page can use coupons.
- Staff stamp add/subtract must write a row to `histories` with timestamp via `created_at`.
- Staff coupon use must update coupon status to `used`, set `used_at`, and write `histories` row.

## Current problem in src/App.jsx
- `CouponAndHistory` always renders the `사용` button.
- `CustomerPage` calls `<CouponAndHistory member={customerMember} onUseCoupon={onUseCoupon} />`, so customers can use coupons.
- DB write helpers use weak checks like `String(memberId).length < 10`; this can skip writes or behave inconsistently. Use UUID validation for real Supabase records.

## Patch plan
1. Add:
```js
function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}
```

2. Change `CouponAndHistory` signature:
```js
function CouponAndHistory({ member, onUseCoupon, readOnly = false })
```

3. Coupon button render:
```jsx
<button
  key={coupon.id}
  style={{ ...styles.couponChip, cursor: readOnly ? 'default' : 'pointer', opacity: readOnly ? 0.9 : 1 }}
  onClick={() => {
    if (!readOnly) onUseCoupon(member.id, coupon.id);
  }}
>
  {coupon.label}
  {!readOnly && <span style={styles.couponChipUse}>사용</span>}
</button>
```

4. In CustomerPage, change:
```jsx
<CouponAndHistory member={customerMember} onUseCoupon={onUseCoupon} />
```
to:
```jsx
<CouponAndHistory member={customerMember} onUseCoupon={onUseCoupon} readOnly />
```

5. In DB helpers, replace member id checks with:
```js
if (!SUPABASE_READY || !isUuid(memberId)) return;
```

6. After staff `addStamp` and `useCoupon`, call DB writes then reload:
```js
await updateMemberStampsToDb(id, nextStamps);
await saveHistoryToDb(id, '스탬프', title);
await loadFromSupabase();
```

```js
await useCouponToDb(couponId);
await saveHistoryToDb(memberId, '쿠폰사용', title);
await loadFromSupabase();
```
