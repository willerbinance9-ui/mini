-- Platform-provisioned live trading accounts, per-account wallets, and market price feed.

create sequence if not exists public.live_trading_login_seq start with 80000001 increment by 1;

alter table public.mt5_accounts add column if not exists bot_type text
  check (bot_type is null or bot_type in ('synthetix_ea', 'quantix_ea'));
alter table public.mt5_accounts add column if not exists is_platform_provisioned boolean not null default false;
alter table public.mt5_accounts add column if not exists leverage integer not null default 100;
alter table public.mt5_accounts add column if not exists platform_login_seq bigint;

create index if not exists idx_mt5_accounts_platform_provisioned
  on public.mt5_accounts (user_id, is_platform_provisioned)
  where is_platform_provisioned = true;

create table if not exists public.live_trading_wallets (
  mt5_account_id uuid primary key references public.mt5_accounts(id) on delete cascade,
  balance numeric(18, 2) not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.live_trading_transfers (
  id uuid primary key default gen_random_uuid(),
  mt5_account_id uuid not null references public.mt5_accounts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  direction text not null check (direction in ('to_live', 'to_cash')),
  amount numeric(18, 2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_live_trading_transfers_account_created
  on public.live_trading_transfers (mt5_account_id, created_at desc);

create table if not exists public.market_prices (
  symbol text primary key,
  bid numeric(18, 8) not null,
  ask numeric(18, 8) not null,
  digits smallint not null default 5,
  updated_at timestamptz not null default now()
);

create index if not exists idx_market_prices_updated on public.market_prices (updated_at desc);

create or replace function public.allocate_live_trading_login()
returns bigint
language plpgsql
as $$
declare
  next_val bigint;
begin
  next_val := nextval('public.live_trading_login_seq');
  return next_val;
end;
$$;
