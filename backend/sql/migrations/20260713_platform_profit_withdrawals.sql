-- Superadmin withdrawals from platform profit (ledger debit against fee accruals).

create table if not exists public.platform_profit_withdrawals (
  id uuid primary key default gen_random_uuid(),
  amount_usd numeric(18, 2) not null check (amount_usd > 0),
  note text,
  admin_username text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_platform_profit_withdrawals_created
  on public.platform_profit_withdrawals (created_at desc);

comment on table public.platform_profit_withdrawals is
  'Superadmin removals from platform fee profit. Available profit = sum(platform_revenue_events.fee_amount) - sum(this table).';
