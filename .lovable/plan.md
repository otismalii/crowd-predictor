# Pagaza Trust & Polish Refactor — Correction Plan

This plan starts from what's visibly broken and works outward. Most of the fintech backbone (ledger entries, idempotency, phone gate, closes_at validation, audit log, treasury reasons) is **already wired** from prior phases — verified in `execute-trade/index.ts`, `treasuryService.ts`, and the `ledger_entries` / `market_audit_log` tables. This plan fixes the remaining trust gaps users actually see and feel.

---

## Priority 1 — Trust-Critical (ship first, low risk)

### 1.1 Remove "Admin" from public navigation
**Problem:** `Navbar.tsx` lines 39-42 + 60 add an `Admin` link to the visible nav whenever `has_role` returns true. Even for admins this leaks the existence of an admin surface to anyone shoulder-surfing or screenshotting. Non-admins never see it, but the route remains discoverable via `/admin`.

**Fix:**
- Drop the `Admin` entry from `allLinks` entirely.
- Move admin entry behind the user dropdown (under the `User` icon), only rendered when `isAdmin === true`.
- Keep `AdminRoute` guard intact (already enforced via `useAdminGuard`).

### 1.2 Replace static "50¢ / 33¢" prices with honest liquidity states
**Problem:** Markets with zero trades show identical flat prices because every outcome starts at `pool_shares = 100`. This makes the platform look broken/fake.

**Fix in `MarketCard.tsx` and `TradePanel.tsx`:**
- Compute `hasLiquidity = market.total_volume > 0` (not pool size — pools start seeded).
- When `!hasLiquidity`: render outcome rows with a muted "—" instead of `{pct}¢`, plus a small label "Awaiting first trade" under the title.
- When `hasLiquidity`: keep current LMSR-derived percentages.
- Add a 24h price-delta indicator (▲/▼ vs. price 24h ago) by querying recent `trades` for that market — small, but signals a live market.

### 1.3 Surface "Verify phone before trading" inline
**Problem:** Trade rejection happens server-side with a toast only after the user clicks Buy. Wasted intent.

**Fix in `TradePanel.tsx`:**
- Read `profile.phone_number` from `AuthContext`.
- If missing, replace the Buy/Sell buttons with a single CTA: "Add phone number to trade →" linking to `/profile/edit`.
- Show a small lock icon + helper text explaining why (KYC / withdrawal continuity).

---

## Priority 2 — Ledger & Wallet Truth

### 2.1 Make the ledger the user-visible source of truth
**Current state:** `ledger_entries` is written on every trade, deposit approval, and withdrawal rejection, but the wallet UI still reads from the `wallets.balance` cache.

**Fix:**
- In `TransactionHistory.tsx`, switch the data source from `transactions` to `ledger_entries` (joined with `transactions` for M-Pesa receipt display when `entry_type` is deposit/withdrawal). This gives users a single immutable timeline.
- Use `getEntryLabel()` and `isCredit()` from `src/lib/ledger.ts` (already exists) for consistent labeling.
- Show running `balance_after` in each row — users can audit their own balance history.
- Add a "Reconciliation" badge on the wallet header: green dot if `wallets.balance === latest ledger balance_after`, amber otherwise (with admin-alerting toast).

### 2.2 Withdrawal lock visibility
**Problem:** `lock_for_withdrawal()` RPC moves balance to `locked_balance`, but the wallet UI doesn't show locked funds clearly.

**Fix in `WalletBalance.tsx` + `DepositWithdraw.tsx`:**
- Show `Available: KES X` (= `balance`) and, if `locked_balance > 0`, a second line `On hold: KES Y` (with tooltip: "Pending withdrawal — released if rejected").
- Daily withdrawal cap progress bar: "KES 12,000 / 50,000 used today" sourced from `daily_withdrawal_total`.

### 2.3 PesaPal withdrawal: write the lock + ledger entry atomically
**Problem:** `pesapal-withdraw` records a `ledger_entries` row but should call `lock_for_withdrawal()` RPC instead of touching `wallets.balance` directly.

**Fix:** In `supabase/functions/pesapal-withdraw/index.ts`, replace direct balance mutation with `db.rpc("lock_for_withdrawal", { p_user_id, p_amount })`. On `treasuryService.approveTransaction` for withdrawals, call a new `release_lock_to_paid` flow (deduct from `locked_balance`, ledger `withdrawal` entry). On reject, call existing `release_withdrawal_lock`.

---

## Priority 3 — Notifications & Real-Time Feedback

### 3.1 Notification delivery polish
**Problem:** `NotificationBell` exists but notifications are written ad-hoc. Users miss key fintech events.

