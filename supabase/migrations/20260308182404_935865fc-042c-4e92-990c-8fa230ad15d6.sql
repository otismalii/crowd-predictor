
-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create subscription_plan enum
CREATE TYPE public.subscription_plan AS ENUM ('free', 'weekly', 'monthly', 'quarterly');

-- Create match_status enum
CREATE TYPE public.match_status AS ENUM ('upcoming', 'live', 'finished', 'postponed', 'cancelled');

-- Create prediction_status enum
CREATE TYPE public.prediction_status AS ENUM ('pending', 'correct', 'incorrect');

-- Create vote_type enum
CREATE TYPE public.vote_type AS ENUM ('up', 'down');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  email TEXT,
  avatar_url TEXT,
  reputation_score INTEGER NOT NULL DEFAULT 0,
  accuracy_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  followers_count INTEGER NOT NULL DEFAULT 0,
  subscription_plan public.subscription_plan NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Matches table
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  kickoff TIMESTAMPTZ NOT NULL,
  status public.match_status NOT NULL DEFAULT 'upcoming',
  home_score INTEGER,
  away_score INTEGER,
  external_match_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Predictions table
CREATE TABLE public.predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  predicted_home_score INTEGER NOT NULL,
  predicted_away_score INTEGER NOT NULL,
  confidence INTEGER NOT NULL DEFAULT 3 CHECK (confidence >= 1 AND confidence <= 5),
  analysis TEXT,
  status public.prediction_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, match_id)
);

-- AI Insights table
CREATE TABLE public.ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  ai_summary TEXT NOT NULL,
  community_prediction TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Votes table
CREATE TABLE public.votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  prediction_id UUID NOT NULL REFERENCES public.predictions(id) ON DELETE CASCADE,
  vote_type public.vote_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, prediction_id)
);

-- User Roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- has_role function (security definer to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Auto-create profile on signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'username');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies

-- Profiles: anyone can read, users can update own
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Matches: anyone can read, admins can insert/update
CREATE POLICY "Matches are viewable by everyone" ON public.matches FOR SELECT USING (true);
CREATE POLICY "Admins can insert matches" ON public.matches FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update matches" ON public.matches FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
-- Also allow service role (edge functions) to insert/update matches
CREATE POLICY "Service role can insert matches" ON public.matches FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role can update matches" ON public.matches FOR UPDATE USING (auth.role() = 'service_role');

-- Predictions: anyone can read, authenticated can insert own, users can update own
CREATE POLICY "Predictions are viewable by everyone" ON public.predictions FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create predictions" ON public.predictions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own predictions" ON public.predictions FOR UPDATE USING (auth.uid() = user_id);

-- AI Insights: anyone can read, service role can insert
CREATE POLICY "AI insights are viewable by everyone" ON public.ai_insights FOR SELECT USING (true);
CREATE POLICY "Service role can insert ai_insights" ON public.ai_insights FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Votes: anyone can read, authenticated can insert own, users can update/delete own
CREATE POLICY "Votes are viewable by everyone" ON public.votes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can vote" ON public.votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own votes" ON public.votes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own votes" ON public.votes FOR DELETE USING (auth.uid() = user_id);

-- User Roles: only admins can read/manage, users can read own
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Enable realtime on predictions
ALTER PUBLICATION supabase_realtime ADD TABLE public.predictions;
