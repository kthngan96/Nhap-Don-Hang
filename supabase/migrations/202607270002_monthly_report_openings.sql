begin;

create table if not exists public.monthly_report_openings (
  user_id uuid not null references auth.users(id) on delete cascade,
  month_start date not null,
  period_start date not null,
  period_end date not null,
  revenue numeric not null default 0 check (revenue >= 0),
  gia_vi numeric not null default 0 check (gia_vi >= 0),
  aso_count integer not null default 0 check (aso_count >= 0),
  source_order_count integer not null default 0 check (source_order_count >= 0),
  source_day_aso integer not null default 0 check (source_day_aso >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, month_start),
  constraint monthly_report_openings_month_start_check
    check (month_start = date_trunc('month', month_start)::date),
  constraint monthly_report_openings_period_check
    check (
      period_start <= period_end
      and date_trunc('month', period_start)::date = month_start
      and date_trunc('month', period_end)::date = month_start
    )
);

drop trigger if exists set_monthly_report_openings_updated_at
on public.monthly_report_openings;
create trigger set_monthly_report_openings_updated_at
before update on public.monthly_report_openings
for each row execute function public.set_updated_at();

alter table public.monthly_report_openings enable row level security;

drop policy if exists "Users manage own report openings"
on public.monthly_report_openings;
create policy "Users manage own report openings"
on public.monthly_report_openings
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on public.monthly_report_openings from anon;
grant select, insert, update, delete
on public.monthly_report_openings to authenticated;

do $$
declare
  target_user_id uuid;
  current_order_count integer;
  current_report_revenue numeric;
  current_report_gia_vi numeric;
  current_report_order_count integer;
  current_report_aso integer;
begin
  select id
  into target_user_id
  from auth.users
  where lower(email) = 'huuthi2706@gmail.com'
  limit 1;

  if target_user_id is null then
    raise exception 'Cannot seed report opening: huuthi2706@gmail.com was not found';
  end if;

  select count(*)::integer
  into current_order_count
  from public.orders
  where user_id = target_user_id
    and work_date = date '2026-07-27';

  if current_order_count <> 3 then
    raise exception
      'Cannot seed report opening: expected 3 orders on 2026-07-27, found %',
      current_order_count;
  end if;

  select
    revenue,
    gia_vi,
    order_count,
    jsonb_array_length(new_customers)
  into
    current_report_revenue,
    current_report_gia_vi,
    current_report_order_count,
    current_report_aso
  from public.daily_reports
  where user_id = target_user_id
    and work_date = date '2026-07-27';

  if not found then
    raise exception
      'Cannot seed report opening: report 2026-07-27 has not been finalized';
  end if;

  if current_report_revenue <> 690030
    or current_report_gia_vi <> 0
    or current_report_order_count <> 3
    or current_report_aso <> 3 then
    raise exception
      'Cannot seed report opening: report 2026-07-27 does not match revenue=690030, gia_vi=0, orders=3, aso=3';
  end if;

  insert into public.monthly_report_openings (
    user_id,
    month_start,
    period_start,
    period_end,
    revenue,
    gia_vi,
    aso_count,
    source_order_count,
    source_day_aso
  )
  values (
    target_user_id,
    date '2026-07-01',
    date '2026-07-20',
    date '2026-07-25',
    5079333,
    486000,
    16,
    3,
    2
  )
  on conflict (user_id, month_start) do update
  set
    period_start = excluded.period_start,
    period_end = excluded.period_end,
    revenue = excluded.revenue,
    gia_vi = excluded.gia_vi,
    aso_count = excluded.aso_count,
    source_order_count = excluded.source_order_count,
    source_day_aso = excluded.source_day_aso;

  insert into public.user_settings (
    user_id,
    npp,
    nvbh,
    target_daily,
    target_monthly,
    target_aso,
    target_gia_vi
  )
  values (
    target_user_id,
    'Thuận Lợi - Trà Vinh',
    'Hữu Thi',
    3426000,
    30555556,
    50,
    20000000
  )
  on conflict (user_id) do update
  set
    npp = excluded.npp,
    nvbh = excluded.nvbh,
    target_daily = excluded.target_daily,
    target_monthly = excluded.target_monthly,
    target_aso = excluded.target_aso,
    target_gia_vi = excluded.target_gia_vi;
end
$$;

commit;
