begin;

do $$
declare
  target_user_id uuid;
  target_email text;
  target_display_name text;
  huuthi_user_id uuid;
  settings_count integer;
  orders_count integer;
  reports_count integer;
  openings_count integer;
begin
  select user_id, display_name
  into target_user_id, target_display_name
  from public.username_accounts
  where username = 'nhanhtv234';

  if target_user_id is null then
    raise exception 'Cannot delete account: username nhanhtv234 was not found';
  end if;

  select lower(email)
  into target_email
  from auth.users
  where id = target_user_id;

  if target_email is distinct from 'nhanhtv234@nhap-don-hang.local' then
    raise exception
      'Cannot delete account: unexpected internal email for nhanhtv234 (%)',
      coalesce(target_email, 'missing');
  end if;

  select id
  into huuthi_user_id
  from auth.users
  where lower(email) = 'huuthi2706@gmail.com'
  limit 1;

  if target_user_id = huuthi_user_id then
    raise exception 'Cannot delete account: target resolves to the Huu Thi account';
  end if;

  if exists (
    select 1
    from public.app_admins
    where user_id = target_user_id
  ) then
    raise exception 'Cannot delete account: nhanhtv234 is an application administrator';
  end if;

  select count(*)::integer
  into settings_count
  from public.user_settings
  where user_id = target_user_id;

  select count(*)::integer
  into orders_count
  from public.orders
  where user_id = target_user_id;

  select count(*)::integer
  into reports_count
  from public.daily_reports
  where user_id = target_user_id;

  select count(*)::integer
  into openings_count
  from public.monthly_report_openings
  where user_id = target_user_id;

  raise notice
    'Deleting username=% display_name=% settings=% orders=% reports=% openings=%',
    'nhanhtv234',
    target_display_name,
    settings_count,
    orders_count,
    reports_count,
    openings_count;

  delete from auth.users
  where id = target_user_id;

  if not found then
    raise exception 'Cannot delete account: auth user disappeared before deletion';
  end if;

  if exists (
    select 1
    from public.username_accounts
    where username = 'nhanhtv234'
  ) then
    raise exception 'Cannot delete account: username row still exists after auth deletion';
  end if;
end
$$;

commit;
