# Real Money Flow: Pesapal Deposits, Withdrawals, Auto-Settled Bets

Goal: money in, money out, and bets that settle themselves — with every shilling recorded once and only once.

## 1. Deposits (Pesapal, end to end)

Today a deposit creates a pending record, sends the player to Pesapal, and the confirmation handler credits the wallet by writing the balance directly. That path can double-credit on a repeated notification and bypasses the double-entry ledger.

New flow:
1. Player enters an amount (minimum KES 10, maximum KES 150,000 per transaction) and taps Deposit.
2. A payment intent is created: one pending transaction row with a unique reference, the Pesapal order id, and the phone number. The Pesapal notification URL is registered once and cached in settings instead of on every deposit.
3. Player is sent to Pesapal checkout and returns to a Wallet "payment in progress" state that polls status for up to 3 minutes.
4. Pesapal notifies our confirmation endpoint. That endpoint re-verifies the payment directly with Pesapal (never trusts the notification body), then credits the wallet through the ledger primitive with an idempotency key built from the order id — so repeats, retries and the return-redirect all land on the same single credit.
5. Failed/invalid payments mark the intent failed and are recorded in the payment failures table with the provider reason. Pending stays pending for the retry job.
6. Player sees a confirmed balance, a receipt code, and a notification.

Also: a status-reconciliation job every 5 minutes queries Pesapal for intents still pending after 10 minutes, completing or failing them so nothing sits stuck.

## 2. Withdrawals

Requests already hold funds atomically and respect the KES 50,000 daily cap, but they are only stored as transactions — the review table and the approve/reject money functions that exist in the database are not wired to them.

- Minimum withdrawal KES 100 (the database already enforces this), maximum KES 50,000 per day.
- Every request writes a withdrawal request row alongside the held funds, so it appears in the admin queue.
- Admin approve pays out and admin reject releases the hold, both via the existing safe money functions with a mandatory reason and audit entry.
- Withdrawal is blocked without a verified Kenyan 254 phone number, matching the platform rule.
- Player sees request status (Pending review / Paid / Rejected with reason) in the Wallet history, updating live.

## 3. Bets: full flow and automatic settlement

- Automatic settlement already runs every minute against finished, cancelled and postponed fixtures. Add a settlement watchdog that reports any slip left open more than 3 hours after its last match finished, surfaced on the admin Today page.
- Void handling for cancelled/postponed matches refunds the stake on singles and drops the leg from accumulators (already in the settlement function — verify with a test).
- Add a "Cashout not available / settles automatically" note plus a settled-bet receipt (stake, odds, return) in My Bets.
- Wallet, My Bets and notifications update live when a settlement lands.

## 4. Next phase: Kenyan sports app conventions

- Wallet-first home header: balance, one-tap Deposit, open bets count.
- M-Pesa-style deposit sheet: preset amounts, saved phone, single confirm.
- Bet slip: multi-bet by default, possible-win always visible, share slip code.
- Jackpot-style highlight rail for the day's top fixtures.
- Responsible-gaming footer, 18+ notice, and self-set deposit limit.

## Technical notes

- New/changed edge functions: `pesapal-deposit` (intent + cached IPN id), `pesapal-callback` (verify + idempotent ledger credit + failure logging), new `pesapal-status` (client polling + reconciliation job), `pesapal-withdraw` (writes `withdrawal_requests`).
- All credits/debits route through `fn_post_double_entry` with deterministic idempotency keys (`pesapal:<order_tracking_id>`), never direct wallet updates.
- Migration: add a unique index on `transactions.reference`, store `pesapal_ipn_id` in `app_settings`, register a `pesapal-status` job definition every 5 minutes, and a view for stuck deposits/unsettled slips.
- Admin finance UI reads the withdrawal queue and calls `fn_admin_settle_withdrawal` / `fn_admin_reject_withdrawal`.
- Client: Wallet gains a pending-payment state and realtime wallet/transaction subscriptions.

Note: the Supabase security check currently lists 62 pre-existing warnings (protected tables without rules, leaked-password protection off). Not caused by this work; can be cleaned in a follow-up if you want.
