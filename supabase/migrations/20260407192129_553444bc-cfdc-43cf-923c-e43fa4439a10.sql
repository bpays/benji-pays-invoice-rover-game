-- Create a public view excluding email
CREATE VIEW public.scores_public
WITH (security_invoker = on) AS
  SELECT id, player_name, score, city_reached, city_flag, best_combo, created_at, flagged, event_tag
  FROM public.scores;

-- Drop the old public SELECT policy
DROP POLICY "Anyone can view non-flagged scores" ON public.scores;

-- Replace with a restrictive policy: anon can't read scores directly
CREATE POLICY "Anon cannot read scores directly"
  ON public.scores FOR SELECT
  TO anon
  USING (false);

-- Authenticated non-admins also can't read directly
CREATE POLICY "Authenticated non-admin cannot read scores directly"
  ON public.scores FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));