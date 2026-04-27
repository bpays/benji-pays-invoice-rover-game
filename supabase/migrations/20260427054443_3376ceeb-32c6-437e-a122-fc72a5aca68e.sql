-- Private storage bucket for backups
insert into storage.buckets (id, name, public)
values ('scores-backups', 'scores-backups', false)
on conflict (id) do nothing;

-- Admin-only read access to backup files (uploads/deletes happen via service role in edge function)
create policy "Admins can read scores backups"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'scores-backups'
  and public.has_role(auth.uid(), 'admin')
);

-- Seed settings
insert into public.settings (key, value) values
  ('backups_enabled', 'false'),
  ('backups_last_run', '')
on conflict (key) do nothing;