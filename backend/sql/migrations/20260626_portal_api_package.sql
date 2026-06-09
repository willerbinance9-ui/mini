-- Partner API subscription package chosen after application approval.

alter table public.partner_portal_accounts
  add column if not exists api_package text check (
    api_package is null or api_package in ('airfarming_only', 'airfarming_vip', 'full')
  ),
  add column if not exists api_package_selected_at timestamptz;

comment on column public.partner_portal_accounts.api_package is 'Monthly API tier: airfarming_only | airfarming_vip | full';
