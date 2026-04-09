
CREATE OR REPLACE FUNCTION public.get_daily_leaderboard(
  p_event_tag text DEFAULT NULL,
  p_limit integer DEFAULT 10
)
RETURNS TABLE(
  id uuid,
  player_name text,
  score integer,
  city_reached text,
  city_flag text,
  best_combo integer,
  created_at timestamptz,
  event_tag text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  WITH best_scores AS (
    SELECT DISTINCT ON (LOWER(s.player_name))
      s.id, s.player_name, s.score, s.city_reached, s.city_flag, s.best_combo, s.created_at, s.event_tag
    FROM public.scores s
    WHERE s.flagged = false
      AND s.created_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
      AND (p_event_tag IS NULL OR s.event_tag = p_event_tag)
    ORDER BY LOWER(s.player_name), s.score DESC
  )
  SELECT * FROM best_scores
  ORDER BY score DESC
  LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION public.get_event_submission_count(
  p_event_tag text DEFAULT NULL
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COUNT(*)::int
  FROM public.scores
  WHERE flagged = false
    AND (p_event_tag IS NULL OR event_tag = p_event_tag);
$$;

CREATE OR REPLACE FUNCTION public.reset_event_scores(
  p_event_tag text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can reset scores';
  END IF;

  DELETE FROM public.scores
  WHERE event_tag = p_event_tag;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_leaderboard(text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_submission_count(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_event_scores(text) TO authenticated;
