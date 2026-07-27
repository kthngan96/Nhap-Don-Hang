begin;

create table if not exists public.vietnam_holidays (
  holiday_date date primary key,
  holiday_year smallint not null,
  name text not null check (length(btrim(name)) > 0),
  holiday_type text not null check (
    holiday_type in ('public_holiday', 'compensatory_leave', 'swapped_leave')
  ),
  source_url text not null check (source_url ~ '^https://'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vietnam_holidays_year_check
    check (holiday_year = extract(year from holiday_date)::smallint)
);

create index if not exists vietnam_holidays_year_date_idx
on public.vietnam_holidays (holiday_year, holiday_date);

drop trigger if exists set_vietnam_holidays_updated_at
on public.vietnam_holidays;
create trigger set_vietnam_holidays_updated_at
before update on public.vietnam_holidays
for each row execute function public.set_updated_at();

alter table public.vietnam_holidays enable row level security;

drop policy if exists "Authenticated users read Vietnam holidays"
on public.vietnam_holidays;
create policy "Authenticated users read Vietnam holidays"
on public.vietnam_holidays
for select
to authenticated
using (true);

revoke all on public.vietnam_holidays from anon, authenticated;
grant select on public.vietnam_holidays to authenticated;

insert into public.vietnam_holidays (
  holiday_date,
  holiday_year,
  name,
  holiday_type,
  source_url
)
values
  ('2025-01-01', 2025, 'Tết Dương lịch', 'public_holiday',
   'https://datafiles.chinhphu.vn/cpp/files/vbpq/2025/9/125-vbhn-vpqh.pdf'),
  ('2025-01-27', 2025, 'Tết Nguyên đán Ất Tỵ', 'public_holiday',
   'https://xaydungchinhsach.chinhphu.vn/lich-nghi-tet-nguyen-dan-at-ty-2025-119241127052424956.htm'),
  ('2025-01-28', 2025, 'Tết Nguyên đán Ất Tỵ', 'public_holiday',
   'https://xaydungchinhsach.chinhphu.vn/lich-nghi-tet-nguyen-dan-at-ty-2025-119241127052424956.htm'),
  ('2025-01-29', 2025, 'Tết Nguyên đán Ất Tỵ', 'public_holiday',
   'https://xaydungchinhsach.chinhphu.vn/lich-nghi-tet-nguyen-dan-at-ty-2025-119241127052424956.htm'),
  ('2025-01-30', 2025, 'Tết Nguyên đán Ất Tỵ', 'public_holiday',
   'https://xaydungchinhsach.chinhphu.vn/lich-nghi-tet-nguyen-dan-at-ty-2025-119241127052424956.htm'),
  ('2025-01-31', 2025, 'Tết Nguyên đán Ất Tỵ', 'public_holiday',
   'https://xaydungchinhsach.chinhphu.vn/lich-nghi-tet-nguyen-dan-at-ty-2025-119241127052424956.htm'),
  ('2025-04-07', 2025, 'Giỗ Tổ Hùng Vương', 'public_holiday',
   'https://datafiles.chinhphu.vn/cpp/files/vbpq/2025/9/125-vbhn-vpqh.pdf'),
  ('2025-04-30', 2025, 'Ngày Chiến thắng', 'public_holiday',
   'https://xaydungchinhsach.chinhphu.vn/lich-nghi-tet-nguyen-dan-at-ty-2025-119241127052424956.htm'),
  ('2025-05-01', 2025, 'Ngày Quốc tế Lao động', 'public_holiday',
   'https://xaydungchinhsach.chinhphu.vn/lich-nghi-tet-nguyen-dan-at-ty-2025-119241127052424956.htm'),
  ('2025-05-02', 2025, 'Nghỉ hoán đổi dịp 30/4–1/5', 'swapped_leave',
   'https://xaydungchinhsach.chinhphu.vn/lich-nghi-tet-nguyen-dan-at-ty-2025-119241127052424956.htm'),
  ('2025-09-01', 2025, 'Nghỉ Quốc khánh', 'public_holiday',
   'https://xaydungchinhsach.chinhphu.vn/lich-nghi-tet-nguyen-dan-at-ty-2025-119241127052424956.htm'),
  ('2025-09-02', 2025, 'Quốc khánh', 'public_holiday',
   'https://xaydungchinhsach.chinhphu.vn/lich-nghi-tet-nguyen-dan-at-ty-2025-119241127052424956.htm'),
  ('2026-01-01', 2026, 'Tết Dương lịch', 'public_holiday',
   'https://datafiles.chinhphu.vn/cpp/files/vbpq/2025/9/125-vbhn-vpqh.pdf'),
  ('2026-02-16', 2026, 'Tết Nguyên đán Bính Ngọ', 'public_holiday',
   'https://moha.gov.vn/tin-tuc/bo-noi-vu-thong-bao-ve-viec-nghi-tet-am-lich-nghi----oid57695'),
  ('2026-02-17', 2026, 'Tết Nguyên đán Bính Ngọ', 'public_holiday',
   'https://moha.gov.vn/tin-tuc/bo-noi-vu-thong-bao-ve-viec-nghi-tet-am-lich-nghi----oid57695'),
  ('2026-02-18', 2026, 'Tết Nguyên đán Bính Ngọ', 'public_holiday',
   'https://moha.gov.vn/tin-tuc/bo-noi-vu-thong-bao-ve-viec-nghi-tet-am-lich-nghi----oid57695'),
  ('2026-02-19', 2026, 'Tết Nguyên đán Bính Ngọ', 'public_holiday',
   'https://moha.gov.vn/tin-tuc/bo-noi-vu-thong-bao-ve-viec-nghi-tet-am-lich-nghi----oid57695'),
  ('2026-02-20', 2026, 'Tết Nguyên đán Bính Ngọ', 'public_holiday',
   'https://moha.gov.vn/tin-tuc/bo-noi-vu-thong-bao-ve-viec-nghi-tet-am-lich-nghi----oid57695'),
  ('2026-04-26', 2026, 'Giỗ Tổ Hùng Vương', 'public_holiday',
   'https://xaydungchinhsach.chinhphu.vn/nghi-le-gio-to-hung-vuong-va-30-4-1-5-khong-hoan-doi-de-nghi-lien-9-ngay-119260411044630249.htm'),
  ('2026-04-27', 2026, 'Nghỉ bù Giỗ Tổ Hùng Vương', 'compensatory_leave',
   'https://xaydungchinhsach.chinhphu.vn/nghi-le-gio-to-hung-vuong-va-30-4-1-5-khong-hoan-doi-de-nghi-lien-9-ngay-119260411044630249.htm'),
  ('2026-04-30', 2026, 'Ngày Chiến thắng', 'public_holiday',
   'https://xaydungchinhsach.chinhphu.vn/nghi-le-gio-to-hung-vuong-va-30-4-1-5-khong-hoan-doi-de-nghi-lien-9-ngay-119260411044630249.htm'),
  ('2026-05-01', 2026, 'Ngày Quốc tế Lao động', 'public_holiday',
   'https://xaydungchinhsach.chinhphu.vn/nghi-le-gio-to-hung-vuong-va-30-4-1-5-khong-hoan-doi-de-nghi-lien-9-ngay-119260411044630249.htm'),
  ('2026-08-31', 2026, 'Nghỉ hoán đổi dịp Quốc khánh', 'swapped_leave',
   'https://moha.gov.vn/tin-tuc/bo-noi-vu-thong-bao-ve-viec-nghi-tet-am-lich-nghi----oid57695'),
  ('2026-09-01', 2026, 'Nghỉ Quốc khánh', 'public_holiday',
   'https://moha.gov.vn/tin-tuc/bo-noi-vu-thong-bao-ve-viec-nghi-tet-am-lich-nghi----oid57695'),
  ('2026-09-02', 2026, 'Quốc khánh', 'public_holiday',
   'https://moha.gov.vn/tin-tuc/bo-noi-vu-thong-bao-ve-viec-nghi-tet-am-lich-nghi----oid57695')
on conflict (holiday_date) do update
set
  holiday_year = excluded.holiday_year,
  name = excluded.name,
  holiday_type = excluded.holiday_type,
  source_url = excluded.source_url,
  updated_at = now();

commit;
