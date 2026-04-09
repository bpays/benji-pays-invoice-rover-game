-- Daily leaderboard: best score per player name for current UTC calendar day only
CREATE OR REPLACE FUNCTION public.get_daily_leaderboard(
  p_event_tag text DEFAULT NULL::text,
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
SET search_path TO 'public'
AS $function$
  WITH day_start AS (
    SELECT ((now() AT TIME ZONE 'utc')::date) AT TIME ZONE 'utc' AS ts
  ),
  best_scores AS (
    SELECT DISTINCT ON (lower(s.player_name))
      s.id,
      s.player_name,
      s.score,
      s.city_reached,
      s.city_flag,
      s.best_combo,
      s.created_at,
      s.event_tag
    FROM public.scores s
    CROSS JOIN day_start d
    WHERE s.flagged = false
      AND s.created_at >= d.ts
      AND (p_event_tag IS NULL OR s.event_tag = p_event_tag)
    ORDER BY lower(s.player_name), s.score DESC
  )
  SELECT * FROM best_scores
  ORDER BY score DESC
  LIMIT p_limit;
$function$;

-- Total non-flagged submissions for an event (all time)
CREATE OR REPLACE FUNCTION public.get_event_submission_count(p_event_tag text DEFAULT NULL)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT count(*)::integer
  FROM public.scores s
  WHERE s.flagged = false
    AND (p_event_tag IS NULL OR s.event_tag = p_event_tag);
$function$;

-- Admin-only: delete all scores for an event tag
CREATE OR REPLACE FUNCTION public.reset_event_scores(p_event_tag text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  deleted bigint;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_event_tag IS NULL OR length(trim(p_event_tag)) = 0 THEN
    RAISE EXCEPTION 'event_tag required';
  END IF;

  DELETE FROM public.scores
  WHERE event_tag = p_event_tag;

  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_daily_leaderboard(text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_submission_count(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.reset_event_scores(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_event_scores(text) TO authenticated;
