-- Ban accounts that reuse a withdrawal wallet already linked to another user.

alter table public.users
  add column if not exists account_status text not null default 'active'
    check (account_status in ('active', 'banned'));

alter table public.users
  add column if not exists banned_at timestamptz;

alter table public.users
  add column if not exists ban_reason text;

alter table public.users
  add column if not exists wallet_duplicate_of_user_id uuid references public.users(id) on delete set null;

alter table public.users
  add column if not exists wallet_duplicate_address text;

create index if not exists idx_users_account_status on public.users (account_status);

comment on column public.users.account_status is 'active or banned (e.g. duplicate external wallet on a second account).';
