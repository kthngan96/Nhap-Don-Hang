begin;

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  npp text not null default '',
  nvbh text not null default '',
  target_daily numeric not null default 0 check (target_daily >= 0),
  target_monthly numeric not null default 0 check (target_monthly >= 0),
  target_aso integer not null default 0 check (target_aso >= 0),
  target_gia_vi numeric not null default 0 check (target_gia_vi >= 0),
  work_days integer not null default 0 check (work_days >= 0),
  prices jsonb not null default '{}'::jsonb check (jsonb_typeof(prices) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  work_date date not null,
  customer_name text not null,
  address text not null default '',
  phone text not null default '',
  is_new boolean not null default false,
  note text not null default '',
  items jsonb not null default '{}'::jsonb check (jsonb_typeof(items) = 'object'),
  latitude double precision,
  longitude double precision,
  location_accuracy double precision,
  location_captured_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint orders_valid_latitude check (latitude is null or latitude between -90 and 90),
  constraint orders_valid_longitude check (longitude is null or longitude between -180 and 180),
  constraint orders_location_pair check ((latitude is null) = (longitude is null))
);

create index if not exists orders_user_work_date_idx
  on public.orders (user_id, work_date, created_at);

create table if not exists public.daily_reports (
  user_id uuid not null references auth.users(id) on delete cascade,
  work_date date not null,
  revenue numeric not null default 0 check (revenue >= 0),
  gia_vi numeric not null default 0 check (gia_vi >= 0),
  order_count integer not null default 0 check (order_count >= 0),
  new_customers jsonb not null default '[]'::jsonb check (jsonb_typeof(new_customers) = 'array'),
  achieved boolean not null default false,
  finalized_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, work_date)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_user_settings_updated_at on public.user_settings;
create trigger set_user_settings_updated_at
before update on public.user_settings
for each row execute function public.set_updated_at();

drop trigger if exists set_orders_updated_at on public.orders;
create trigger set_orders_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

drop trigger if exists set_daily_reports_updated_at on public.daily_reports;
create trigger set_daily_reports_updated_at
before update on public.daily_reports
for each row execute function public.set_updated_at();

alter table public.user_settings enable row level security;
alter table public.orders enable row level security;
alter table public.daily_reports enable row level security;

drop policy if exists "Users manage own settings" on public.user_settings;
create policy "Users manage own settings"
on public.user_settings
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own orders" on public.orders;
create policy "Users manage own orders"
on public.orders
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own reports" on public.daily_reports;
create policy "Users manage own reports"
on public.daily_reports
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on public.user_settings from anon;
revoke all on public.orders from anon;
revoke all on public.daily_reports from anon;

grant select, insert, update, delete on public.user_settings to authenticated;
grant select, insert, update, delete on public.orders to authenticated;
grant select, insert, update, delete on public.daily_reports to authenticated;

commit;
