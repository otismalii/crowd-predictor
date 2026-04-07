
## Pagaza Betz Production Revamp

### Phase 1: Critical Stability Fixes (5 files)

**1A. Fix `execute-trade` edge function LMSR overflow**
Replace raw `Math.exp(q/b)` with max-subtraction pattern in `supabase/functions/execute-trade/index.ts`. Add guards for `b <= 0`, `NaN`/`Infinity` results, and a max shares-per-trade limit (10,000). The `lmsrCost` function needs to return `b * Math.log(sum) + maxQ` instead of `b * Math.log(sum)`.

**1B. Admin route guard in App.tsx**
Import `AdminRoute` from `src/routes/route-guards.tsx` and wrap all `/admin/*` routes. Create the `AdminRoute` component using `useAdminGuard`:
```text
<Route path="/admin" element={<AdminRoute><AdminOverviewPage /></AdminRoute>} />
```
Then remove the duplicated inline `has_role` RPC checks from `AdminOverviewPage`, `AdminMarketsPage`, and all other admin pages -- they should just render content directly since the route guard handles auth.

**1C. PWA iframe guard in main.tsx**
Add before service worker registration:
```text
const isInIframe = window.self !== window.top
const isPreviewHost = window.location.hostname.includes("id-preview--")
if (isPreviewHost || isInIframe) {
  navigator.serviceWorker?.getRegistrations().then(regs => regs.forEach(r => r.unregister()))
}
```

**1D. Fix Feed.tsx hero background**
Replace the `heroBg` import with an inline CSS gradient fallback. Remove dependency on `src/assets/hero-bg.jpg`.

---

### Phase 2: PesaPal Payment Integration (4 new files, 1 edit)

**2A. Add secrets**
Store `PESAPAL_CONSUMER_KEY` (`5dmbgMfLGLVcQ7NQDyyVKuzIEshhQMkN`) and `PESAPAL_CONSUMER_SECRET` (`KvwEhJa6BV9muE5djcmfTFZKnvE=`).

**2B. Create `supabase/functions/pesapal-deposit/index.ts`**
- Authenticate user via JWT
- Call PesaPal v3 OAuth2 (`https://pay.pesapal.com/v3/api/Auth/RequestToken`) to get bearer token
- Register IPN callback URL
- Submit order via `https://pay.pesapal.com/v3/api/Transactions/SubmitOrderRequest`
- Create pending transaction in DB with PesaPal `order_tracking_id` as reference
- Return redirect URL to client

**2C. Create `supabase/functions/pesapal-callback/index.ts`**
- Receive IPN notification from PesaPal
- Query transaction status via `https://pay.pesapal.com/v3/api/Transactions/GetTransactionStatus`
- On status=1 (completed): credit wallet, update transaction, create notification
- On failed: mark transaction failed

**2D. Create `supabase/functions/pesapal-withdraw/index.ts`**
- Validate balance, deduct immediately
- Create pending withdrawal transaction
- Admin approves/rejects via treasury dashboard (no auto-disbursement yet)

**2E. Update `src/pages/Wallet.tsx`**
- Replace IntaSend STK push with PesaPal redirect flow
- Deposit: call `pesapal-deposit`, redirect user to PesaPal payment page
- Withdraw: submit request, show pending status
- Keep transaction history and portfolio sections unchanged

---

### Phase 3: Admin Treasury & Fraud Hardening (4 files)

**3A. Treasury approve/reject actions**
Add to `AdminTreasuryPage.tsx`:
- "Approve" / "Reject" buttons on pending deposits and withdrawals
- Approve deposit: update transaction status to completed, credit wallet
- Reject deposit: update status to failed
- Approve withdrawal: mark as processed
- Reject withdrawal: refund wallet balance, update status

Add corresponding functions to `src/services/treasuryService.ts`:
- `approveTransaction(txId)` 
- `rejectTransaction(txId)`

**3B. Enhanced fraud detection**
Add to `src/services/fraudService.ts`:
- Same phone number across multiple user accounts
- Failed deposit spam detection (>3 failed in 1 hour)

Add admin action buttons to `AdminFraudPage.tsx`:
- "Flag User" button
- "Block Transaction" button

**3C. Admin users page enhancement**
Update `AdminUsersPage.tsx` with:
- Wallet balance display per user
- Transaction count
- Flag/suspend toggle

---

### Phase 4: Dead Code Cleanup (delete ~6 files)

Check imports and remove unused admin components:
- `src/components/admin/AdminAPI.tsx`
- `src/components/admin/AdminAuditLog.tsx`
- `src/components/admin/AdminDisputes.tsx`
- `src/components/admin/AdminIngestion.tsx`
- `src/components/admin/AdminPredictions.tsx`
- `src/components/admin/AdminSourceRegistry.tsx`

Only delete if no other file imports them.

---

### Phase 5: SEO (4 files)

Add `<SEOHead>` to:
- `Leaderboard.tsx`: title="Leaderboard | Pagaza"
- `Portfolio.tsx`: title="Portfolio | Pagaza"
- `Wallet.tsx`: title="Dashboard | Pagaza"
- `MarketDetail.tsx`: Add JSON-LD structured data for the market

---

### Technical Notes

- PesaPal API base: `https://pay.pesapal.com/v3/api/` (production) -- the provided keys appear to be production keys
- IntaSend functions are NOT deleted -- kept as deprecated fallback
- No database schema changes required
- All admin pages will use `useAdminGuard` hook consistently instead of inline RPC calls
- Edge function LMSR fix is critical for preventing trade failures with large pool values
