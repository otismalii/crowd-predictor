

# PagazaBetz MVP Plan — Full Sprint

## Overview

Build the complete MVP: authentication, database schema, landing page, prediction feed, match data integration, AI insights, leaderboards, and user profiles. Dark street neon visual theme throughout.

## Phase 1: Database Schema

Create all core tables via Supabase migrations:

- **profiles** — `id (uuid FK auth.users)`, `username`, `email`, `avatar_url`, `reputation_score`, `accuracy_rate`, `followers_count`, `subscription_plan (free/weekly/monthly/quarterly)`, `created_at`
- **matches** — `id`, `league`, `home_team`, `away_team`, `kickoff`, `status`, `final_score`, `external_match_id`, `created_at`
- **predictions** — `id`, `user_id (FK profiles)`, `match_id (FK matches)`, `predicted_score`, `confidence (1-5)`, `analysis (text)`, `status (pending/correct/incorrect)`, `created_at`
- **ai_insights** — `id`, `match_id (FK matches)`, `ai_summary`, `community_prediction`, `created_at`
- **votes** — `id`, `user_id`, `prediction_id`, `vote_type (up/down)`, unique on `(user_id, prediction_id)`
- **user_roles** — `id`, `user_id (FK auth.users)`, `role (app_role enum: admin/moderator/user)`

All tables get RLS policies. A trigger auto-creates a profile row on signup.

## Phase 2: Authentication

- Email + password signup/login pages
- Auth context provider with `onAuthStateChange` listener
- Protected route wrapper
- Forgot password + `/reset-password` page
- Redirect to feed after login

## Phase 3: Design System — Dark Street Neon

Update CSS variables for the dark neon theme:

```text
Background:  near-black (#0a0a0f)
Primary:     neon green (#39ff14)
Accent:      electric yellow (#ffe600)
Secondary:   deep purple (#1a0033)
Cards:       dark glass (#12121a, semi-transparent)
Text:        white / light gray
Fonts:       Bold, condensed headings (e.g. Inter Black)
```

Glow effects on buttons, cards with subtle neon borders, gradient accents.

## Phase 4: Pages & Components

### Landing Page (`/`)
- Hero section with tagline "Predict with the Crowd. Smarter with AI."
- Feature highlights (crowd predictions, AI insights, leaderboards)
- CTA to sign up
- LionByte Studios footer branding

### Prediction Feed (`/feed`)
- List of upcoming matches with community predictions
- Post prediction form (score, confidence slider, analysis text)
- Vote on other predictions (up/down)
- Filter by league

### Match Detail (`/match/:id`)
- Match info (teams, kickoff, league)
- AI insight summary
- Community predictions list
- Combined AI + community confidence meter

### Leaderboards (`/leaderboard`)
- Top predictors ranked by accuracy & reputation
- Weekly/monthly/all-time tabs
- Free tier leaderboard (premium tier placeholder for later)

### Profile (`/profile/:id`)
- User stats: accuracy, streaks, prediction history
- Follower count, reputation score
- Recent predictions list

### Admin Dashboard (`/admin`) — basic version
- User list with ban/suspend actions
- Prediction moderation
- Protected by admin role check via `has_role()` function

## Phase 5: API Integration — Edge Functions

### Match Sync Edge Function (`sync-matches`)
- Calls API-Football to fetch upcoming matches
- Upserts into `matches` table
- Triggered manually or on schedule
- Requires **API-Football API key** stored as Supabase secret

### AI Insights Edge Function (`generate-insights`)
- Uses Lovable AI Gateway (Gemini) to generate match analysis
- Takes match data + community predictions as context
- Stores results in `ai_insights` table

## Phase 6: Real-time & Polish

- Supabase Realtime subscriptions on predictions feed
- Toast notifications for new predictions
- Mobile-first responsive layout
- Loading skeletons and error states

## API Key Requirement

You will need to provide an **API-Football API key** (from api-football.com or RapidAPI) for live match data. I will securely store it as a Supabase secret and use it only in edge functions.

## File Structure

```text
src/
  components/
    auth/        — LoginForm, SignupForm, ForgotPassword
    layout/      — Navbar, Footer, ProtectedRoute
    predictions/ — PredictionCard, PredictionForm, VoteButtons
    matches/     — MatchCard, MatchDetail, AIInsightPanel
    leaderboard/ — LeaderboardTable
    profile/     — ProfileHeader, PredictionHistory
    admin/       — UserManagement, ContentModeration
  pages/
    Index.tsx (landing), Auth.tsx, Feed.tsx, Match.tsx,
    Leaderboard.tsx, Profile.tsx, Admin.tsx, ResetPassword.tsx
  hooks/
    useAuth.ts, useMatches.ts, usePredictions.ts, useLeaderboard.ts
  contexts/
    AuthContext.tsx
  integrations/supabase/
    client.ts, types.ts
supabase/
  functions/
    sync-matches/index.ts
    generate-insights/index.ts
  config.toml
```

## Implementation Order

1. Database migrations (all tables, RLS, triggers, roles)
2. Design system (CSS variables, theme)
3. Auth (signup, login, context, protected routes)
4. Landing page
5. Match sync edge function + matches display
6. Prediction feed (post, vote, list)
7. AI insights edge function + display
8. Leaderboards
9. User profiles
10. Admin dashboard (basic)

