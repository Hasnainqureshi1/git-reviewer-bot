alter table public.repos
  add column if not exists github_installation_id bigint,
  add column if not exists review_mode text not null default 'balanced',
  add column if not exists minimum_severity text not null default 'low',
  add column if not exists ignored_paths text[] not null default '{}',
  add column if not exists custom_instructions text not null default '',
  add column if not exists auto_review boolean not null default true,
  add column if not exists block_on_critical boolean not null default false;

alter table public.reviews
  add column if not exists head_sha text,
  add column if not exists review_mode text not null default 'balanced',
  add column if not exists attempt_count integer not null default 0,
  add column if not exists input_characters integer not null default 0,
  add column if not exists output_characters integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'repos_review_mode_check') then
    alter table public.repos add constraint repos_review_mode_check
      check (review_mode in ('balanced', 'security', 'performance'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'repos_minimum_severity_check') then
    alter table public.repos add constraint repos_minimum_severity_check
      check (minimum_severity in ('low', 'medium', 'high', 'critical'));
  end if;
end
$$;

create table if not exists public.review_jobs (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null unique references public.reviews(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  processing_started_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists review_jobs_due_idx
  on public.review_jobs(status, next_attempt_at);
create index if not exists audit_logs_user_created_idx
  on public.audit_logs(user_id, created_at desc);

alter table public.review_jobs enable row level security;
alter table public.audit_logs enable row level security;

drop trigger if exists reviews_set_updated_at on public.reviews;
create trigger reviews_set_updated_at
before update on public.reviews
for each row execute function public.set_updated_at();

create or replace function public.claim_review_jobs(batch_size integer default 5)
returns setof public.review_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.review_jobs
  set
    status = 'processing',
    processing_started_at = now(),
    attempt_count = attempt_count + 1,
    updated_at = now()
  where id in (
    select id
    from public.review_jobs
    where
      (status in ('pending', 'failed') and next_attempt_at <= now() and attempt_count < 4)
      or (status = 'processing' and processing_started_at < now() - interval '5 minutes')
    order by next_attempt_at asc
    for update skip locked
    limit greatest(batch_size, 1)
  )
  returning *;
end;
$$;

revoke all on function public.claim_review_jobs(integer) from public, anon, authenticated;
grant execute on function public.claim_review_jobs(integer) to service_role;
