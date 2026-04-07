-- Drop the security definer view
DROP VIEW public.scores_public;

-- Drop the restrictive policies we just added
DROP POLICY "Anon cannot read scores directly" ON public.scores;
DROP POLICY "Authenticated non-admin cannot read scores directly" ON public.scores;

-- Drop the existing admin SELECT policy to avoid conflict
DROP POLICY "Admins can view all scores including flagged" ON public.scores;

-- Re-create public read policy excluding email via column-level REVOKE
-- First, restore public read for non-flagged scores
CREATE POLICY "Anyone can view non-flagged scores"
  ON public.scores FOR SELECT
  TO public
  USING (flagged = false);

-- Admins can see everything
CREATE POLICY "Admins can view all scores including flagged"
  ON public.scores FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Revoke email column access from anon role
REVOKE SELECT (email) ON public.scores FROM anon;