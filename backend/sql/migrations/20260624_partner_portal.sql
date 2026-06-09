-- Partner portal accounts for aare.cc (login separate from Partner API keys).

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
