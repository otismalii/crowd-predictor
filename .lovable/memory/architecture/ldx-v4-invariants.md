---
name: LDX v4 Invariants
description: Non-negotiable architectural rules for Pagaza Prediction Market OS
type: constraint
---
# Pagaza LDX v4 — Architectural Invariants

These are enforced both in code review and in the database (via GRANT revocation + RLS).

1. **AI never moves funds.** `fn_post_double_entry`, `fn_settle_trade`, `credit_balance`, `deduct_balance`, `deduct_balance_idempotent`, `lock_for_withdrawal` are service_role only. Frontend and any AI-triggered code path must go through an edge function that performs human-readable audit logging.
2. **AI never publishes a market.** Markets insert policy: only `market_creator`/`verified_creator` can insert (status='draft' only); only `market_manager`/`admin`/`super_admin` can publish or update.
3. **AI never settles a market.** Resolution writes go through ACP; Oracle can only insert `market_audit_log` rows of type `oracle_suggestion`.
4. **Every financial movement is double-entry in the ledger.** `treasury_bucket` is NOT NULL on `ledger_entries`. The `v_treasury_balances` view's `drift` column must always be 0 — non-zero drift is a P0 incident.
5. **Single source of truth.** `wallets` table is a cache. Truth is `ledger_entries`. Reconciliation runs assert: `SUM(ledger_entries WHERE treasury_bucket='user_funds') = SUM(wallets.balance + locked_balance + escrow_balance)`.
6. **Audit-first.** Every admin write requires a reason and lands in `audit_logs` or `market_audit_log`. Promotion approvals land in `role_promotions.reason`.
7. **Idempotency everywhere.** Every wallet/ledger write requires `idempotency_key`. Replays return the original event id without re-posting.
