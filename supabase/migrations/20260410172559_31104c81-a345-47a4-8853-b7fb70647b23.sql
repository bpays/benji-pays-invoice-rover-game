
-- Create the missing get_daily_board_clock function (returns EST timezone + seconds until midnight EST)
CREATE OR REPLACE FUNCTION public.get_daily_board_clock()
RETURNS TABLE(timezone text, seconds_until_reset integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    'America/New_York'::text AS timezone,
    EXTRACT(EPOCH FROM (
      (date_trunc('day', now() AT TIME ZONE 'America/New_York') + interval '1 day')
      - (now() AT TIME ZONE 'America/New_York')
    ))::integer AS seconds_until_reset;
$$;

-- Update get_daily_leaderboard to use EST day boundary
CREATE OR REPLACE FUNCTION public.get_daily_leaderboard(p_event_tag text DEFAULT NULL::text, p_limit integer DEFAULT 10)
RETURNS TABLE(id uuid, player_name text, score integer, city_reached text, city_flag text, best_combo integer, created_at timestamp with time zone, event_tag text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH best_scores AS (
    SELECT DISTINCT ON (LOWER(s.player_name))
      s.id, s.player_name, s.score, s.city_reached, s.city_flag, s.best_combo, s.created_at, s.event_tag
    FROM public.scores s
    WHERE s.flagged = false
      AND s.created_at >= date_trunc('day', now() AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York'
      AND (p_event_tag IS NULL OR s.event_tag = p_event_tag)
    ORDER BY LOWER(s.player_name), s.score DESC
  )
  SELECT * FROM best_scores
  ORDER BY score DESC
  LIMIT p_limit;
$$;

-- Update get_today_run_count to use EST day boundary
CREATE OR REPLACE FUNCTION public.get_today_run_count(p_event_tag text DEFAULT NULL::text)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::int
  FROM public.scores
  WHERE flagged = false
    AND created_at >= date_trunc('day', now() AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York'
    AND (p_event_tag IS NULL OR event_tag = p_event_tag);
$$;
