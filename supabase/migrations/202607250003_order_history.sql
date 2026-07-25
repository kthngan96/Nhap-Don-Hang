begin;

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

alter table public.orders
  add column if not exists district text,
  add column if not exists customer_search text not null default '',
  add column if not exists product_ids text[] not null default '{}'::text[];

alter table public.orders
  drop constraint if exists orders_district_allowed;

alter table public.orders
  add constraint orders_district_allowed check (
    district is null or district in (
      'Huyện Càng Long',
      'Huyện Cầu Kè',
      'Huyện Tiểu Cần',
      'Huyện Châu Thành',
      'Huyện Cầu Ngang',
      'Huyện Trà Cú',
      'Huyện Duyên Hải',
      'Thành phố Trà Vinh'
    )
  );

create or replace function public.normalize_order_search(value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(value, '')));
$$;

create or replace function public.order_product_ids(value jsonb)
returns text[]
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(array_agg(item.key order by item.key), '{}'::text[])
  from jsonb_each(coalesce(value, '{}'::jsonb)) as item(key, quantities)
  where coalesce((item.quantities ->> 'ban')::numeric, 0) > 0
     or coalesce((item.quantities ->> 'tang')::numeric, 0) > 0;
$$;

create or replace function public.set_order_history_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.customer_search := public.normalize_order_search(new.customer_name);
  new.product_ids := public.order_product_ids(new.items);
  return new;
end;
$$;

drop trigger if exists set_order_history_fields on public.orders;
create trigger set_order_history_fields
before insert or update of customer_name, items on public.orders
for each row execute function public.set_order_history_fields();

update public.orders
set
  customer_search = public.normalize_order_search(customer_name),
  product_ids = public.order_product_ids(items),
  district = case
    when public.normalize_order_search(address) like '%cang long%' then 'Huyện Càng Long'
    when public.normalize_order_search(address) like '%cau ke%' then 'Huyện Cầu Kè'
    when public.normalize_order_search(address) like '%tieu can%' then 'Huyện Tiểu Cần'
    when public.normalize_order_search(address) like '%chau thanh%' then 'Huyện Châu Thành'
    when public.normalize_order_search(address) like '%cau ngang%' then 'Huyện Cầu Ngang'
    when public.normalize_order_search(address) like '%tra cu%' then 'Huyện Trà Cú'
    when public.normalize_order_search(address) like '%huyen duyen hai%' then 'Huyện Duyên Hải'
    when public.normalize_order_search(address) like '%thanh pho tra vinh%'
      or public.normalize_order_search(address) like '%tp tra vinh%'
      or public.normalize_order_search(address) like '%tp. tra vinh%'
      then 'Thành phố Trà Vinh'
    else district
  end;

create index if not exists orders_history_cursor_idx
  on public.orders (user_id, work_date desc, created_at desc, id desc);

create index if not exists orders_customer_search_trgm_idx
  on public.orders using gin (customer_search extensions.gin_trgm_ops);

create index if not exists orders_product_ids_gin_idx
  on public.orders using gin (product_ids);

create index if not exists orders_user_district_date_idx
  on public.orders (user_id, district, work_date desc);

create or replace function public.search_order_history(
  p_date_from date,
  p_date_to date,
  p_customer text default null,
  p_product_id text default null,
  p_district text default null,
  p_cursor_work_date date default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_id text default null,
  p_page_size integer default 30
)
returns setof public.orders
language sql
stable
security invoker
set search_path = ''
as $$
  select orders.*
  from public.orders
  where orders.user_id = (select auth.uid())
    and orders.work_date between p_date_from and p_date_to
    and (
      nullif(trim(p_customer), '') is null
      or orders.customer_search like '%' || public.normalize_order_search(trim(p_customer)) || '%'
    )
    and (
      nullif(trim(p_product_id), '') is null
      or trim(p_product_id) = any(orders.product_ids)
    )
    and (
      nullif(trim(p_district), '') is null
      or (p_district = '__UNKNOWN__' and orders.district is null)
      or (p_district <> '__UNKNOWN__' and orders.district = p_district)
    )
    and (
      p_cursor_work_date is null
      or (orders.work_date, orders.created_at, orders.id)
        < (p_cursor_work_date, p_cursor_created_at, p_cursor_id)
    )
  order by orders.work_date desc, orders.created_at desc, orders.id desc
  limit least(greatest(coalesce(p_page_size, 30), 1), 50) + 1;
$$;

revoke all on function public.search_order_history(
  date, date, text, text, text, date, timestamptz, text, integer
) from public, anon;

grant execute on function public.search_order_history(
  date, date, text, text, text, date, timestamptz, text, integer
) to authenticated;

commit;
