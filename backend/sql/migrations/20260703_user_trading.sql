-- User trading desk: allocated balance + MT5-style deal history (admin-managed).

create table if not exists public.user_trading_wallets (
  user_id uuid primary key references public.users(id) on delete cascade,
  balance numeric(18, 2) not null default 0 check (balance >= 0),
  allocated_total numeric(18, 2) not null default 0 check (allocated_total >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_trading_deals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  ticket text not null,
  symbol text not null,
  side text not null check (side in ('buy', 'sell')),
  volume numeric(12, 2) not null check (volume > 0),
  open_price numeric(18, 5) not null,
  close_price numeric(18, 5),
  profit numeric(18, 2) not null default 0,
  swap numeric(18, 2) not null default 0,
  commission numeric(18, 2) not null default 0,
  status text not null default 'open' check (status in ('open', 'closed')),
  opened_at timestamptz not null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, ticket)
);

create index if not exists idx_user_trading_deals_user_status
  on public.user_trading_deals (user_id, status, opened_at desc);

create index if not exists idx_user_trading_deals_user_closed
  on public.user_trading_deals (user_id, closed_at desc nulls last);

comment on table public.user_trading_wallets is
  'Cash allocated by the user for MT5-style trading balance.';
comment on table public.user_trading_deals is
  'Open and closed trading deals shown in the app (managed from superadmin).';
