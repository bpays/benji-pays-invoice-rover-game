-- Remove server-side bulk delete path
DROP FUNCTION IF EXISTS public.reset_event_scores(text);

-- Remove existing admin DELETE policy on scores
DROP POLICY IF EXISTS "Admins can delete scores" ON public.scores;

-- Add restrictive policy that denies all DELETE operations on scores for everyone
CREATE POLICY "No deletes on scores"
ON public.scores
AS RESTRICTIVE
FOR DELETE
TO public
USING (false);
