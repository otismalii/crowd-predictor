
# PAGAZA LDX v4 — Master Upgrade Plan

Four waves, executed sequentially with approval between each. Each wave ships a working slice — no dead schema. Two non-negotiable invariants enforced from Wave 1: **AI never moves funds or publishes/settles markets**, and **every financial action lives in the immutable ledger**.

## Cross-cutting decisions

- **Oracle model provider**: NVIDIA NIM (key you supplied). The key will be stored as Supabase secret `NVIDIA_API_KEY` via the secrets tool — never committed to code. I will also **update `mem://index.md`** to lift the "no AI insights / no Gemini" rule and replace it with "AI is suggestion-only; humans approve all market/financial actions."
- **Memory update**: rewrite the Oracle Resolution Policy memory to match v4 (AI suggests; ACP decides). Add a new memory `mem://architecture/ldx-v4-invariants` capturing the 7 critical design rules.
- **Single source of truth**: keep existing `wallets`, `ledger_entries`, `event_log`, `user_roles`, `market_audit_log`, `audit_logs`, `market_suggestions`, `source_registry`, `ingestion_logs`, `risk_signals`. **No duplicates created.**
- **All AI calls** go through one edge function (`logik-oracle`) that fans out to sub-tasks. Frontend never calls the model directly.

---

## WAVE 1 — Foundations: Treasury sub-ledger + Role expansion + ACP restructure

**Goal**: lock down the money model and the people model before any AI lands.

### 1A. Treasury sub-ledger (full refactor)

Migration:
- New enum `treasury_bucket`: `user_funds`, `platform_revenue`, `liquidity_pool`, `settlement_reserve`, `operational_reserve`.
- New table `treasury_accounts(bucket PK, balance numeric, updated_at)` — derived/cached, truth lives in ledger.
- Add `treasury_bucket treasury_bucket NOT NULL DEFAULT 'user_funds'` to `ledger_entries`. Backfill all existing rows to `user_funds`.
- New view `v_treasury_balances` — `SUM(amount) GROUP BY bucket` from ledger; must always equal `treasury_accounts.balance` (reconciliation invariant).
- New function `fn_post_double_entry(p_debit_user, p_credit_user, p_debit_bucket, p_credit_bucket, p_amount, p_event_id, p_idempotency_key)` — single chokepoint for all bucket movement; SECURITY DEFINER, revoke from anon/authenticated, service_role only.
- Trigger on `ledger_entries` insert → updates `treasury_accounts.balance`.

Edge function refactors (route every write through `fn_post_double_entry`):
- `execute-trade`: debit user → credit `liquidity_pool` (stake) + `platform_revenue` (fee split from `app_settings.trade_fee_bps`).
- `pesapal-deposit` callback: external M-Pesa → credit `user_funds` + debit `operational_reserve`.
- `pesapal-withdraw`: debit `user_funds` → credit external; lock first via existing `lock_for_withdrawal`.
- `reconcile-ledger`: extend to assert `SUM(ledger) per bucket = treasury_accounts.balance` and that `user_funds = SUM(wallets.balance + locked_balance + escrow_balance)`. Emit `risk_signal` on drift.

Acceptance: ledger imbalance always = 0; every wallet write goes through `fn_post_double_entry`; old direct `credit_balance`/`deduct_balance` paths are deprecated (kept for backward compat but logged + flagged in `risk_signals`).

### 1B. Full role system

Migration:
- Extend `app_role` enum: add `trusted_predictor`, `analyst`, `market_creator`, `verified_creator`, `market_manager`. (Existing: `user`, `moderator`, `admin`, `super_admin`, `market_operator`, `verified_user`, `risk_flagged`.)
- New table `role_promotions(id, user_id, from_role, to_role, requested_by, approved_by, status, reason, evidence jsonb, created_at, decided_at)` — ACP-only approval; service_role grants only for writes, authenticated read own.
- RLS: `markets` insert policy splits — `market_creator`/`verified_creator` can insert with `status='draft'` only; only `market_manager`/`admin`/`super_admin` can flip to `published`.

Frontend:
- `useAdminRole` → rename to `useUserRole`, return the full role ladder.
- ACP `/admin/risk/users` gains a **Promote** action that writes to `role_promotions`. Approve UI in new `/admin/governance/promotions`.

### 1C. ACP information-architecture rebuild

Restructure `adminNav.ts` into the v4 spec exactly:
```
Operations: Overview, Event Stream
Markets: Active, Creation Queue (drafts + suggestions), Oracle Suggestions, Resolution, Liquidity, Sources
Finance: Treasury (bucketed), Settlements, Reconciliation
Intelligence: LOGIK Insights, Event Sources, Risk Signals, Prediction History
Governance: Users, Roles & Promotions, Disputes, Fraud
Audit: Logs, System Events, Market History
```
Five existing domain folders collapse into the six-domain v4 layout. All new pages are stubs in Wave 1 (skeleton + empty state) and filled in Waves 2-4.

---

## WAVE 2 — LOGIK Oracle: suggestion engine + market quality scoring

**Goal**: humans-approved AI suggestions land in the Creation Queue. Nothing publishes automatically.

### 2A. Secrets + provider

- Add secret `NVIDIA_API_KEY` (user-supplied). Edge functions call `https://integrate.api.nvidia.com/v1/chat/completions` with `Authorization: Bearer ${NVIDIA_API_KEY}`. Model default: `meta/llama-3.3-70b-instruct` (configurable in `app_settings`).

### 2B. Oracle data model

