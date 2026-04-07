
## Pagaza Betz Production Revamp Plan

This plan fixes critical bugs, replaces IntaSend with PesaPal for payments, hardens admin tooling, cleans dead code, and adds PWA safety. Organized by priority.

---

### Phase 1: Critical Stability Fixes

**1A. Fix `execute-trade` edge function numerical instability**
The server-side LMSR in `supabase/functions/execute-trade/index.ts` uses raw `Math.exp(q/b)` without max-subtraction, causing `Infinity` for large pool values. Apply the same guard pattern from `src/lib/pricing.ts`.

Files: `supabase/functions/execute-trade/index.ts`

**1B. Fix Feed.tsx `heroBg` import safety**
`src/assets/hero-bg.jpg` exists but is a potential build issue if removed. Replace with a CSS gradient fallback that doesn't depend on the asset, or keep the import but add a fallback.

Files: `src/pages/Feed.tsx`

**1C. Fix admin routes missing route guard**
Admin routes in `App.tsx` (lines 122-132) have no route-level guard -- they rely on each page's internal `useAdminGuard`. This is fragile. Wrap all `/admin/*` routes in an `AdminRoute` guard component.

Files: `src/App.tsx`, `src/routes/route-guards.tsx`

**1D. Deduplicate admin guard logic**
`AdminOverviewPage`, `AdminMarketsPage`, and other admin pages each independently call `has_role` RPC. Refactor to use the existing `useAdminGuard` hook consistently. Remove the duplicated inline check pattern.

Files: `src/pages/admin/AdminOverviewPage.tsx`, `src/pages/admin/AdminMarketsPage.tsx` (+ other admin pages that duplicate the pattern)

**1E. PWA service worker iframe guard**
Per Lovable PWA rules, the service worker must not register inside iframes or preview hosts. Add the guard to `src/main.tsx`.

Files: `src/main.tsx`

---

### Phase 2: PesaPal Payment Integration

**2A. Add PesaPal secrets**
Store `PESAPAL_CONSUMER_KEY` and `PESAPAL_CONSUMER_SECRET` as Supabase edge function secrets. The values provided:
- Key: `5dmbgMfLGLVcQ7NQDyyVKuzIEshhQMkN`
- Secret: `KvwEhJa6BV9muE5djcmfTFZKnvE=`

**2B. Create `pesapal-deposit` edge function**
New edge function that:
1. Authenticates user via JWT
2. Validates amount and phone
3. Calls PesaPal OAuth2 to get auth token
4. Registers IPN URL
5. Submits order request
6. Creates pending transaction in DB
7. Returns redirect URL for user to complete payment

Files: `supabase/functions/pesapal-deposit/index.ts`

**2C. Create `pesapal-callback` edge function**
IPN callback handler that:
1. Receives PesaPal notification
2. Queries transaction status from PesaPal API
3. Updates transaction status in DB
4. Credits wallet on success
5. Creates notification for user

Files: `supabase/functions/pesapal-callback/index.ts`

**2D. Create `pesapal-withdraw` edge function**
Withdrawal handler (manual approval flow for now):
1. Validates user balance
2. Deducts from wallet immediately
3. Creates pending withdrawal transaction
4. Admin approves/rejects via treasury dashboard

Files: `supabase/functions/pesapal-withdraw/index.ts`

**2E. Update Wallet UI for PesaPal**
Replace the IntaSend STK Push UI with PesaPal flow:
- Deposit: redirect to PesaPal payment page
- Withdraw: submit request for admin approval
- Show pending/completed/failed states

Files: `src/pages/Wallet.tsx`

**2F. Keep IntaSend edge functions** (don't delete yet -- mark as deprecated for fallback)

---

### Phase 3: Admin Dashboard Hardening

**3A. Add transaction approve/reject to Treasury**
Add action buttons on pending transactions in `AdminTreasuryPage`:
- Approve deposit (credit wallet + update status)
- Reject deposit (update status to failed)
- Approve withdrawal (mark as processed)
- Reject withdrawal (refund wallet balance)

Files: `src/pages/admin/AdminTreasuryPage.tsx`, `src/services/treasuryService.ts`

**3B. Add admin user management actions**
The `AdminUsersPage` needs actual CRUD:
- View user details + wallet balance
- Flag/suspend accounts (update profile status)
- View user transaction history

Files: `src/pages/admin/AdminUsersPage.tsx`

**3C. Enhance fraud detection**
Add to the existing fraud scanner:
- Same phone number across different accounts
- Failed deposit spam (many failed attempts)
- Admin action buttons: flag user, block transaction

Files: `src/services/fraudService.ts`, `src/pages/admin/AdminFraudPage.tsx`

---

### Phase 4: Dead Code Removal & Cleanup

**4A. Remove unused/redundant files**
Audit and remove:
- `src/components/admin/AdminAPI.tsx` (if unused)
- `src/components/admin/AdminAuditLog.tsx` (if unused)  
- `src/components/admin/AdminDisputes.tsx` (if unused)
- `src/components/admin/AdminIngestion.tsx` (if unused)
- `src/components/admin/AdminPredictions.tsx` (if unused)
- `src/components/admin/AdminSourceRegistry.tsx` (if unused)
- Any components not imported anywhere

**4B. Remove mock data patterns**
Search for hardcoded sample data arrays, fake balances, or static JSON markets in components and remove them. Replace with proper empty states.

**4C. Consolidate duplicate LMSR implementations**
The edge function `execute-trade` has its own LMSR. Keep it (server needs its own copy) but apply the numerical stability fix. Document that `src/lib/pricing.ts` is the client reference and `execute-trade/index.ts` is the server reference.

---

### Phase 5: SEO & Performance

**5A. Add SEOHead to pages missing it**
Pages that need `<SEOHead>`:
- `src/pages/Leaderboard.tsx`
- `src/pages/Profile.tsx`
- `src/pages/Portfolio.tsx`
- `src/pages/Wallet.tsx`

With appropriate titles, descriptions, and canonical URLs.

**5B. Add JSON-LD to MarketDetail**
Add structured data for market pages:
```json
{ "@type": "Event", "name": "...", "description": "..." }
```

Files: `src/pages/MarketDetail.tsx`

---

### Assumptions
- PesaPal API uses their v3 REST API (OAuth2 + order submission + IPN callbacks)
- IntaSend functions are kept but deprecated (not deleted) for existing transaction continuity
- No database schema changes needed -- existing `transactions`, `wallets`, and `ledger_entries` tables support PesaPal
- Admin approve/reject actions will use edge functions or direct service-role Supabase calls
- The PesaPal consumer key/secret provided are for sandbox/testing

### Implementation Order
1. Phase 1 (stability) -- unblocks everything
2. Phase 2 (PesaPal) -- core payment pivot  
3. Phase 3 (admin) -- operational tooling
4. Phase 4 (cleanup) -- reduce surface area
5. Phase 5 (SEO) -- growth layer
