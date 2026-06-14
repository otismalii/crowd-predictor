---
name: Oracle Resolution Policy
description: LOGIK Oracle is advisory only; humans approve all market and financial actions
type: constraint
---
# LOGIK Oracle Policy (v4)

LOGIK Oracle is an **AI suggestion engine**. It runs via the `logik-oracle` edge function using NVIDIA NIM (secret `NVIDIA_API_KEY`).

## Oracle CAN
- Detect candidate events from `source_registry` and `ingestion_logs`.
- Generate draft market specs into `market_suggestions`.
- Score market quality (0-100); drafts below 85 are flagged `needs_revision`.
- Detect risk and write to `risk_signals`.
- Propose resolutions as `market_audit_log` rows of type `oracle_suggestion`.
- Score creators and propose role promotions into `role_promotions` (status='pending').

## Oracle CANNOT
- Publish a market. Only `market_manager`/`admin`/`super_admin` can flip status to `published`.
- Settle a market or write to `markets.resolved_outcome_id`.
- Move funds (cannot call `fn_post_double_entry`, `fn_settle_trade`, `credit_balance`, `deduct_balance`).
- Approve a payout or withdrawal.
- Promote a user role automatically.

All AI invocations are logged to `oracle_runs` for the recursive-learning loop.
