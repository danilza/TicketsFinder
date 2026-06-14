alter table public.offer_snapshots
  add column if not exists outbound_price integer,
  add column if not exists return_price integer,
  add column if not exists passenger_count integer not null default 1,
  add column if not exists price_note text;

alter table public.booking_attempts
  add column if not exists outbound_price integer,
  add column if not exists return_price integer,
  add column if not exists passenger_count integer not null default 1;