**Fix:**
- Standardize notification triggers in three edge functions: `execute-trade` (on settlement), `pesapal-callback` (deposit confirmed), `resolve-bets` (market resolved).
- Each notification gets: `type` (one of: `trade`, `deposit`, `withdrawal`, `resolution`, `dispute`), `title`, `message`, `link`. Already a table — just ensure consistency.
- Add realtime subscription in `NotificationBell.tsx` using `supabase.channel('notifications:user_id=eq.X')` so the bell badge updates without refresh.

### 3.2 Trade success: show eagle-themed confirmation modal
Replace the post-trade toast with an `AlertDialog` showing: shares bought, price paid, new % odds, and a "View position" button → `/portfolio`. Adds perceived weight to the action.

---

## Priority 4 — Admin Polish (already 80% done)

### 4.1 Audit log searchability
`AdminAuditPage.tsx` exists but lacks filters. Add: action-type dropdown (deposit/withdrawal/override/flag), date-range picker, admin-user filter, and CSV export button (client-side blob).

### 4.2 Treasury reconciliation panel
Add to `AdminTreasuryPage.tsx`: a "Ledger Sanity" card that runs a single SQL aggregate (sum of all `ledger_entries.amount` per user vs. `wallets.balance`) and flags any mismatch. Read-only — surfaces drift before it becomes a crisis.

### 4.3 Pending action queue on Admin Overview
`AdminOverviewPage.tsx` already shows KPIs. Add three click-through tiles at the top:
- Pending deposits (count + total KES) → `/admin/treasury?status=pending&type=deposit`
- Pending withdrawals (count + total KES) → `/admin/treasury?status=pending&type=withdrawal`
- Markets awaiting resolution → `/admin/resolution`

---

## Priority 5 — Mobile & PWA Polish

- `Navbar.tsx` hides admin link from desktop but mobile menu still shows it — apply the same dropdown pattern there.
- Add `OfflineIndicator.tsx` (already exists) to root layout in `App.tsx` if not mounted.
- Verify `InstallBanner.tsx` only fires once per session (use `sessionStorage` flag).
- Audit all `pb-20` clearances on pages that use the bottom `MobileNav`.

---

## Files Modified

- `src/components/layout/Navbar.tsx` — remove admin from public nav, move under user menu
- `src/components/MarketCard.tsx` — no-liquidity state, 24h delta
- `src/components/markets/TradePanel.tsx` — phone gate inline CTA + success modal
- `src/components/wallet/TransactionHistory.tsx` — switch to `ledger_entries` source
- `src/components/wallet/DepositWithdraw.tsx` — show locked balance + daily cap
- `src/components/WalletBalance.tsx` — surface available vs. on-hold
- `src/components/NotificationBell.tsx` — realtime subscription
- `src/pages/admin/AdminAuditPage.tsx` — filters + CSV export
- `src/pages/admin/AdminTreasuryPage.tsx` — reconciliation card
- `src/pages/admin/AdminOverviewPage.tsx` — pending-action tiles
- `supabase/functions/pesapal-withdraw/index.ts` — use `lock_for_withdrawal` RPC
- `src/services/treasuryService.ts` — release-lock flow on withdrawal approve

## Files Created

- `src/components/markets/PriceDelta.tsx` — small ▲/▼ % component
- `src/components/wallet/ReconciliationBadge.tsx`
- `src/components/markets/TradeSuccessDialog.tsx`

## What's NOT in scope (already shipped)

- Ledger entries on trades ✅ (verified in `execute-trade/index.ts` lines 190, 251)
- 5s idempotency guard ✅ (line 92)
- Phone gate server-side ✅ (line 87)
- `closes_at` enforcement ✅ (line 112)
- LMSR numerical stability ✅ (`stableExps`)
- Treasury approve/reject reasons + audit log ✅ (`treasuryService.ts`)
- Admin route guard centralization ✅ (`useAdminGuard`)

## Database changes

None. All new functionality uses existing tables (`ledger_entries`, `market_audit_log`, `notifications`, `wallets.locked_balance`).

## Acceptance checklist

- [ ] Admin link not visible in public nav (desktop + mobile)
- [ ] Empty markets show "Awaiting first trade" instead of fake 50¢
- [ ] Users without phone see inline CTA, not a server-side error
- [ ] Wallet history reads from `ledger_entries` with running balance
- [ ] Locked withdrawal funds visible to user
- [ ] Daily withdrawal cap progress visible
- [ ] Notification bell updates in realtime
- [ ] Trade success dialog replaces toast
- [ ] Admin overview shows pending-action click-throughs
- [ ] Reconciliation card flags ledger drift
