-- VIP exit wizard: partial/full revenue withdrawal with admin approval.

alter table public.vip_investments
  add column if not exists revenue_withdrawn_usd numeric(18, 2) not null default 0
    check (revenue_withdrawn_usd >= 0);

-- Relax days_accrued cap for 22 working-day accrual model.
alter table public.vip_investments
  drop constraint if exists vip_investments_days_accrued_check;

alter table public.vip_investments
  add constraint vip_investments_days_accrued_check
    check (days_accrued >= 0 and days_accrued <= 22);

create table if not exists public.vip_exit_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  investment_id uuid not null references public.vip_investments(id) on delete cascade,
  mode text not null check (mode in ('full_stop', 'partial_continue')),
  revenue_percent integer not null check (revenue_percent in (50, 60, 70, 80, 90, 100)),
  destination text not null check (destination in ('platform', 'direct_wallet')),
  wallet_address text,
  principal_usd numeric(18, 2) not null default 0,
  revenue_base_usd numeric(18, 2) not null default 0,
  revenue_selected_usd numeric(18, 2) not null default 0,
  penalty_usd numeric(18, 2) not null default 0,
  gas_fees_usd numeric(18, 2) not null default 0,
  commission_usd numeric(18, 2) not null default 0,
  gas_reward_usd numeric(18, 2) not null default 0,
  net_revenue_usd numeric(18, 2) not null default 0,
  principal_return_usd numeric(18, 2) not null default 0,
  net_total_usd numeric(18, 2) not null default 0,
  working_days integer not null default 0,
  calendar_days integer not null default 0,
  penalty_free boolean not null default false,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'completed')),
  admin_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_vip_exit_requests_user on public.vip_exit_requests (user_id, created_at desc);
create index if not exists idx_vip_exit_requests_status on public.vip_exit_requests (status, created_at desc);

comment on table public.vip_exit_requests is
  'Pending VIP revenue/principal exit requests awaiting admin approval.';
