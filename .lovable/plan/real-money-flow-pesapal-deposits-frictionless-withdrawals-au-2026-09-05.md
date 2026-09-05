# Real Money Flow: Pesapal Deposits, Frictionless Withdrawals, Auto-Settled Bets

Goal: money in, money out, bets that pay themselves out, and a clear platform till — with every shilling recorded once and only once.

## 1. Deposits (Pesapal, end to end)

Today a deposit creates a pending record, sends the player to Pesapal, and the confirmation handler credits the wallet by writing the balance directly. That path can double-credit on a repeated notification and bypasses the double-entry ledger.

New flow:
1. Player enters an amount (minimum KES 10, maximum KES 150,000 per transaction) and taps Deposit.
2. A payment intent is created: one pending transaction row with a unique reference, the Pesapal order id, and the phone number. The Pesapal notification URL is registered once and cached in settings instead of on every deposit.
3. Player is sent to Pesapal checkout and returns to a Wallet "payment in progress" state that polls status for up to 3 minutes.
4. Pesapal notifies our confirmation endpoint. That endpoint re-verifies the payment directly with Pesapal (never trusts the notification body), then credits the wallet through the ledger primitive with an idempotency key built from the order id — so repeats, retries and the return-redirect all land on the same single credit.
5. Failed/invalid payments mark the intent failed and are logged with the provider reason. Pending stays pending for the reconciliation job.
6. Player sees a confirmed balance, a receipt code, and a notification.

A reconciliation job every 5 minutes asks Pesapal about intents still pending after 10 minutes and completes or fails them, so nothing sits stuck.

## 2. Withdrawals — rebuilt, frictionless

The current request path is leftover prediction-market logic: it writes a transaction plus a manual hold, never creates a review record, and always waits for a human. Rework:

- Requests write a proper withdrawal request row so they appear in the finance queue, alongside the held funds.
- Minimum KES 100, maximum KES 50,000 per day, verified 254 phone required.
- Auto-approval: requests up to KES 5,000 from an account with a verified phone, no risk flag, and a settled deposit history pay out immediately via Pesapal payout — no admin waiting. Bigger or risk-flagged requests go to manual review.
- Payout is executed against Pesapal, and only a confirmed payout marks the request paid and releases the hold; a failed payout returns the funds and tells the player why.
- Approve/reject use the existing safe money functions with a mandatory reason and audit trail.
- Player sees live status (Processing / Paid with receipt / Under review / Returned with reason) in the Wallet.

## 3. Bets: winnings and losses

Already correct and verified in the database: when a slip is graded, wins credit the player's wallet automatically from the settlement reserve, voids refund the stake, and a losing slip's stake moves to platform revenue. Match results already drive this every minute. What's missing is confidence and visibility:

- A watchdog that flags any slip still open 3 hours after its last match finished, shown on the admin Today page.
- Settled-bet receipts in My Bets (stake, odds, return, settled time) and a "settles automatically" note instead of a cashout button.
- Wallet balance, My Bets and notifications update live the moment a settlement lands.
- Tests covering: single win, accumulator with one loser, postponed match void, and max-payout cap.

## 4. Platform funds and the till

- The platform's own money lives in the treasury buckets, and the admin account `stevotieno2004@gmail.com` is designated as the platform funds account — its wallet mirrors the platform till rather than being a normal player wallet.
- A seeding tool in the admin finance area: add or withdraw platform funds (liquidity pool / settlement reserve / operational reserve) with an amount, a reason, and a ledger entry — no direct balance edits anywhere.
- Finance dashboard: player money held, platform revenue from losing slips, payouts owed, deposits in, withdrawals out, and a balance check that flags any mismatch between wallets and the ledger.
- House margin stays the built-in odds margin (currently 7%); no extra bet fee is added on top.

## 5. Admin control panel audit and cleanup

- Remove or archive the leftover prediction-market and old marketing surfaces from the admin panel (creator payouts/subscriptions promo, market foundry/import, oracle suggestion queues, liquidity trading pages) so the panel only shows sportsbook, casino, finance, users, and system.
- Consolidate finance into one place: deposits, withdrawals, treasury, reconciliation, fraud signals.
- Every destructive or money-moving action requires a typed reason and lands in the audit log.
- Public site: strip remaining prediction-market wording and stale promo blocks.

## 6. Next phase: Kenyan sports app conventions

- Wallet-first header: balance, one-tap Deposit, open bets count.
- M-Pesa-style deposit sheet: preset amounts, saved phone, single confirm.
- Bet slip: multi-bet by default, possible win always visible, shareable slip code.
- Jackpot-style highlight rail for the day's top fixtures.
- Responsible gaming: 18+ notice, self-set deposit limit, self-exclusion request.

## Technical notes

- Edge functions: `pesapal-deposit` (intent + cached IPN id), `pesapal-callback` (verify + idempotent ledger credit), new `pesapal-status` (polling + reconciliation job), `pesapal-withdraw` (writes `withdrawal_requests`, auto-approval path), new `pesapal-payout` (Pesapal payout execution + status confirm), new `admin-treasury-actions` (seeding, approve/reject).
- All money movement goes through `fn_post_double_entry` with deterministic idempotency keys (`pesapal:<order_tracking_id>`, `payout:<request_id>`); never direct wallet updates.
- Migration: unique index on `transactions.reference`; `withdrawal_requests` payout fields/status transitions; `app_settings` keys for `pesapal_ipn_id`, `withdraw_min_kes=100`, `withdraw_auto_approve_max_kes=5000`, `platform_funds_user_id`; job definitions for `pesapal-status` (5m) and `settlement-watchdog` (15m); views for stuck deposits and unsettled slips.
- Admin finance UI calls `fn_admin_settle_withdrawal` / `fn_admin_reject_withdrawal`; treasury seeding posts ledger-backed transfers between buckets.
- Client: realtime wallet/transaction/slip subscriptions; Wallet pending-payment state.
- Roadmap: this plan supersedes the open finance items in `roadmap.md`; that file gets updated as the first build step.

Note: the Supabase security check lists 62 pre-existing warnings (protected tables without rules, leaked-password protection off), unrelated to this work — worth a follow-up pass.
