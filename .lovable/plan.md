## Pagaza — Major Overhaul Plan

Goal: ship a focused, hyperlocalised Kenyan prediction-market UI with competitor-grade information density, kill legacy weight, and harden SEO — without touching the now-secured ledger and RLS layer.

---

### Phase 1 — Design system reset (Flag Bold)

Rewrite `src/index.css` + `tailwind.config.ts` tokens to the chosen palette:

```text
bg          #0a0a0a (near-black)        --background
surface     #14110f                      --card
primary     #006644 (KE green)           --primary
accent      #bb0a1e (KE red)             --accent
ivory       #f5f5f5                      --foreground
muted       neutral 12% / 60%            --muted / --muted-foreground
```

- Map every `--*` HSL token (light + dark); keep dark as default, light as accessible alt.
- Replace neon-green glow utilities with subtler "flag glint" (green primary, red accent only on critical CTAs / loss states).
- Typography: keep Oswald headings (works for KE editorial feel), Inter body. Add a `font-display` heading scale (clamp).
- New radii (`--radius: 0.5rem`) — Polymarket-tighter cards.
- Delete unused reactbits flair that fights density (Aurora background on Feed, oversized SpotlightCard glow). Keep AnimatedCounter, GradientText, ShimmerButton for CTAs only.
- Update `<meta name="theme-color">` in `index.html` to `#0a0a0a`.

### Phase 2 — Route + IA cleanup

Routes to remove from `src/App.tsx` and the codebase entirely (all approved):

- `/trending`, `/closing-soon`, `/resolved` → fold into `/markets?sort=…&filter=…` (already redirected; remove the redirect lines too once nothing inbound).
- `/categories/:slug` → `/markets?category=slug`.
- `/faq`, `/about` → merge into `/rules` (single page with anchored sections + JSON-LD FAQPage).
- `/challenges` → delete; surface leaderboard CTA on `/leaderboard` directly.
- Duplicate `/market/:id` alias → keep `/markets/:id` only, add a one-time 301-style redirect for old shares.

Audit components for orphans (will list before deleting):
- `src/components/reactbits/Aurora.tsx`, `Magnet.tsx` if unused after restyle
- Any skeleton not referenced
- `src/lib/social.ts` if unreferenced

### Phase 3 — Page-level UI overhaul

Polymarket density + Kalshi polish + 5050 social, per page:

**Feed (`/`)** — new landing
- Hero strip: KE-flag accent bar, single H1 ("Predict Kenya"), live volume ticker, two CTAs (Trade / How it works).
- Category chip rail (horizontal scroll, sticky on mobile).
- Featured markets row (3 large cards) → dense grid below (`MarketCard` redesign).
- Social proof strip: top tipsters from leaderboard (5050-style).
- Remove Aurora hero background.

**MarketCard redesign**
- Compact (Polymarket): title (2 lines max), Yes/No price chips with % + delta arrow, mini sparkline (last 24h), volume + traders + closes-in row, watchlist star.
- Replace SpotlightCard wrapper with simple bordered surface; hover = primary border-glow.
- Skeleton matches.

**Markets (`/markets`)**
- Left rail filters on desktop, top sheet on mobile (`MarketFilters` already exists, restyle).
- Sort chips (Trending / Newest / Closing / Volume).
- Infinite scroll keeps; remove duplicate sort logic in Feed.

**MarketDetail (`/markets/:id`)**
- Two-column: left = price chart + outcome bars + description + sources (Kalshi-style evidence panel); right = sticky `TradePanel`.
- Below: tabs `Activity | Comments | Holders | Rules` (5050-style social).
- Activity uses the new `get_market_recent_trades` RPC (already wired).
- Add JSON-LD `Article` + breadcrumbs.

**Wallet** — collapse Deposit/Withdraw into a single tabbed card; reconciliation badge inline; transaction list virtualised if >50 rows.

**Profile** — public stats card (rep, accuracy, streak) + recent positions (own only) + followers; remove email/phone reveal entirely (already RLS-locked).

**Leaderboard** — single dense table, weekly/all-time toggle, KE-flag rank chips for top 3.

**Auth** — keep, restyle to flag palette, KE phone input prominent for trade-required path.

### Phase 4 — Hyperlocalisation

- Currency: every amount through `formatKES()` (already in `src/lib/format.ts`) — sweep all `Ksh`/`KES`/raw number leaks.
- Time: `Africa/Nairobi` formatter helper, "EAT" suffix on closing times.
- Copy: replace "bet/wager" → "predict/position"; CTAs in plain Kenyan English (no Sheng unless user later asks).
- Categories: rebalance to KE-relevant defaults (Politics, Sports/FKF+EPL, Economy/CBK, Entertainment, Local). Reorder in `src/lib/constants.ts`.
- Phone capture: enforce `+254` prefix in input mask, already required for trade.

### Phase 5 — SEO hardening

- `index.html`: shorten title <60 chars, description <160, swap `pagaza.app` → relative paths (no domain set yet) per head-meta rules.
- Add per-route `<Helmet>` already via `SEOHead` — extend to MarketDetail with Article JSON-LD; add BreadcrumbList on Markets and MarketDetail; add FAQPage on Rules.
- Move sitemap from `public/sitemap.xml` static + edge function to `scripts/generate-sitemap.ts` with Supabase fetch of open+resolved markets, wired into `predev`/`prebuild`. Keep the existing `generate-sitemap` edge function for runtime regeneration if you want — confirm.
- `public/robots.txt` audit: ensure `/admin`, `/wallet`, `/portfolio`, `/dashboard`, `/watchlist`, `/profile/*` disallowed.
- Single H1 per page sweep; alt text on all `<img>`; semantic landmarks (`<main>`, `<nav>`, `<article>`).
- Lazy-load images, `loading="lazy"` on market thumbs.

### Phase 6 — Legacy DB + edge cleanup (held for per-item approval)

I'll surface a checklist before deleting any of:
- `wallets.casino_credit_balance`, `wallets.fantasy_entry_balance` columns + related code paths.
- Any unused enum values in `transaction_type` / `app_role`.
- Edge functions with no caller (audit `evaluate-risk`, `compute-trends` cron status).
- Orphaned tables surfaced by audit.

No DB changes execute without you approving each item.

### Phase 7 — Verification

- `npm run build` (auto by harness) — zero TS errors.
- Spot-check Feed, MarketDetail, Wallet, Admin overview at 360px and desktop.
- Lighthouse mental-pass: LCP image, no layout shift on cards, meta presence.
- Confirm no client-side `select("*")` on `profiles`/`trades` reintroduced.

---

### Sequencing & risk

I'll deliver in this order so the app stays usable throughout:

1. Phase 1 (tokens) + Phase 2 (route cleanup) — single PR, low risk.
2. Phase 3 page-by-page (Feed → MarketCard → MarketDetail → Wallet → Leaderboard → Profile → Auth) — one page per turn, you review each.
3. Phase 4 + Phase 5 sweep — combined pass.
4. Phase 6 cleanup checklist — you tick items, I execute.

### What I will NOT touch

- RLS policies / SECURITY DEFINER functions / ledger semantics (just secured).
- PesaPal flows, treasury ledger, fraud detection.
- Auth provider config.
- Realtime channel pattern, safeFetch wrapper, LMSR engine.

### Open questions for during build (won't block plan approval)

- Are inbound links pointing to `/trending`, `/faq` worth keeping as 301 redirects, or hard-delete?
- Should Markets default sort be Trending or Closing-soon for Kenyan timezone primetime?
- Want a marketing landing variant for logged-out users distinct from Feed, or keep Feed as the public face?
