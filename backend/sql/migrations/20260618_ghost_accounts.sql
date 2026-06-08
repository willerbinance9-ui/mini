-- Ghost Account: shared pool for funding member airfarming drops.

create table if not exists public.ghost_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users(id) on delete cascade,
  pool_balance numeric(18, 2) not null default 0 check (pool_balance >= 0),
  allocated_total numeric(18, 2) not null default 0 check (allocated_total >= 0),
  status text not null default 'active' check (status in ('active', 'paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id)
);

create table if not exists public.ghost_account_members (
  id uuid primary key default gen_random_uuid(),
  ghost_account_id uuid not null references public.ghost_accounts(id) on delete cascade,
  member_user_id uuid not null references public.users(id) on delete cascade,
  added_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (ghost_account_id, member_user_id),
  unique (member_user_id)
);

create table if not exists public.ghost_account_lends (
  id uuid primary key default gen_random_uuid(),
  ghost_account_id uuid not null references public.ghost_accounts(id) on delete cascade,
  member_user_id uuid not null references public.users(id) on delete cascade,
  drop_id uuid not null references public.airfarming_drops(id) on delete cascade,
  lend_amount numeric(18, 2) not null default 0 check (lend_amount >= 0),
  projected_profit_gross numeric(18, 2) not null default 0,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'lent', 'recalled', 'failed')),
  fail_reason text,
  lent_at timestamptz,
  recalled_at timestamptz,
  recalled_principal numeric(18, 2) not null default 0,
  recalled_profit_net numeric(18, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (drop_id)
);

create index if not exists idx_ghost_account_lends_account_status
  on public.ghost_account_lends (ghost_account_id, status);

create index if not exists idx_ghost_account_lends_member
  on public.ghost_account_lends (member_user_id, status);

create table if not exists public.ghost_account_ledger (
  id uuid primary key default gen_random_uuid(),
  ghost_account_id uuid not null references public.ghost_accounts(id) on delete cascade,
  direction text not null check (direction in ('allocate', 'deallocate', 'lend', 'recall')),
  amount numeric(18, 2) not null check (amount > 0),
  related_lend_id uuid references public.ghost_account_lends(id) on delete set null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ghost_account_ledger_account
  on public.ghost_account_ledger (ghost_account_id, created_at desc);
