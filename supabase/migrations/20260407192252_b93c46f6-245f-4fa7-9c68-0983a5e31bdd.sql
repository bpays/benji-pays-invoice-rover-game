-- Function to count today's runs without exposing emails
CREATE OR REPLACE FUNCTION public.get_today_run_count(p_event_tag text DEFAULT NULL)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.scores
  WHERE flagged = false
    AND created_at >= (now()::date)::timestamptz
    AND (p_event_tag IS NULL OR event_tag = p_event_tag);
$$;