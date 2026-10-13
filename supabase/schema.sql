-- Jam's English Desk — run in Supabase SQL editor (free plan is enough). Safe to re-run.
-- Also: Authentication → Providers → Google ON; set ALLOWED_EMAIL (Vercel/Netlify) to Jam's email;
-- and after Jam's first sign-in: Authentication → Settings → turn OFF "Allow new users to sign up"
-- (RLS lets any signed-in user store their own rows/files, so strangers must not be able to sign up).

-- One JSON document per key per user: profile, sessions, phrases, snapshots.
create table if not exists public.app_state (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.app_state enable row level security;
drop policy if exists "own rows" on public.app_state;
create policy "own rows" on public.app_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Voice Snapshot recordings (private bucket, folder = user id).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('snapshots', 'snapshots', false, 20971520, array['audio/webm', 'audio/mp4', 'audio/ogg'])
  on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "own snapshots read" on storage.objects;
create policy "own snapshots read" on storage.objects for select
  using (bucket_id = 'snapshots' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "own snapshots write" on storage.objects;
create policy "own snapshots write" on storage.objects for insert
  with check (bucket_id = 'snapshots' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "own snapshots delete" on storage.objects;
create policy "own snapshots delete" on storage.objects for delete
  using (bucket_id = 'snapshots' and (storage.foldername(name))[1] = auth.uid()::text);
