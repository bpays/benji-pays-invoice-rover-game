
CREATE OR REPLACE FUNCTION public.get_daily_dashboard(p_event_tag text DEFAULT NULL, p_limit integer DEFAULT 10)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.get_event_dashboard(p_event_tag text DEFAULT NULL, p_limit integer DEFAULT 10)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
        AND (p_event_tag IS NULL OR event_tag = p_event_tag)
    )
  ) INTO result;
  RETURN result;
END;
$$;
