-- User-to-user P2P marketplace (USDT escrow + manual fiat settlement)

create table if not exists public.p2p_merchant_profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  enabled boolean not null default false,
  side text not null check (side in ('sell_usdt', 'buy_usdt')),
  price_per_usdt numeric(18, 4) not null check (price_per_usdt > 0),
  fiat_currency text not null,
  country_code text not null,
  limit_min_fiat numeric(18, 2) not null default 0 check (limit_min_fiat >= 0),
  limit_max_fiat numeric(18, 2) not null check (limit_max_fiat > 0),
  payment_name text not null default '',
  payment_phone text not null default '',
  bank_name text not null default '',
  bank_account text not null default '',
  notes text not null default '',
  completed_trades integer not null default 0 check (completed_trades >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_p2p_merchant_profiles_enabled
  on public.p2p_merchant_profiles (enabled, country_code)
  where enabled = true;

create table if not exists public.p2p_trades (
  id uuid primary key default gen_random_uuid(),
  merchant_user_id uuid not null references public.users(id) on delete cascade,
  counterparty_user_id uuid not null references public.users(id) on delete cascade,
  merchant_side text not null check (merchant_side in ('sell_usdt', 'buy_usdt')),
  fiat_amount numeric(18, 2) not null check (fiat_amount > 0),
  crypto_amount numeric(24, 8) not null check (crypto_amount > 0),
  price_per_usdt numeric(18, 4) not null check (price_per_usdt > 0),
  fiat_currency text not null,
  country_code text not null,
  status text not null default 'awaiting_fiat'
    check (status in ('awaiting_fiat', 'fiat_sent', 'completed', 'cancelled', 'disputed')),
  usdt_sender_id uuid not null references public.users(id) on delete cascade,
  usdt_receiver_id uuid not null references public.users(id) on delete cascade,
  fiat_payer_id uuid not null references public.users(id) on delete cascade,
  fiat_payee_id uuid not null references public.users(id) on delete cascade,
  fiat_payee_snapshot jsonb not null default '{}'::jsonb,
  ledger_escrow_posted boolean not null default false,
  fiat_sent_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint p2p_trades_distinct_users check (merchant_user_id <> counterparty_user_id)
);

create index if not exists idx_p2p_trades_merchant on public.p2p_trades (merchant_user_id, created_at desc);
create index if not exists idx_p2p_trades_counterparty on public.p2p_trades (counterparty_user_id, created_at desc);
create index if not exists idx_p2p_trades_status on public.p2p_trades (status, created_at desc);

alter table public.crypto_ledger_entries
  drop constraint if exists crypto_ledger_entries_source_check;

alter table public.crypto_ledger_entries
  add constraint crypto_ledger_entries_source_check
  check (
    source in (
      'payment',
      'payout',
      'reserve',
      'reserve_release',
      'local_withdraw',
      'local_deposit',
      'local_withdraw_refund',
      'cash_wallet',
      'cash_wallet_refund',
      'admin_adjustment',
      'airfarming_auto_fund',
      'p2p_escrow_lock',
      'p2p_escrow_release',
      'p2p_escrow_refund'
    )
  );
