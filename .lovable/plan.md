# Full System Audit — Pagaza

A structured audit across four layers: **database security**, **edge functions / money flow**, **frontend correctness**, and **operational hygiene**. Each finding has severity (🔴 critical / 🟠 high / 🟡 medium / 🔵 low) and a concrete fix.

---

## 1. Database & RLS

### 🔴 Critical
1. **`profiles.email` / `phone_number` publicly readable** — `Profiles are viewable by everyone USING (true)`. Anyone (incl. anon) can scrape emails/phones.
   - Fix: drop public SELECT; add `authenticated`-only policy; `REVOKE SELECT (email, phone_number)` from anon/authenticated; add SECURITY DEFINER RPCs `get_own_profile()` and `admin_list_profiles()`.
2. **`trades` & `positions` publicly readable** — all users' trade history and portfolios exposed. Fix: replace `USING (true)` with `auth.uid() = user_id` + admin role policy.
3. **`market_disputes` publicly readable** — exposes user_id, evidence, admin_response. Fix: owner-only SELECT + admin policy.
4. **`notifications` — any user can insert into any inbox** — `Authenticated can insert notifications WITH CHECK (auth.uid() IS NOT NULL)`. Fix: drop that policy entirely (service role insert remains).
5. **`user_badges` — any user can award themselves badges** — same pattern. Fix: drop public INSERT policy; only service role.
6. **`guest_sessions` UPDATE unrestricted** — `USING (true) WITH CHECK (true)`. Anyone can drain credits / hijack sessions. Fix: drop policy; only service role can update.
7. **Avatars storage bucket — no ownership check on INSERT/UPDATE/DELETE** — any authenticated user can overwrite anyone's avatar. Fix: enforce `(storage.foldername(name))[1] = auth.uid()::text`.

### 🟠 High
8. **Privileged SECURITY DEFINER functions executable by `anon` / `authenticated`** — `deduct_balance`, `credit_balance`, `lock_for_withdrawal`, `release_withdrawal_lock`, `fn_settle_trade`, `derived_balance`, `deduct_balance_idempotent`. Any signed-in user could call these from the client. Fix: `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated`. Keep `has_role` / `has_any_role` executable (used in RLS).
9. **Leaked password protection disabled** in Supabase Auth. Fix: enable in Auth → Email settings (dashboard toggle, not SQL).
10. **`wallets` UPDATE policy too permissive** — `auth.uid() = user_id` lets users update their own wallet balance directly from the client. Fix: drop the public UPDATE policy; only service role updates wallets (edge functions already do this).

### 🟡 Medium
11. **`votes` table still exists** but `predictions` was dropped — orphaned. Drop `votes`.
12. **`source_registry` warn** — RLS only has admin ALL; verify no implicit grants. Mark ignored (already correct).
13. **`realtime.messages` has no policies** — any authed user can subscribe to any topic. Lovable cannot modify the `realtime` schema; surface to user to configure in dashboard.

---

## 2. Edge Functions & Money Flow

### 🟠 High
14. **`pesapal-withdraw` does not use the shared envelope helpers** — inconsistent with other money-moving functions; missing `serviceClient()` standardization. Refactor to `_shared/envelope.ts`.
15. **`evaluate-risk` called via service-role bearer from `pesapal-withdraw`** — passes service role JWT in `Authorization` header to a public function. Should be internal-only invoke or signed call. Acceptable, but document.
16. **`execute-trade` & `pesapal-withdraw` rely on RPCs that will be revoked from authenticated.** Since they use `serviceClient()` (service role), they continue to work after fix #8. Verify all callers.

### 🟡 Medium
17. **No global rate limit on `pesapal-deposit`, `manage-markets`** — risk-evaluate covers trades/withdraws only. Add per-IP token bucket or rely on Supabase rate limits.
18. **`config.toml`** — `manage-markets` has `verify_jwt = false` but enforces admin role server-side. Acceptable but flip to `verify_jwt = true` to fail closed.

---

## 3. Frontend Correctness

### 🟠 High (caused by DB fixes above)
19. **`select("*")` on `profiles` will break** after column REVOKE in 5 places: `AuthContext`, `Wallet`, `Profile`, `player/Dashboard`, `admin/AdminUsersPage`. Switch to:
    - Own profile → `rpc('get_own_profile')`
    - Other user → explicit columns excluding email/phone
    - Admin list → `rpc('admin_list_profiles')`
20. **`trades` / `positions` public reads** — confirm no anonymous view consumes them. `MarketDetail` may need a public aggregate (volume, last price). Move aggregation server-side via a SECURITY DEFINER view (`public_market_stats`) returning only counts and last price, no user_ids.

### 🟡 Medium
21. **`AuthContext` swallows errors silently** in `fetchProfile`. Add console.warn; surface a toast only on persistent failure.
22. **No CSRF / origin check on edge functions** that mutate state — they trust the JWT, which is correct for Supabase, but `pesapal-callback` is public; verify provider signature.

### 🔵 Low
23. **Duplicate skeletons** — `ChallengesSkeleton` is unused since predictions was dropped. Delete.
24. **`votes` types lingering** in `src/integrations/supabase/types.ts` until next regen.

---

## 4. Operational Hygiene

### 🟡 Medium
25. **No automated test for RLS policies.** Add a small `_test` suite (Deno) that signs in as 2 fake users and asserts they cannot read each other's trades/positions/notifications.
26. **Service worker `public/sw.js`** — confirm PWA guard is in place (already memorized).
27. **Sitemap regeneration** — `generate-sitemap` exists; ensure it's scheduled (cron job in `system_jobs`).

---

## Remediation Sprint Plan

Execute in this order, one migration per phase so RLS and code roll out together:

| Phase | Scope | Risk |
|---|---|---|
| **A** | DB: fixes 1–6 (RLS tightening) + 8 (revoke EXECUTE) | High — must update frontend in same release |
| **B** | Frontend: fix #19 (RPC + explicit column selects) | Medium |
| **C** | Storage policy fix #7 (avatars ownership) | Low |
| **D** | DB: fix #10 (wallets UPDATE), fix #11 (drop `votes`) | Low |
| **E** | Edge functions: refactor #14 + tighten #18 | Low |
| **F** | Public aggregates view for `trades`/`positions` (#20) if needed by `MarketDetail` | Medium |
| **G** | Manual dashboard actions: enable leaked-password protection (#9), realtime policies (#13) | User-action |
| **H** | Cleanup: delete unused skeletons (#23), add RLS Deno tests (#25) | Low |

---

## What I Will NOT Touch

- `auth`, `storage`, `realtime`, `supabase_functions`, `vault` schemas (reserved).
- Working PesaPal callback flow.
- Existing immutable ledger semantics.

---

## Open Questions Before Phase A

1. `MarketDetail` currently reads `trades` for "recent trade" feed. Do you want a public anonymized feed (counts + last price) preserved, or restrict trade list to the trader only?
2. `Leaderboard` reads aggregated profile data — should display names + avatars stay public (yes, expected), and is **username** considered sensitive? (Assumption: no.)
3. OK to drop the orphaned `votes` table?

If you approve, I'll start with Phase A + B as a single coordinated change (DB migration + frontend RPC swap) since they're tightly coupled.
