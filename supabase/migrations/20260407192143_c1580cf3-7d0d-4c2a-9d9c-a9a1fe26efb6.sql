-- Drop the security_invoker view
DROP VIEW public.scores_public;

-- Recreate WITHOUT security_invoker (defaults to security_definer behavior for views)
-- This allows the view to bypass RLS since views run as the view owner
CREATE VIEW public.scores_public AS
  SELECT id, player_name, score, city_reached, city_flag, best_combo, created_at, flagged, event_tag
  FROM public.scores
  WHERE flagged = false;