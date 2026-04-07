
-- 1. Create a public view of scores WITHOUT the email column
CREATE OR REPLACE VIEW public.public_scores AS
SELECT id, player_name, score, city_reached, city_flag, best_combo, event_tag, flagged, created_at
FROM public.scores;

-- Grant anon/authenticated access to the view (view inherits RLS from underlying table)
GRANT SELECT ON public.public_scores TO anon;
GRANT SELECT ON public.public_scores TO authenticated;

-- 2. Remove the client-side INSERT policy on user_roles
-- All role management goes through the admin-invite edge function using service_role key
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
