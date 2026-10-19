-- Données de l'app Nutrition : une ligne JSON par utilisateur.
-- À exécuter une fois dans Supabase > SQL Editor.

create table if not exists public.user_data (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Date de mise à jour fixée par le serveur (sert à détecter les modifs des autres appareils).
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_data_touch on public.user_data;
create trigger user_data_touch
  before insert or update on public.user_data
  for each row execute function public.touch_updated_at();

-- Chaque compte ne voit et ne modifie que sa propre ligne.
alter table public.user_data enable row level security;

drop policy if exists "Lecture de ses données" on public.user_data;
create policy "Lecture de ses données" on public.user_data
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Création de ses données" on public.user_data;
create policy "Création de ses données" on public.user_data
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Modification de ses données" on public.user_data;
create policy "Modification de ses données" on public.user_data
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select, insert, update on public.user_data to authenticated;
revoke all on public.user_data from anon;
