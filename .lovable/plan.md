

## Plan: Integrate User Profile into Dashboard + Pull-to-Refresh

### What we're building
1. **User profile section** at the top of the Dashboard page — avatar, username, bio, edit button, stats (streak, accuracy, followers)
2. **Pull-to-refresh** on mobile — touch-drag-down gesture triggers data reload with a visual indicator

### Implementation

#### 1. Add Profile Section to Dashboard (`src/pages/Wallet.tsx`)
- Fetch user profile data alongside wallet/portfolio data in `fetchAll()`
- Add a compact profile card above the stats row: avatar, username, bio, edit profile button, streak badge
- Clicking avatar/username links to full `/profile/{id}` page
- Include inline `ProfileEdit` component (already exists) toggled by edit button
- Import: `Avatar`, `AvatarImage`, `AvatarFallback`, `StreakBadge`, `ProfileEdit`, `Pencil` icon

#### 2. Pull-to-Refresh Hook (`src/hooks/usePullToRefresh.ts`) — New file
- Custom hook using touch events (`touchstart`, `touchmove`, `touchend`)
- Tracks pull distance, shows a rotating spinner when threshold exceeded
- On release past threshold, calls `onRefresh()` callback
- Returns: `{ pullDistance, isRefreshing, pullToRefreshProps }` — props to spread on container
- Only active on mobile (check `window.innerWidth < 768` or use existing `useIsMobile`)

#### 3. Pull-to-Refresh UI Component (`src/components/PullToRefresh.tsx`) — New file
- Wrapper component that renders a pull indicator (animated spinner/arrow) above children
- Uses framer-motion for smooth spring animation of the indicator
- Shows `RefreshCw` icon that rotates when refreshing

#### 4. Wire into Dashboard
- Wrap the dashboard content area with `PullToRefresh` component
- `onRefresh` calls `fetchAll()` and returns a promise
- Also usable on Feed, Leaderboard etc. later

### Files to create
- `src/hooks/usePullToRefresh.ts`
- `src/components/PullToRefresh.tsx`

### Files to edit
- `src/pages/Wallet.tsx` — add profile section + wrap with pull-to-refresh

