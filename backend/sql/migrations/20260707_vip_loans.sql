-- VIP Farmers loans: borrow against last month's VIP earnings (30% commission),
-- admin approval (up to 2 days), on-platform use only, withdrawal restrictions
-- until fully repaid.

create table if not exists public.vip_loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  investment_id uuid references public.vip_investments(id) on delete set null,
  -- Requested loan amount (what the borrower owes back).
  amount_usd numeric(18, 2) not null check (amount_usd > 0),
  commission_rate numeric(6, 4) not null default 0.30,
  -- 30% commission deducted upfront from the requested amount.
  commission_usd numeric(18, 2) not null default 0 check (commission_usd >= 0),
  -- Amount actually credited to the borrower's cash wallet (amount - commission).
  disbursed_usd numeric(18, 2) not null default 0 check (disbursed_usd >= 0),
  last_month_earnings_usd numeric(18, 2) not null default 0,
  max_loan_usd numeric(18, 2) not null default 0,
  outstanding_usd numeric(18, 2) not null default 0 check (outstanding_usd >= 0),
  repaid_usd numeric(18, 2) not null default 0 check (repaid_usd >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'repaid', 'rejected')),
  admin_note text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  disbursed_at timestamptz,
  repaid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_vip_loans_user on public.vip_loans (user_id, created_at desc);
create index if not exists idx_vip_loans_status on public.vip_loans (status, created_at desc);

comment on table public.vip_loans is
  'VIP Farmers loans against last month''s VIP earnings. 30% commission deducted upfront. Borrower cannot withdraw until fully repaid.';

-- Peer transfers made by a borrower while a loan is outstanding. Loan money moved
-- to another account stays withdrawal-restricted for the recipient unless that
-- account deposited >= $5,000 in the 3 days before the loan was disbursed.
create table if not exists public.vip_loan_fund_transfers (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.vip_loans(id) on delete cascade,
  transfer_id uuid references public.wallet_peer_transfers(id) on delete set null,
  from_user_id uuid not null references public.users(id) on delete cascade,
  to_user_id uuid not null references public.users(id) on delete cascade,
  amount_usd numeric(18, 2) not null check (amount_usd > 0),
  -- true when the recipient deposited >= $5,000 in the 3 days before the loan
  -- was disbursed; such recipients may withdraw the received loan funds.
  recipient_exempt boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_vip_loan_fund_transfers_to_user
  on public.vip_loan_fund_transfers (to_user_id, created_at desc);
create index if not exists idx_vip_loan_fund_transfers_loan
  on public.vip_loan_fund_transfers (loan_id);

comment on table public.vip_loan_fund_transfers is
  'Tracks loan-tainted peer transfers so received loan funds stay withdrawal-restricted while the loan is outstanding.';

-- Allow VIP loan commission in the platform revenue ledger.
alter table public.platform_revenue_events
  drop constraint if exists platform_revenue_events_event_type_check;

alter table public.platform_revenue_events
  add constraint platform_revenue_events_event_type_check
  check (event_type in ('airfarming_drop', 'withdrawal', 'vip_accrual', 'vip_loan_commission'));
