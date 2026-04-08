

# Pagaza Fintech-Grade Refactor Plan

## A. Code Audit Summary

**Critical weaknesses found:**

1. **No phone number on profiles** — phone is only captured per-transaction, not stored on the user profile. No uniqueness enforcement.
2. **No phone number verification** — anyone can enter any phone number for withdrawals.
3. **Auth has no email verification gate** — users can trade immediately without confirming email.
4. **Wallet page is 553 lines** — profile, portfolio, deposit/withdraw, and transaction history are all crammed into one component.
5. **Admin overview fetches predictions/matches** (legacy sports model) instead of markets/trades/treasury KPIs.
6. **3 "Coming Soon" placeholder pages** — Bots, Uploads, Collaborations are empty shells taking up routes.
7. **No ledger entries created on deposit approval** — treasury `approveTransaction` credits wallet but skips ledger.
8. **Admin Users page has no wallet balance or transaction count** — makes user investigation impossible.
9. **No eagle-themed status language** — resolution/settlement messages are generic.
10. **Profile edit has no phone number field** — users cannot add their phone for withdrawals.

---

## B. Refactor Plan — 6 Phases

### Phase 1: Auth & Profile Hardening (DB migration + 3 files)

**DB Migration:**
- Add `phone_number TEXT` column to `profiles` table with a UNIQUE constraint
- Add `phone_verified BOOLEAN DEFAULT false` to `profiles`
- Add `email_verified BOOLEAN DEFAULT false` to `profiles`

**Auth.tsx changes:**
- After signup confirmation screen, add a "phone number required" step before allowing access to wallet
- Add a phone number field on the post-confirmation profile setup
- Validate phone format (254XXXXXXXXX, 10+ digits)

**ProfileEdit.tsx changes:**
- Add phone number field with format validation
- Show current phone number (masked: 254***678)
- Prevent phone number changes once set (require admin)

**Wallet.tsx withdrawal changes:**
- Pull phone from `profiles.phone_number` instead of manual input
- If no phone on profile, show "Add phone number in profile first" instead of phone input
- Block withdrawal if `profiles.phone_number` is null

**pesapal-withdraw edge function:**
- Query `profiles.phone_number` from DB instead of accepting from request body
- Reject if no phone on profile

### Phase 2: Wallet Page Split & Eagle Theming (5 files)

Split `Wallet.tsx` (553 lines) into focused sections:

**Keep `Wallet.tsx` as the dashboard shell** (~150 lines) — layout, header, stats row only.

**Extract to new components:**
- `src/components/wallet/DepositWithdraw.tsx` — deposit/withdraw form with PesaPal flow
- `src/components/wallet/PositionsPanel.tsx` — portfolio positions list with filtering
- `src/components/wallet/TransactionHistory.tsx` — recent transactions list

**Eagle-themed status language:**
- Market resolved → "Eagle has landed" badge
- High-confidence market → "Eagle vision" indicator
- Dispute/conflict → "Turbulence detected" label
- Successful payout → "Landing confirmed" toast
- Apply these in `MarketStatusPill.tsx`, `ResolutionBadge.tsx`, toast messages, and settlement notifications

### Phase 3: Admin Control Room Overhaul (6 files)

**AdminOverviewPage.tsx — complete rewrite of stats:**
- Replace predictions/matches counters with fintech KPIs:
  - Total users, Active users (7d), Open markets, Total volume
  - Pending deposits, Pending withdrawals, Net treasury balance
  - Today's trades, Resolution queue depth
- Add "Pending Actions" section showing counts of items needing admin attention
- Add "System Health" indicators (PesaPal connectivity, last sync time)

**AdminUsersPage.tsx enhancements:**
- Add wallet balance column per user
- Add transaction count column
- Add phone number display (masked)
- Add "Flag User" / "Suspend" toggle with reason capture
- Add link to user's transaction history

**AdminTreasuryPage.tsx fixes:**
- Fix `approveTransaction` to create ledger entries (currently missing)
- Add "Liabilities" card (sum of all user wallet balances = what platform owes)
- Add "Platform Revenue" card (sum of house_fee ledger entries)
- Add "Reserve Ratio" indicator (treasury net balance vs user liabilities)
- Add confirmation dialog before approve/reject with reason field

**AdminFraudPage.tsx enhancements:**
- Add "Flag User" action button on each alert
- Add "Block Transaction" action button
- Add "Dismiss Alert" with reason capture
- Add fraud alert history (not just current scan)

**Delete placeholder pages (3 files):**
- `AdminBotsPage.tsx` — remove from routes
- `AdminUploadsPage.tsx` — remove from routes
- `AdminCollaborationsPage.tsx` — remove from routes
- Update `App.tsx` to remove these 3 routes
- Update `AdminOverviewPage.tsx` to remove Bots, Uploads, Collabs from quick links

### Phase 4: Trading & Resolution Hardening (3 files)

