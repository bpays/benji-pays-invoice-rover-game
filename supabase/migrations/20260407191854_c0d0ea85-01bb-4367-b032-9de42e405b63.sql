DROP POLICY "Anyone can insert scores" ON public.scores;
CREATE POLICY "Anyone can insert non-flagged scores"
  ON public.scores FOR INSERT
  TO public
  WITH CHECK (flagged = false OR flagged IS NULL);