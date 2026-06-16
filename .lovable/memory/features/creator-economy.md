---
name: Creator Economy
description: Wave 3 — creator_profiles/payouts/subscriptions, 0.5% default rate, payouts via fn_post_double_entry from creator_rewards bucket, admin approval required
type: feature
---
Creator economy adds three tables: `creator_profiles` (tier/score/rate_bps), `creator_payouts` (pending→approved→paid via `creator-payouts` edge function), `creator_subscriptions` (subscriber→creator premium follows).

Attribution: settle worker calls `fn_attribute_creator_payout(market_id, creator_id, basis_volume)` which inserts a pending payout using the creator's `payout_rate_bps` (default 50 = 0.5%). Admin approves then pays — payment posts a double-entry from `creator_rewards` bucket to user wallet via `fn_post_double_entry` with idempotency key `creator_payout:<id>`.

Markets gained `suggested_by` column to track the original human author when an Oracle suggestion is promoted.

Routes: `/creator` (self-service Creator Studio), `/admin/finance/creator-payouts` (admin queue).

Tiers: bronze / silver / gold / platinum — score-driven, admin adjusts `payout_rate_bps` per tier.
