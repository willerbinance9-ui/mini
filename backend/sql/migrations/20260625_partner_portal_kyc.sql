-- Partner portal: accounts (if missing), phone fields, SMS login challenges, document KYC.
-- Prerequisite tables: public.partners, public.partner_applications (migrations 20260619–20260623).

create extension if not exists citext;

create table if not exists public.partner_portal_accounts (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  password_hash text not null,
  full_name text,
  partner_id uuid references public.partners(id) on delete set null,
  application_id uuid references public.partner_applications(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_partner_portal_accounts_partner_id
  on public.partner_portal_accounts (partner_id)
  where partner_id is not null;

create index if not exists idx_partner_portal_accounts_application_id
  on public.partner_portal_accounts (application_id)
  where application_id is not null;

comment on table public.partner_portal_accounts is 'Self-service login on aare.cc; linked to partnership application and partner tenant when approved.';

alter table public.partner_portal_accounts
  add column if not exists phone text,
  add column if not exists phone_country text,
  add column if not exists country_of_residency text,
  add column if not exists phone_verified_at timestamptz;

create index if not exists idx_partner_portal_accounts_phone
  on public.partner_portal_accounts (phone)
  where phone is not null;

create table if not exists public.partner_portal_login_challenges (
  id uuid primary key default gen_random_uuid(),
  portal_account_id uuid not null references public.partner_portal_accounts(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_partner_portal_login_challenges_account
  on public.partner_portal_login_challenges (portal_account_id, created_at desc);

create table if not exists public.partner_portal_kyc (
  id uuid primary key default gen_random_uuid(),
  portal_account_id uuid not null unique references public.partner_portal_accounts(id) on delete cascade,
  status text not null default 'draft' check (status in (
    'draft', 'submitted', 'ai_reviewing', 'approved', 'rejected', 'manual_review'
  )),
  residence_country text,
  residence_scope text check (residence_scope is null or residence_scope in ('live_only', 'work_only', 'live_and_work')),
  document_type text check (document_type is null or document_type in ('permit_id', 'passport')),
  front_storage_path text,
  back_storage_path text,
  ai_result jsonb,
  ai_confidence numeric(5, 4) check (ai_confidence is null or (ai_confidence >= 0 and ai_confidence <= 1)),
  rejection_reason text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_partner_portal_kyc_status
  on public.partner_portal_kyc (status, updated_at desc);

comment on table public.partner_portal_kyc is 'Identity verification for aare.cc partners before API application.';
comment on table public.partner_portal_login_challenges is 'SMS OTP challenges for portal login.';

-- Supabase Storage: create private bucket "partner-kyc" in dashboard if not using SQL API.
-- insert into storage.buckets (id, name, public) values ('partner-kyc', 'partner-kyc', false) on conflict do nothing;
