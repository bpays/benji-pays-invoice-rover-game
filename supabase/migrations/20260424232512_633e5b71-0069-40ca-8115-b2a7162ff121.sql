CREATE TABLE IF NOT EXISTS public.submit_rate_buckets (
  bucket_key text NOT NULL,
  window_id  bigint NOT NULL,
  hit_count  integer NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_key, window_id)
);

ALTER TABLE public.submit_rate_buckets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.check_submit_score_rate_limit(
  p_ip_key      text,
  p_email_key   text,
  p_max_ip      integer DEFAULT 25,
  p_max_email   integer DEFAULT 10,
  p_window_secs integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w      bigint := (extract(epoch from now())::bigint / p_window_secs);
  ip_k   text   := left('i:' || coalesce(nullif(p_ip_key, ''), 'unknown'), 200);
  em_k   text   := left('e:' || coalesce(nullif(lower(p_email_key), ''), 'none'), 200);
  ip_cnt int;
  em_cnt int;
BEGIN
  INSERT INTO public.submit_rate_buckets (bucket_key, window_id, hit_count)
  VALUES (ip_k, w, 1)
  ON CONFLICT (bucket_key, window_id)
  DO UPDATE SET hit_count = public.submit_rate_buckets.hit_count + 1
  RETURNING hit_count INTO ip_cnt;

  INSERT INTO public.submit_rate_buckets (bucket_key, window_id, hit_count)
  VALUES (em_k, w, 1)
  ON CONFLICT (bucket_key, window_id)
  DO UPDATE SET hit_count = public.submit_rate_buckets.hit_count + 1
  RETURNING hit_count INTO em_cnt;

  RETURN ip_cnt <= p_max_ip AND em_cnt <= p_max_email;
END;
$$;

REVOKE ALL ON FUNCTION public.check_submit_score_rate_limit(text, text, integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_submit_score_rate_limit(text, text, integer, integer, integer) TO service_role;