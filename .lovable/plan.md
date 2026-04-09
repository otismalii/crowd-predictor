

# Pagaza Fintech-Grade Refactor — Implementation Plan

This is a large-scope hardening across 6 workstreams. Each phase is ordered by dependency and criticality.

---

## Phase 1: Ledger Integrity & Trade Hardening

**Problem:** `execute-trade` creates `transactions` rows but no `ledger_entries`. Treasury approve/reject works but lacks idempotency. No `closes_at` validation.

**Changes:**

1. **`supabase/functions/execute-trade/index.ts`** — After wallet debit/credit, insert `ledger_entries` with `entry_type: "trade_buy"` or `"trade_sell"`, `balance_after`, and `reference_id` pointing to the trade. Add `closes_at` check: reject trades if `market.closes_at < now()`. Add 5-second idempotency guard: query `trades` for same `user_id + market_id + outcome_id + side` within last 5 seconds, reject if found.

2. **`src/services/treasuryService.ts`** — Add confirmation reason parameter to `approveTransaction` and `rejectTransaction`. Log to `market_audit_log` on every approve/reject with admin user ID and reason.

3. **DB migration** — Add `market_audit_log` entry type for treasury actions (no schema change needed, audit log table already exists).

---

## Phase 2: Auth & Profile Enforcement

**Problem:** Users can trade without verified email. No gate for phone number before wallet access. Profile phone field exists but no enforcement on trading.

**Changes:**

1. **`src/contexts/AuthContext.tsx`** — Add `profile` to context state. After auth state change, fetch profile and expose `profile.phone_number`, `profile.email_verified` on context.

2. **`src/components/layout/ProtectedRoute.tsx`** — Add an `onboarding` check: if user has no `phone_number` on profile, redirect to a phone capture step on `/wallet` or show inline prompt.

3. **`src/components/ProfileEdit.tsx`** — Lock phone number field if already set (show disabled input with masked number). Add format validation regex for `254XXXXXXXXX`.

4. **`src/pages/MarketDetail.tsx`** — Before executing trade, check if user has phone number on profile. If not, show toast: "Add your phone number in profile settings before trading."

---

## Phase 3: Admin Control Room Expansion

**Problem:** Admin Users page has no wallet/transaction data. No audit log viewer. No admin earnings/fees dashboard. No marketing table.

**Changes:**

1. **`src/components/admin/AdminUsers.tsx`** — Fetch wallets and transaction counts alongside profiles. Add columns: wallet balance, transaction count, phone number (masked). Add "Flag User" button that inserts a fraud alert with `type: "manual_flag"`.

2. **`src/pages/admin/AdminOverviewPage.tsx`** — Add "Platform Revenue" card showing sum of `house_fee` ledger entries. Add "Reserve Ratio" indicator (net treasury balance / total user liabilities).

3. **New: `src/pages/admin/AdminAuditPage.tsx`** — Query `market_audit_log` table with filters (action type, date range, admin user). Display in a table with action, market, admin, details, timestamp.

4. **`src/App.tsx`** — Add route `/admin/audit` pointing to `AdminAuditPage`.

5. **`src/pages/admin/AdminFraudPage.tsx`** — Add "Flag User" and "Block Transaction" action buttons on each alert. Flag User inserts into a new `user_flags` concept (stored in `market_audit_log` with `action: "user_flagged"`). Block Transaction updates the transaction status to `"blocked"`.

6. **`src/pages/admin/AdminTreasuryPage.tsx`** — Add "Platform Revenue" and "Reserve Ratio" cards. Add confirmation dialog (AlertDialog) before approve/reject with mandatory reason textarea.

---

## Phase 4: Resolution & AI Oracle Refinement

**Problem:** Resolution is manual-only with no confidence scoring or evidence requirements. AI oracle concept referenced but not implemented.

**Changes:**

1. **`src/pages/admin/AdminResolutionPage.tsx`** — Add a "Resolution Queue" section showing markets with `status: "closed"` that haven't been resolved yet. For each, show: title, closes_at, source count, average confidence from `market_sources`.

2. **`src/components/admin/AdminDisputes.tsx`** — Add resolution confidence indicator per dispute's market. Show audit trail from `market_audit_log` for that market.

3. **`supabase/functions/resolve-bets/index.ts`** — Add validation: require at least one `market_sources` entry before allowing resolution. Log resolution evidence (source URLs, confidence scores) in `market_audit_log`. Ensure AI-suggested resolutions are queued with `status: "pending_review"` rather than auto-finalizing.

