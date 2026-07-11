
-- Achievement badge definitions
CREATE TABLE public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL DEFAULT '🏆',
  category text NOT NULL DEFAULT 'general',
  threshold integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Badges viewable by everyone" ON public.badges FOR SELECT USING (true);

-- Seed default badges
INSERT INTO public.badges (slug, name, description, icon, category, threshold) VALUES
  ('first_prediction', 'First Blood', 'Made your first prediction', '🎯', 'predictions', 1),
  ('ten_predictions', 'Regular', 'Made 10 predictions', '📊', 'predictions', 10),
  ('fifty_predictions', 'Veteran', 'Made 50 predictions', '🎖️', 'predictions', 50),
  ('streak_5', 'Hot Streak', '5 correct predictions in a row', '🔥', 'streaks', 5),
  ('streak_10', 'On Fire', '10 correct predictions in a row', '💥', 'streaks', 10),
  ('accuracy_70', 'Sharpshooter', 'Maintain 70% accuracy', '🎯', 'accuracy', 70),
  ('accuracy_90', 'Oracle', 'Maintain 90% accuracy', '🔮', 'accuracy', 90),
  ('first_win_bet', 'First Win', 'Won your first P2P bet', '💰', 'bets', 1),
  ('ten_win_bets', 'High Roller', 'Won 10 P2P bets', '🎰', 'bets', 10),
  ('first_follower', 'Influencer', 'Got your first follower', '⭐', 'social', 1);

-- User badges join table
CREATE TABLE public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User badges viewable by everyone" ON public.user_badges FOR SELECT USING (true);
CREATE POLICY "System can insert user badges" ON public.user_badges FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- P2P Bets table
CREATE TYPE public.bet_status AS ENUM ('pending', 'accepted', 'declined', 'resolved', 'cancelled');

CREATE TABLE public.p2p_bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  challenger_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opponent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenger_prediction_home integer NOT NULL,
  challenger_prediction_away integer NOT NULL,
  opponent_prediction_home integer,
  opponent_prediction_away integer,
  stake_amount integer NOT NULL DEFAULT 100,
  house_cut_percent numeric NOT NULL DEFAULT 10,
  status bet_status NOT NULL DEFAULT 'pending',
  winner_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.p2p_bets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bets viewable by everyone" ON public.p2p_bets FOR SELECT USING (true);
CREATE POLICY "Authenticated can create bets" ON public.p2p_bets FOR INSERT WITH CHECK (auth.uid() = challenger_id);
CREATE POLICY "Participants can update bets" ON public.p2p_bets FOR UPDATE USING (auth.uid() IN (challenger_id, opponent_id));
