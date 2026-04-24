-- Explicit deny-all policies (RLS is on, no policies = deny-all already, but
-- the linter wants an explicit policy so intent is auditable).
CREATE POLICY "No client access to rate buckets"
  ON public.submit_rate_buckets
  AS RESTRICTIVE
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);