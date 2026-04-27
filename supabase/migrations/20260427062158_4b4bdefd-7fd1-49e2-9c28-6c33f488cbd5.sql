-- Recreate the resolver helper (idempotent), then update dashboard RPCs to use it.

CREATE OR REPLACE FUNCTION public.resolve_leaderboard_timezone()
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  tz text;
BEGIN
  SELECT s.value INTO tz FROM public.settings s WHERE s.key = 'leaderboard_timezone' LIMIT 1;
  IF tz IS NULL OR tz = '' THEN
    RETURN 'America/New_York';
  END IF;
  -- Validate by attempting to use it; fall back if invalid.
  BEGIN
    PERFORM now() AT TIME ZONE tz;
  EXCEPTION WHEN OTHERS THEN
    RETURN 'America/New_York';
  END;
  RETURN tz;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_leaderboard_timezone() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_leaderboard_timezone() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_daily_leaderboard(p_event_tag text DEFAULT NULL::text, p_limit integer DEFAULT 10)
 RETURNS TABLE(id uuid, player_name text, score integer, city_reached text, city_flag text, best_combo integer, created_at timestamp with time zone, event_tag text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH tz_name AS (SELECT public.resolve_leaderboard_timezone() AS tz),
  best_scores AS (
    SELECT DISTINCT ON (LOWER(s.player_name))
      s.id, s.player_name, s.score, s.city_reached, s.city_flag, s.best_combo, s.created_at, s.event_tag
    FROM public.scores s, tz_name
    WHERE s.flagged = false
      AND s.score > 0
      AND s.created_at >= date_trunc('day', now() AT TIME ZONE tz_name.tz) AT TIME ZONE tz_name.tz
      AND (p_event_tag IS NULL OR s.event_tag = p_event_tag)
    ORDER BY LOWER(s.player_name), s.score DESC
  )
  SELECT id, player_name, score, city_reached, city_flag, best_combo, created_at, event_tag
  FROM best_scores
  ORDER BY score DESC
  LIMIT p_limit;
$function$;

CREATE OR REPLACE FUNCTION public.get_today_run_count(p_event_tag text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH tz_name AS (SELECT public.resolve_leaderboard_timezone() AS tz)
  SELECT COUNT(*)::int
  FROM public.scores, tz_name
  WHERE flagged = false
    AND score > 0
    AND created_at >= date_trunc('day', now() AT TIME ZONE tz_name.tz) AT TIME ZONE tz_name.tz
    AND (p_event_tag IS NULL OR event_tag = p_event_tag);
$function$;

CREATE OR REPLACE FUNCTION public.get_daily_board_clock()
 RETURNS TABLE(timezone text, seconds_until_reset integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH tz_name AS (SELECT public.resolve_leaderboard_timezone() AS tz)
  SELECT
    tz_name.tz AS timezone,
    EXTRACT(EPOCH FROM (
      (date_trunc('day', now() AT TIME ZONE tz_name.tz) + interval '1 day')
      - (now() AT TIME ZONE tz_name.tz)
    ))::integer AS seconds_until_reset
  FROM tz_name;
$function$;

CREATE OR REPLACE FUNCTION public.get_daily_dashboard(p_event_tag text DEFAULT NULL::text, p_limit integer DEFAULT 10)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result json;
  v_tz text;
BEGIN
  v_tz := public.resolve_leaderboard_timezone();

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
            AND s.created_at >= date_trunc('day', now() AT TIME ZONE v_tz) AT TIME ZONE v_tz
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
        AND created_at >= date_trunc('day', now() AT TIME ZONE v_tz) AT TIME ZONE v_tz
        AND (p_event_tag IS NULL OR event_tag = p_event_tag)
    ),
    'clock', json_build_object(
      'timezone', v_tz,
      'seconds_until_reset', EXTRACT(EPOCH FROM (
        (date_trunc('day', now() AT TIME ZONE v_tz) + interval '1 day')
        - (now() AT TIME ZONE v_tz)
      ))::integer
    )
  ) INTO result;
  RETURN result;
END;
$function$;