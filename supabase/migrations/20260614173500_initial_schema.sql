create extension if not exists pgcrypto;

create table if not exists public.search_profiles (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Flight search',
  origin text not null,
  destination text not null,
  depart_date date not null,
  return_date date,
  adults integer not null default 1 check (adults >= 1),
  children integer not null default 0 check (children >= 0),
  infants integer not null default 0 check (infants >= 0),
  currency text not null default 'RUB',
  max_price integer,
  direct_only boolean not null default false,
  active boolean not null default true,
  check_interval_minutes integer not null default 60 check (check_interval_minutes >= 15),
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.search_runs (
  id uuid primary key default gen_random_uuid(),
  search_profile_id uuid not null references public.search_profiles(id) on delete cascade,
  provider text not null,
  status text not null check (status in ('success', 'failed', 'partial')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error_message text
);

create table if not exists public.offer_snapshots (
  id uuid primary key default gen_random_uuid(),
  search_profile_id uuid not null references public.search_profiles(id) on delete cascade,
  search_run_id uuid references public.search_runs(id) on delete set null,
  provider text not null,
  offer_fingerprint text not null,
  origin text not null,
  destination text not null,
  depart_date date not null,
  return_date date,
  airline text,
  flight_number text,
  transfers integer,
  duration_minutes integer,
  total_price integer not null,
  currency text not null,
  booking_url text,
  raw_payload jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now()
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  search_profile_id uuid not null references public.search_profiles(id) on delete cascade,
  offer_snapshot_id uuid references public.offer_snapshots(id) on delete set null,
  channel text not null default 'telegram',
  status text not null check (status in ('sent', 'failed', 'skipped')),
  message text,
  error_message text,
  sent_at timestamptz not null default now()
);

create table if not exists public.booking_attempts (
  id uuid primary key default gen_random_uuid(),
  search_profile_id uuid not null references public.search_profiles(id) on delete cascade,
  offer_snapshot_id uuid references public.offer_snapshots(id) on delete set null,
  status text not null default 'proposed',
  provider text not null,
  provider_offer_id text,
  price_at_attempt integer not null,
  currency text not null,
  booking_url text,
  raw_offer_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists search_profiles_active_idx
  on public.search_profiles(active, last_checked_at);

create index if not exists offer_snapshots_profile_observed_idx
  on public.offer_snapshots(search_profile_id, observed_at desc);

create index if not exists offer_snapshots_fingerprint_idx
  on public.offer_snapshots(offer_fingerprint, observed_at desc);

create index if not exists alerts_profile_sent_idx
  on public.alerts(search_profile_id, sent_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists search_profiles_set_updated_at on public.search_profiles;
create trigger search_profiles_set_updated_at
before update on public.search_profiles
for each row execute function public.set_updated_at();

alter table public.search_profiles enable row level security;
alter table public.search_runs enable row level security;
alter table public.offer_snapshots enable row level security;
alter table public.alerts enable row level security;
alter table public.booking_attempts enable row level security;
