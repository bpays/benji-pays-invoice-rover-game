
-- Create events table
CREATE TABLE public.events (
  tag TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Anyone can read events (public leaderboard needs the active event label)
CREATE POLICY "Anyone can read events"
  ON public.events FOR SELECT
  USING (true);

-- Only admins with aal2 can insert
CREATE POLICY "Admins can insert events"
  ON public.events FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND COALESCE(
      current_setting('request.jwt.claim.aal', true),
      (auth.jwt() ->> 'aal')
    ) = 'aal2'
  );

-- No update / no delete policies => denied by default

-- Seed events
INSERT INTO public.events (tag, label) VALUES
  ('general', 'General Play'),
  ('nable-empower-2026', 'N-able Empower 2026')
ON CONFLICT (tag) DO NOTHING;

-- Seed active_event setting
INSERT INTO public.settings (key, value, updated_at)
VALUES ('active_event', 'nable-empower-2026', now())
ON CONFLICT (key) DO NOTHING;
