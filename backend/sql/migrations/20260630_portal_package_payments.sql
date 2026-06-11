-- One-time API package purchases via NOWPayments for aare.cc partner accounts.
-- A package is activated when the crypto payment finishes and can never be changed afterwards.

create table if not exists public.partner_portal_package_payments (
  id uuid primary key default gen_random_uuid(),
  portal_account_id uuid not null references public.partner_portal_accounts(id) on delete cascade,
  package text not null check (package in ('airfarming_only', 'airfarming_vip', 'full')),
  app_preference text check (
    app_preference is null or app_preference in ('use_ours', 'own_build_for_me', 'own_independent_dev')
  ),
  amount_usd numeric(10, 2) not null,
  invoice_id text,
  invoice_url text,
  payment_id text,
  payment_status text not null default 'waiting',
  raw_last_ipn jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_portal_package_payments_account
  on public.partner_portal_package_payments (portal_account_id, created_at desc);

create index if not exists idx_portal_package_payments_status
  on public.partner_portal_package_payments (payment_status);

comment on table public.partner_portal_package_payments is
  'NOWPayments invoices for one-time API package purchases; activation locks the package on the portal account.';

-- How the buyer plans to ship their integration: our app, an app we build for them, or their own developer.
alter table public.partner_portal_accounts
  add column if not exists app_preference text check (
    app_preference is null or app_preference in ('use_ours', 'own_build_for_me', 'own_independent_dev')
  );
