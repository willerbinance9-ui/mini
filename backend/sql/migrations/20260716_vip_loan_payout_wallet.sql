-- VIP loan: eligibility/principal threshold product rules live in app code.
-- Persist payout destination + borrower tier on each loan request.

alter table public.vip_loans
  add column if not exists payout_destination text not null default 'platform'
    check (payout_destination in ('platform', 'direct_wallet'));

alter table public.vip_loans
  add column if not exists payout_wallet_address text;

alter table public.vip_loans
  add column if not exists borrower_tier text not null default 'standard'
    check (borrower_tier in ('standard', 'new'));

alter table public.vip_loans
  add column if not exists month_earnings_base_usd numeric(18, 2) not null default 0;

alter table public.vip_loans
  add column if not exists haircut_rate numeric(6, 4) not null default 0;

comment on column public.vip_loans.payout_destination is
  'Where disbursed funds should be sent: platform cash wallet or a specified external wallet.';
comment on column public.vip_loans.borrower_tier is
  'standard = completed VIP month (30% commission); new = under one month (50% haircut then 10% commission).';
