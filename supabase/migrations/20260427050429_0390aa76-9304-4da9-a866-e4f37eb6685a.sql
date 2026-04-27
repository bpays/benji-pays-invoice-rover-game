
ALTER TABLE public.scores
  ADD COLUMN IF NOT EXISTS run_id uuid,
  ADD COLUMN IF NOT EXISTS duration_s integer;

CREATE INDEX IF NOT EXISTS idx_scores_run_id ON public.scores(run_id);

CREATE TABLE IF NOT EXISTS public.game_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  player_name text,
  email text,
  event_tag text
);

CREATE INDEX IF NOT EXISTS idx_game_runs_started_at ON public.game_runs(started_at DESC);

ALTER TABLE public.game_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No client access to game_runs"
  ON public.game_runs
  AS RESTRICTIVE
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);