4. **Admin override** — In resolution UI, add "Admin Override" button with mandatory reason textarea. Creates `market_audit_log` entry with `action: "admin_override"` and the reason.

---

## Phase 5: UX Polish, PWA & Performance

**Problem:** MarketDetail.tsx is 1007 lines. No install prompt for PWA. Missing SEO on several pages. No offline fallback. Comment moderation nonexistent.

**Changes:**

1. **`src/pages/MarketDetail.tsx`** — Extract trade panel into `src/components/markets/TradePanel.tsx` (~200 lines). Extract comment section into `src/components/markets/CommentThread.tsx` (~150 lines). Add eagle-themed settlement language: "Eagle has landed" for resolved markets, "Turbulence detected" for disputed.

2. **`public/sw.js`** — Add offline fallback: cache app shell and show offline page for failed navigations. Add `navigateFallbackDenylist` for `/~oauth`.

3. **`src/main.tsx`** — Already has iframe/preview guard. Add install prompt detection: listen for `beforeinstallprompt` event, expose via context for an install banner component.

4. **New: `src/components/InstallBanner.tsx`** — Bottom banner on mobile: "Install Pagaza for faster access" with Install button. Dismissible, shows only once per session.

5. **SEO** — Add `<SEOHead>` with JSON-LD to `MarketDetail.tsx` (BettingOdds schema), `Profile.tsx`, `Sources.tsx`.

6. **Comment moderation** — Add admin delete capability in `CommentThread.tsx` (admin can delete any comment, not just own). Check `has_role` RPC before showing delete button for non-owners.

7. **Mobile polish** — Ensure all pages have `pb-20` for bottom nav clearance. Add `min-h-[44px]` to all interactive buttons. Add horizontal scroll wrapper to admin tables.

---

## Phase 6: Image Assets & Branding

**Problem:** No favicon/logo assets. No OG images for social sharing. Eagle branding is text-only.

**Changes:**

1. **Generate assets** — Use AI image generation to create: favicon (eagle silhouette, neon green on dark), OG share image (1200x630, dark premium with eagle + "Pagaza" text), PWA icons (192x192, 512x512).

2. **`index.html`** — Update favicon link, add OG meta tags with generated image path, add Apple touch icon.

3. **`public/manifest.json`** — Update icons array with generated PWA icons. Set `theme_color` to match dark primary (`#0a0a12`), `background_color` to match.

4. **`src/components/SEOHead.tsx`** — Add default OG image fallback. Add `twitter:card` meta tag.

---

## Database Changes Required

1. **No new tables needed** — All audit logging uses existing `market_audit_log`. User flagging stored as audit entries.
2. **No schema migrations** — Phone number columns already added in prior phase.

## Files Created
- `src/pages/admin/AdminAuditPage.tsx`
- `src/components/markets/TradePanel.tsx`
- `src/components/markets/CommentThread.tsx`
- `src/components/InstallBanner.tsx`
- Generated image assets in `public/`

## Files Modified
- `supabase/functions/execute-trade/index.ts` (ledger entries + idempotency + closes_at check)
- `supabase/functions/resolve-bets/index.ts` (evidence requirements + audit logging)
- `src/services/treasuryService.ts` (confirmation reasons + audit logging)
- `src/contexts/AuthContext.tsx` (profile in context)
- `src/components/admin/AdminUsers.tsx` (wallet + tx columns + flag action)
- `src/pages/admin/AdminOverviewPage.tsx` (revenue + reserve ratio cards)
- `src/pages/admin/AdminTreasuryPage.tsx` (confirmation dialogs + revenue cards)
- `src/pages/admin/AdminFraudPage.tsx` (action buttons)
- `src/pages/admin/AdminResolutionPage.tsx` (resolution queue)
- `src/pages/MarketDetail.tsx` (split + eagle branding + phone check)
- `src/components/ProfileEdit.tsx` (phone lock)
- `src/App.tsx` (audit route)
- `src/main.tsx` (install prompt)
- `index.html` (OG tags + favicon)
- `public/manifest.json` (icons + theme)
- `public/sw.js` (offline fallback)
- `src/components/SEOHead.tsx` (OG defaults)

## Security Checklist
- Trade idempotency prevents double-spend
- Ledger entries on every money movement
- Phone required before trading/withdrawing
- Admin actions require reason + audit trail
- AI oracle cannot auto-finalize without evidence
- Comment moderation for admins
- Resolution requires source evidence

