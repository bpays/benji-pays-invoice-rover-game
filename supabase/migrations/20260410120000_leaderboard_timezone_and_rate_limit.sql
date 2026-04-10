-- Default "daily" window to US Eastern (handles EST/EDT via IANA name)
INSERT INTO public.settings (key, value, updated_at)
VALUES ('leaderboard_timezone', 'America/New_York', now())
ON CONFLICT (key) DO NOTHING;

-- Rate limiting for submit-score (Edge Function uses service_role)
CREATE TABLE IF NOT EXISTS public.submit_rate_buckets (
  bucket_key text NOT NULL,
  window_id bigint NOT NULL,
  hit_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_key, window_id)
);

ALTER TABLE public.submit_rate_buckets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.resolve_leaderboard_timezone()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tz text;
BEGIN
  SELECT s.value INTO tz FROM public.settings s WHERE s.key = 'leaderboard_timezone' LIMIT 1;
  IF tz IS NULL OR btrim(tz) = '' THEN
    RETURN 'America/New_York';
  END IF;
  tz := btrim(tz);
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names n WHERE n.name = tz) THEN
    RETURN 'America/New_York';
  END IF;
  RETURN tz;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_leaderboard_timezone() FROM PUBLIC;

-- IP + email windows (same rolling window length)
CREATE OR REPLACE FUNCTION public.check_submit_score_rate_limit(
  p_ip_key text,
  p_email_key text,
  p_max_ip integer DEFAULT 25,
  p_max_email integer DEFAULT 10,
  p_window_secs integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w bigint := (extract(epoch from now())::bigint / p_window_secs);
  ip_k text := left('i:' || coalesce(nullif(p_ip_key, ''), 'unknown'), 200);
  em_k text := left('e:' || coalesce(nullif(lower(p_email_key), ''), 'none'), 200);
  ip_cnt int;
  em_cnt int;
BEGIN
  INSERT INTO public.submit_rate_buckets (bucket_key, window_id, hit_count)
  VALUES (ip_k, w, 1)
  ON CONFLICT (bucket_key, window_id)
  DO UPDATE SET hit_count = public.submit_rate_buckets.hit_count + 1
  RETURNING hit_count INTO ip_cnt;

  INSERT INTO public.submit_rate_buckets (bucket_key, window_id, hit_count)
  VALUES (em_k, w, 1)
  ON CONFLICT (bucket_key, window_id)
  DO UPDATE SET hit_count = public.submit_rate_buckets.hit_count + 1
  RETURNING hit_count INTO em_cnt;

  RETURN ip_cnt <= p_max_ip AND em_cnt <= p_max_email;
END;
$$;

REVOKE ALL ON FUNCTION public.check_submit_score_rate_limit(text, text, integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_submit_score_rate_limit(text, text, integer, integer, integer) TO service_role;

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
SET search_path = public
AS $$
  WITH tz_name AS (SELECT public.resolve_leaderboard_timezone() AS tz),
  day_bounds AS (
    SELECT
      (date_trunc('day', now() AT TIME ZONE tz_name.tz)) AT TIME ZONE tz_name.tz AS day_start,
      (date_trunc('day', now() AT TIME ZONE tz_name.tz) + interval '1 day') AT TIME ZONE tz_name.tz AS day_end
    FROM tz_name
  ),
  best_scores AS (
    SELECT DISTINCT ON (LOWER(s.player_name))
      s.id, s.player_name, s.score, s.city_reached, s.city_flag, s.best_combo, s.created_at, s.event_tag
    FROM public.scores s
    CROSS JOIN day_bounds d
    WHERE s.flagged = false
      AND s.created_at >= d.day_start
      AND s.created_at < d.day_end
      AND (p_event_tag IS NULL OR s.event_tag = p_event_tag)
    ORDER BY LOWER(s.player_name), s.score DESC
  )
  SELECT * FROM best_scores
  ORDER BY score DESC
  LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION public.get_today_run_count(p_event_tag text DEFAULT NULL)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH tz_name AS (SELECT public.resolve_leaderboard_timezone() AS tz),
  day_bounds AS (
    SELECT
      (date_trunc('day', now() AT TIME ZONE tz_name.tz)) AT TIME ZONE tz_name.tz AS day_start,
      (date_trunc('day', now() AT TIME ZONE tz_name.tz) + interval '1 day') AT TIME ZONE tz_name.tz AS day_end
    FROM tz_name
  )
  SELECT COUNT(*)::integer
  FROM public.scores s
  CROSS JOIN day_bounds d
  WHERE s.flagged = false
    AND s.created_at >= d.day_start
    AND s.created_at < d.day_end
    AND (p_event_tag IS NULL OR s.event_tag = p_event_tag);
$$;

-- Single call for leaderboard UI: timezone label + seconds until local midnight
CREATE OR REPLACE FUNCTION public.get_daily_board_clock()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH tz_name AS (SELECT public.resolve_leaderboard_timezone() AS tz),
  bounds AS (
    SELECT
      tz_name.tz,
      (date_trunc('day', now() AT TIME ZONE tz_name.tz) + interval '1 day') AT TIME ZONE tz_name.tz AS next_boundary
    FROM tz_name
  )
  SELECT jsonb_build_object(
    'timezone', bounds.tz,
    'seconds_until_reset',
    GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (bounds.next_boundary - now())))::integer)
  )
  FROM bounds;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_board_clock() TO anon, authenticated;
