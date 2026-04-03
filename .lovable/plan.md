

## Pagaza Hardening & Refactor Plan

### Priority 1: Critical Bugs (Quick Wins)

**A. Fix Realtime Crash (the ErrorBoundary-triggering bug)**

The console error `cannot add postgres_changes callbacks after subscribe()` crashes the app. Root cause: `NotificationBell` uses a static channel name `"notifications-realtime"`. When `user` changes (auth state resolves), React re-runs the effect. Supabase may reuse the existing channel reference before cleanup completes, then `.on()` is called on an already-subscribed channel.

Fix across all 5 files that use `.channel()`:
- `src/components/NotificationBell.tsx` — change to `notifications-${user.id}`
- `src/components/WalletBalance.tsx` — change to `wallet-balance-${user.id}`
- `src/pages/MarketDetail.tsx` — already uses `market-${id}`, but add a unique suffix with a ref counter to prevent remount collisions
- `src/pages/Portfolio.tsx` — change to `portfolio-${user.id}`
- `src/pages/Wallet.tsx` — change to `wallet-${user.id}`

For all: wrap cleanup in a proper pattern:
```ts
const channelName = `notifications-${user.id}-${Date.now()}`;
const channel = supabase.channel(channelName)
  .on(...)
  .subscribe();
return () => { supabase.removeChannel(channel); };
```

**B. Fix MarketCard Link Mismatch**

`MarketCard.tsx` line 57 links to `/market/${market.id}` but the canonical route is `/markets/:id`. The `/market/:id` route exists as a legacy redirect but causes unnecessary navigation. Change to `/markets/${market.id}`.

**C. Add Route Guards on Player Routes**

`src/App.tsx` lines 111-115: Dashboard, Portfolio, Activity, Wallet are not wrapped in `PlayerRoute`. The guard exists in `src/routes/route-guards.tsx` but is unused. Wrap all player routes.

**D. Fix Feed.tsx Missing Error Handling**

`fetchMarkets` silently swallows errors. Add try/catch with an error state and user-facing fallback.

---

### Priority 2: Medium Fixes

**E. Harden AuthContext Race Condition**

In `AuthContext.tsx`, `onAuthStateChange` and `getSession` both call `setLoading(false)`. If `getSession` resolves before the listener fires, the user sees the app in an unauthenticated state briefly. Fix: use a flag to ensure `getSession` result is only used if the listener hasn't fired yet.

**F. Deduplicate Realtime Refetches**

`MarketDetail.tsx` subscribes to `market_outcomes`, `trades`, and `market_comments` and calls `fetchAll()` on each event — meaning a single trade triggers 2 full refetches. Debounce with a 300ms timer.

**G. Add Loading/Error/Empty States Across Pages**

Pages that need attention:
- `Portfolio.tsx`, `Wallet.tsx`, `Leaderboard.tsx` — need error states for failed fetches
- `MarketDetail.tsx` — needs error state if market fetch fails (not just "not found")
- `Dashboard.tsx` — already handles no-user, needs fetch error state

**H. SEO on Key Pages**

Add `SEOHead` to pages that lack it:
- `MarketDetail.tsx` — dynamic title/description from market data, JSON-LD for the market
- `Leaderboard.tsx` — static SEO
- `Markets.tsx` — static SEO
- `Rules.tsx`, `Sources.tsx` — static SEO

**I. Fix GuestContext Unnecessary DB Calls**

When a user is authenticated, `GuestContext` still reads from `guest_sessions` on initial mount because `user` starts as `null` in `AuthContext` while `getSession` is pending. The guest init runs, then user loads, then guest clears. Fix: check `loading` from AuthContext before initializing guest.

**J. Improve ErrorBoundary**

Add route context logging. Reset error state on navigation (currently the error sticks even if user navigates away via browser back).

---

### Priority 3: Structural Improvements

**K. Centralize Supabase Realtime Pattern**

Create `src/hooks/useRealtimeChannel.ts` — a hook that handles:
- Unique channel naming
- Proper cleanup
- Reconnection on disconnect
- Error logging

Refactor all 5 realtime usages to use this hook.

**L. Standardize Fetch Error Pattern**

Create `src/lib/api.ts` with a wrapper:
```ts
async function safeFetch<T>(query: Promise<{data: T | null, error: any}>): Promise<{data: T | null, error: string | null}>
```
Use across all Supabase queries to normalize error handling.

**M. Add SEO for Dynamic Market Pages**

In `MarketDetail.tsx`, after market data loads, set:
- Title: `{market.title} | Pagaza`
- Description: market description or auto-generated
- OG image: market image_url if available
- JSON-LD: `Event` or `Thing` schema

**N. Clean Up Dead/Redundant Code**

- Remove `src/pages/About.tsx`, `src/pages/FAQ.tsx`, `src/pages/Trending.tsx`, `src/pages/ClosingSoon.tsx`, `src/pages/Resolved.tsx`, `src/pages/CategoryPage.tsx` — these are now redirect targets
- Remove `src/pages/Challenges.tsx` if it's just redirected
- Remove unused imports in MarketCard (`useState`, `useEffect`, `supabase`)

**O. Pricing Algorithm Guardrails**

In `src/lib/pricing.ts` (and `MarketCard.tsx` duplicate), add:
- Guard against `b === 0` (division by zero)
- Guard against empty pools array
- Clamp prices to [0, 1] range
- Handle NaN/Infinity from Math.exp overflow

---

### Implementation Order

1. **A + B + C** — Fix crash, fix link, add guards (unblocks the app)
2. **D + E + I** — Error handling, auth race, guest race
3. **F + G** — Debounce realtime, add page states
4. **H + M** — SEO hardening
5. **K + L** — Structural hooks/utilities
6. **N + O** — Cleanup and algorithm guards

### Files Changed (estimate)

| Priority | Files | Type |
|----------|-------|------|
| A | 5 files (realtime) | Edit |
| B | MarketCard.tsx | Edit |
| C | App.tsx | Edit |
| D | Feed.tsx | Edit |
| E | AuthContext.tsx | Edit |
| F | MarketDetail.tsx | Edit |
| G | 4 page files | Edit |
| H | 5 page files | Edit |
| I | GuestContext.tsx | Edit |
| J | ErrorBoundary.tsx | Edit |
| K | 1 new hook | Create |
| L | 1 new utility | Create |
| N | ~6 files | Delete |
| O | pricing.ts, MarketCard.tsx | Edit |

### Assumptions

- The `lmsrPrice` function in `MarketCard.tsx` is the canonical pricing logic (duplicated from `src/lib/pricing.ts`). Will keep `src/lib/pricing.ts` as the single source and update imports.
- The `PlayerRoute` guard from `route-guards.tsx` is the correct auth gate for player routes.
- The existing Admin route guard (checking `has_role`) is working correctly per the network logs.
- No database schema changes are needed for this hardening pass.

