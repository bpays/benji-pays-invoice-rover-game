
-- Create scores table
CREATE TABLE public.scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_name TEXT NOT NULL,
  email TEXT,
  score INTEGER NOT NULL DEFAULT 0,
  city_reached TEXT,
  city_flag TEXT,
  best_combo INTEGER DEFAULT 0,
  flagged BOOLEAN DEFAULT false,
  event_tag TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create settings table
CREATE TABLE public.settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Scores policies: public read (non-flagged), public insert
CREATE POLICY "Anyone can view non-flagged scores"
  ON public.scores FOR SELECT
  USING (flagged = false);

CREATE POLICY "Anyone can insert scores"
  ON public.scores FOR INSERT
  WITH CHECK (true);

-- Settings policies: public read, authenticated update
CREATE POLICY "Anyone can read settings"
  ON public.settings FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can update settings"
  ON public.settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insert default settings
INSERT INTO public.settings (key, value) VALUES
  ('leaderboard_reset_at', now()::text),
  ('event_name', 'Invoice Rover Launch'),
  ('event_active', 'true');
