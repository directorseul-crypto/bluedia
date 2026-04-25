# Staff history + customer coupon read-only fix

요청사항:
1. 직원이 스탬프를 적립/차감하면 `histories` 테이블에 날짜와 기록이 남아야 함.
2. 직원이 쿠폰을 사용하면 `coupons.status='used'`, `used_at` 저장, `histories`에 쿠폰 사용 기록이 남아야 함.
3. 고객 페이지에서는 쿠폰 사용 버튼을 제거하고 보유 쿠폰과 이력 확인만 가능해야 함.

수정 포인트:
- `CouponAndHistory`에 `readOnly=false` prop 추가.
- 고객 페이지에서는 `<CouponAndHistory ... readOnly />` 사용.
- 직원 페이지에서는 기존처럼 `readOnly` 없이 사용해서 쿠폰 사용 가능.
- `addStamp`와 `useCoupon`을 async로 바꾸고 DB 저장 후 `loadFromSupabase()` 호출.
- `saveHistoryToDb`, `updateMemberStampsToDb`, `useCouponToDb`는 실제 Supabase UUID에 대해서만 실행.

보안상 전체 App.jsx 자동 덮어쓰기는 차단될 수 있어 이 지시 파일을 저장함.