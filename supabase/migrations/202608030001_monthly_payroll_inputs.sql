-- Store the approved attendance input for each user's payroll month.
begin;

create table if not exists public.monthly_payroll_inputs (
  user_id uuid not null references auth.users(id) on delete cascade,
  month_start date not null,
  attendance_days numeric(4,2) not null default 0
    check (attendance_days >= 0 and attendance_days <= 26),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, month_start),
  constraint monthly_payroll_inputs_month_start_check
    check (month_start = date_trunc('month', month_start)::date)
);

drop trigger if exists set_monthly_payroll_inputs_updated_at
on public.monthly_payroll_inputs;
create trigger set_monthly_payroll_inputs_updated_at
before update on public.monthly_payroll_inputs
for each row execute function public.set_updated_at();

alter table public.monthly_payroll_inputs enable row level security;

drop policy if exists "Users manage own payroll inputs"
on public.monthly_payroll_inputs;
create policy "Users manage own payroll inputs"
on public.monthly_payroll_inputs
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on public.monthly_payroll_inputs from anon;
grant select, insert, update, delete
on public.monthly_payroll_inputs to authenticated;

commit;
