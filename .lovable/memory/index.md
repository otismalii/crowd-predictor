# Project Memory

## Core
- Mobile-first SPA on Vercel. Supabase Edge Functions for logic. Framer-motion for UI.
- Premium dark theme (near-black bg, neon green accents). No casino-style elements.
- YC-style prediction market for Kenya. Guest-first onboarding.
- Trading and withdrawals require a verified 254 Kenyan phone number.
- All KES transactions are double-entry in `ledger_entries` with NOT NULL `treasury_bucket`. Drift in `v_treasury_balances` must be 0.
- AI (LOGIK Oracle) is suggestion-only. AI cannot publish markets, settle markets, or move funds. Humans approve all financial and governance actions.
- ACP information architecture (v4): Operations / Markets / Finance / Intelligence / Governance / Audit.
- MCP server exposed at supabase/functions/mcp via @lovable.dev/mcp-js; tools live under src/lib/mcp/tools. Supabase OAuth 2.1 issuer bound to project ref, consent route at /.lovable/oauth/consent.

## Memories
- [LDX v4 Invariants](mem://architecture/ldx-v4-invariants) — Non-negotiable rules; AI never moves money or publishes/settles
- [Automation Jobs](mem://architecture/automation-jobs) — system_jobs queue + jobs-dispatch worker + pg_cron; handlers must be idempotent
- [Oracle Resolution Policy](mem://admin/oracle-resolution-policy) — LOGIK Oracle is advisory; runs on NVIDIA NIM via logik-oracle edge function
- [Creator Economy](mem://features/creator-economy) — creator_profiles/payouts/subscriptions, 0.5% default rate, admin approval required
- [Visual Assets](mem://style/visual-assets) — Hybrid licensed/AI images with strict metadata tracking
- [Mobile UX](mem://ux/mobile-experience) — Bottom nav, pull-to-refresh, shimmer skeletons
- [Market Resolution](mem://admin/market-resolution-logic) — Source-ranked pipeline and strict evidence snapshots
- [Anti-Abuse Measures](mem://security/anti-abuse-measures) — Rate limiting and guest device fingerprinting
- [Realtime Subscriptions](mem://tech/realtime-pattern) — Unique dynamic channel names and removeChannel cleanup
- [Data Fetching](mem://tech/data-fetching-pattern) — safeFetch wrapper in src/lib/api.ts for Supabase
- [LMSR Pricing Engine](mem://tech/pricing-engine-stability) — Max-subtraction pattern for numerical stability
- [PesaPal Integration](mem://integrations/pesapal-payments) — Deposit and withdrawal flows via Supabase Edge Functions
- [PWA Environment Guard](mem://tech/pwa-environment-guard) — Service worker conflict prevention for previews/iframes
- [Treasury Operations](mem://admin/treasury-ops-ledger) — Till inflows/outflows tracking via immutable ledger
- [Fraud Detection](mem://admin/fraud-detection-system) — M-Pesa receipt deduplication and rapid deposit flags
- [Market Taxonomy](mem://finance/market-lifecycle-and-categories) — Valid lifecycle statuses and primary categories
- [Trading Constraints](mem://tech/trading-constraints) — Maximum 10,000 shares per trade limit
- [Withdrawal Process](mem://finance/withdrawal-process) — Manual admin approval post-market-resolution
- [Trade Idempotency](mem://tech/trading-idempotency-and-validation) — 5-second duplicate submission guard and fee disclosure
- [Brand Terminology](mem://ui/branding-eagle-terminology) — Specific Eagle-themed wording for system states
- [Admin Audit Protocol](mem://security/admin-audit-protocol) — Mandatory reason entry for all critical admin actions
