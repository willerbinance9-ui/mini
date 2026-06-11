-- Investor profile for aare.cc partner dashboard.
-- The drops algorithm reads these answers to match opportunities to each investor.

create table if not exists public.partner_portal_investor_profiles (
  id uuid primary key default gen_random_uuid(),
  portal_account_id uuid not null unique references public.partner_portal_accounts(id) on delete cascade,
  motivation text,
  investment_amount numeric(14, 2) check (investment_amount is null or investment_amount >= 0),
  withdrawal_method text check (withdrawal_method is null or withdrawal_method in ('bank', 'crypto')),
  withdrawal_percent numeric(5, 2) check (
    withdrawal_percent is null or (withdrawal_percent >= 0 and withdrawal_percent <= 100)
  ),
  withdrawal_frequency text check (
    withdrawal_frequency is null or withdrawal_frequency in ('weekly', 'biweekly', 'monthly', 'trimester')
  ),
  photo_storage_path text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_portal_investor_profiles_completed
  on public.partner_portal_investor_profiles (completed_at desc)
  where completed_at is not null;

comment on table public.partner_portal_investor_profiles is
  'Investor questionnaire on aare.cc dashboard; drop-generation algorithm uses it to target opportunities.';
