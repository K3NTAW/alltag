-- alltag initial schema.
-- Identity comes from Clerk. Clerk session tokens reach Supabase as third-party auth with
-- role "authenticated"; the Clerk user id is the JWT "sub" claim and keys every row.
-- Rows are soft-deleted (deleted_at) so deletes sync between devices.

create or replace function public.current_user_id()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt()->>'sub', '')
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- profiles: one row per user.
create table public.profiles (
  user_id text primary key not null default public.current_user_id(),
  level text check (level in ('A1', 'A2', 'B1', 'B2')),
  display_name text,
  settings jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- items: kept phrases with SM-2 state (srs: interval, ease, reps, due ISO).
create table public.items (
  id uuid primary key,
  user_id text not null default public.current_user_id(),
  noun_fr text,
  phrase_fr text not null,
  phrase_en text,
  error_type text,
  srs jsonb not null default '{}',
  kept_at timestamptz,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- scenes: one per capture; the photo lives in storage at scenes/<sub>/<id>.jpg.
create table public.scenes (
  id uuid primary key,
  user_id text not null default public.current_user_id(),
  place text,
  objects jsonb not null default '[]',
  task jsonb,
  image_path text,
  captured_at timestamptz,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- conversations: roleplay transcripts.
create table public.conversations (
  id uuid primary key,
  user_id text not null default public.current_user_id(),
  started_at timestamptz,
  duration_s int,
  lines jsonb not null default '[]',
  kept_count int default 0,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Sync pulls "everything of mine changed since t".
create index profiles_user_id_updated_at_idx on public.profiles (user_id, updated_at);
create index items_user_id_updated_at_idx on public.items (user_id, updated_at);
create index scenes_user_id_updated_at_idx on public.scenes (user_id, updated_at);
create index conversations_user_id_updated_at_idx on public.conversations (user_id, updated_at);

create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.items
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.scenes
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.conversations
  for each row execute function public.set_updated_at();

-- RLS: a user sees and writes only their own rows. No anon access.
alter table public.profiles enable row level security;
alter table public.items enable row level security;
alter table public.scenes enable row level security;
alter table public.conversations enable row level security;

create policy "profiles_select_own" on public.profiles for select to authenticated
  using (user_id = public.current_user_id());
create policy "profiles_insert_own" on public.profiles for insert to authenticated
  with check (user_id = public.current_user_id());
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (user_id = public.current_user_id()) with check (user_id = public.current_user_id());
create policy "profiles_delete_own" on public.profiles for delete to authenticated
  using (user_id = public.current_user_id());

create policy "items_select_own" on public.items for select to authenticated
  using (user_id = public.current_user_id());
create policy "items_insert_own" on public.items for insert to authenticated
  with check (user_id = public.current_user_id());
create policy "items_update_own" on public.items for update to authenticated
  using (user_id = public.current_user_id()) with check (user_id = public.current_user_id());
create policy "items_delete_own" on public.items for delete to authenticated
  using (user_id = public.current_user_id());

create policy "scenes_select_own" on public.scenes for select to authenticated
  using (user_id = public.current_user_id());
create policy "scenes_insert_own" on public.scenes for insert to authenticated
  with check (user_id = public.current_user_id());
create policy "scenes_update_own" on public.scenes for update to authenticated
  using (user_id = public.current_user_id()) with check (user_id = public.current_user_id());
create policy "scenes_delete_own" on public.scenes for delete to authenticated
  using (user_id = public.current_user_id());

create policy "conversations_select_own" on public.conversations for select to authenticated
  using (user_id = public.current_user_id());
create policy "conversations_insert_own" on public.conversations for insert to authenticated
  with check (user_id = public.current_user_id());
create policy "conversations_update_own" on public.conversations for update to authenticated
  using (user_id = public.current_user_id()) with check (user_id = public.current_user_id());
create policy "conversations_delete_own" on public.conversations for delete to authenticated
  using (user_id = public.current_user_id());

-- Storage: private bucket, objects at <sub>/<sceneId>.jpg.
insert into storage.buckets (id, name, public) values ('scenes', 'scenes', false)
  on conflict (id) do nothing;

create policy "scenes_objects_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'scenes' and (storage.foldername(name))[1] = public.current_user_id());
create policy "scenes_objects_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'scenes' and (storage.foldername(name))[1] = public.current_user_id());
create policy "scenes_objects_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'scenes' and (storage.foldername(name))[1] = public.current_user_id())
  with check (bucket_id = 'scenes' and (storage.foldername(name))[1] = public.current_user_id());
create policy "scenes_objects_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'scenes' and (storage.foldername(name))[1] = public.current_user_id());
