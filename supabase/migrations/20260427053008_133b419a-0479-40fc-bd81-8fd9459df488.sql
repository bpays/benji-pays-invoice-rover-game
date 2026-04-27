-- Exclude lead-capture rows (score = 0) from public leaderboards.
-- Each game run inserts one row at start (score 0) and one at end (final score),
-- so the leaderboard should ignore the 0-score "lead" row.

CREATE OR REPLACE FUNCTION public.get_daily_leaderboard(p_event_tag text DEFAULT NULL::text, p_limit integer DEFAULT 10)
 RETURNS TABLE(id uuid, player_name text, score integer, city_reached text, city_flag text, best_combo integer, created_at timestamp with time zone, event_tag text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH best_scores AS (
    SELECT DISTINCT ON (LOWER(s.player_name))
      s.id, s.player_name, s.score, s.city_reached, s.city_flag, s.best_combo, s.created_at, s.event_tag
    FROM public.scores s
    WHERE s.flagged = false
      AND s.score > 0
      AND s.created_at >= date_trunc('day', now() AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York'
      AND (p_event_tag IS NULL OR s.event_tag = p_event_tag)
    ORDER BY LOWER(s.player_name), s.score DESC
  )
  SELECT * FROM best_scores
  ORDER BY score DESC
  LIMIT p_limit;
$function$;

CREATE OR REPLACE FUNCTION public.get_leaderboard(p_event_tag text DEFAULT NULL::text, p_limit integer DEFAULT 10)
 RETURNS TABLE(id uuid, player_name text, score integer, city_reached text, city_flag text, best_combo integer, created_at timestamp with time zone, event_tag text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH best_scores AS (
    SELECT DISTINCT ON (LOWER(s.player_name))
      s.id, s.player_name, s.score, s.city_reached, s.city_flag, s.best_combo, s.created_at, s.event_tag
    FROM public.scores s
    WHERE s.flagged = false
      AND s.score > 0
      AND (p_event_tag IS NULL OR s.event_tag = p_event_tag)
    ORDER BY LOWER(s.player_name), s.score DESC
  )
  SELECT * FROM best_scores
  ORDER BY score DESC
  LIMIT p_limit;
$function$;

CREATE OR REPLACE FUNCTION public.get_today_run_count(p_event_tag text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COUNT(*)::int
  FROM public.scores
  WHERE flagged = false
    AND score > 0
    AND created_at >= date_trunc('day', now() AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York'
    AND (p_event_tag IS NULL OR event_tag = p_event_tag);
$function$;

CREATE OR REPLACE FUNCTION public.get_event_submission_count(p_event_tag text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COUNT(*)::int
  FROM public.scores
  WHERE flagged = false
    AND score > 0
    AND (p_event_tag IS NULL OR event_tag = p_event_tag);
$function$;

CREATE OR REPLACE FUNCTION public.get_event_dashboard(p_event_tag text DEFAULT NULL::text, p_limit integer DEFAULT 10)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'scores', COALESCE((
      SELECT json_agg(row_to_json(sub))
      FROM (
        SELECT * FROM (
          SELECT DISTINCT ON (LOWER(s.player_name))
            s.id, s.player_name, s.score, s.city_reached, s.city_flag, s.best_combo, s.created_at, s.event_tag
          FROM public.scores s
          WHERE s.flagged = false
            AND s.score > 0
            AND (p_event_tag IS NULL OR s.event_tag = p_event_tag)
          ORDER BY LOWER(s.player_name), s.score DESC
        ) ranked
        ORDER BY score DESC
        LIMIT p_limit
      ) sub
    ), '[]'::json),
    'submission_count', (
      SELECT COUNT(*)::int
      FROM public.scores
      WHERE flagged = false
        AND score > 0
        AND (p_event_tag IS NULL OR event_tag = p_event_tag)
    )
  ) INTO result;
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_daily_dashboard(p_event_tag text DEFAULT NULL::text, p_limit integer DEFAULT 10)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'scores', COALESCE((
      SELECT json_agg(row_to_json(sub))
      FROM (
        SELECT * FROM (
          SELECT DISTINCT ON (LOWER(s.player_name))
            s.id, s.player_name, s.score, s.city_reached, s.city_flag, s.best_combo, s.created_at, s.event_tag
          FROM public.scores s
          WHERE s.flagged = false
            AND s.score > 0
            AND s.created_at >= date_trunc('day', now() AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York'
            AND (p_event_tag IS NULL OR s.event_tag = p_event_tag)
          ORDER BY LOWER(s.player_name), s.score DESC
        ) ranked
        ORDER BY score DESC
        LIMIT p_limit
      ) sub
    ), '[]'::json),
    'run_count', (
      SELECT COUNT(*)::int
      FROM public.scores
      WHERE flagged = false
        AND score > 0
        AND created_at >= date_trunc('day', now() AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York'
        AND (p_event_tag IS NULL OR event_tag = p_event_tag)
    ),
    'clock', json_build_object(
      'timezone', 'America/New_York',
      'seconds_until_reset', EXTRACT(EPOCH FROM (
        (date_trunc('day', now() AT TIME ZONE 'America/New_York') + interval '1 day')
        - (now() AT TIME ZONE 'America/New_York')
      ))::integer
    )
  ) INTO result;
  RETURN result;
END;
$function$;