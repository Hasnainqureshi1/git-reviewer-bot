create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  github_id bigint not null unique,
  github_login text not null,
  avatar_url text,
  encrypted_access_token text not null,
  token_iv text not null,
  token_auth_tag text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.repos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  github_repo_id bigint not null unique,
  owner text not null,
  name text not null,
  full_name text not null,
  default_branch text not null default 'main',
  webhook_id bigint,
  webhook_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  repo_id uuid not null references public.repos(id) on delete cascade,
  github_delivery_id text not null unique,
  pr_number integer not null check (pr_number > 0),
  pr_title text not null,
  pr_url text not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  ai_response text,
  comment_url text,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists repos_user_id_idx on public.repos(user_id);
create index if not exists reviews_repo_created_idx on public.reviews(repo_id, created_at desc);

alter table public.users enable row level security;
alter table public.repos enable row level security;
alter table public.reviews enable row level security;

-- This application uses the Supabase service-role key exclusively in server code.
-- With RLS enabled and no public policies, anon/authenticated clients cannot read secrets.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists repos_set_updated_at on public.repos;
create trigger repos_set_updated_at
before update on public.repos
for each row execute function public.set_updated_at();
