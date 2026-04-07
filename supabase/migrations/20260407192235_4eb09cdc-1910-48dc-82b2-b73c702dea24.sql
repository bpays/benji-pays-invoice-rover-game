-- Drop the public SELECT policy
DROP POLICY "Anyone can view non-flagged scores" ON public.scores;

-- Create a security definer function that returns scores without email
CREATE OR REPLACE FUNCTION public.get_leaderboard(
  p_event_tag text DEFAULT NULL,
  p_limit int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  player_name text,
  score int,
  city_reached text,
  city_flag text,
  best_combo int,
  created_at timestamptz,
  event_tag text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.player_name, s.score, s.city_reached, s.city_flag, s.best_combo, s.created_at, s.event_tag
  FROM public.scores s
  WHERE s.flagged = false
    AND (p_event_tag IS NULL OR s.event_tag = p_event_tag)
  ORDER BY s.score DESC
  LIMIT p_limit;
$$;