-- 1. Restrictive UPDATE policy on user_roles (defense-in-depth against privilege escalation)
CREATE POLICY "No one can update roles"
ON public.user_roles
AS RESTRICTIVE
FOR UPDATE
TO public
USING (false)
WITH CHECK (false);

-- 2. Restrictive INSERT policy on scores (only the service-role edge function may insert)
CREATE POLICY "No client inserts on scores"
ON public.scores
AS RESTRICTIVE
FOR INSERT
TO public
WITH CHECK (false);

-- 3. Enforce MFA (aal2) inside sensitive admin SECURITY DEFINER functions
CREATE OR REPLACE FUNCTION public.get_admin_stats(p_event_tag text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result json;
  v_aal text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can read admin stats';
  END IF;

  v_aal := COALESCE(current_setting('request.jwt.claim.aal', true), (auth.jwt() ->> 'aal'));
  IF v_aal IS DISTINCT FROM 'aal2' THEN
    RAISE EXCEPTION 'MFA (aal2) required';
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
$function$;

CREATE OR REPLACE FUNCTION public.reset_event_scores(p_event_tag text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_aal text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can reset scores';
  END IF;

  v_aal := COALESCE(current_setting('request.jwt.claim.aal', true), (auth.jwt() ->> 'aal'));
  IF v_aal IS DISTINCT FROM 'aal2' THEN
    RAISE EXCEPTION 'MFA (aal2) required';
  END IF;

  DELETE FROM public.scores
  WHERE event_tag = p_event_tag;
END;
$function$;