**execute-trade edge function:**
- Add idempotency check (prevent double-submit within 5s for same user+market+outcome+shares)
- Add ledger entry for every trade (currently only `transactions` table, no ledger)
- Validate market `closes_at` hasn't passed before allowing trade

**MarketDetail.tsx improvements:**
- Add fee disclosure before trade confirmation ("Cost: KES 52.30 incl. 0% fee")
- Add position lock indicator for resolved markets
- Show settlement status with eagle-themed language
- Add "Market Rules" expandable section showing resolution criteria
- Improve trade confirmation: show estimated price impact

**Resolution system (AdminResolutionPage.tsx):**
- Keep AdminDisputes and AdminSourceRegistry (they're functional)
- Add resolution confidence indicator per market
- Add "Admin Override" with mandatory reason field
- Show resolution audit trail

### Phase 5: Ledger & Treasury Integrity (2 files)

**treasuryService.ts:**
- Fix `approveTransaction` to create ledger entries:
  ```
  For deposits: ledger entry type "deposit", balance_after = wallet.balance + amount
  For withdrawals: ledger entry already created at hold time, mark as "completed"
  ```
- Fix `rejectTransaction` for deposits: no ledger entry needed (no money moved)
- Fix `rejectTransaction` for withdrawals: create refund ledger entry

**execute-trade edge function:**
- Add ledger entries for trade_buy and trade_sell
- Include `balance_after` in every entry

### Phase 6: UX Polish & Cleanup (8 files)

**Mobile-first improvements:**
- Add `pb-20` to main content containers (mobile nav covers bottom content)
- Ensure all admin tables have horizontal scroll on mobile
- Add touch-friendly tap targets (min 44px) on trade buttons

**Empty states:**
- All admin pages: show helpful empty states instead of blank tables
- Markets page: "No markets yet — create one from the admin panel"

**Error handling:**
- Wrap all `fetchAll` patterns in try-catch with user-facing error toasts
- Add retry buttons on error states

**Performance:**
- Remove unused imports across all files (Aurora, SplitText used sparingly)
- Add `useMemo` for expensive computations in admin pages

---

## C. Target File Structure

```text
src/
├── components/
│   ├── admin/          (AdminOverview, AdminUsers, AdminMatches, etc.)
│   ├── layout/         (Navbar, Footer, MobileNav, ProtectedRoute)
│   ├── markets/        (MarketCard, MarketFilters, MarketGrid, etc.)
│   ├── wallet/         (DepositWithdraw, PositionsPanel, TransactionHistory) ← NEW
│   ├── skeletons/      (loading states)
│   ├── reactbits/      (Aurora, GradientText, etc.)
│   └── ui/             (shadcn primitives)
├── contexts/           (AuthContext, GuestContext)
├── hooks/              (useAdminGuard, usePullToRefresh, etc.)
├── lib/                (pricing, ledger, format, utils, etc.)
├── pages/
│   ├── admin/          (Overview, Treasury, Fraud, Analytics, Markets, Users, Resolution)
│   └── player/         (Dashboard, Activity)
├── routes/             (route-guards)
├── services/           (walletService, treasuryService, fraudService, etc.)
└── integrations/       (supabase client + types)
```

**Files to delete:**
- `src/pages/admin/AdminBotsPage.tsx`
- `src/pages/admin/AdminUploadsPage.tsx`
- `src/pages/admin/AdminCollaborationsPage.tsx`

**Files to create:**
- `src/components/wallet/DepositWithdraw.tsx`
- `src/components/wallet/PositionsPanel.tsx`
- `src/components/wallet/TransactionHistory.tsx`

---

## D. Security Hardening Checklist

| Item | Status |
|------|--------|
| Admin routes guarded by `AdminRoute` | ✅ Already done |
| `has_role` RPC for admin checks | ✅ Already done |
| Phone uniqueness per account | 🔧 Phase 1 |
| Phone pulled from profile, not request | 🔧 Phase 1 |
| Ledger entries on all fund movements | 🔧 Phase 5 |
| Trade idempotency guard | 🔧 Phase 4 |
| Approval confirmation dialogs | 🔧 Phase 3 |
| LMSR overflow protection | ✅ Already done |
| PesaPal JWT validation | ✅ Already done |
| RLS on all tables | ✅ Already done |

---

## E. Non-Negotiable Checklist

| Requirement | Phase |
|-------------|-------|
| Auth is secure and predictable | 1 |
| Email verification works | 1 (already via Supabase) |
| Phone number required & unique | 1 |
| Wallet is ledger-based | 5 |
| Deposits/withdrawals auditable | 5 |
| Treasury/liabilities visible | 3 |
| Trades are safe and validated | 4 |
| Oracle resolution is evidence-based | 4 |
| Admin override is logged | 4 |
| Fraud signals tracked | 3 |
| Analytics meaningful | 3 |
| UI feels premium and mobile-first | 2, 6 |
| Empty/loading/error states polished | 6 |
| Code modular and maintainable | 2 |
| No placeholder pages | 3 |

