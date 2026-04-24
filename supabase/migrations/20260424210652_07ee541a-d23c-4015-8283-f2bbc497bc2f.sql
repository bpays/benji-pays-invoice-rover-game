
CREATE OR REPLACE FUNCTION public.get_admin_stats(p_event_tag text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can read admin stats';
  END IF;

  WITH base AS (
    SELECT id, score, email, city_reached, player_name, created_at, flagged
    FROM public.scores
    WHERE (p_event_tag IS NULL OR event_tag = p_event_tag)
  ),
  visible AS (
    SELECT * FROM base WHERE flagged = false
  ),
  top_row AS (
    SELECT player_name, score, city_reached
    FROM visible
    ORDER BY score DESC
    LIMIT 1
  ),
  top_city_row AS (
    SELECT city_reached, COUNT(*) AS c
    FROM visible
    WHERE city_reached IS NOT NULL AND score > 0
    GROUP BY city_reached
    ORDER BY c DESC
    LIMIT 1
  )
  SELECT json_build_object(
    'total', (SELECT COUNT(*) FROM visible),
    'today', (
      SELECT COUNT(*) FROM visible
      WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York'
    ),
    'active', (
      SELECT COUNT(*) FROM visible
      WHERE created_at >= now() - interval '15 minutes'
    ),
    'leads', (
      SELECT COUNT(DISTINCT email) FROM visible WHERE email IS NOT NULL AND email <> ''
    ),
    'avg', COALESCE((
      SELECT ROUND(AVG(score))::int FROM visible WHERE score > 0
    ), 0),
    'topScore', COALESCE((SELECT score FROM top_row), 0),
    'topName', COALESCE((SELECT player_name FROM top_row), '—'),
    'topCity', COALESCE((SELECT city_reached FROM top_city_row), '—')
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_stats(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_stats(text) TO authenticated;

CREATE INDEX IF NOT EXISTS scores_event_score_idx
  ON public.scores (event_tag, score DESC)
  WHERE flagged = false;
