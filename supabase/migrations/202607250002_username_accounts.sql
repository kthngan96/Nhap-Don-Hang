begin;

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.username_accounts (
  username text primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint username_accounts_username_format
    check (username = lower(username) and username ~ '^[a-z0-9._-]{3,32}$'),
  constraint username_accounts_display_name_length
    check (char_length(trim(display_name)) between 1 and 120)
);

alter table public.app_admins enable row level security;
alter table public.username_accounts enable row level security;

revoke all on public.app_admins from anon, authenticated;
revoke all on public.username_accounts from anon, authenticated;

insert into public.app_admins (user_id)
select id
from auth.users
where lower(email) = 'huuthi2706@gmail.com'
on conflict (user_id) do nothing;

commit;
