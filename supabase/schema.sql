-- Run in Supabase SQL Editor after creating users in Supabase Auth.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null,
  role text not null default 'user' check (role in ('admin','manager','user')),
  department text,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id bigint generated always as identity primary key,
  title text not null,
  description text not null default '',
  status text not null default 'idea' check (status in ('idea','script','production','editing','review','scheduled','published')),
  due_date date,
  executor_ids uuid[] not null default '{}',
  created_by uuid not null references public.profiles(id) on delete restrict,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$ select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;

create policy "profiles read authenticated"
on public.profiles for select
to authenticated
using (true);

create policy "profiles update own"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

create policy "tasks read authenticated"
on public.tasks for select
to authenticated
using (not is_deleted or public.is_admin());

create policy "tasks insert authenticated"
on public.tasks for insert
to authenticated
with check (created_by = auth.uid());

create policy "tasks update owner executor admin"
on public.tasks for update
to authenticated
using (created_by = auth.uid() or auth.uid() = any(executor_ids) or public.is_admin())
with check (created_by = auth.uid() or auth.uid() = any(executor_ids) or public.is_admin());

create policy "tasks delete admin only"
on public.tasks for delete
to authenticated
using (public.is_admin());