Migration:
- Extend `market_suggestions`: add `quality_score int`, `quality_breakdown jsonb` (clarity, resolution_certainty, dispute_risk, liquidity_potential, popularity_potential), `oracle_run_id uuid`, `source_evidence jsonb`, `domain text` (sports/politics/economics/tech/entertainment/social), `risk_flags jsonb`.
- New table `oracle_runs(id, pipeline_stage, input jsonb, output jsonb, model, latency_ms, cost_estimate, error, created_at)` — every LOGIK call logged for the recursive-learning loop.
- New table `market_quality_scores(market_id, score, breakdown jsonb, scored_at, scored_by)` — applies to both drafts and live markets.

### 2C. Edge function `logik-oracle`

Single entrypoint with `action` param:
- `detect_events` — pulls from `source_registry` + `ingestion_logs`, dedupes, returns candidate events.
- `suggest_markets` — for an event, generates 1-N draft market specs (question, outcomes, resolution criteria, sources).
- `score_quality` — scores a draft 0-100; **gate: score < 85 → status `needs_revision`**.
- `analyze_risk` — writes a `risk_signals` row if dispute/fraud heuristics trip.
- `propose_resolution` — for a closed market, suggests an outcome with evidence; **never writes resolution** — only inserts a row in `market_audit_log` of type `oracle_suggestion`.

All writes go through service-role with idempotency keys; `logik-oracle` is called from cron jobs (`system_jobs`) and from ACP "re-run" buttons.

### 2D. ACP screens (functional)

- `/admin/markets/oracle-suggestions` — list of `market_suggestions` with quality score, "Approve & Promote to Draft" (ACP only), "Reject", "Request revision."
- `/admin/markets/creation-queue` — drafts (from creators + approved Oracle suggestions); ACP publishes from here.
- `/admin/intelligence/logik-insights` — `oracle_runs` log + calibration metrics.

---

## WAVE 3 — Creator economy + confidence engine

**Goal**: track creator/predictor accuracy; promotions are scored but never automatic.

### 3A. Data model

- `creator_scores(user_id PK, accuracy_rate, market_success_rate, dispute_rate, fraud_risk, engagement_score, tier text)` — tier ∈ `bronze|silver|gold|elite`, computed nightly by `logik-oracle action=score_creators`.
- `prediction_accuracy(user_id, market_id, predicted_outcome, actual_outcome, confidence, brier_score, created_at)` — feeds the recursive-learning calibration.
- `confidence_calibration(domain, bucket_lo, bucket_hi, predicted_rate, actual_rate, sample_size, updated_at)` — rolling calibration table.

### 3B. Promotion workflow

- Oracle proposes role promotions (`role_promotions` row with `requested_by = oracle_system_user`); ACP approves/rejects. **No auto-promotion.**

### 3C. UI

- Public: creator profile badge (bronze/silver/gold/elite) on `Profile.tsx` + market card.
- ACP: `/admin/governance/creator-scores` review board.

---

## WAVE 4 — Recursive learning + internal LOGIK API + hardening

**Goal**: close the feedback loop, expose a stable internal API, finish hardening.

### 4A. Recursive learning loop

- Nightly cron (`system_jobs`) → `logik-oracle action=calibrate` → reads `prediction_accuracy`, updates `confidence_calibration`, adjusts per-domain prompt temperature/system prompt stored in `app_settings`.
- Per-market post-resolution job writes Brier scores for every trader who held a position.

### 4B. Internal LOGIK API layer

- New edge function `logik-api` exposing read-only endpoints (`/events`, `/suggestions`, `/quality/:market_id`, `/confidence/:domain`) for future external/partner use. Auth via per-consumer API keys table `oracle_api_keys` (hashed). Rate limited.

### 4C. Hardening

- Settlement engine: every settlement runs `reconcile-ledger` pre-check; refuses if imbalance ≠ 0.
- Add `settlement_previews` table — ACP must "Preview → Approve" two-step for every payout batch.
- Realtime subscriptions on `oracle_suggestions` so ACP queue updates live.
- Performance: index audit (`ledger_entries(treasury_bucket, created_at)`, `market_suggestions(quality_score, status)`).

---

## Technical notes / risks

- **Backfill order matters** in Wave 1A: add column NULL → backfill `user_funds` → set NOT NULL → create trigger. Otherwise the trigger blocks the backfill.
- **`fn_post_double_entry` is a chokepoint**: every existing edge function must be updated in the same wave; partial migration corrupts the bucket invariant. Wave 1A is therefore atomic — all 4 edge functions ship together.
- **NVIDIA NIM rate limits**: cron-driven suggestions throttled to N/min via `system_jobs`; ACP-triggered runs bypass throttle but log to `oracle_runs.cost_estimate`.
- **Memory rewrite**: lifting the "no AI" rule is a one-way door. The new memory will be explicit that AI is **advisory only** and cannot publish/settle/move funds — these remain DB-enforced via GRANT revocation on `fn_settle_trade`, `fn_post_double_entry`, market `status` transitions.
- **No frontend AI calls.** All `logik-oracle` invocations are server-side (edge functions, cron). The browser only reads `market_suggestions`, `oracle_runs`, `creator_scores`.

## Out of scope (explicit)

- External LOGIK API monetization, billing for partners — deferred past Wave 4.
- Mobile push notifications for Oracle suggestions — separate request.
- Re-theming, marketing pages.

## Approval gate after each wave

After Wave 1 ships: I stop, you verify treasury reconciliation = 0 and ACP IA matches the v4 spec, then approve Wave 2. Same for 2→3 and 3→4.
