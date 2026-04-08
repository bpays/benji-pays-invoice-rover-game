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
      AND (p_event_tag IS NULL OR s.event_tag = p_event_tag)
    ORDER BY LOWER(s.player_name), s.score DESC
  )
  SELECT * FROM best_scores
  ORDER BY score DESC
  LIMIT p_limit;
$function$;