-- Platform revenue ledger: fees on drop payouts, withdrawals, and VIP accruals.

create table if not exists public.platform_revenue_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null
    check (event_type in ('airfarming_drop', 'withdrawal', 'vip_accrual')),
  user_id uuid references public.users(id) on delete set null,
  source_id text not null,
  gross_amount numeric(18, 2) not null check (gross_amount >= 0),
  fee_rate numeric(10, 4) not null check (fee_rate >= 0 and fee_rate <= 1),
  fee_amount numeric(18, 2) not null check (fee_amount >= 0),
  net_amount numeric(18, 2) not null check (net_amount >= 0),
  currency text not null default 'USD',
  meta jsonb,
  event_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (event_type, source_id)
);

create index if not exists idx_platform_revenue_events_at
  on public.platform_revenue_events (event_at desc);
create index if not exists idx_platform_revenue_events_type_at
  on public.platform_revenue_events (event_type, event_at desc);

comment on table public.platform_revenue_events is
  'Platform fee accruals: 10% airfarming drop payouts, 5% withdrawals, 3% VIP daily interest (gross basis).';
