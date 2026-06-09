-- Partner API: third-party apps register users under isolated partner tenants.
-- Platform users (partner_id IS NULL) are unchanged.

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug citext not null,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slug)
);

create table if not exists public.partner_api_keys (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  name text not null default 'default',
  key_prefix text not null,
  key_hash text not null,
  scopes text[] not null default array['users', 'compliance', 'airfarming', 'wallet', 'deposits', 'withdrawals', 'vip', 'webhooks']::text[],
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  unique (key_prefix)
);

create index if not exists idx_partner_api_keys_partner_id on public.partner_api_keys(partner_id);

alter table public.users
  add column if not exists partner_id uuid references public.partners(id) on delete restrict;

alter table public.users
  add column if not exists partner_external_ref text;

-- Replace global email uniqueness with tenant-scoped rules.
alter table public.users drop constraint if exists users_email_key;

create unique index if not exists users_platform_email_unique
  on public.users (email)
  where partner_id is null;

create unique index if not exists users_partner_email_unique
  on public.users (partner_id, email)
  where partner_id is not null;

create unique index if not exists users_partner_external_ref_unique
  on public.users (partner_id, partner_external_ref)
  where partner_id is not null and partner_external_ref is not null;

create index if not exists idx_users_partner_id on public.users(partner_id);

comment on column public.users.partner_id is 'NULL = Ema platform user (legacy app). Set = partner-registered user.';
comment on column public.users.partner_external_ref is 'Partner-supplied stable id for the user in their system.';
